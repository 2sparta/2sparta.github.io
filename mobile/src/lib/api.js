import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { cached, enqueue, isOnline, readCache, readQueue, wipeUser, writeCache, writeQueue } from "./offline";

function s(v, fallback = "") {
  if (v == null) return fallback;
  return String(v);
}

function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function clampPoints(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.trunc(n)));
}

function user() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return u;
}

function appRole(role) {
  if (role === "student") return "student";
  if (role === "parent") return "parent";
  if (role === "teacher" || role === "admin" || role === "pending-teacher") return "teacher";
  return null;
}

export function kyivToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

export function kyivClock() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Kyiv",
  });
}

export function kyivWeekday() {
  const map = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" };
  const short = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Kyiv" });
  return map[short] ?? "mon";
}

function isoWeekKey() {
  const iso = kyivToday();
  const d = new Date(`${iso}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function minutesOf(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];

async function bySchool(name, schoolId) {
  const snap = await getDocs(query(collection(db, name), where("schoolId", "==", schoolId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function findRoster(uid, rosterId) {
  if (rosterId) {
    const snap = await getDoc(doc(db, "students", rosterId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  }
  for (const field of ["authUid", "linkedUserId"]) {
    const snap = await getDocs(query(collection(db, "students"), where(field, "==", uid)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}

export async function loadProfile() {
  const u = user();
  const snap = await getDoc(doc(db, "users", u.uid));
  const d = snap.exists() ? snap.data() : null;
  const isParent = d?.role === "parent";
  const childId = isParent ? s(d?.childRosterId || d?.rosterId) : "";
  let roster = null;
  if (isParent) {
    if (childId) {
      const child = await getDoc(doc(db, "students", childId));
      if (child.exists()) roster = { id: child.id, ...child.data() };
    }
  } else {
    roster = await findRoster(u.uid, d?.rosterId ? s(d.rosterId) : d?.studentId ? s(d.studentId) : null);
  }
  let schoolName = d?.schoolName ? s(d.schoolName) : null;
  const schoolId = d?.schoolId ? s(d.schoolId) : roster?.schoolId ? s(roster.schoolId) : null;
  if (!schoolName && schoolId) {
    const school = await getDoc(doc(db, "schools", schoolId));
    schoolName = school.exists() ? s(school.data().name) : null;
  }
  const classId = d?.classId ? s(d.classId) : roster?.classId ? s(roster.classId) : null;
  let className = roster?.className ? s(roster.className) : null;
  if (!className && classId) {
    const klass = await getDoc(doc(db, "classes", classId));
    className = klass.exists() ? s(klass.data().name) : null;
  }
  const role = isParent ? "parent" : appRole(d?.role) || (roster ? "student" : null);
  const setupComplete =
    d?.setupComplete === true ||
    (d?.setupComplete == null && Boolean(schoolId) && (d?.role === "admin" || d?.role === "teacher"));
  return {
    userId: u.uid,
    role,
    displayName: s(d?.displayName) || s(u.displayName) || s(roster?.name) || s(u.email).split("@")[0],
    schoolId,
    classId,
    groupId: d?.groupId ? s(d.groupId) : roster?.groupId ? s(roster.groupId) : null,
    rosterId: roster ? roster.id : d?.rosterId ? s(d.rosterId) : null,
    isAdmin: d?.role === "admin" || d?.isAdmin === true,
    isStarosta: !isParent && roster?.isStarosta === true,
    setupComplete,
    email: s(d?.email) || s(u.email) || null,
    schoolName,
    className,
    points: clampPoints(Number(roster?.points ?? 0) || 0),
    linked: Boolean(roster),
    office: isParent || !roster?.office ? null : s(roster.office),
    budget: isParent ? 0 : clampPoints(Number(roster?.budget) || 0),
    canPostHw: !isParent && roster?.canPostHw === true,
    childName: isParent && roster ? s(roster.name) : null,
  };
}

export async function loadProfileCached() {
  const u = user();
  try {
    const p = await loadProfile();
    await writeCache(u.uid, "profile", p);
    return p;
  } catch (err) {
    const hit = await readCache(u.uid, "profile");
    if (hit) return hit.data;
    throw err;
  }
}

export function nextStep(p) {
  if (!p?.role) return "role";
  if (p.role === "teacher") {
    if (!p.schoolId) return "school";
    if (!p.setupComplete) return "setup";
    return "app";
  }
  if (p.role === "parent") return p.linked ? "app" : "link";
  if (!p.linked) return "link";
  return "app";
}

export async function chooseRole(role, displayName) {
  const u = user();
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return loadProfile();
  const name = (displayName || "").trim() || u.displayName || (u.email ?? "").split("@")[0];
  await setDoc(ref, {
    role: role === "student" ? "student" : role === "parent" ? "parent" : "pending-teacher",
    displayName: name,
    email: u.email,
    schoolId: null,
    classId: null,
    groupId: null,
    rosterId: null,
    isAdmin: false,
    setupComplete: false,
    createdAt: Date.now(),
  });
  return loadProfile();
}

async function chatIndex(schoolId) {
  const school = await getDoc(doc(db, "schools", schoolId));
  const raw = school.data()?.chatIds;
  return Array.isArray(raw) ? raw : [];
}

export async function linkStudent(code) {
  await mustOnline();
  const clean = String(code || "").replace(/\s+/g, "");
  const u = user();
  const snap = await getDocs(query(collection(db, "students"), where("inviteCode", "==", clean)));
  if (snap.empty) throw new Error("CODE_NOT_FOUND");
  const row = snap.docs[0];
  const taken = row.data().authUid || row.data().linkedUserId;
  if (taken && taken !== u.uid) throw new Error("CODE_USED");
  await updateDoc(row.ref, { authUid: u.uid, linkedUserId: u.uid });
  const d = row.data();
  const userRef = doc(db, "users", u.uid);
  const existing = await getDoc(userRef);
  const patch = {
    role: "student",
    displayName: s(d.name) || (u.email ?? "").split("@")[0],
    email: u.email,
    schoolId: d.schoolId ?? null,
    classId: d.classId ?? null,
    groupId: d.groupId ?? null,
    rosterId: row.id,
    isAdmin: false,
    setupComplete: true,
  };
  if (existing.exists()) await updateDoc(userRef, patch);
  else await setDoc(userRef, { ...patch, createdAt: Date.now() });
  if (d.schoolId) {
    const chats = await chatIndex(s(d.schoolId));
    for (const c of chats) {
      const classOk = !c.classId || c.classId === s(d.classId);
      if (c.kind !== "teachers" && classOk) {
        await updateDoc(doc(db, "chats", c.id), { memberUids: arrayUnion(u.uid) });
      }
    }
  }
  return loadProfile();
}

export async function linkParent(code) {
  await mustOnline();
  const clean = String(code || "").replace(/\s+/g, "");
  const u = user();
  const snap = await getDocs(query(collection(db, "students"), where("inviteCode", "==", clean)));
  if (snap.empty) throw new Error("CODE_NOT_FOUND");
  const row = snap.docs[0];
  const d = row.data();
  await updateDoc(row.ref, { parentUids: arrayUnion(u.uid) });
  const userRef = doc(db, "users", u.uid);
  const existing = await getDoc(userRef);
  const patch = {
    role: "parent",
    displayName: existing.exists() && s(existing.data().displayName) ? s(existing.data().displayName) : (u.email ?? "").split("@")[0],
    email: u.email,
    schoolId: d.schoolId ?? null,
    classId: d.classId ?? null,
    groupId: d.groupId ?? null,
    rosterId: row.id,
    childRosterId: row.id,
    isAdmin: false,
    setupComplete: true,
  };
  if (existing.exists()) await updateDoc(userRef, patch);
  else await setDoc(userRef, { ...patch, createdAt: Date.now() });
  return loadProfile();
}

export async function joinSchool(code, displayName) {
  await mustOnline();
  const u = user();
  const clean = String(code || "").replace(/\s+/g, "").toUpperCase();
  const invRef = doc(db, "teacherInvites", clean);
  const inv = await getDoc(invRef);
  if (!inv.exists()) throw new Error("CODE_NOT_FOUND");
  if (inv.data().usedBy) throw new Error("CODE_USED");
  const schoolId = s(inv.data().schoolId);
  const display = (displayName || "").trim() || u.displayName || (u.email ?? "").split("@")[0];
  await updateDoc(invRef, { usedBy: u.uid });
  const userRef = doc(db, "users", u.uid);
  const existing = await getDoc(userRef);
  const school = await getDoc(doc(db, "schools", schoolId));
  const patch = {
    role: "teacher",
    displayName: display,
    email: u.email,
    schoolId,
    schoolName: school.exists() ? s(school.data().name) : "",
    isAdmin: false,
    setupComplete: false,
  };
  if (existing.exists()) await updateDoc(userRef, patch);
  else {
    await setDoc(userRef, { ...patch, role: "pending-teacher", createdAt: Date.now() });
    await updateDoc(userRef, { role: "teacher" });
  }
  const chats = await chatIndex(schoolId);
  for (const c of chats) {
    if (c.kind === "teachers" || c.kind === "school") {
      await updateDoc(doc(db, "chats", c.id), { memberUids: arrayUnion(u.uid) });
    }
  }
  return loadProfile();
}

export async function listSubjects(profile) {
  const rows = await bySchool("subjects", profile.schoolId);
  return rows
    .map((r) => ({ id: s(r.id), name: s(r.name), room: s(r.room), meetLink: s(r.meetLink) }))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

export async function completeSetup(profile, { displayName, isAdmin, subjectIds }) {
  await mustOnline();
  const u = user();
  const name = (displayName || "").trim();
  if (!name) throw new Error("NAME");
  const admin = Boolean(isAdmin);
  const ids = subjectIds ?? [];
  if (!admin && ids.length === 0) throw new Error("SUBJECTS");
  await updateDoc(doc(db, "users", u.uid), {
    displayName: name,
    isAdmin: admin,
    setupComplete: true,
    ...(admin ? { role: "admin" } : {}),
  });
  const subjects = await bySchool("subjects", profile.schoolId);
  for (const sub of subjects) {
    const has = Array.isArray(sub.teacherIds) && sub.teacherIds.includes(u.uid);
    const want = ids.includes(s(sub.id));
    if (want && !has) await updateDoc(doc(db, "subjects", s(sub.id)), { teacherIds: arrayUnion(u.uid) });
    if (!want && has) await updateDoc(doc(db, "subjects", s(sub.id)), { teacherIds: arrayRemove(u.uid) });
  }
  return loadProfile();
}

function mapSchedule(r) {
  const subjectId = r.subjectId ? s(r.subjectId) : null;
  const subjectName = r.subjectName ? s(r.subjectName) : null;
  return {
    id: s(r.id),
    classId: s(r.classId),
    groupId: r.groupId ? s(r.groupId) : null,
    weekday: s(r.weekday),
    period: Number(r.period) || 0,
    startTime: s(r.startTime),
    endTime: s(r.endTime),
    subjectId,
    subjectName,
    room: s(r.room),
    meetLink: s(r.meetLink),
    overrideSubjectId: r.overrideSubjectId ? s(r.overrideSubjectId) : null,
    overrideSubjectName: r.overrideSubjectName ? s(r.overrideSubjectName) : null,
    overrideWeek: r.overrideWeek ? s(r.overrideWeek) : null,
    customTimes: r.customTimes === true,
    shownSubjectId: subjectId,
    shownSubjectName: subjectName,
  };
}

function decorate(entries, subjects) {
  const week = isoWeekKey();
  const byId = new Map(subjects.map((sub) => [s(sub.id), sub]));
  return entries.map((e) => {
    const base = e.subjectId ? byId.get(e.subjectId) : undefined;
    let meetLink = (base ? s(base.meetLink) : "") || e.meetLink;
    let room = (base ? s(base.room) : "") || e.room;
    let shownSubjectId = e.subjectId;
    let shownSubjectName = e.subjectName;
    if (e.overrideWeek === week && (e.overrideSubjectId || e.overrideSubjectName)) {
      shownSubjectId = e.overrideSubjectId;
      shownSubjectName = e.overrideSubjectName || e.overrideSubjectId;
      const over = shownSubjectId ? byId.get(shownSubjectId) : undefined;
      if (over) {
        meetLink = s(over.meetLink) || meetLink;
        room = s(over.room) || room;
      }
    }
    return { ...e, room, meetLink, shownSubjectId, shownSubjectName };
  });
}

async function scheduleFor(profile, classId) {
  const subjects = await bySchool("subjects", profile.schoolId);
  const rows = await bySchool("schedule", profile.schoolId);
  let cid = classId || profile.classId || "";
  if (!cid) {
    const classes = await bySchool("classes", profile.schoolId);
    classes.sort((a, b) => s(a.name).localeCompare(s(b.name), "uk"));
    cid = classes[0] ? s(classes[0].id) : "";
  }
  let entries = rows.filter((r) => s(r.classId) === cid).map(mapSchedule);
  let groupId = profile.role === "student" || profile.role === "parent" ? profile.groupId || "" : "";
  const known = [...new Set(entries.map((e) => e.groupId).filter(Boolean))];
  if (!groupId && known.length) groupId = known[0];
  if (groupId) entries = entries.filter((e) => !e.groupId || e.groupId === groupId);
  entries.sort((a, b) => a.weekday.localeCompare(b.weekday) || a.period - b.period);
  return decorate(entries, subjects);
}

export async function listClasses(profile) {
  return cached(profile.userId, "classes", async () => {
    const groups = await bySchool("groups", profile.schoolId);
    const classes = (await bySchool("classes", profile.schoolId))
      .map((c) => ({
        id: s(c.id),
        name: s(c.name),
        groups: groups
          .filter((g) => s(g.classId) === s(c.id))
          .map((g) => ({ id: s(g.id), name: s(g.name) })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
    return { classes };
  });
}

export async function addLesson(profile, input) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  const title = (input.title || "").trim();
  if (!title || !input.subjectId) throw new Error("Required");
  const sub = await getDoc(doc(db, "subjects", input.subjectId));
  if (!sub.exists()) throw new Error("Not found");
  const id = newId();
  const homework = Boolean(input.homeworkDue);
  await setDoc(doc(db, "lessons", id), {
    schoolId: profile.schoolId,
    subjectId: input.subjectId,
    subjectName: s(sub.data().name),
    teacherId: profile.userId,
    title,
    content: input.content || "",
    lessonDate: input.lessonDate || kyivToday(),
    hasHomework: homework,
    homeworkDue: input.homeworkDue || null,
    classIds: input.classIds || [],
    publishAt: null,
    addedByStarosta: false,
    imageUrls: [],
    createdAt: Date.now(),
  });
  return { id };
}

export async function addAnnouncement(profile, input) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  const title = (input.title || "").trim();
  const body = (input.body || "").trim();
  const classIds = [...new Set((input.classIds || []).filter(Boolean))];
  if (!title || !body || classIds.length === 0) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db, "announcements", id), {
    schoolId: profile.schoolId,
    authorId: profile.userId,
    authorName: profile.displayName,
    title,
    body,
    createdAt: new Date().toISOString(),
    classIds,
    important: input.important === true,
  });
  return { id };
}

export async function getHome(profile) {
  return cached(profile.userId, "home", async () => {
    const day = kyivWeekday();
    const entries = await scheduleFor(profile);
    const today = entries.filter((e) => e.weekday === day).sort((a, b) => a.period - b.period);
    return { today, weekday: day, date: kyivToday() };
  });
}

export async function getSchedule(profile, classId) {
  return cached(profile.userId, `schedule:${classId || "me"}`, async () => ({ entries: await scheduleFor(profile, classId) }));
}

export async function listLessons(profile) {
  return cached(profile.userId, "lessons", async () => {
    let lessons = (await bySchool("lessons", profile.schoolId)).map((r) => ({
      id: s(r.id),
      subjectId: s(r.subjectId),
      subjectName: s(r.subjectName),
      title: s(r.title),
      content: s(r.content),
      lessonDate: s(r.lessonDate).slice(0, 10),
      hasHomework: r.hasHomework === true,
      homeworkDue: r.homeworkDue ? s(r.homeworkDue).slice(0, 10) : null,
      classIds: Array.isArray(r.classIds) ? r.classIds.map((id) => s(id)) : [],
      publishAt: r.publishAt ? s(r.publishAt) : null,
      imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls.map((u) => s(u)).filter(Boolean).slice(0, 4) : [],
    }));
    lessons.sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
    if ((profile.role === "student" || profile.role === "parent") && profile.classId) {
      const now = Date.now();
      lessons = lessons.filter((l) => l.classIds.length === 0 || l.classIds.includes(profile.classId));
      lessons = lessons.filter((l) => !l.publishAt || new Date(l.publishAt).getTime() <= now);
    }
    let doneIds = [];
    if (profile.rosterId) {
      const st = await getDoc(doc(db, "students", profile.rosterId));
      doneIds = Array.isArray(st.data()?.doneLessonIds) ? st.data().doneLessonIds : [];
    }
    return { lessons: lessons.slice(0, 80), doneIds };
  });
}

export async function toggleHomeworkDone(profile, lessonId, done) {
  if (!profile.rosterId) throw new Error("Not linked");
  const apply = async () => {
    await updateDoc(doc(db, "students", profile.rosterId), {
      doneLessonIds: done ? arrayUnion(lessonId) : arrayRemove(lessonId),
    });
  };
  if (!(await isOnline())) {
    await enqueue(profile.userId, { op: "homework", lessonId, done });
    return { queued: true };
  }
  await apply();
  return { queued: false };
}

export async function listGrades(profile) {
  return cached(profile.userId, "grades", async () => {
    const students = await bySchool("students", profile.schoolId);
    const names = new Map(students.map((r) => [s(r.id), s(r.name)]));
    let rows = await bySchool("grades", profile.schoolId);
    if (profile.role === "student" || profile.role === "parent") {
      if (!profile.rosterId) return { grades: [] };
      rows = rows.filter((g) => s(g.rosterId) === profile.rosterId);
    }
    const grades = rows
      .map((g) => ({
        id: s(g.id),
        studentName: names.get(s(g.rosterId)) || "",
        subjectName: s(g.subjectName),
        kind: s(g.kind) || "lesson",
        value: s(g.value),
        comment: s(g.comment),
        createdAt: s(g.createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { grades: grades.slice(0, 80) };
  });
}

export async function listLeaderboard(profile) {
  return cached(profile.userId, "points", async () => {
    const rows = await bySchool("students", profile.schoolId);
    const people = rows
      .map((r) => ({
        id: s(r.id),
        name: s(r.name),
        className: s(r.className),
        points: clampPoints(Number(r.points) || 0),
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "uk"));
    return { people };
  });
}

export async function adjustPoints(profile, rosterId, delta) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  const ref = doc(db, "students", rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== profile.schoolId) throw new Error("Not found");
  const current = clampPoints(Number(snap.data().points) || 0);
  const next = clampPoints(current + Number(delta || 0));
  const applied = next - current;
  if (!applied) throw new Error("Limit");
  await updateDoc(ref, { points: next });
  await setDoc(doc(db, "pointsHistory", newId()), {
    schoolId: profile.schoolId,
    rosterId,
    delta: applied,
    note: "",
    byUserId: profile.userId,
    byName: profile.displayName || "",
    pointsAfter: next,
    createdAt: Date.now(),
  });
}

export async function listAnnouncements(profile) {
  return cached(profile.userId, "news", async () => {
    let list = (await bySchool("announcements", profile.schoolId))
      .filter((r) => s(r.kind) !== "activity")
      .map((r) => ({
        id: s(r.id),
        title: s(r.title),
        body: s(r.body),
        authorName: s(r.authorName) || "—",
        createdAt: s(r.createdAt),
        classIds: Array.isArray(r.classIds) ? r.classIds.map((id) => s(id)) : [],
        important: r.important === true,
      }));
    if ((profile.role === "student" || profile.role === "parent") && profile.classId) list = list.filter((a) => a.classIds.includes(profile.classId));
    list.sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));
    return { announcements: list.slice(0, 40) };
  });
}

export async function listActivities(profile) {
  return cached(profile.userId, "activities", async () => {
    let list = (await bySchool("announcements", profile.schoolId))
      .filter((r) => s(r.kind) === "activity")
      .map((r) => ({
        id: s(r.id),
        title: s(r.title),
        body: s(r.body),
        authorName: s(r.authorName) || "—",
        createdAt: s(r.createdAt),
        classIds: Array.isArray(r.classIds) ? r.classIds.map((id) => s(id)) : [],
        important: r.important === true,
      }));
    if (profile.classId) list = list.filter((a) => a.classIds.includes(profile.classId));
    list.sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));
    return { activities: list.slice(0, 40) };
  });
}

export async function getElection(profile) {
  return cached(profile.userId, "election", async () => {
    if (!profile.classId) return { election: null };
    const rows = (await bySchool("elections", profile.schoolId)).filter((e) => s(e.classId) === profile.classId);
    const open = rows.find((e) => e.closed !== true);
    if (!open) return { election: null };
    const votes = open.votes || {};
    const candidates = Array.isArray(open.candidates) ? open.candidates : [];
    const counts = {};
    for (const cand of Object.values(votes)) counts[cand] = (counts[cand] || 0) + 1;
    return {
      election: {
        id: s(open.id),
        endsAt: s(open.endsAt),
        myVote: profile.rosterId ? votes[profile.rosterId] || null : null,
        candidates: candidates.map((c) => ({
          rosterId: c.rosterId,
          name: c.name,
          votes: counts[c.rosterId] || 0,
        })),
      },
    };
  });
}

export async function voteElection(profile, electionId, candidateId) {
  await mustOnline();
  if (!profile.rosterId) throw new Error("Not linked");
  const ref = doc(db, "elections", electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const votes = { ...(snap.data().votes || {}) };
  votes[profile.rosterId] = candidateId;
  await updateDoc(ref, { votes });
}

export async function listChats(profile) {
  return cached(profile.userId, "chats", async () => {
    const snap = await getDocs(query(collection(db, "chats"), where("memberUids", "array-contains", profile.userId)));
    const chats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => s(c.schoolId) === profile.schoolId)
      .map((r) => ({
        id: s(r.id),
        kind: s(r.kind),
        name: s(r.name),
        lastBody: r.lastBody ? s(r.lastBody) : "",
        lastAt: r.lastAt ? s(r.lastAt) : "",
      }))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return { chats };
  });
}

export async function listMessages(profile, chatId) {
  return cached(profile.userId, `chat:${chatId}`, async () => {
    const chat = await getDoc(doc(db, "chats", chatId));
    const members = chat.data()?.memberUids ?? [];
    if (!members.includes(profile.userId)) throw new Error("Forbidden");
    const snap = await getDocs(query(collection(db, "chatMessages"), where("chatId", "==", chatId)));
    const messages = snap.docs
      .map((d) => ({
        id: d.id,
        authorId: s(d.data().senderUid),
        authorName: s(d.data().authorName) || "—",
        body: d.data().deleted === true ? "" : s(d.data().body),
        createdAt: s(d.data().createdAt),
        deleted: d.data().deleted === true,
        subjectName: s(d.data().subjectName),
        imageUrls: d.data().deleted === true || !Array.isArray(d.data().imageUrls) ? [] : d.data().imageUrls.map((u) => s(u)).filter(Boolean),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-80);
    return { messages, kind: s(chat.data()?.kind) };
  });
}

export async function sendMessage(profile, chatId, body) {
  const text = body.trim();
  if (!text) throw new Error("Empty");
  const payload = {
    chatId,
    senderUid: profile.userId,
    authorName: profile.displayName,
    body: text,
    subjectName: "",
    imageUrls: [],
    pinned: false,
    deleted: false,
  };
  if (!(await isOnline())) {
    await enqueue(profile.userId, { op: "message", payload });
    return { queued: true };
  }
  await writeMessage(payload);
  return { queued: false };
}

async function writeMessage(payload) {
  const id = newId();
  const createdAt = new Date().toISOString();
  await setDoc(doc(db, "chatMessages", id), { ...payload, createdAt });
  await updateDoc(doc(db, "chats", payload.chatId), { lastBody: payload.body, lastAt: createdAt });
}

async function mustOnline() {
  if (!(await isOnline())) {
    const err = new Error("OFFLINE");
    err.code = "OFFLINE";
    throw err;
  }
}

export async function flushQueue(profile) {
  if (!profile?.userId || !(await isOnline())) return;
  const list = await readQueue(profile.userId);
  if (!list.length) return;
  const left = [];
  for (const item of list) {
    try {
      if (item.op === "message") await writeMessage(item.payload);
      else if (item.op === "homework" && profile.rosterId) {
        await updateDoc(doc(db, "students", profile.rosterId), {
          doneLessonIds: item.done ? arrayUnion(item.lessonId) : arrayRemove(item.lessonId),
        });
      }
    } catch {
      left.push(item);
    }
  }
  await writeQueue(profile.userId, left);
}

export async function logout() {
  const uid = auth.currentUser?.uid;
  await signOut(auth);
  await wipeUser(uid);
}
