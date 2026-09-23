import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
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
    setupComplete,
    email: s(d?.email) || s(u.email) || null,
    schoolName,
    className,
    points: Number(roster?.points ?? 0) || 0,
    linked: Boolean(roster),
  };
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
    .filter((e) => s(e.weekday) === day && (!profile.classId || s(e.classId) === profile.classId))
    .map(mapSchedule)
    .sort((a, b) => a.period - b.period);
  return {
    profile,
    nextStep: nextStep(profile),
    stats: {
      students: students.length,
      subjects: subjects.length,
      lessonsToday: today.filter((e) => e.subjectId).length,
      linked: students.filter((st) => st.authUid || st.linkedUserId).length,
      linkedTotal: students.length,
      points: profile.points,
      todayDate: kyivToday(),
      weekday: day,
    },
    today,
  };
}

function mapSchedule(r: Bag): ScheduleEntry {
  return {
    id: s(r.id),
    classId: s(r.classId),
    weekday: s(r.weekday),
    period: Number(r.period) || 0,
    startTime: s(r.startTime),
    endTime: s(r.endTime),
    subjectId: r.subjectId ? s(r.subjectId) : null,
    subjectName: r.subjectName ? s(r.subjectName) : null,
    room: s(r.room),
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
      points: Number(r.points) || 0,
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
  await updateDoc(ref, { points: increment(data.delta) });
  await setDoc(doc(db(), "pointsHistory", newId()), {
    schoolId: p.schoolId,
    rosterId: data.rosterId,
    delta: data.delta,
    note: data.note ?? "",
    byUserId: p.userId,
    createdAt: Date.now(),
  });
  return { ok: true };
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

export async function getSchedule(input?: { data?: { classId?: string } }) {
  const p = await requireProfile();
  let classId = dataOf(input)?.classId || p.classId || "";
  const rows = await bySchool("schedule", p.schoolId!);
  if (!classId) {
    const classes = await bySchool("classes", p.schoolId!);
    classes.sort((a, b) => s(a.name).localeCompare(s(b.name), "uk"));
    classId = classes[0] ? s(classes[0].id) : "";
  }
  if (!classId) return { classId: null as string | null, entries: [] as ScheduleEntry[] };
  const entries = rows
    .filter((r) => s(r.classId) === classId)
    .map(mapSchedule)
    .sort((a, b) => a.weekday.localeCompare(b.weekday) || a.period - b.period);
  return { classId, entries };
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
  if (data.subjectId) {
    const sub = await getDoc(doc(db(), "subjects", data.subjectId));
    if (sub.exists()) {
      subjectName = s(sub.data().name);
      room = s(sub.data().room);
    }
  }
  await updateDoc(ref, { subjectId: data.subjectId, subjectName, room });
  return { ok: true };
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
  }));
  lessons.sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
  if (p.role === "student" && p.classId) {
    lessons = lessons.filter((l) => l.classIds.length === 0 || l.classIds.includes(p.classId!));
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
  };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  if (!title || !data) throw new Error("Title required");
  const sub = await getDoc(doc(db(), "subjects", data.subjectId));
  const id = newId();
  await setDoc(doc(db(), "lessons", id), {
    schoolId: p.schoolId,
    subjectId: data.subjectId,
    subjectName: sub.exists() ? s(sub.data().name) : "",
    teacherId: p.userId,
    title,
    content: data.content ?? "",
    lessonDate: data.lessonDate,
    hasHomework: data.hasHomework || Boolean(data.homeworkDue),
    homeworkDue: data.homeworkDue || null,
    classIds: data.classIds ?? [],
    createdAt: Date.now(),
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
    .map((r) => ({
      id: s(r.id),
      rosterId: s(r.rosterId),
      subjectId: s(r.subjectId),
      subjectName: s(r.subjectName),
      lessonId: r.lessonId ? s(r.lessonId) : null,
      kind: (s(r.kind) || "lesson") as Grade["kind"],
      value: s(r.value),
      comment: s(r.comment),
      createdAt: s(r.createdAt),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { grades };
}

export async function setGrade(input?: {
  data?: { rosterId: string; subjectId: string; lessonId?: string | null; kind: "lesson" | "homework"; value: string; comment?: string };
}) {
  const p = await requireTeacher();
  const data = dataOf(input);
  if (!data?.rosterId || !data.subjectId) throw new Error("Missing");
  const sub = await getDoc(doc(db(), "subjects", data.subjectId));
  const id = newId();
  await setDoc(doc(db(), "grades", id), {
    schoolId: p.schoolId,
    rosterId: data.rosterId,
    subjectId: data.subjectId,
    subjectName: sub.exists() ? s(sub.data().name) : "",
    lessonId: data.lessonId ?? null,
    kind: data.kind,
    value: data.value,
    comment: data.comment ?? "",
    createdAt: new Date().toISOString(),
  });
  return { id };
}

export async function listAnnouncements() {
  const p = await requireProfile();
  let list: Announcement[] = (await bySchool("announcements", p.schoolId!)).map((r) => ({
    id: s(r.id),
    authorId: s(r.authorId),
    authorName: s(r.authorName) || "—",
    title: s(r.title),
    body: s(r.body),
    createdAt: s(r.createdAt),
    classIds: Array.isArray(r.classIds) ? (r.classIds as string[]) : [],
  }));
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (p.role === "student" && p.classId) {
    list = list.filter((a) => a.classIds.length === 0 || a.classIds.includes(p.classId!));
  }
  return { announcements: list };
}

export async function addAnnouncement(input?: { data?: { title: string; body: string; classIds: string[] } }) {
  const p = await requireTeacher();
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  const body = (data?.body ?? "").trim();
  if (!title || !body) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db(), "announcements", id), {
    schoolId: p.schoolId,
    authorId: p.userId,
    authorName: p.displayName,
    title,
    body,
    createdAt: new Date().toISOString(),
    classIds: data?.classIds ?? [],
  });
  return { id };
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
  await requireTeacher();
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
  return { winner };
}

export async function listChats() {
  const p = await requireProfile();
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
      body: s(d.data().body),
      createdAt: s(d.data().createdAt),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-200);
  return { messages };
}

export async function sendMessage(input?: { data?: { chatId: string; body: string } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  const body = (data?.body ?? "").trim();
  if (!data?.chatId || !body) throw new Error("Empty");
  const chatRef = doc(db(), "chats", data.chatId);
  const chat = await getDoc(chatRef);
  const members = (chat.data()?.memberUids ?? []) as string[];
  if (!members.includes(p.userId)) throw new Error("Forbidden");
  const id = newId();
  const createdAt = new Date().toISOString();
  await setDoc(doc(db(), "chatMessages", id), {
    chatId: data.chatId,
    senderUid: p.userId,
    authorName: p.displayName,
    body,
    createdAt,
  });
  await updateDoc(chatRef, { lastBody: body, lastAt: createdAt });
  return { id };
}

export async function startDm(input?: { data?: { otherUserId: string; name: string } }) {
  const p = await requireProfile();
  const data = dataOf(input);
  if (!data?.otherUserId) throw new Error("Missing");
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
