import {
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
import { db } from "@/lib/firebase";
import { OFFICES, newId, officeName } from "./ids";
import { loadProfile } from "./firebase-api";
import type { Profile } from "./types";

type Bag = DocumentData;

function dataOf<T>(input?: { data?: T } | null): T | undefined {
  if (input && typeof input === "object" && "data" in input) return input.data;
  return undefined;
}

function s(v: unknown, fallback = "") {
  if (v == null) return fallback;
  return String(v);
}

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.trunc(n)));
}

async function profile() {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Join a school first");
  return p;
}

async function bySchool(name: string, schoolId: string): Promise<Bag[]> {
  const snap = await getDocs(query(collection(db(), name), where("schoolId", "==", schoolId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function minutes(hhmm: string) {
  if (!hhmm?.includes(":")) return null;
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export function clubsOverlap(
  a: { weekday: string; startTime: string; endTime: string },
  b: { weekday: string; startTime: string; endTime: string },
) {
  if (a.weekday !== b.weekday) return false;
  const as = minutes(a.startTime);
  const ae = minutes(a.endTime);
  const bs = minutes(b.startTime);
  const be = minutes(b.endTime);
  if (as == null || ae == null || bs == null || be == null) return a.startTime === b.startTime;
  return as < be && bs < ae;
}

export function clubClusters<T extends { id: string; weekday: string; startTime: string; endTime: string }>(clubs: T[]) {
  const days = [...new Set(clubs.map((c) => c.weekday))];
  const groups: T[][] = [];
  for (const day of days) {
    const list = clubs.filter((c) => c.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const used = new Set<string>();
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

function clusterKey(group: { id: string }[]) {
  return group.map((c) => c.id).sort().join(",");
}

export async function setStudentPerms(input?: { data?: { rosterId: string; isStarosta?: boolean; canPostHw?: boolean } }) {
  const p = await profile();
  const data = dataOf(input);
  if (!data?.rosterId) throw new Error("Missing");
  const ref = doc(db(), "students", data.rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (p.role === "teacher") {
    if (data.isStarosta != null) {
      const classId = s(snap.data().classId);
      if (data.isStarosta && classId) {
        const mates = (await bySchool("students", p.schoolId!)).filter((st) => s(st.classId) === classId);
        const batch = writeBatch(db());
        for (const st of mates) batch.update(doc(db(), "students", s(st.id)), { isStarosta: s(st.id) === data.rosterId });
        await batch.commit();
      } else await updateDoc(ref, { isStarosta: false });
    }
    if (data.canPostHw != null) await updateDoc(ref, { canPostHw: data.canPostHw === true });
    return { ok: true };
  }
  if (p.role === "student" && p.isStarosta && data.canPostHw != null) {
    if (s(snap.data().classId) !== p.classId) throw new Error("Forbidden");
    await updateDoc(ref, { canPostHw: data.canPostHw === true });
    return { ok: true };
  }
  throw new Error("Forbidden");
}

export async function listClassmates() {
  const p = await profile();
  if (!p.classId || (p.role !== "student" && p.role !== "teacher")) return { students: [] as { id: string; name: string; canPostHw: boolean; isStarosta: boolean }[] };
  const rows = (await bySchool("students", p.schoolId!)).filter((r) => s(r.classId) === p.classId);
  return {
    students: rows
      .map((r) => ({
        id: s(r.id),
        name: s(r.name),
        canPostHw: r.canPostHw === true,
        isStarosta: r.isStarosta === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk")),
  };
}

export async function listRosterNames() {
  const p = await profile();
  if (p.role === "parent") return { students: [] as { id: string; name: string; className: string }[] };
  const rows = await bySchool("students", p.schoolId!);
  return {
    students: rows
      .map((r) => ({ id: s(r.id), name: s(r.name), className: s(r.className) }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk")),
  };
}

export async function setOffice(input?: { data?: { rosterId: string; office: string | null } }) {
  const p = await profile();
  if (p.role !== "teacher") throw new Error("Forbidden");
  const data = dataOf(input);
  if (!data?.rosterId) throw new Error("Missing");
  const office = data.office || null;
  if (office && !OFFICES.some((o) => o.id === office)) throw new Error("Missing");
  const ref = doc(db(), "students", data.rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const batch = writeBatch(db());
  if (office) {
    const rows = await bySchool("students", p.schoolId!);
    for (const st of rows) {
      if (s(st.office) === office && s(st.id) !== data.rosterId) batch.update(doc(db(), "students", s(st.id)), { office: null });
    }
  }
  batch.update(ref, { office });
  await batch.commit();
  return { ok: true };
}

export async function fundOffice(input?: { data?: { rosterId: string; delta: number } }) {
  const p = await profile();
  if (p.role !== "teacher") throw new Error("Forbidden");
  const data = dataOf(input);
  if (!data?.rosterId) throw new Error("Missing");
  const ref = doc(db(), "students", data.rosterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (!snap.data().office) throw new Error("NO_OFFICE");
  const next = clamp(clamp(Number(snap.data().budget) || 0) + (Number(data.delta) || 0));
  await updateDoc(ref, { budget: next });
  return { budget: next };
}

export async function listRewards() {
  const p = await profile();
  const rows = await bySchool("rewards", p.schoolId!);
  return {
    rewards: rows
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
        createdAt: Number(r.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
  };
}

export async function addReward(input?: { data?: { title: string; body: string; points: number } }) {
  const p = await profile();
  if (p.role !== "student" || !p.office || !p.rosterId) throw new Error("Forbidden");
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  const body = (data?.body ?? "").trim();
  const points = clamp(Number(data?.points) || 0);
  if (!title || !body || points < 1) throw new Error("Required");
  const ref = doc(db(), "students", p.rosterId);
  const snap = await getDoc(ref);
  const budget = clamp(Number(snap.data()?.budget) || 0);
  if (points > budget) throw new Error("BUDGET");
  await updateDoc(ref, { budget: budget - points });
  const id = newId();
  await setDoc(doc(db(), "rewards", id), {
    schoolId: p.schoolId,
    office: p.office,
    authorRosterId: p.rosterId,
    authorName: p.displayName,
    title,
    body,
    points,
    awardedRosterId: null,
    awardedName: null,
    createdAt: Date.now(),
  });
  return { id };
}

export async function awardReward(input?: { data?: { rewardId: string; rosterId: string } }) {
  const p = await profile();
  const data = dataOf(input);
  if (!data?.rewardId || !data.rosterId || !p.rosterId) throw new Error("Missing");
  if (data.rosterId === p.rosterId) throw new Error("SELF");
  const rewardRef = doc(db(), "rewards", data.rewardId);
  const reward = await getDoc(rewardRef);
  if (!reward.exists() || reward.data().schoolId !== p.schoolId) throw new Error("Not found");
  if (s(reward.data().authorRosterId) !== p.rosterId) throw new Error("Forbidden");
  if (reward.data().awardedRosterId) throw new Error("AWARDED");
  const studentRef = doc(db(), "students", data.rosterId);
  const student = await getDoc(studentRef);
  if (!student.exists() || student.data().schoolId !== p.schoolId) throw new Error("Not found");
  const points = clamp(Number(reward.data().points) || 0);
  const next = clamp(clamp(Number(student.data().points) || 0) + points);
  await updateDoc(studentRef, { points: next });
  await setDoc(doc(db(), "pointsHistory", newId()), {
    schoolId: p.schoolId,
    rosterId: data.rosterId,
    delta: points,
    note: `Нагорода: ${s(reward.data().title)}`,
    byUserId: p.userId,
    byName: p.displayName || "",
    pointsAfter: next,
    createdAt: Date.now(),
  });
  await updateDoc(rewardRef, { awardedRosterId: data.rosterId, awardedName: s(student.data().name) });
  return { ok: true };
}

function mapClub(r: Bag, rosterId: string | null) {
  const memberIds = Array.isArray(r.memberIds) ? (r.memberIds as string[]).map((id) => s(id)) : [];
  return {
    id: s(r.id),
    name: s(r.name),
    kind: (s(r.kind) === "elective" ? "elective" : "club") as "club" | "elective",
    weekday: s(r.weekday),
    startTime: s(r.startTime),
    endTime: s(r.endTime),
    room: s(r.room),
    about: s(r.about),
    imageUrl: s(r.imageUrl),
    memberCount: memberIds.length,
    memberIds,
    joined: Boolean(rosterId && memberIds.includes(rosterId)),
  };
}

export async function listClubs() {
  const p = await profile();
  const rows = await bySchool("clubs", p.schoolId!);
  let picks: Record<string, string> = {};
  if (p.rosterId) {
    const me = await getDoc(doc(db(), "students", p.rosterId));
    const raw = me.data()?.clubPicks;
    if (raw && typeof raw === "object") picks = raw as Record<string, string>;
  }
  return {
    clubs: rows.map((r) => mapClub(r, p.rosterId)).sort((a, b) => a.weekday.localeCompare(b.weekday) || a.startTime.localeCompare(b.startTime)),
    picks,
  };
}

export async function addClub(input?: {
  data?: {
    name: string;
    kind: "club" | "elective";
    weekday: string;
    startTime: string;
    endTime: string;
    room?: string;
    about?: string;
    imageUrl?: string;
  };
}) {
  const p = await profile();
  if (p.role !== "teacher") throw new Error("Forbidden");
  const data = dataOf(input);
  const name = (data?.name ?? "").trim();
  if (!name || !data?.weekday || !data.startTime || !data.endTime) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db(), "clubs", id), {
    schoolId: p.schoolId,
    name,
    kind: data.kind === "elective" ? "elective" : "club",
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime,
    room: (data.room ?? "").trim(),
    about: (data.about ?? "").trim(),
    imageUrl: (data.imageUrl ?? "").trim(),
    memberIds: [],
    createdAt: Date.now(),
  });
  return { id };
}

export async function deleteClub(input?: { data?: { id: string } }) {
  const p = await profile();
  if (p.role !== "teacher") throw new Error("Forbidden");
  const id = dataOf(input)?.id;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "clubs", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  await deleteDoc(ref);
  return { ok: true };
}

export async function joinClub(input?: { data?: { id: string; join: boolean } }) {
  const p = await profile();
  if (p.role !== "student" || !p.rosterId) throw new Error("Forbidden");
  const data = dataOf(input);
  if (!data?.id) throw new Error("Missing");
  const ref = doc(db(), "clubs", data.id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  await updateDoc(ref, { memberIds: data.join ? arrayUnion(p.rosterId) : arrayRemove(p.rosterId) });
  return { ok: true };
}

export async function pickClub(input?: { data?: { clubId: string } }) {
  const p = await profile();
  if (p.role !== "student" || !p.rosterId) throw new Error("Forbidden");
  const clubId = dataOf(input)?.clubId;
  if (!clubId) throw new Error("Missing");
  const listed = await listClubs();
  const joined = listed.clubs.filter((c) => c.joined);
  const group = clubClusters(joined).find((items) => items.some((c) => c.id === clubId));
  if (!group || group.length < 2) throw new Error("Missing");
  await updateDoc(doc(db(), "students", p.rosterId), { [`clubPicks.${clusterKey(group)}`]: clubId });
  return { ok: true };
}

export async function listClassHomework() {
  const p = await profile();
  let rows = await bySchool("classHomework", p.schoolId!);
  if (p.role !== "teacher" && p.classId) rows = rows.filter((r) => s(r.classId) === p.classId);
  return {
    posts: rows
      .map((r) => ({
        id: s(r.id),
        classId: s(r.classId),
        subjectName: s(r.subjectName),
        title: s(r.title),
        body: s(r.body),
        due: s(r.due).slice(0, 10),
        authorName: s(r.authorName),
        authorRosterId: s(r.authorRosterId),
        createdAt: Number(r.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
  };
}

export async function addClassHomework(input?: { data?: { subjectName: string; title: string; body?: string; due: string } }) {
  const p = await profile();
  if (p.role !== "student" || !p.classId || !p.rosterId) throw new Error("Forbidden");
  if (!p.isStarosta && !p.canPostHw) throw new Error("Forbidden");
  const data = dataOf(input);
  const title = (data?.title ?? "").trim();
  const subjectName = (data?.subjectName ?? "").trim();
  if (!title || !subjectName || !data?.due) throw new Error("Required");
  const id = newId();
  await setDoc(doc(db(), "classHomework", id), {
    schoolId: p.schoolId,
    classId: p.classId,
    subjectName,
    title,
    body: (data.body ?? "").trim(),
    due: data.due,
    authorName: p.displayName,
    authorRosterId: p.rosterId,
    createdAt: Date.now(),
  });
  return { id };
}

export async function deleteClassHomework(input?: { data?: { id: string } }) {
  const p = await profile();
  const id = dataOf(input)?.id;
  if (!id) throw new Error("Missing");
  const ref = doc(db(), "classHomework", id);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const own = s(snap.data().authorRosterId) === p.rosterId;
  if (p.role !== "teacher" && !own && !(p.isStarosta && s(snap.data().classId) === p.classId)) throw new Error("Forbidden");
  await deleteDoc(ref);
  return { ok: true };
}

export function attendingClubIds(joined: { id: string; weekday: string; startTime: string; endTime: string }[], picks: Record<string, string>) {
  const ids = new Set<string>();
  for (const group of clubClusters(joined)) {
    if (group.length === 1) ids.add(group[0].id);
    else {
      const chosen = picks[clusterKey(group)];
      if (chosen && group.some((c) => c.id === chosen)) ids.add(chosen);
    }
  }
  return ids;
}

export type { Profile };
