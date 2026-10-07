import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import { isOnline } from "./offline";
import { kyivToday } from "./api";

function s(v, fallback = "") {
  return v == null ? fallback : String(v);
}

function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function teacherCode() {
  let out = "";
  for (let i = 0; i < 16; i++) out += ALPH[Math.floor(Math.random() * ALPH.length)];
  return out;
}

function studentCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function mustOnline() {
  if (!(await isOnline())) {
    const err = new Error("OFFLINE");
    err.code = "OFFLINE";
    throw err;
  }
}

function teacher(profile) {
  if (profile.role !== "teacher") throw new Error("Forbidden");
}

const BELLS = [
  ["08:30", "09:15"],
  ["09:25", "10:10"],
  ["10:20", "11:05"],
  ["11:25", "12:10"],
  ["12:20", "13:05"],
];

async function bySchool(name, schoolId) {
  const snap = await getDocs(query(collection(db, name), where("schoolId", "==", schoolId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addClass(profile, name) {
  await mustOnline();
  teacher(profile);
  const title = name.trim();
  if (!title) throw new Error("Required");
  const classId = newId();
  const groupId = newId();
  const batch = writeBatch(db);
  batch.set(doc(db, "classes", classId), { schoolId: profile.schoolId, name: title, createdAt: Date.now() });
  batch.set(doc(db, "groups", groupId), { schoolId: profile.schoolId, classId, name: "1 група" });
  for (const day of ["mon", "tue", "wed", "thu", "fri"]) {
    BELLS.forEach(([start, end], i) => {
      batch.set(doc(db, "schedule", newId()), {
        schoolId: profile.schoolId,
        classId,
        groupId,
        weekday: day,
        period: i + 1,
        startTime: start,
        endTime: end,
        subjectId: null,
        subjectName: null,
        room: "",
      });
    });
  }
  await batch.commit();
  return { id: classId };
}

export async function addGroup(profile, classId, name) {
  await mustOnline();
  teacher(profile);
  const title = name.trim();
  if (!classId || !title) throw new Error("Required");
  const id = newId();
  const existing = (await bySchool("schedule", profile.schoolId)).filter((r) => s(r.classId) === classId);
  const sourceGroup = existing.find((r) => r.groupId)?.groupId;
  const source = sourceGroup ? existing.filter((r) => s(r.groupId) === s(sourceGroup)) : existing;
  const batch = writeBatch(db);
  batch.set(doc(db, "groups", id), { schoolId: profile.schoolId, classId, name: title });
  const seen = new Set();
  for (const row of source) {
    const key = `${s(row.weekday)}:${row.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    batch.set(doc(db, "schedule", newId()), {
      schoolId: profile.schoolId,
      classId,
      groupId: id,
      weekday: s(row.weekday),
      period: Number(row.period) || 1,
      startTime: s(row.startTime),
      endTime: s(row.endTime),
      subjectId: null,
      subjectName: null,
      room: "",
      customTimes: row.customTimes === true,
    });
  }
  await batch.commit();
  return { id };
}

export async function addStudent(profile, { name, classId, groupId }) {
  await mustOnline();
  teacher(profile);
  const title = (name || "").trim();
  if (!title || !classId) throw new Error("Required");
  const klass = await getDoc(doc(db, "classes", classId));
  const groups = (await bySchool("groups", profile.schoolId)).filter((g) => s(g.classId) === classId);
  const group = groups.find((g) => s(g.id) === groupId) ?? groups[0];
  const id = newId();
  const code = studentCode();
  await setDoc(doc(db, "students", id), {
    schoolId: profile.schoolId,
    classId,
    className: klass.exists() ? s(klass.data().name) : "",
    groupId: group ? s(group.id) : null,
    groupName: group ? s(group.name) : null,
    group: group ? s(group.id) : null,
    name: title,
    points: 0,
    inviteCode: code,
    authUid: null,
    linkedUserId: null,
    isStarosta: false,
    doneLessonIds: [],
    createdAt: Date.now(),
  });
  return { id, inviteCode: code };
}

export async function deleteStudent(profile, rosterId) {
  await mustOnline();
  teacher(profile);
  await deleteDoc(doc(db, "students", rosterId));
}

export async function setStarosta(profile, rosterId, on) {
  await mustOnline();
  teacher(profile);
  const ref = doc(db, "students", rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const classId = s(snap.data().classId);
  if (on && classId) {
    const mates = (await bySchool("students", profile.schoolId)).filter((st) => s(st.classId) === classId);
    const batch = writeBatch(db);
    for (const st of mates) batch.update(doc(db, "students", s(st.id)), { isStarosta: s(st.id) === rosterId });
    await batch.commit();
  } else {
    await updateDoc(ref, { isStarosta: false });
  }
}

export async function setScheduleSubject(profile, entryId, subjectId) {
  await mustOnline();
  teacher(profile);
  let subjectName = null;
  let room = "";
  let meetLink = "";
  if (subjectId) {
    const sub = await getDoc(doc(db, "subjects", subjectId));
    if (sub.exists()) {
      subjectName = s(sub.data().name);
      room = s(sub.data().room);
      meetLink = s(sub.data().meetLink);
    }
  }
  await updateDoc(doc(db, "schedule", entryId), { subjectId: subjectId || null, subjectName, room, meetLink });
}

export async function setWeekOverride(profile, entryId, subjectId) {
  await mustOnline();
  teacher(profile);
  if (!subjectId) {
    await updateDoc(doc(db, "schedule", entryId), { overrideSubjectId: null, overrideSubjectName: null, overrideWeek: null });
    return;
  }
  const sub = await getDoc(doc(db, "subjects", subjectId));
  const iso = kyivToday();
  const d = new Date(`${iso}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const week = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  await updateDoc(doc(db, "schedule", entryId), {
    overrideSubjectId: subjectId,
    overrideSubjectName: sub.exists() ? s(sub.data().name) : subjectId,
    overrideWeek: week,
  });
}

export async function addSchedulePeriod(profile, classId, groupId) {
  await mustOnline();
  teacher(profile);
  const rows = (await bySchool("schedule", profile.schoolId)).filter(
    (r) => s(r.classId) === classId && (!groupId || !r.groupId || s(r.groupId) === groupId),
  );
  const max = rows.reduce((m, r) => Math.max(m, Number(r.period) || 0), 0);
  const next = max + 1;
  const bell = BELLS[next - 1];
  const start = bell?.[0] ?? "15:00";
  const end = bell?.[1] ?? "15:45";
  const batch = writeBatch(db);
  for (const weekday of ["mon", "tue", "wed", "thu", "fri"]) {
    batch.set(doc(db, "schedule", newId()), {
      schoolId: profile.schoolId,
      classId,
      groupId: groupId || null,
      weekday,
      period: next,
      startTime: start,
      endTime: end,
      subjectId: null,
      subjectName: null,
      room: "",
    });
  }
  await batch.commit();
}

export async function setGrade(profile, { rosterId, subjectId, value, kind, comment }) {
  await mustOnline();
  teacher(profile);
  const sub = await getDoc(doc(db, "subjects", subjectId));
  const subjectName = sub.exists() ? s(sub.data().name) : "";
  const raw = String(value).trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (n < 1 || n > 12) throw new Error("Оцінка має бути від 1 до 12");
  }
  const id = newId();
  await setDoc(doc(db, "grades", id), {
    schoolId: profile.schoolId,
    rosterId,
    subjectId,
    subjectName,
    lessonId: null,
    kind: kind || "lesson",
    value: String(value).trim(),
    comment: comment || "",
    finalPeriod: null,
    createdAt: new Date().toISOString(),
  });
}

export async function updateSubject(profile, subjectId, patch) {
  await mustOnline();
  teacher(profile);
  const next = {};
  if (patch.room != null) next.room = patch.room.trim();
  if (patch.meetLink != null) next.meetLink = patch.meetLink.trim();
  if (patch.name != null) next.name = patch.name.trim();
  if (patch.studentsCanAddHw != null) next.studentsCanAddHw = patch.studentsCanAddHw;
  await updateDoc(doc(db, "subjects", subjectId), next);
}

export async function addSubject(profile, { name, room, meetLink }) {
  await mustOnline();
  teacher(profile);
  const title = (name || "").trim();
  if (!title) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db, "subjects", id), {
    schoolId: profile.schoolId,
    name: title,
    room: (room || "").trim(),
    meetLink: (meetLink || "").trim(),
    studentsCanAddHw: false,
    teacherIds: [profile.userId],
  });
  return { id };
}

export async function deleteLesson(profile, lessonId) {
  await mustOnline();
  teacher(profile);
  await deleteDoc(doc(db, "lessons", lessonId));
}

export async function deleteAnnouncement(profile, id) {
  await mustOnline();
  teacher(profile);
  await deleteDoc(doc(db, "announcements", id));
}

export async function addActivity(profile, { title, body, classIds, important }) {
  await mustOnline();
  const name = (title || "").trim();
  const text = (body || "").trim();
  const ids = [...new Set((classIds || []).filter(Boolean))];
  const starosta = profile.role === "student" && profile.isStarosta;
  if (profile.role !== "teacher" && !starosta) throw new Error("Forbidden");
  if (starosta && profile.classId) ids.splice(0, ids.length, profile.classId);
  if (!name || !text || ids.length === 0) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db, "announcements", id), {
    schoolId: profile.schoolId,
    kind: "activity",
    classId: ids[0],
    classIds: ids,
    important: important === true,
    authorId: profile.userId,
    authorName: profile.displayName,
    title: name,
    body: text,
    createdAt: new Date().toISOString(),
  });
}

export async function runForElection(profile, electionId) {
  await mustOnline();
  if (!profile.rosterId) throw new Error("Not linked");
  const ref = doc(db, "elections", electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const candidates = Array.isArray(snap.data().candidates) ? [...snap.data().candidates] : [];
  if (!candidates.some((c) => c.rosterId === profile.rosterId)) {
    candidates.push({ rosterId: profile.rosterId, name: profile.displayName });
    await updateDoc(ref, { candidates });
  }
}

export async function announceElection(profile, classId) {
  await mustOnline();
  teacher(profile);
  const today = kyivToday();
  const id = newId();
  await setDoc(doc(db, "elections", id), {
    schoolId: profile.schoolId,
    classId,
    startsAt: today,
    endsAt: today,
    closed: false,
    winnerRosterId: null,
    candidates: [],
    votes: {},
  });
}

export async function closeElection(profile, electionId) {
  await mustOnline();
  teacher(profile);
  const ref = doc(db, "elections", electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const votes = snap.data().votes || {};
  const counts = {};
  for (const cand of Object.values(votes)) counts[cand] = (counts[cand] || 0) + 1;
  let winner = null;
  let best = -1;
  for (const [id, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      winner = id;
    }
  }
  await updateDoc(ref, { closed: true, winnerRosterId: winner });
  if (winner) await setStarosta(profile, winner, true);
}

export async function pinMessage(profile, messageId, pinned) {
  await mustOnline();
  await updateDoc(doc(db, "chatMessages", messageId), { pinned: pinned, pinnedAt: pinned ? Date.now() : null });
}

export async function editMessage(profile, messageId, body) {
  await mustOnline();
  const text = body.trim();
  if (!text) throw new Error("Empty");
  const ref = doc(db, "chatMessages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().senderUid !== profile.userId) throw new Error("Forbidden");
  await updateDoc(ref, { body: text, editedAt: Date.now() });
}

export async function deleteMessage(profile, messageId) {
  await mustOnline();
  const ref = doc(db, "chatMessages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().senderUid !== profile.userId) throw new Error("Forbidden");
  await updateDoc(ref, { deleted: true, body: "", imageUrls: [] });
}

export async function listNotices(profile) {
  const uid = auth.currentUser?.uid || profile.userId;
  const snap = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", uid)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      title: s(d.data().title),
      body: s(d.data().body),
      createdAt: Number(d.data().createdAt) || 0,
      read: d.data().read === true,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40);
}

export async function markNoticesRead(profile) {
  await mustOnline();
  const uid = auth.currentUser?.uid || profile.userId;
  const snap = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", uid)));
  const batch = writeBatch(db);
  snap.docs.filter((d) => d.data().read !== true).slice(0, 400).forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function listTeachers(profile) {
  teacher(profile);
  const users = await bySchool("users", profile.schoolId);
  return users
    .filter((t) => t.role === "teacher" || t.role === "admin")
    .map((t) => ({
      userId: s(t.id),
      displayName: s(t.displayName) || s(t.email),
      isAdmin: t.role === "admin" || t.isAdmin === true,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "uk"));
}

export async function generateTeacherInvite(profile) {
  await mustOnline();
  if (!profile.isAdmin) throw new Error("Forbidden");
  const code = teacherCode();
  await setDoc(doc(db, "teacherInvites", code), {
    schoolId: profile.schoolId,
    createdBy: profile.userId,
    usedBy: null,
    createdAt: new Date().toISOString(),
  });
  return { code };
}

export async function listPointsHistory(profile, rosterId) {
  const wanted = profile.role === "student" ? profile.rosterId : rosterId;
  if (!wanted) return [];
  const rows = await bySchool("pointsHistory", profile.schoolId);
  return rows
    .filter((r) => s(r.rosterId) === wanted)
    .map((r) => ({
      id: s(r.id),
      delta: Number(r.delta) || 0,
      note: s(r.note),
      byName: s(r.byName),
      createdAt: Number(r.createdAt) || 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
}

export async function addStarostaHomework(profile, { subjectId, title, content, homeworkDue }) {
  await mustOnline();
  if (!profile.isStarosta) throw new Error("Forbidden");
  const name = (title || "").trim();
  if (!name || !subjectId || !homeworkDue) throw new Error("Required");
  const sub = await getDoc(doc(db, "subjects", subjectId));
  if (!sub.exists() || sub.data().studentsCanAddHw !== true) throw new Error("Not allowed");
  const id = newId();
  await setDoc(doc(db, "lessons", id), {
    schoolId: profile.schoolId,
    subjectId,
    subjectName: s(sub.data().name),
    teacherId: profile.userId,
    title: name,
    content: content || "",
    lessonDate: kyivToday(),
    hasHomework: true,
    homeworkDue,
    classIds: profile.classId ? [profile.classId] : [],
    publishAt: null,
    addedByStarosta: true,
    imageUrls: [],
    createdAt: Date.now(),
  });
}
