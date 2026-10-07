import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { isOnline } from "./offline";

export const OFFICES = [
  { id: "interschool", name: "Голова комітету міжшкільних зв’язків" },
  { id: "public", name: "Голова комітету зв’язків з громадськістю" },
  { id: "culture", name: "Голова комітету культури і дозвілля" },
  { id: "sport", name: "Голова комітету фізкультури і спорту" },
  { id: "media", name: "Голова комітету інформації та медіаресурсів" },
  { id: "tech", name: "Голова комітету звукового і технічного оформлення" },
  { id: "speaker", name: "Спікер" },
];

export function officeName(id) {
  return OFFICES.find((o) => o.id === id)?.name || "";
}

function s(v, fallback = "") {
  return v == null ? fallback : String(v);
}

function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.trunc(n)));
}

async function mustOnline() {
  if (!(await isOnline())) throw new Error("OFFLINE");
}

async function rows(name, schoolId) {
  const snap = await getDocs(query(collection(db, name), where("schoolId", "==", schoolId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function minutes(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export function clubsOverlap(a, b) {
  if (a.weekday !== b.weekday) return false;
  const as = minutes(a.startTime);
  const ae = minutes(a.endTime);
  const bs = minutes(b.startTime);
  const be = minutes(b.endTime);
  if (as == null || ae == null || bs == null || be == null) return a.startTime === b.startTime;
  return as < be && bs < ae;
}

export function clubClusters(clubs) {
  const days = [...new Set(clubs.map((c) => c.weekday))];
  const groups = [];
  for (const day of days) {
    const list = clubs.filter((c) => c.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const used = new Set();
    for (const club of list) {
      if (used.has(club.id)) continue;
      const group = [club];
      used.add(club.id);
      let grew = true;
      while (grew) {
        grew = false;
        for (const other of list) {
          if (used.has(other.id)) continue;
          if (group.some((item) => clubsOverlap(item, other))) {
            group.push(other);
            used.add(other.id);
            grew = true;
          }
        }
      }
      groups.push(group);
    }
  }
  return groups;
}

function clusterKey(group) {
  return group.map((c) => c.id).sort().join(",");
}

export async function setStudentPerms(profile, rosterId, patch) {
  await mustOnline();
  const ref = doc(db, "students", rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== profile.schoolId) throw new Error("Not found");
  if (profile.role === "teacher") {
    if (patch.isStarosta != null) {
      const classId = s(snap.data().classId);
      if (patch.isStarosta && classId) {
        const mates = (await rows("students", profile.schoolId)).filter((st) => s(st.classId) === classId);
        const batch = writeBatch(db);
        for (const st of mates) batch.update(doc(db, "students", s(st.id)), { isStarosta: s(st.id) === rosterId });
        await batch.commit();
      } else await updateDoc(ref, { isStarosta: false });
    }
    if (patch.canPostHw != null) await updateDoc(ref, { canPostHw: patch.canPostHw === true });
    return;
  }
  if (profile.role === "student" && profile.isStarosta && patch.canPostHw != null) {
    if (s(snap.data().classId) !== profile.classId) throw new Error("Forbidden");
    await updateDoc(ref, { canPostHw: patch.canPostHw === true });
    return;
  }
  throw new Error("Forbidden");
}

export async function listClassmates(profile) {
  if (!profile.classId) return { students: [] };
  const list = (await rows("students", profile.schoolId)).filter((r) => s(r.classId) === profile.classId);
  return {
    students: list
      .map((r) => ({ id: s(r.id), name: s(r.name), canPostHw: r.canPostHw === true, isStarosta: r.isStarosta === true }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk")),
  };
}

export async function listRosterNames(profile) {
  const list = await rows("students", profile.schoolId);
  return {
    students: list.map((r) => ({ id: s(r.id), name: s(r.name), className: s(r.className) })).sort((a, b) => a.name.localeCompare(b.name, "uk")),
  };
}

export async function setOffice(profile, rosterId, office) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  const ref = doc(db, "students", rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const batch = writeBatch(db);
  if (office) {
    for (const st of await rows("students", profile.schoolId)) {
      if (s(st.office) === office && s(st.id) !== rosterId) batch.update(doc(db, "students", s(st.id)), { office: null });
    }
  }
  batch.update(ref, { office: office || null });
  await batch.commit();
}

export async function fundOffice(profile, rosterId, delta) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  const ref = doc(db, "students", rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || !snap.data().office) throw new Error("NO_OFFICE");
  const next = clamp(clamp(Number(snap.data().budget) || 0) + Number(delta || 0));
  await updateDoc(ref, { budget: next });
}

export async function listRewards(profile) {
  const list = await rows("rewards", profile.schoolId);
  return {
    rewards: list
      .map((r) => ({
        id: s(r.id),
        office: s(r.office),
        officeName: officeName(s(r.office)),
        authorRosterId: s(r.authorRosterId),
        authorName: s(r.authorName),
        title: s(r.title),
        body: s(r.body),
        points: clamp(Number(r.points) || 0),
        awardedRosterId: r.awardedRosterId ? s(r.awardedRosterId) : null,
        awardedName: r.awardedName ? s(r.awardedName) : null,
      }))
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
  };
}

export async function addReward(profile, { title, body, points }) {
  await mustOnline();
  if (profile.role !== "student" || !profile.office || !profile.rosterId) throw new Error("Forbidden");
  const amount = clamp(Number(points) || 0);
  if (!title.trim() || !body.trim() || amount < 1) throw new Error("Required");
  const ref = doc(db, "students", profile.rosterId);
  const snap = await getDoc(ref);
  const budget = clamp(Number(snap.data()?.budget) || 0);
  if (amount > budget) throw new Error("BUDGET");
  await updateDoc(ref, { budget: budget - amount });
  await setDoc(doc(db, "rewards", newId()), {
    schoolId: profile.schoolId,
    office: profile.office,
    authorRosterId: profile.rosterId,
    authorName: profile.displayName,
    title: title.trim(),
    body: body.trim(),
    points: amount,
    awardedRosterId: null,
    awardedName: null,
    createdAt: Date.now(),
  });
}

export async function awardReward(profile, rewardId, rosterId) {
  await mustOnline();
  if (rosterId === profile.rosterId) throw new Error("SELF");
  const rewardRef = doc(db, "rewards", rewardId);
  const reward = await getDoc(rewardRef);
  if (!reward.exists() || s(reward.data().authorRosterId) !== profile.rosterId) throw new Error("Forbidden");
  if (reward.data().awardedRosterId) throw new Error("AWARDED");
  const studentRef = doc(db, "students", rosterId);
  const student = await getDoc(studentRef);
  if (!student.exists()) throw new Error("Not found");
  const points = clamp(Number(reward.data().points) || 0);
  const next = clamp(clamp(Number(student.data().points) || 0) + points);
  await updateDoc(studentRef, { points: next });
  await setDoc(doc(db, "pointsHistory", newId()), {
    schoolId: profile.schoolId,
    rosterId,
    delta: points,
    note: `Нагорода: ${s(reward.data().title)}`,
    byUserId: profile.userId,
    byName: profile.displayName || "",
    pointsAfter: next,
    createdAt: Date.now(),
  });
  await updateDoc(rewardRef, { awardedRosterId: rosterId, awardedName: s(student.data().name) });
}

function mapClub(r, rosterId) {
  const memberIds = Array.isArray(r.memberIds) ? r.memberIds.map((id) => s(id)) : [];
  return {
    id: s(r.id),
    name: s(r.name),
    kind: s(r.kind) === "elective" ? "elective" : "club",
    weekday: s(r.weekday),
    startTime: s(r.startTime),
    endTime: s(r.endTime),
    room: s(r.room),
    about: s(r.about),
    imageUrl: s(r.imageUrl),
    memberCount: memberIds.length,
    joined: Boolean(rosterId && memberIds.includes(rosterId)),
  };
}

export async function listClubs(profile) {
  const list = await rows("clubs", profile.schoolId);
  let picks = {};
  if (profile.rosterId) {
    const me = await getDoc(doc(db, "students", profile.rosterId));
    if (me.data()?.clubPicks && typeof me.data().clubPicks === "object") picks = me.data().clubPicks;
  }
  return {
    clubs: list.map((r) => mapClub(r, profile.rosterId)).sort((a, b) => a.weekday.localeCompare(b.weekday) || a.startTime.localeCompare(b.startTime)),
    picks,
  };
}

export async function addClub(profile, data) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  await setDoc(doc(db, "clubs", newId()), {
    schoolId: profile.schoolId,
    name: data.name.trim(),
    kind: data.kind === "elective" ? "elective" : "club",
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime,
    room: (data.room || "").trim(),
    about: (data.about || "").trim(),
    imageUrl: (data.imageUrl || "").trim(),
    memberIds: [],
    createdAt: Date.now(),
  });
}

export async function deleteClub(profile, id) {
  await mustOnline();
  if (profile.role !== "teacher") throw new Error("Forbidden");
  await deleteDoc(doc(db, "clubs", id));
}

export async function joinClub(profile, id, join) {
  await mustOnline();
  if (profile.role !== "student" || !profile.rosterId) throw new Error("Forbidden");
  await updateDoc(doc(db, "clubs", id), { memberIds: join ? arrayUnion(profile.rosterId) : arrayRemove(profile.rosterId) });
}

export async function pickClub(profile, clubId) {
  await mustOnline();
  if (!profile.rosterId) throw new Error("Forbidden");
  const listed = await listClubs(profile);
  const joined = listed.clubs.filter((c) => c.joined);
  const group = clubClusters(joined).find((items) => items.some((c) => c.id === clubId));
  if (!group || group.length < 2) throw new Error("Missing");
  await updateDoc(doc(db, "students", profile.rosterId), { [`clubPicks.${clusterKey(group)}`]: clubId });
}

export async function listClassHomework(profile) {
  let list = await rows("classHomework", profile.schoolId);
  if (profile.role !== "teacher" && profile.classId) list = list.filter((r) => s(r.classId) === profile.classId);
  return {
    posts: list
      .map((r) => ({
        id: s(r.id),
        subjectName: s(r.subjectName),
        title: s(r.title),
        body: s(r.body),
        due: s(r.due).slice(0, 10),
        authorName: s(r.authorName),
        authorRosterId: s(r.authorRosterId),
      }))
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
  };
}

export async function addClassHomework(profile, data) {
  await mustOnline();
  if (profile.role !== "student" || !profile.classId) throw new Error("Forbidden");
  if (!profile.isStarosta && !profile.canPostHw) throw new Error("Forbidden");
  await setDoc(doc(db, "classHomework", newId()), {
    schoolId: profile.schoolId,
    classId: profile.classId,
    subjectName: data.subjectName.trim(),
    title: data.title.trim(),
    body: (data.body || "").trim(),
    due: data.due,
    authorName: profile.displayName,
    authorRosterId: profile.rosterId,
    createdAt: Date.now(),
  });
}

export async function deleteClassHomework(profile, id) {
  await mustOnline();
  const ref = doc(db, "classHomework", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const own = s(snap.data().authorRosterId) === profile.rosterId;
  if (profile.role !== "teacher" && !own && !(profile.isStarosta && s(snap.data().classId) === profile.classId)) throw new Error("Forbidden");
  await deleteDoc(ref);
}
