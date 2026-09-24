import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  DEFAULT_BELLS,
  isoWeekKey,
  kyivToday,
  kyivWeekday,
  newId,
  studentInviteCode,
  teacherInviteCode,
  WEEKDAYS,
} from "./ids";
import type {
  Announcement,
  ChatMessage,
  ChatSummary,
  Election,
  Grade,
  Lesson,
  Notice,
  Profile,
  RosterStudent,
  ScheduleEntry,
  SchoolClass,
  Subject,
} from "./types";

type Bag = DocumentData;

function dataOf<T>(input?: { data?: T } | null): T | undefined {
  if (input && typeof input === "object" && "data" in input) return input.data;
  return undefined;
}

function user() {
  const u = auth().currentUser;
  if (!u) throw new Error("Not signed in");
  return u;
}

function s(v: unknown, fallback = "") {
  if (v == null) return fallback;
  return String(v);
}

function appRole(role: unknown): Profile["role"] {
  if (role === "student") return "student";
  if (role === "teacher" || role === "admin" || role === "pending-teacher") return "teacher";
  return null;
}

async function findRoster(uid: string, rosterId?: string | null): Promise<Bag | null> {
  const fire = db();
  if (rosterId) {
    const snap = await getDoc(doc(fire, "students", rosterId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  }
  for (const field of ["authUid", "linkedUserId"] as const) {
    const snap = await getDocs(query(collection(fire, "students"), where(field, "==", uid)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}

export async function loadProfile(uid?: string): Promise<Profile> {
  const u = uid ? { uid, email: auth().currentUser?.email ?? null, displayName: auth().currentUser?.displayName ?? "" } : user();
  const id = u.uid;
  const fire = db();
  const snap = await getDoc(doc(fire, "users", id));
  const d = snap.exists() ? snap.data() : null;
  const roster = await findRoster(id, d?.rosterId ? s(d.rosterId) : null);
  let schoolName: string | null = d?.schoolName ? s(d.schoolName) : null;
  const schoolId = d?.schoolId ? s(d.schoolId) : roster?.schoolId ? s(roster.schoolId) : null;
  if (!schoolName && schoolId) {
    const school = await getDoc(doc(fire, "schools", schoolId));
    schoolName = school.exists() ? s(school.data().name) : null;
  }
  const classId = d?.classId ? s(d.classId) : roster?.classId ? s(roster.classId) : null;
  let className: string | null = roster?.className ? s(roster.className) : null;
  if (!className && classId) {
    const klass = await getDoc(doc(fire, "classes", classId));
    className = klass.exists() ? s(klass.data().name) : null;
  }
  const role = appRole(d?.role);
  const setupComplete =
    d?.setupComplete === true ||
    (d?.setupComplete == null && Boolean(schoolId) && (d?.role === "admin" || d?.role === "teacher"));
  return {
    userId: id,
    role,
    displayName: s(d?.displayName) || s(u.displayName) || s(roster?.name) || s(u.email).split("@")[0],
    schoolId,
    classId,
    groupId: d?.groupId ? s(d.groupId) : roster?.groupId ? s(roster.groupId) : null,
    rosterId: roster ? roster.id : d?.rosterId ? s(d.rosterId) : null,
    isAdmin: d?.role === "admin" || d?.isAdmin === true,
    isStarosta: roster?.isStarosta === true,
    setupComplete,
    email: s(d?.email) || s(u.email) || null,
    schoolName,
    className,
    points: clampPoints(Number(roster?.points ?? 0) || 0),
    linked: Boolean(roster),
  };
}

function clampPoints(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.trunc(n)));
}

function nextStep(p: Profile): "role" | "school" | "setup" | "link" | "app" {
  if (!p.role) return "role";
  if (p.role === "teacher") {
    if (!p.schoolId) return "school";
    if (!p.setupComplete) return "setup";
    return "app";
  }
  if (!p.linked) return "link";
  return "app";
}

async function requireProfile() {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Join a school first");
  return p;
}

async function requireTeacher() {
  const p = await requireProfile();
  if (p.role !== "teacher") throw new Error("Teacher access required");
  return p;
}

function canTeach(p: Profile, teacherIds: unknown): boolean {
  if (p.isAdmin) return true;
  if (!Array.isArray(teacherIds) || teacherIds.length === 0) return true;
  return teacherIds.includes(p.userId);
}

async function assertSubject(p: Profile, subjectId: string) {
  const sub = await getDoc(doc(db(), "subjects", subjectId));
  if (!sub.exists() || sub.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (!canTeach(p, sub.data().teacherIds)) throw new Error("SUBJECT");
  return sub;
}

async function saveChatIndex(schoolId: string, chats: { id: string; kind: string; classId: string | null }[]) {
  await updateDoc(doc(db(), "schools", schoolId), {
    chatIds: chats.map((c) => ({ id: c.id, kind: c.kind, classId: c.classId })),
  });
}

async function chatIndex(schoolId: string) {
  const school = await getDoc(doc(db(), "schools", schoolId));
  const raw = school.data()?.chatIds;
  return Array.isArray(raw) ? (raw as { id: string; kind: string; classId: string | null }[]) : [];
}

async function bySchool(name: string, schoolId: string): Promise<Bag[]> {
  const snap = await getDocs(query(collection(db(), name), where("schoolId", "==", schoolId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMe() {
  const profile = await loadProfile();
  return { profile, nextStep: nextStep(profile) };
}

export async function chooseRole(input?: { data?: { role: "teacher" | "student"; displayName?: string } }) {
  const data = dataOf(input);
  const u = user();
  const ref = doc(db(), "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return loadProfile();
  const role = data?.role === "student" ? "student" : "pending-teacher";
  const displayName = (data?.displayName ?? "").trim() || u.displayName || (u.email ?? "").split("@")[0];
  await setDoc(ref, {
    role,
    displayName,
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

const SUBJECTS = [
  { name: "Українська мова", room: "12" },
  { name: "Математика", room: "21" },
  { name: "Англійська мова", room: "8" },
  { name: "Історія України", room: "15" },
  { name: "Біологія", room: "4" },
];

const DEMO_STUDENTS = [
  { name: "Максим Коваленко", points: 245 },
  { name: "Оля Шевченко", points: 198 },
  { name: "Андрій Мельник", points: 176 },
  { name: "Софія Бондар", points: 154 },
  { name: "Данило Ткаченко", points: 132 },
  { name: "Марія Іваненко", points: 121 },
];

async function seedSchool(schoolId: string, adminUid: string, adminName: string) {
  const fire = db();
  const batch = writeBatch(fire);
  const classId = newId();
  const groupId = newId();
  batch.set(doc(fire, "classes", classId), { schoolId, name: "8-А", createdAt: Date.now() });
  batch.set(doc(fire, "groups", groupId), { schoolId, classId, name: "1 група" });

  const subjectIds: string[] = [];
  for (const sub of SUBJECTS) {
    const id = newId();
    subjectIds.push(id);
    batch.set(doc(fire, "subjects", id), {
      schoolId,
      name: sub.name,
      room: sub.room,
      meetLink: "",
      studentsCanAddHw: false,
      teacherIds: [adminUid],
    });
  }

  const roster: { id: string; name: string }[] = [];
  const used = new Set<string>();
  for (const st of DEMO_STUDENTS) {
    let code = studentInviteCode();
    while (used.has(code)) code = studentInviteCode();
    used.add(code);
    const id = newId();
    roster.push({ id, name: st.name });
    batch.set(doc(fire, "students", id), {
      schoolId,
      classId,
      className: "8-А",
      groupId,
      groupName: "1 група",
      group: groupId,
      name: st.name,
      points: st.points,
      inviteCode: code,
      authUid: null,
      linkedUserId: null,
      isStarosta: st.name.startsWith("Максим"),
      doneLessonIds: [],
      createdAt: Date.now(),
    });
  }

  const bells = DEFAULT_BELLS.slice(0, 5);
  const workdays = WEEKDAYS.slice(0, 5);
  for (let d = 0; d < workdays.length; d++) {
    for (let p = 0; p < bells.length; p++) {
      const subjectId = subjectIds[(p + d) % subjectIds.length];
      const subject = SUBJECTS[(p + d) % SUBJECTS.length];
      batch.set(doc(fire, "schedule", newId()), {
        schoolId,
        classId,
        groupId,
        weekday: workdays[d],
        period: p + 1,
        startTime: bells[p].start,
        endTime: bells[p].end,
        subjectId,
        subjectName: subject.name,
        room: subject.room,
      });
    }
  }

  const today = kyivToday();
  const tomorrow = shiftDate(today, 1);
  const lessonSpecs = [
    { subject: 0, title: "Складні речення", content: "Опрацювати §14. Вправи 1–4 письмово.", date: today, hw: tomorrow },
    { subject: 1, title: "Квадратні рівняння", content: "Формула коренів. Розв'язати завдання 12–18.", date: today, hw: tomorrow },
    { subject: 2, title: "Present Perfect", content: "Read the text on page 46 and answer the questions.", date: today, hw: null as string | null },
  ];
  const lessonIds: string[] = [];
  for (const spec of lessonSpecs) {
    const id = newId();
    lessonIds.push(id);
    batch.set(doc(fire, "lessons", id), {
      schoolId,
      subjectId: subjectIds[spec.subject],
      subjectName: SUBJECTS[spec.subject].name,
      teacherId: adminUid,
      title: spec.title,
      content: spec.content,
      lessonDate: spec.date,
      hasHomework: Boolean(spec.hw),
      homeworkDue: spec.hw,
      classIds: [classId],
      createdAt: Date.now(),
    });
  }

  const sample = [
    [0, 0, "11"],
    [0, 1, "10"],
    [0, 2, "12"],
    [0, 3, "9"],
    [0, 4, "11"],
    [1, 0, "10"],
    [1, 1, "11"],
    [2, 1, "9"],
    [2, 2, "8"],
  ] as const;
  for (const [ri, si, value] of sample) {
    batch.set(doc(fire, "grades", newId()), {
      schoolId,
      rosterId: roster[ri].id,
      subjectId: subjectIds[si],
      subjectName: SUBJECTS[si].name,
      lessonId: lessonIds[0],
      kind: "lesson",
      value,
      comment: "",
      createdAt: new Date().toISOString(),
    });
  }

  batch.set(doc(fire, "announcements", newId()), {
    schoolId,
    authorId: adminUid,
    authorName: adminName || "Учитель",
    title: "Вітаємо у Класному просторі",
    body: "Школу створено. Додайте вчителів за кодом на вкладці «Вчителі» та роздайте учням їхні коди-запрошення.",
    createdAt: new Date().toISOString(),
    classIds: [],
  });

  const chats: { id: string; kind: string; name: string; classId: string | null; body: string }[] = [
    {
      id: newId(),
      kind: "school",
      name: "Вся школа",
      classId: null,
      body: adminName ? `Вітаю! Я ${adminName}. Пишіть сюди загальні новини школи.` : "Вітаю в шкільному чаті!",
    },
    {
      id: newId(),
      kind: "class",
      name: "8-А",
      classId,
      body: "Нагадування: завтра контрольна з математики. Повторіть §12.",
    },
    {
      id: newId(),
      kind: "teachers",
      name: "Учительський чат",
      classId: null,
      body: "Чат для вчителів.",
    },
  ];
  for (const c of chats) {
    batch.set(doc(fire, "chats", c.id), {
      schoolId,
      kind: c.kind,
      name: c.name,
      classId: c.classId,
      memberUids: [adminUid],
      isAuto: true,
      createdBy: adminUid,
      lastBody: c.body,
      lastAt: new Date().toISOString(),
    });
  }
  await batch.commit();

  for (const c of chats) {
    await setDoc(doc(fire, "chatMessages", newId()), {
      chatId: c.id,
      senderUid: adminUid,
      authorName: adminName || "Учитель",
      body: c.body,
      createdAt: new Date().toISOString(),
    });
  }

  return { classId, groupId, maksymId: roster[0].id, chats };
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createSchool(input?: { data?: { name: string; displayName?: string } }) {
  const data = dataOf(input);
  const u = user();
  const name = (data?.name ?? "").trim();
  if (!name) throw new Error("School name required");
  const display = (data?.displayName ?? "").trim() || u.displayName || (u.email ?? "").split("@")[0] || name;
  const ref = doc(db(), "users", u.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      role: "pending-teacher",
      displayName: display,
      email: u.email,
      schoolId: null,
      isAdmin: false,
      setupComplete: false,
      createdAt: Date.now(),
    });
  }
  const schoolId = newId();
  await setDoc(doc(db(), "schools", schoolId), {
    name,
    createdBy: u.uid,
    creatorEmail: u.email,
    createdAt: Date.now(),
  });
  await updateDoc(ref, {
    role: "admin",
    displayName: display,
    email: u.email,
    schoolId,
    schoolName: name,
    isAdmin: true,
    setupComplete: true,
  });
  const seeded = await seedSchool(schoolId, u.uid, display);
  await saveChatIndex(schoolId, seeded.chats);
  return loadProfile();
}

export async function joinSchool(input?: { data?: { code: string; displayName?: string } }) {
  const data = dataOf(input);
  const u = user();
  const code = (data?.code ?? "").replace(/\s+/g, "").toUpperCase();
  const invRef = doc(db(), "teacherInvites", code);
  const inv = await getDoc(invRef);
  if (!inv.exists()) throw new Error("CODE_NOT_FOUND");
  if (inv.data().usedBy) throw new Error("CODE_USED");
  const schoolId = s(inv.data().schoolId);
  const display = (data?.displayName ?? "").trim() || u.displayName || (u.email ?? "").split("@")[0];
  await updateDoc(invRef, { usedBy: u.uid });
  const userRef = doc(db(), "users", u.uid);
  const existing = await getDoc(userRef);
  const school = await getDoc(doc(db(), "schools", schoolId));
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
      await updateDoc(doc(db(), "chats", c.id), { memberUids: arrayUnion(u.uid) });
    }
  }
  return loadProfile();
}

export async function completeSetup(input?: { data?: { displayName: string; isAdmin: boolean; subjectIds: string[] } }) {
  const data = dataOf(input);
  const p = await requireTeacher();
  const u = user();
  const name = (data?.displayName ?? "").trim();
  if (!name) throw new Error("NAME");
  const admin = p.isAdmin ? Boolean(data?.isAdmin) : false;
  const subjectIds = data?.subjectIds ?? [];
  if (!admin && subjectIds.length === 0) throw new Error("SUBJECTS");
  await updateDoc(doc(db(), "users", u.uid), {
    displayName: name,
    isAdmin: admin,
    setupComplete: true,
    ...(admin ? { role: "admin" } : {}),
  });
  const subjects = await bySchool("subjects", p.schoolId!);
  for (const sub of subjects) {
    const ids = Array.isArray(sub.teacherIds) ? (sub.teacherIds as string[]) : [];
    const has = ids.includes(u.uid);
    const want = subjectIds.includes(s(sub.id));
    if (want && !has) await updateDoc(doc(db(), "subjects", s(sub.id)), { teacherIds: arrayUnion(u.uid) });
    if (!want && has) await updateDoc(doc(db(), "subjects", s(sub.id)), { teacherIds: arrayRemove(u.uid) });
  }
  return loadProfile();
}

export async function linkStudent(input?: { data?: { code: string } }) {
  const code = (dataOf(input)?.code ?? "").replace(/\s+/g, "");
  const u = user();
  const snap = await getDocs(query(collection(db(), "students"), where("inviteCode", "==", code)));
  if (snap.empty) throw new Error("CODE_NOT_FOUND");
  const row = snap.docs[0];
  const taken = row.data().authUid || row.data().linkedUserId;
  if (taken && taken !== u.uid) throw new Error("CODE_USED");
  await updateDoc(row.ref, { authUid: u.uid, linkedUserId: u.uid });
  const d = row.data();
  const userRef = doc(db(), "users", u.uid);
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
        await updateDoc(doc(db(), "chats", c.id), { memberUids: arrayUnion(u.uid) });
      }
    }
  }
  return loadProfile();
}

export async function enterDemoAsStudent() {
  const u = user();
  const existing = await loadProfile();
  if (existing.linked && existing.role === "student") return existing;
  const schoolId = newId();
  const display = u.displayName || (u.email ?? "").split("@")[0] || "Класний керівник";
  await setDoc(doc(db(), "schools", schoolId), {
    name: "Ліцей №1",
    createdBy: u.uid,
    creatorEmail: u.email,
    createdAt: Date.now(),
  });
  const seeded = await seedSchool(schoolId, u.uid, display);
  const maksym = await getDoc(doc(db(), "students", seeded.maksymId));
  await updateDoc(maksym.ref, { authUid: u.uid, linkedUserId: u.uid });
  const userRef = doc(db(), "users", u.uid);
  const userSnap = await getDoc(userRef);
  const patch = {
    role: "student",
    displayName: s(maksym.data()?.name) || "Максим Коваленко",
    email: u.email,
    schoolId,
    schoolName: "Ліцей №1",
    classId: seeded.classId,
    groupId: seeded.groupId,
    rosterId: seeded.maksymId,
    isAdmin: false,
    setupComplete: true,
  };
  if (userSnap.exists()) await updateDoc(userRef, patch);
  else await setDoc(userRef, { ...patch, createdAt: Date.now() });
  await saveChatIndex(schoolId, seeded.chats);
  for (const c of seeded.chats) {
    if (c.kind === "teachers") {
      await updateDoc(doc(db(), "chats", c.id), { memberUids: arrayRemove(u.uid) });
    }
  }
  return loadProfile();
}

export async function getHome() {
  const profile = await loadProfile();
  if (!profile.schoolId) return { profile, nextStep: nextStep(profile), stats: null, today: [] as ScheduleEntry[] };
  const day = kyivWeekday();
  const [students, subjects, schedule] = await Promise.all([
    bySchool("students", profile.schoolId),
    bySchool("subjects", profile.schoolId),
    bySchool("schedule", profile.schoolId),
  ]);
  const today = schedule
    .filter((e) => {
      if (s(e.weekday) !== day) return false;
      if (profile.classId && s(e.classId) !== profile.classId) return false;
      if (profile.groupId && e.groupId && s(e.groupId) !== profile.groupId) return false;
      return true;
    })
    .map(mapSchedule)
    .sort((a, b) => a.period - b.period);
  const shown = decorate(today, subjects);
  return {
    profile,
    nextStep: nextStep(profile),
    stats: {
      students: students.length,
      subjects: subjects.length,
      lessonsToday: shown.filter((e) => e.shownSubjectId).length,
      linked: students.filter((st) => st.authUid || st.linkedUserId).length,
      linkedTotal: students.length,
      points: profile.points,
      todayDate: kyivToday(),
      weekday: day,
    },
    today: shown,
  };
}

function inGroup(r: Bag, groupId?: string | null) {
  if (!groupId) return true;
  const g = r.groupId ? s(r.groupId) : "";
  return g === "" || g === groupId;
}

function mapGrade(r: Bag): Grade {
  const kind = s(r.kind) || "lesson";
  return {
    id: s(r.id),
    rosterId: s(r.rosterId),
    subjectId: s(r.subjectId),
    subjectName: s(r.subjectName),
    lessonId: r.lessonId ? s(r.lessonId) : null,
    kind: (kind === "homework" || kind === "final" ? kind : "lesson") as Grade["kind"],
    value: s(r.value),
    comment: s(r.comment),
    createdAt: s(r.createdAt),
    finalPeriod: r.finalPeriod ? s(r.finalPeriod) : null,
  };
}

function decorate(entries: ScheduleEntry[], subjects: Bag[]): ScheduleEntry[] {
  const week = isoWeekKey();
  const byId = new Map(subjects.map((sub) => [s(sub.id), sub]));
  return entries.map((e) => {
    const base = e.subjectId ? byId.get(e.subjectId) : undefined;
    let meetLink = e.meetLink || (base ? s(base.meetLink) : "");
    let room = e.room || (base ? s(base.room) : "");
    let shownSubjectId = e.subjectId;
    let shownSubjectName = e.subjectName;
    let overrideOn = false;
    if (e.overrideWeek === week && (e.overrideSubjectId || e.overrideSubjectName)) {
      shownSubjectId = e.overrideSubjectId;
      shownSubjectName = e.overrideSubjectName || e.overrideSubjectId;
      overrideOn = true;
      const over = shownSubjectId ? byId.get(shownSubjectId) : undefined;
      if (over) {
        meetLink = s(over.meetLink) || meetLink;
        room = s(over.room) || room;
      }
    }
    return { ...e, room, meetLink, shownSubjectId, shownSubjectName, overrideOn };
  });
}

function mapSchedule(r: Bag): ScheduleEntry {
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
    customTimes: r.customTimes === true,
    overrideSubjectId: r.overrideSubjectId ? s(r.overrideSubjectId) : null,
    overrideSubjectName: r.overrideSubjectName ? s(r.overrideSubjectName) : null,
    overrideWeek: r.overrideWeek ? s(r.overrideWeek) : null,
    shownSubjectId: subjectId,
    shownSubjectName: subjectName,
    overrideOn: false,
  };
}

export async function listClasses() {
  const p = await requireProfile();
  const classes = await bySchool("classes", p.schoolId!);
  const groups = await bySchool("groups", p.schoolId!);
  return classes
    .map((c) => ({
      id: s(c.id),
      name: s(c.name),
      groups: groups
        .filter((g) => s(g.classId) === s(c.id))
        .map((g) => ({ id: s(g.id), name: s(g.name) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "uk")) satisfies SchoolClass[];
}

export async function addClass(input?: { data?: { name: string } }) {
  const p = await requireTeacher();
  const name = (dataOf(input)?.name ?? "").trim();
  if (!name) throw new Error("Name required");
  const classId = newId();
  const groupId = newId();
  const fire = db();
  const batch = writeBatch(fire);
  batch.set(doc(fire, "classes", classId), { schoolId: p.schoolId, name, createdAt: Date.now() });
  batch.set(doc(fire, "groups", groupId), { schoolId: p.schoolId, classId, name: "1 група" });
  const bells = DEFAULT_BELLS.slice(0, 5);
  for (const day of ["mon", "tue", "wed", "thu", "fri"]) {
    for (let i = 0; i < bells.length; i++) {
      batch.set(doc(fire, "schedule", newId()), {
        schoolId: p.schoolId,
        classId,
        groupId,
        weekday: day,
        period: i + 1,
        startTime: bells[i].start,
        endTime: bells[i].end,
        subjectId: null,
        subjectName: null,
        room: "",
      });
    }
  }
  await batch.commit();
  return { id: classId };
}

export async function listSubjects() {
  const p = await requireProfile();
  const rows = await bySchool("subjects", p.schoolId!);
  const subjects: Subject[] = rows
    .map((r) => ({
      id: s(r.id),
      name: s(r.name),
      room: s(r.room),
      meetLink: s(r.meetLink),
      studentsCanAddHw: r.studentsCanAddHw === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const mine = rows.filter((r) => Array.isArray(r.teacherIds) && (r.teacherIds as string[]).includes(p.userId)).map((r) => s(r.id));
  return { subjects, mine };
}

export async function addSubject(input?: { data?: { name: string; room?: string; meetLink?: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  if (!name) throw new Error("Name required");
  const id = newId();
  await setDoc(doc(db(), "subjects", id), {
    schoolId: p.schoolId,
    name,
    room: (data?.room ?? "").trim(),
    meetLink: (data?.meetLink ?? "").trim(),
    studentsCanAddHw: false,
    teacherIds: [p.userId],
  });
  return { id };
}

export async function listStudents() {
  const p = await requireTeacher();
  const rows = await bySchool("students", p.schoolId!);
  return rows
    .map((r) => ({
      id: s(r.id),
      name: s(r.name),
      classId: s(r.classId),
      className: s(r.className),
      groupId: r.groupId ? s(r.groupId) : null,
      groupName: r.groupName ? s(r.groupName) : null,
      points: clampPoints(Number(r.points) || 0),
      inviteCode: s(r.inviteCode),
      linkedUserId: r.linkedUserId ? s(r.linkedUserId) : r.authUid ? s(r.authUid) : null,
      isStarosta: r.isStarosta === true,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "uk")) satisfies RosterStudent[];
}

export async function addStudent(input?: { data?: { name: string; classId: string; groupId?: string | null } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  if (!name || !data?.classId) throw new Error("Name required");
  const klass = await getDoc(doc(db(), "classes", data.classId));
  const groups = (await bySchool("groups", p.schoolId!)).filter((g) => s(g.classId) === data.classId);
  const group = groups.find((g) => s(g.id) === data.groupId) ?? groups[0];
  const id = newId();
  const code = studentInviteCode();
  await setDoc(doc(db(), "students", id), {
    schoolId: p.schoolId,
    classId: data.classId,
    className: klass.exists() ? s(klass.data().name) : "",
    groupId: group ? s(group.id) : null,
    groupName: group ? s(group.name) : null,
    group: group ? s(group.id) : null,
    name,
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

export async function adjustPoints(input?: { data?: { rosterId: string; delta: number; note?: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.rosterId) throw new Error("Missing");
  const ref = doc(db(), "students", data.rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const current = clampPoints(Number(snap.data().points) || 0);
  const next = clampPoints(current + (Number(data.delta) || 0));
  const applied = next - current;
  if (!applied) throw new Error("Limit");
  await updateDoc(ref, { points: next });
  await setDoc(doc(db(), "pointsHistory", newId()), {
    schoolId: p.schoolId,
    rosterId: data.rosterId,
    delta: applied,
    note: (data.note ?? "").trim(),
    byUserId: p.userId,
    byName: p.displayName || "",
    pointsAfter: next,
    createdAt: Date.now(),
  });
  return { ok: true };
}

export async function listLeaderboard() {
  const p = await requireProfile();
  const rows = await bySchool("students", p.schoolId!);
  return rows
    .map((r) => ({
      id: s(r.id),
      name: s(r.name),
      classId: s(r.classId),
      className: s(r.className),
      points: clampPoints(Number(r.points) || 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "uk"));
}

export async function listPointsHistory(input?: { data?: { rosterId?: string } }) {
  const p = await requireProfile();
  const wanted = p.role === "student" ? p.rosterId : dataOf(input)?.rosterId;
  if (!wanted) return [];
  const rows = await bySchool("pointsHistory", p.schoolId!);
  return rows
    .filter((r) => s(r.rosterId) === wanted)
    .map((r) => ({
      id: s(r.id),
      delta: Number(r.delta) || 0,
      note: s(r.note),
      byName: s(r.byName),
      pointsAfter: r.pointsAfter == null ? null : Number(r.pointsAfter),
      createdAt: Number(r.createdAt) || 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteStudent(input?: { data?: { rosterId: string } }) {
  const p = await requireTeacher();
  const id = dataOf(input)?.rosterId;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "students", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  await deleteDoc(ref);
  return { ok: true };
}

export async function getSchedule(input?: { data?: { classId?: string; groupId?: string | null } }) {
  const p = await requireProfile();
  const asked = dataOf(input);
  let classId = asked?.classId || p.classId || "";
  const rows = await bySchool("schedule", p.schoolId!);
  const subjects = await bySchool("subjects", p.schoolId!);
  if (!classId) {
    const classes = await bySchool("classes", p.schoolId!);
    classes.sort((a, b) => s(a.name).localeCompare(s(b.name), "uk"));
    classId = classes[0] ? s(classes[0].id) : "";
  }
  if (!classId) return { classId: null as string | null, groupId: null as string | null, entries: [] as ScheduleEntry[] };
  let entries = rows.filter((r) => s(r.classId) === classId).map(mapSchedule);
  let groupId = asked?.groupId || (p.role === "student" ? p.groupId : "") || "";
  const known = [...new Set(entries.map((e) => e.groupId).filter((g): g is string => Boolean(g)))];
  if (!groupId && known.length > 0) groupId = known[0];
  if (groupId) entries = entries.filter((e) => !e.groupId || e.groupId === groupId);
  entries.sort((a, b) => a.weekday.localeCompare(b.weekday) || a.period - b.period);
  return { classId, groupId: groupId || null, entries: decorate(entries, subjects) };
}

export async function setScheduleSubject(input?: { data?: { entryId: string; subjectId: string | null } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.entryId) throw new Error("Missing");
  const ref = doc(db(), "schedule", data.entryId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  let subjectName: string | null = null;
  let room = "";
  let meetLink = "";
  if (data.subjectId) {
    const sub = await getDoc(doc(db(), "subjects", data.subjectId));
    if (sub.exists()) {
      subjectName = s(sub.data().name);
      room = s(sub.data().room);
      meetLink = s(sub.data().meetLink);
    }
  }
  await updateDoc(ref, { subjectId: data.subjectId, subjectName, room, meetLink });
  return { ok: true };
}

export async function setScheduleTimes(input?: {
  data?: { classId: string; groupId?: string | null; period: number; startTime: string; endTime: string; weekday?: string | null };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.classId || !data.period || !data.startTime || !data.endTime) throw new Error("Missing");
  const fire = db();
  const rows = (await bySchool("schedule", p.schoolId!)).filter(
    (r) => s(r.classId) === data.classId && Number(r.period) === data.period && inGroup(r, data.groupId),
  );
  const batch = writeBatch(fire);
  let writes = 0;
  if (data.weekday) {
    const row = rows.find((r) => s(r.weekday) === data.weekday);
    if (row) {
      batch.update(doc(fire, "schedule", s(row.id)), {
        startTime: data.startTime,
        endTime: data.endTime,
        customTimes: true,
      });
    } else {
      batch.set(doc(fire, "schedule", newId()), {
        schoolId: p.schoolId,
        classId: data.classId,
        groupId: data.groupId || null,
        weekday: data.weekday,
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: null,
        subjectName: null,
        room: "",
        customTimes: true,
      });
    }
    writes = 1;
  } else {
    for (const row of rows) {
      if (row.customTimes === true) continue;
      batch.update(doc(fire, "schedule", s(row.id)), {
        startTime: data.startTime,
        endTime: data.endTime,
        customTimes: false,
      });
      writes += 1;
    }
  }
  if (writes) await batch.commit();
  return { ok: true };
}

export async function enableCustomDay(input?: { data?: { classId: string; groupId?: string | null; weekday: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.classId || !data.weekday) throw new Error("Missing");
  const fire = db();
  const rows = (await bySchool("schedule", p.schoolId!)).filter(
    (r) => s(r.classId) === data.classId && inGroup(r, data.groupId),
  );
  const dayRows = rows.filter((r) => s(r.weekday) === data.weekday);
  const batch = writeBatch(fire);
  if (dayRows.length === 0) {
    const templateDays = ["mon", "tue", "wed", "thu", "fri"];
    const sourceDay = templateDays.find((d) => rows.some((r) => s(r.weekday) === d)) ?? rows[0]?.weekday;
    const source = rows.filter((r) => s(r.weekday) === s(sourceDay));
    if (source.length === 0) return { ok: true };
    for (const row of source) {
      batch.set(doc(fire, "schedule", newId()), {
        schoolId: p.schoolId,
        classId: data.classId,
        groupId: data.groupId || null,
        weekday: data.weekday,
        period: Number(row.period) || 1,
        startTime: s(row.startTime),
        endTime: s(row.endTime),
        subjectId: null,
        subjectName: null,
        room: "",
        customTimes: true,
      });
    }
  } else {
    for (const row of dayRows) {
      batch.update(doc(fire, "schedule", s(row.id)), { customTimes: true });
    }
  }
  await batch.commit();
  return { ok: true };
}

export async function clearDayTimes(input?: { data?: { classId: string; groupId?: string | null; weekday: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.classId || !data.weekday) throw new Error("Missing");
  const fire = db();
  const rows = (await bySchool("schedule", p.schoolId!)).filter(
    (r) => s(r.classId) === data.classId && inGroup(r, data.groupId),
  );
  const dayRows = rows.filter((r) => s(r.weekday) === data.weekday);
  if (dayRows.length === 0) return { ok: true };
  const batch = writeBatch(fire);
  for (const row of dayRows) {
    if (!row.subjectId) {
      batch.delete(doc(fire, "schedule", s(row.id)));
      continue;
    }
    const sibling = rows.find(
      (r) =>
        Number(r.period) === Number(row.period) &&
        s(r.weekday) !== data.weekday &&
        r.customTimes !== true &&
        r.startTime,
    );
    batch.update(doc(fire, "schedule", s(row.id)), {
      startTime: sibling ? s(sibling.startTime) : s(row.startTime),
      endTime: sibling ? s(sibling.endTime) : s(row.endTime),
      customTimes: false,
    });
  }
  await batch.commit();
  return { ok: true };
}

export async function addSchedulePeriod(input?: { data?: { classId: string; groupId?: string | null } }) {
  const p = await requireTeacher();
  const classId = dataOf(input)?.classId;
  const groupId = dataOf(input)?.groupId || null;
  if (!classId) throw new Error("Missing");
  const fire = db();
  const rows = (await bySchool("schedule", p.schoolId!)).filter((r) => s(r.classId) === classId && inGroup(r, groupId));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.period) || 0), 0);
  const next = max + 1;
  const bell = DEFAULT_BELLS[next - 1];
  let start = bell?.start ?? "15:00";
  let end = bell?.end ?? "15:45";
  if (!bell && max > 0) {
    const last = rows.find((r) => Number(r.period) === max && r.customTimes !== true) ?? rows.find((r) => Number(r.period) === max);
    const prevEnd = s(last?.endTime, "14:00");
    const [hh, mm] = prevEnd.split(":").map((n) => Number(n) || 0);
    const from = hh * 60 + mm + 10;
    const to = from + 45;
    const fmt = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    start = fmt(from);
    end = fmt(to);
  }
  const days = new Set(rows.map((r) => s(r.weekday)).filter(Boolean));
  for (const day of ["mon", "tue", "wed", "thu", "fri"]) days.add(day);
  const batch = writeBatch(fire);
  for (const weekday of days) {
    if (rows.some((r) => s(r.weekday) === weekday && Number(r.period) === next)) continue;
    const custom = rows.some((r) => s(r.weekday) === weekday && r.customTimes === true);
    batch.set(doc(fire, "schedule", newId()), {
      schoolId: p.schoolId,
      classId,
      groupId,
      weekday,
      period: next,
      startTime: start,
      endTime: end,
      subjectId: null,
      subjectName: null,
      room: "",
      customTimes: custom,
    });
  }
  await batch.commit();
  return { period: next };
}

export async function listLessons() {
  const p = await requireProfile();
  let lessons: Lesson[] = (await bySchool("lessons", p.schoolId!)).map((r) => ({
    id: s(r.id),
    subjectId: s(r.subjectId),
    subjectName: s(r.subjectName),
    teacherId: s(r.teacherId),
    title: s(r.title),
    content: s(r.content),
    lessonDate: s(r.lessonDate).slice(0, 10),
    hasHomework: r.hasHomework === true,
    homeworkDue: r.homeworkDue ? s(r.homeworkDue).slice(0, 10) : null,
    classIds: Array.isArray(r.classIds) ? (r.classIds as string[]) : [],
    publishAt: r.publishAt ? s(r.publishAt) : null,
    addedByStarosta: r.addedByStarosta === true,
    imageUrls: Array.isArray(r.imageUrls) ? (r.imageUrls as string[]).map((u) => s(u)).filter(Boolean) : [],
  }));
  lessons.sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
  if (p.role === "student" && p.classId) {
    const now = Date.now();
    lessons = lessons.filter((l) => l.classIds.length === 0 || l.classIds.includes(p.classId!));
    lessons = lessons.filter((l) => !l.publishAt || new Date(l.publishAt).getTime() <= now);
  }
  if (p.role === "teacher" && !p.isAdmin) {
    const subs = await bySchool("subjects", p.schoolId!);
    const mine = new Set(
      subs.filter((sub) => Array.isArray(sub.teacherIds) && (sub.teacherIds as string[]).includes(p.userId)).map((sub) => s(sub.id)),
    );
    if (mine.size > 0) lessons = lessons.filter((l) => mine.has(l.subjectId));
  }
  let doneIds: string[] = [];
  if (p.rosterId) {
    const st = await getDoc(doc(db(), "students", p.rosterId));
    doneIds = Array.isArray(st.data()?.doneLessonIds) ? (st.data()?.doneLessonIds as string[]) : [];
  }
  return { lessons, doneIds };
}

export async function addLesson(input?: {
  data?: {
    subjectId: string;
    title: string;
    content: string;
    lessonDate: string;
    hasHomework: boolean;
    homeworkDue?: string | null;
    classIds: string[];
    publishAt?: string | null;
    imageUrls?: string[];
  };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  if (!title || !data?.subjectId) throw new Error("Title required");
  const sub = await assertSubject(p, data.subjectId);
  const id = newId();
  const subjectName = s(sub.data().name);
  const homework = data.hasHomework || Boolean(data.homeworkDue);
  await setDoc(doc(db(), "lessons", id), {
    schoolId: p.schoolId,
    subjectId: data.subjectId,
    subjectName,
    teacherId: p.userId,
    title,
    content: data.content ?? "",
    lessonDate: data.lessonDate,
    hasHomework: homework,
    homeworkDue: data.homeworkDue || null,
    classIds: data.classIds ?? [],
    publishAt: data.publishAt || null,
    addedByStarosta: false,
    imageUrls: (data.imageUrls ?? []).slice(0, 4),
    createdAt: Date.now(),
  });
  await notifyClass(p, data.classIds ?? [], {
    type: homework ? "homework" : "lesson",
    title: homework ? `Нове ДЗ: ${subjectName}` : `Новий урок: ${subjectName}`,
    body: title,
  });
  return { id };
}

export async function toggleHomeworkDone(input?: { data?: { lessonId: string; done: boolean } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  if (!p.rosterId || !data?.lessonId) throw new Error("Not linked");
  await updateDoc(doc(db(), "students", p.rosterId), {
    doneLessonIds: data.done ? arrayUnion(data.lessonId) : arrayRemove(data.lessonId),
  });
  return { ok: true };
}

export async function listGrades(input?: { data?: { rosterId?: string } }) {
  const p = await requireProfile();
  const rosterId = p.role === "student" ? p.rosterId : dataOf(input)?.rosterId;
  if (!rosterId) return { grades: [] as Grade[] };
  const grades = (await bySchool("grades", p.schoolId!))
    .filter((g) => s(g.rosterId) === rosterId)
    .map(mapGrade)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { grades };
}

export async function listGradebook() {
  const p = await requireTeacher();
  const grades = (await bySchool("grades", p.schoolId!)).map(mapGrade);
  return { grades };
}

export async function setGrade(input?: {
  data?: {
    rosterId: string;
    subjectId: string;
    lessonId?: string | null;
    kind: "lesson" | "homework" | "final";
    value: string;
    comment?: string;
    finalPeriod?: string | null;
  };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.rosterId || !data.subjectId) throw new Error("Missing");
  await assertSubject(p, data.subjectId);
  const rows = await bySchool("grades", p.schoolId!);
  const lessonId = data.lessonId || "";
  const period = data.finalPeriod || "";
  const existing = rows.find(
    (g) =>
      s(g.rosterId) === data.rosterId &&
      s(g.subjectId) === data.subjectId &&
      (s(g.kind) || "lesson") === data.kind &&
      s(g.lessonId) === lessonId &&
      s(g.finalPeriod) === period,
  );
  const value = data.value.trim();
  if (!value) {
    if (existing) await deleteDoc(doc(db(), "grades", s(existing.id)));
    return { id: existing ? s(existing.id) : null };
  }
  const sub = await getDoc(doc(db(), "subjects", data.subjectId));
  const subjectName = sub.exists() ? s(sub.data().name) : "";
  const payload = {
    schoolId: p.schoolId,
    rosterId: data.rosterId,
    subjectId: data.subjectId,
    subjectName,
    lessonId: data.lessonId ?? null,
    kind: data.kind,
    value,
    comment: data.comment ?? "",
    finalPeriod: data.finalPeriod ?? null,
    createdAt: existing?.createdAt ? s(existing.createdAt) : new Date().toISOString(),
  };
  const id = existing ? s(existing.id) : newId();
  if (existing) await updateDoc(doc(db(), "grades", id), payload);
  else await setDoc(doc(db(), "grades", id), payload);
  const student = await getDoc(doc(db(), "students", data.rosterId));
  const uid = student.exists() ? s(student.data().authUid || student.data().linkedUserId) : "";
  if (uid) {
    await pushNotice(uid, p.schoolId!, {
      type: "grade",
      title: `Нова оцінка: ${value} — ${subjectName}`,
      body: data.comment?.trim() || (data.kind === "homework" ? "ДЗ" : data.kind === "final" ? "Підсумок" : "Урок"),
    });
  }
  return { id };
}

export async function listAnnouncements() {
  const p = await requireProfile();
  let list: Announcement[] = (await bySchool("announcements", p.schoolId!))
    .filter((r) => s(r.kind) !== "activity")
    .map((r) => ({
    id: s(r.id),
    authorId: s(r.authorId),
    authorName: s(r.authorName) || "—",
    title: s(r.title),
    body: s(r.body),
    createdAt: s(r.createdAt),
    classIds: Array.isArray(r.classIds) ? (r.classIds as string[]) : [],
    important: r.important === true,
  }));
  list.sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));
  if (p.role === "student" && p.classId) {
    list = list.filter((a) => a.classIds.includes(p.classId!));
  }
  return { announcements: list };
}

export async function addAnnouncement(input?: { data?: { title: string; body: string; classIds: string[]; important?: boolean } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  const body = (data?.body ?? "").trim();
  const classIds = [...new Set((data?.classIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (!title || !body || classIds.length === 0) throw new Error("Required");
  const id = newId();
  const important = data?.important === true;
  await setDoc(doc(db(), "announcements", id), {
    schoolId: p.schoolId,
    authorId: p.userId,
    authorName: p.displayName,
    title,
    body,
    createdAt: new Date().toISOString(),
    classIds,
    important,
  });
  await notifyClass(p, classIds, { type: "announcement", title: `${important ? "Важливо: " : "Оголошення: "}${title}`, body });
  return { id };
}

export async function listActivities(input?: { data?: { classId?: string } }) {
  const p = await requireProfile();
  const classId = dataOf(input)?.classId || (p.role === "student" ? p.classId ?? "" : "");
  let list = (await bySchool("announcements", p.schoolId!))
    .filter((r) => s(r.kind) === "activity")
    .map((r) => ({
      id: s(r.id),
      authorId: s(r.authorId),
      authorName: s(r.authorName) || "—",
      title: s(r.title),
      body: s(r.body),
      createdAt: s(r.createdAt),
      classId: s(r.classId),
      classIds: Array.isArray(r.classIds) ? (r.classIds as string[]).map((id) => s(id)) : s(r.classId) ? [s(r.classId)] : [],
      important: r.important === true,
    }));
  if (classId) list = list.filter((a) => a.classIds.includes(classId) || a.classId === classId);
  list.sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));
  return { activities: list };
}

export async function addActivity(input?: { data?: { classId?: string; classIds?: string[]; title: string; body: string; important?: boolean } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  const body = (data?.body ?? "").trim();
  let classIds = [...new Set([...(data?.classIds ?? []), data?.classId ?? ""].map((id) => id.trim()).filter(Boolean))];
  const teacher = p.role === "teacher";
  const starosta = p.role === "student" && p.isStarosta;
  if (starosta) classIds = p.classId ? [p.classId] : [];
  if ((!teacher && !starosta) || !title || !body || classIds.length === 0) throw new Error(classIds.length === 0 ? "Required" : "Forbidden");
  const id = newId();
  const important = data?.important === true;
  await setDoc(doc(db(), "announcements", id), {
    schoolId: p.schoolId,
    kind: "activity",
    classId: classIds[0],
    classIds,
    important,
    authorId: p.userId,
    authorName: p.displayName,
    title,
    body,
    createdAt: new Date().toISOString(),
  });
  await notifyClass(p, classIds, { type: "announcement", title: `${important ? "Важливо: " : "Оголошення: "}${title}`, body });
  return { id };
}

export async function deleteActivity(input?: { data?: { id: string } }) {
  const p = await requireProfile();
  const id = dataOf(input)?.id;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "announcements", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId || snap.data().kind !== "activity") throw new Error("Not found");
  const teacher = p.role === "teacher";
  if (!teacher && snap.data().authorId !== p.userId) throw new Error("Forbidden");
  await deleteDoc(ref);
  return { ok: true };
}

export async function listTeachers() {
  const p = await requireTeacher();
  const users = await bySchool("users", p.schoolId!);
  const teachers = users
    .filter((t) => t.role === "teacher" || t.role === "admin")
    .map((t) => ({
      userId: s(t.id),
      displayName: s(t.displayName) || s(t.email),
      isAdmin: t.role === "admin" || t.isAdmin === true,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "uk"));
  const invites = p.isAdmin
    ? (await bySchool("teacherInvites", p.schoolId!))
        .filter((i) => !i.usedBy)
        .map((i) => ({ code: s(i.id) || s(i.code), createdAt: s(i.createdAt) }))
    : [];
  return { isAdmin: p.isAdmin, teachers, invites };
}

export async function generateTeacherInvite() {
  const p = await requireTeacher();
  if (!p.isAdmin) throw new Error("Admin only");
  const code = teacherInviteCode();
  await setDoc(doc(db(), "teacherInvites", code), {
    schoolId: p.schoolId,
    createdBy: p.userId,
    usedBy: null,
    createdAt: new Date().toISOString(),
  });
  return { code };
}

export async function getElection(input?: { data?: { classId?: string } }) {
  const p = await requireProfile();
  const classId = dataOf(input)?.classId || p.classId;
  if (!classId) return { election: null as Election | null, history: [] as Election[] };
  const rows = (await bySchool("elections", p.schoolId!)).filter((e) => s(e.classId) === classId);
  const mapped: Election[] = rows.map((e) => {
    const votes = (e.votes ?? {}) as Record<string, string>;
    const candidates = Array.isArray(e.candidates) ? (e.candidates as { rosterId: string; name: string }[]) : [];
    const counts = new Map<string, number>();
    for (const cand of Object.values(votes)) counts.set(cand, (counts.get(cand) ?? 0) + 1);
    return {
      id: s(e.id),
      classId: s(e.classId),
      startsAt: s(e.startsAt),
      endsAt: s(e.endsAt),
      closed: e.closed === true,
      winnerRosterId: e.winnerRosterId ? s(e.winnerRosterId) : null,
      candidates: candidates.map((c) => ({ rosterId: c.rosterId, name: c.name, votes: counts.get(c.rosterId) ?? 0 })),
      myCandidate: Boolean(p.rosterId && candidates.some((c) => c.rosterId === p.rosterId)),
      myVote: p.rosterId ? votes[p.rosterId] ?? null : null,
    };
  });
  mapped.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { election: mapped.find((e) => !e.closed) ?? null, history: mapped.filter((e) => e.closed) };
}

export async function announceElection(input?: { data?: { classId: string; startsAt: string; endsAt: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.classId) throw new Error("Missing");
  const open = (await bySchool("elections", p.schoolId!)).find((e) => s(e.classId) === data.classId && e.closed !== true);
  if (open) throw new Error("ALREADY");
  const id = newId();
  await setDoc(doc(db(), "elections", id), {
    schoolId: p.schoolId,
    classId: data.classId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    closed: false,
    winnerRosterId: null,
    candidates: [],
    votes: {},
  });
  await notifyClass(p, [data.classId], {
    type: "election",
    title: "Оголошено вибори старости",
    body: "Можна подати кандидатуру або проголосувати у розділі «Самоврядування».",
  });
  return { id };
}

export async function runForElection(input?: { data?: { electionId: string } }) {
  const p = await requireProfile();
  const electionId = dataOf(input)?.electionId;
  if (!p.rosterId || !electionId) throw new Error("Not linked");
  const ref = doc(db(), "elections", electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const candidates = Array.isArray(snap.data().candidates) ? [...(snap.data().candidates as { rosterId: string; name: string }[])] : [];
  if (!candidates.some((c) => c.rosterId === p.rosterId)) {
    candidates.push({ rosterId: p.rosterId, name: p.displayName });
    await updateDoc(ref, { candidates });
  }
  return { ok: true };
}

export async function voteElection(input?: { data?: { electionId: string; candidateId: string } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  if (!p.rosterId || !data?.electionId) throw new Error("Not linked");
  const ref = doc(db(), "elections", data.electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const votes = { ...(snap.data().votes as Record<string, string> | undefined) };
  votes[p.rosterId] = data.candidateId;
  await updateDoc(ref, { votes });
  return { ok: true };
}

export async function closeElection(input?: { data?: { electionId: string } }) {
  const p = await requireTeacher();
  const electionId = dataOf(input)?.electionId;
  if (!electionId) throw new Error("Missing");
  const ref = doc(db(), "elections", electionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const votes = (snap.data().votes ?? {}) as Record<string, string>;
  const counts = new Map<string, number>();
  for (const cand of Object.values(votes)) counts.set(cand, (counts.get(cand) ?? 0) + 1);
  let winner: string | null = null;
  let best = -1;
  for (const [id, n] of counts) {
    if (n > best) {
      best = n;
      winner = id;
    }
  }
  await updateDoc(ref, { closed: true, winnerRosterId: winner });
  const classId = s(snap.data().classId);
  if (winner && classId) {
    const students = (await bySchool("students", s(snap.data().schoolId))).filter((st) => s(st.classId) === classId);
    for (const st of students) {
      await updateDoc(doc(db(), "students", s(st.id)), { isStarosta: s(st.id) === winner });
    }
  }
  const winnerName = winner
    ? s((await getDoc(doc(db(), "students", winner))).data()?.name) || "старосту"
    : "";
  if (classId) {
    await notifyClass(p, [classId], {
      type: "election",
      title: winnerName ? `Новий староста: ${winnerName}` : "Вибори завершено",
      body: "Результати у розділі «Самоврядування».",
    });
  }
  return { winner };
}

async function classMemberUids(schoolId: string, classId: string, me: string) {
  const [students, users] = await Promise.all([bySchool("students", schoolId), bySchool("users", schoolId)]);
  const uids = new Set<string>([me]);
  for (const u of users) {
    const role = s(u.role);
    if (role === "teacher" || role === "admin" || role === "pending-teacher") uids.add(s(u.id));
  }
  for (const st of students) {
    if (s(st.classId) !== classId) continue;
    const uid = s(st.authUid || st.linkedUserId);
    if (uid) uids.add(uid);
  }
  return [...uids];
}

async function ensureMyChats(p: Profile) {
  if (!p.schoolId) return;
  const index = await chatIndex(p.schoolId);
  const created: { id: string; kind: string; classId: string | null }[] = [];
  const join = async (id: string) => {
    const ref = doc(db(), "chats", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const members = (snap.data().memberUids ?? []) as string[];
    if (!members.includes(p.userId)) await updateDoc(ref, { memberUids: arrayUnion(p.userId) });
    return true;
  };
  for (const c of index) {
    if (p.role === "student" && (c.kind === "teachers" || (c.classId && c.classId !== p.classId))) continue;
    await join(c.id);
  }
  const classes = await bySchool("classes", p.schoolId);
  const indexedClasses = new Set(index.filter((c) => c.kind === "class" && c.classId).map((c) => c.classId));
  const wanted = p.role === "student" ? classes.filter((c) => s(c.id) === p.classId) : classes;
  for (const klass of wanted) {
    const classId = s(klass.id);
    if (indexedClasses.has(classId)) continue;
    const id = `auto_class_${classId}`;
    const exists = await join(id);
    if (!exists) {
      await setDoc(doc(db(), "chats", id), {
        schoolId: p.schoolId,
        kind: "class",
        name: s(klass.name) || classId,
        classId,
        memberUids: await classMemberUids(p.schoolId, classId, p.userId),
        isAuto: true,
        createdBy: p.userId,
        lastBody: null,
        lastAt: null,
      });
      created.push({ id, kind: "class", classId });
    }
  }
  if (p.role === "teacher" && !index.some((c) => c.kind === "teachers")) {
    const id = `auto_teachers_${p.schoolId}`;
    const exists = await join(id);
    if (!exists) {
      const users = await bySchool("users", p.schoolId);
      const memberUids = [
        ...new Set([
          p.userId,
          ...users
            .filter((u) => ["teacher", "admin", "pending-teacher"].includes(s(u.role)))
            .map((u) => s(u.id)),
        ]),
      ];
      await setDoc(doc(db(), "chats", id), {
        schoolId: p.schoolId,
        kind: "teachers",
        name: "Учительський чат",
        classId: null,
        memberUids,
        isAuto: true,
        createdBy: p.userId,
        lastBody: null,
        lastAt: null,
      });
      created.push({ id, kind: "teachers", classId: null });
    }
  }
  if (created.length) {
    try {
      await saveChatIndex(p.schoolId, [...index, ...created]);
    } catch {
      /* Індекс чатів на документі школи може оновлювати лише її автор. */
    }
  }
}

export async function listChats() {
  const p = await requireProfile();
  await ensureMyChats(p);
  const snap = await getDocs(query(collection(db(), "chats"), where("memberUids", "array-contains", p.userId)));
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Bag)
    .filter((c) => s(c.schoolId) === p.schoolId);
  const chats: ChatSummary[] = rows
    .map((r) => ({
      id: s(r.id),
      kind: s(r.kind),
      name: s(r.name),
      lastBody: r.lastBody ? s(r.lastBody) : null,
      lastAt: r.lastAt ? s(r.lastAt) : null,
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return { chats };
}

export async function listMessages(input?: { data?: { chatId: string } }) {
  const p = await requireProfile();
  const chatId = dataOf(input)?.chatId;
  if (!chatId) throw new Error("Missing");
  const chat = await getDoc(doc(db(), "chats", chatId));
  const members = (chat.data()?.memberUids ?? []) as string[];
  if (!members.includes(p.userId)) throw new Error("Forbidden");
  const snap = await getDocs(query(collection(db(), "chatMessages"), where("chatId", "==", chatId)));
  const messages: ChatMessage[] = snap.docs
    .map((d) => ({
      id: d.id,
      authorId: s(d.data().senderUid),
      authorName: s(d.data().authorName) || "—",
      body: d.data().deleted === true ? "" : s(d.data().body),
      createdAt: s(d.data().createdAt),
      deleted: d.data().deleted === true,
      subjectName: s(d.data().subjectName),
      edited: Boolean(d.data().editedAt),
      pinned: d.data().pinned === true,
      imageUrls: d.data().deleted === true || !Array.isArray(d.data().imageUrls) ? [] : (d.data().imageUrls as string[]).map((u) => s(u)).filter(Boolean),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-200);
  return { messages };
}

export async function sendMessage(input?: { data?: { chatId: string; body: string; subjectName?: string; imageUrls?: string[] } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  const body = (data?.body ?? "").trim();
  const imageUrls = (data?.imageUrls ?? []).filter(Boolean).slice(0, 4);
  if (!data?.chatId || (!body && imageUrls.length === 0)) throw new Error("Empty");
  const chatRef = doc(db(), "chats", data.chatId);
  const chat = await getDoc(chatRef);
  const members = (chat.data()?.memberUids ?? []) as string[];
  if (!members.includes(p.userId)) throw new Error("Forbidden");
  const id = newId();
  const createdAt = new Date().toISOString();
  const kind = s(chat.data()?.kind);
  const subjectName = kind === "class" ? (data.subjectName ?? "").trim() : "";
  await setDoc(doc(db(), "chatMessages", id), {
    chatId: data.chatId,
    senderUid: p.userId,
    authorName: p.displayName,
    body,
    subjectName,
    imageUrls,
    pinned: false,
    deleted: false,
    createdAt,
  });
  await updateDoc(chatRef, { lastBody: body || "Фото", lastAt: createdAt });
  return { id };
}

export async function startDm(input?: { data?: { otherUserId: string; name: string } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  if (!data?.otherUserId) throw new Error("Missing");
  const mine = await getDocs(query(collection(db(), "chats"), where("memberUids", "array-contains", p.userId)));
  const existing = mine.docs.find((d) => {
    const members = (d.data().memberUids ?? []) as string[];
    return d.data().kind === "dm" && members.includes(data.otherUserId);
  });
  if (existing) return { id: existing.id };
  const id = newId();
  await setDoc(doc(db(), "chats", id), {
    schoolId: p.schoolId,
    kind: "dm",
    name: data.name || "Діалог",
    classId: null,
    memberUids: [p.userId, data.otherUserId],
    isAuto: false,
    createdBy: p.userId,
    lastBody: null,
    lastAt: null,
  });
  return { id };
}

export async function listPeople() {
  const p = await requireProfile();
  const rows = await bySchool("users", p.schoolId!);
  return {
    people: rows
      .filter((r) => s(r.id) !== p.userId)
      .map((r) => ({
        userId: s(r.id),
        displayName: s(r.displayName) || s(r.email),
        role: s(r.role),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "uk")),
  };
}

export async function listElectives() {
  const u = user();
  const snap = await getDocs(query(collection(db(), "electives"), where("uid", "==", u.uid)));
  return {
    electives: snap.docs
      .map((d) => ({
        id: d.id,
        name: s(d.data().name),
        weekday: s(d.data().weekday),
        startTime: s(d.data().startTime),
        endTime: s(d.data().endTime),
      }))
      .sort((a, b) => a.weekday.localeCompare(b.weekday) || a.startTime.localeCompare(b.startTime)),
  };
}

export async function addElective(input?: { data?: { name: string; weekday: string; startTime: string; endTime: string } }) {
  const u = user();
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  if (!name || !data) throw new Error("Name required");
  const id = newId();
  await setDoc(doc(db(), "electives", id), {
    uid: u.uid,
    name,
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime,
  });
  return { id };
}

async function pushNotice(uid: string, schoolId: string, n: { type: string; title: string; body: string }) {
  if (!uid) return;
  await addDoc(collection(db(), "notifications"), {
    recipientUid: uid,
    schoolId,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: Date.now(),
    read: false,
  });
}

async function notifyClass(p: Profile, classIds: string[], n: { type: string; title: string; body: string }) {
  if (!p.schoolId) return;
  const students = await bySchool("students", p.schoolId);
  const targets = students.filter((st) => {
    const uid = s(st.authUid || st.linkedUserId);
    if (!uid || uid === p.userId) return false;
    if (!classIds.length) return true;
    return classIds.includes(s(st.classId));
  });
  await Promise.all(targets.map((st) => pushNotice(s(st.authUid || st.linkedUserId), p.schoolId!, n)));
}

export async function deleteLesson(input?: { data?: { lessonId: string } }) {
  const p = await requireTeacher();
  const id = dataOf(input)?.lessonId;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "lessons", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const subjectId = s(snap.data().subjectId);
  if (subjectId) await assertSubject(p, subjectId);
  await deleteDoc(ref);
  return { ok: true };
}

export async function updateSubject(input?: {
  data?: { subjectId: string; name?: string; room?: string; meetLink?: string; studentsCanAddHw?: boolean };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.subjectId) throw new Error("Missing");
  const ref = doc(db(), "subjects", data.subjectId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (!canTeach(p, snap.data().teacherIds)) throw new Error("SUBJECT");
  const patch: Bag = {};
  if (data.name != null) patch.name = data.name.trim();
  if (data.room != null) patch.room = data.room.trim();
  if (data.meetLink != null) patch.meetLink = data.meetLink.trim();
  if (data.studentsCanAddHw != null) patch.studentsCanAddHw = data.studentsCanAddHw;
  await updateDoc(ref, patch);
  return { ok: true };
}

export async function deleteSubject(input?: { data?: { subjectId: string } }) {
  const p = await requireTeacher();
  const id = dataOf(input)?.subjectId;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "subjects", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (!canTeach(p, snap.data().teacherIds)) throw new Error("SUBJECT");
  await deleteDoc(ref);
  return { ok: true };
}

export async function addStarostaHomework(input?: {
  data?: { subjectId: string; title: string; content?: string; homeworkDue: string; imageUrls?: string[] };
}) {
  const p = await requireProfile();
  if (!p.rosterId || !p.isStarosta) throw new Error("Monitor only");
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  if (!title || !data?.subjectId || !data.homeworkDue) throw new Error("Required");
  const sub = await getDoc(doc(db(), "subjects", data.subjectId));
  if (!sub.exists() || sub.data().studentsCanAddHw !== true) throw new Error("Not allowed");
  const id = newId();
  await setDoc(doc(db(), "lessons", id), {
    schoolId: p.schoolId,
    subjectId: data.subjectId,
    subjectName: s(sub.data().name),
    teacherId: p.userId,
    title,
    content: data.content ?? "",
    lessonDate: kyivToday(),
    hasHomework: true,
    homeworkDue: data.homeworkDue,
    classIds: p.classId ? [p.classId] : [],
    publishAt: null,
    addedByStarosta: true,
    imageUrls: (data.imageUrls ?? []).slice(0, 4),
    createdAt: Date.now(),
  });
  await notifyClass(p, p.classId ? [p.classId] : [], {
    type: "homework",
    title: `Нове ДЗ: ${s(sub.data().name)}`,
    body: title,
  });
  return { id };
}

export async function setStarosta(input?: { data?: { rosterId: string; on: boolean } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.rosterId) throw new Error("Missing");
  const ref = doc(db(), "students", data.rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const classId = s(snap.data().classId);
  if (data.on && classId) {
    const mates = (await bySchool("students", p.schoolId!)).filter((st) => s(st.classId) === classId);
    const batch = writeBatch(db());
    for (const st of mates) batch.update(doc(db(), "students", s(st.id)), { isStarosta: s(st.id) === data.rosterId });
    await batch.commit();
  } else {
    await updateDoc(ref, { isStarosta: false });
  }
  return { ok: true };
}

export async function addGroup(input?: { data?: { classId: string; name: string } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  if (!data?.classId || !name) throw new Error("Name required");
  const id = newId();
  const fire = db();
  const existing = (await bySchool("schedule", p.schoolId!)).filter((r) => s(r.classId) === data.classId);
  const sourceGroup = existing.find((r) => r.groupId)?.groupId;
  const source = sourceGroup ? existing.filter((r) => s(r.groupId) === s(sourceGroup)) : existing;
  const batch = writeBatch(fire);
  batch.set(doc(fire, "groups", id), { schoolId: p.schoolId, classId: data.classId, name });
  const seen = new Set<string>();
  for (const row of source) {
    const key = `${s(row.weekday)}:${row.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    batch.set(doc(fire, "schedule", newId()), {
      schoolId: p.schoolId,
      classId: data.classId,
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

export async function deleteGroup(input?: { data?: { groupId: string } }) {
  const p = await requireTeacher();
  const groupId = dataOf(input)?.groupId;
  if (!groupId) throw new Error("Missing");
  const groups = await bySchool("groups", p.schoolId!);
  const group = groups.find((g) => s(g.id) === groupId);
  if (!group) throw new Error("Not found");
  const siblings = groups.filter((g) => s(g.classId) === s(group.classId) && s(g.id) !== groupId);
  if (siblings.length === 0) throw new Error("ONLY_GROUP");
  const fallback = siblings[0];
  const fire = db();
  const batch = writeBatch(fire);
  const students = (await bySchool("students", p.schoolId!)).filter((st) => s(st.groupId) === groupId);
  for (const st of students) {
    batch.update(doc(fire, "students", s(st.id)), {
      groupId: s(fallback.id),
      group: s(fallback.id),
      groupName: s(fallback.name),
    });
  }
  const slots = (await bySchool("schedule", p.schoolId!)).filter((r) => s(r.groupId) === groupId);
  for (const row of slots) batch.delete(doc(fire, "schedule", s(row.id)));
  batch.delete(doc(fire, "groups", groupId));
  await batch.commit();
  return { ok: true };
}

export async function deleteClass(input?: { data?: { classId: string } }) {
  const p = await requireTeacher();
  const classId = dataOf(input)?.classId;
  if (!classId) throw new Error("Missing");
  const classes = await bySchool("classes", p.schoolId!);
  if (!classes.some((c) => s(c.id) === classId)) throw new Error("Not found");
  const others = classes.filter((c) => s(c.id) !== classId);
  if (others.length === 0) throw new Error("ONLY_CLASS");
  const target = others[0];
  const groups = await bySchool("groups", p.schoolId!);
  const targetGroup = groups.find((g) => s(g.classId) === s(target.id));
  const fire = db();
  const batch = writeBatch(fire);
  const students = (await bySchool("students", p.schoolId!)).filter((st) => s(st.classId) === classId);
  for (const st of students) {
    batch.update(doc(fire, "students", s(st.id)), {
      classId: s(target.id),
      className: s(target.name),
      groupId: targetGroup ? s(targetGroup.id) : null,
      group: targetGroup ? s(targetGroup.id) : null,
      groupName: targetGroup ? s(targetGroup.name) : null,
    });
  }
  for (const g of groups.filter((g) => s(g.classId) === classId)) batch.delete(doc(fire, "groups", s(g.id)));
  const slots = (await bySchool("schedule", p.schoolId!)).filter((r) => s(r.classId) === classId);
  for (const row of slots) batch.delete(doc(fire, "schedule", s(row.id)));
  batch.delete(doc(fire, "classes", classId));
  await batch.commit();
  return { ok: true };
}

export async function applyScheduleCells(input?: {
  data?: {
    classId: string;
    groupId?: string | null;
    cells: { weekday: string; period: number; subjectId: string | null }[];
  };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.classId || !data.cells) throw new Error("Missing");
  const subjects = await bySchool("subjects", p.schoolId!);
  const byId = new Map(subjects.map((sub) => [s(sub.id), sub]));
  const rows = (await bySchool("schedule", p.schoolId!)).filter(
    (r) => s(r.classId) === data.classId && inGroup(r, data.groupId),
  );
  const batch = writeBatch(db());
  for (const cell of data.cells) {
    const row = rows.find((r) => s(r.weekday) === cell.weekday && Number(r.period) === cell.period);
    const sub = cell.subjectId ? byId.get(cell.subjectId) : undefined;
    const patch = {
      subjectId: cell.subjectId,
      subjectName: sub ? s(sub.name) : null,
      room: sub ? s(sub.room) : "",
      meetLink: sub ? s(sub.meetLink) : "",
    };
    if (row) batch.update(doc(db(), "schedule", s(row.id)), patch);
    else {
      batch.set(doc(db(), "schedule", newId()), {
        schoolId: p.schoolId,
        classId: data.classId,
        groupId: data.groupId || null,
        weekday: cell.weekday,
        period: cell.period,
        startTime: DEFAULT_BELLS[cell.period - 1]?.start ?? "08:30",
        endTime: DEFAULT_BELLS[cell.period - 1]?.end ?? "09:15",
        customTimes: false,
        ...patch,
      });
    }
  }
  await batch.commit();
  return { ok: true };
}

export async function setWeekOverride(input?: { data?: { entryId: string; subjectId: string | null } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.entryId) throw new Error("Missing");
  const ref = doc(db(), "schedule", data.entryId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (!data.subjectId) {
    await updateDoc(ref, { overrideSubjectId: null, overrideSubjectName: null, overrideWeek: null });
    return { ok: true };
  }
  const sub = await getDoc(doc(db(), "subjects", data.subjectId));
  await updateDoc(ref, {
    overrideSubjectId: data.subjectId,
    overrideSubjectName: sub.exists() ? s(sub.data().name) : data.subjectId,
    overrideWeek: isoWeekKey(),
  });
  return { ok: true };
}

export async function deleteAnnouncement(input?: { data?: { id: string } }) {
  const p = await requireTeacher();
  const id = dataOf(input)?.id;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "announcements", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  await deleteDoc(ref);
  return { ok: true };
}

export async function deleteTeacherInvite(input?: { data?: { code: string } }) {
  const p = await requireTeacher();
  if (!p.isAdmin) throw new Error("Admin only");
  const code = dataOf(input)?.code;
  if (!code) throw new Error("Missing");
  const ref = doc(db(), "teacherInvites", code);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  await deleteDoc(ref);
  return { ok: true };
}

export async function deleteElective(input?: { data?: { id: string } }) {
  const u = user();
  const id = dataOf(input)?.id;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "electives", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().uid !== u.uid) throw new Error("Not found");
  await deleteDoc(ref);
  return { ok: true };
}

export async function createGroupChat(input?: { data?: { name: string; memberUids: string[] } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  const members = [...new Set([p.userId, ...(data?.memberUids ?? [])])];
  if (!name || members.length < 2) throw new Error("Need members");
  const id = newId();
  await setDoc(doc(db(), "chats", id), {
    schoolId: p.schoolId,
    kind: "group",
    name,
    classId: null,
    memberUids: members,
    isAuto: false,
    createdBy: p.userId,
    lastBody: null,
    lastAt: null,
  });
  return { id };
}

export async function pinMessage(input?: { data?: { messageId: string; pinned: boolean } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  if (!data?.messageId) throw new Error("Missing");
  const ref = doc(db(), "chatMessages", data.messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const chat = await getDoc(doc(db(), "chats", s(snap.data().chatId)));
  const members = (chat.data()?.memberUids ?? []) as string[];
  if (!members.includes(p.userId)) throw new Error("Forbidden");
  await updateDoc(ref, { pinned: Boolean(data.pinned), pinnedAt: data.pinned ? Date.now() : null });
  return { ok: true };
}

export async function editMessage(input?: { data?: { messageId: string; body: string } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  const body = (data?.body ?? "").trim();
  if (!data?.messageId || !body) throw new Error("Empty");
  const ref = doc(db(), "chatMessages", data.messageId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().senderUid !== p.userId) throw new Error("Forbidden");
  await updateDoc(ref, { body, editedAt: Date.now() });
  return { ok: true };
}

export async function deleteMessage(input?: { data?: { messageId: string } }) {
  const p = await requireProfile();
  const id = dataOf(input)?.messageId;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "chatMessages", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().senderUid !== p.userId) throw new Error("Forbidden");
  await updateDoc(ref, { deleted: true, body: "", imageUrls: [] });
  return { ok: true };
}

export async function listNotices() {
  const u = user();
  const snap = await getDocs(query(collection(db(), "notifications"), where("recipientUid", "==", u.uid)));
  const notices: Notice[] = snap.docs
    .map((d) => ({
      id: d.id,
      title: s(d.data().title),
      body: s(d.data().body),
      createdAt: Number(d.data().createdAt) || 0,
      read: d.data().read === true,
      type: s(d.data().type),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40);
  return { notices };
}

export async function markNoticesRead() {
  const u = user();
  const snap = await getDocs(query(collection(db(), "notifications"), where("recipientUid", "==", u.uid)));
  const unread = snap.docs.filter((d) => d.data().read !== true).slice(0, 400);
  if (unread.length === 0) return { ok: true };
  const batch = writeBatch(db());
  for (const d of unread) batch.update(d.ref, { read: true });
  await batch.commit();
  return { ok: true };
}

