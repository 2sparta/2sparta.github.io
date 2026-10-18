import { collection, doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadProfile } from "./firebase-api";
import {
  parseSettings,
  validateSettings,
  type SchoolSettings,
  type Capability,
  canOffice,
} from "./settings";
import type { Profile } from "./types";
export async function readSchoolSettings(schoolId: string) {
  const [current, legacy] = await Promise.all([
    getDoc(doc(db(), "schoolSettings", schoolId)),
    getDoc(doc(db(), "gradingSettings", schoolId)),
  ]);
  return {
    settings: parseSettings(current.data(), legacy.data()?.allowSelfAssessment === true),
    revision: Number(current.data()?.revision) || 0,
  };
}
export async function getSchoolSettings() {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Forbidden");
  return readSchoolSettings(p.schoolId);
}
export async function saveSchoolSettings(input: { settings: SchoolSettings; revision: number }) {
  const p = await loadProfile();
  if (p.role !== "teacher" || !p.schoolId) throw new Error("Forbidden");
  const settings = validateSettings(input.settings);
  const ref = doc(db(), "schoolSettings", p.schoolId);
  const people = await getDocs(
    query(collection(db(), "students"), where("schoolId", "==", p.schoolId)),
  );
  return runTransaction(db(), async (tx) => {
    const current = await tx.get(ref);
    const lock = doc(db(), "officeAssignments", p.schoolId!);
    const lockSnap = await tx.get(lock);
    const holders = await Promise.all(people.docs.map((s) => tx.get(s.ref)));
    if ((Number(current.data()?.revision) || 0) !== input.revision) throw new Error("CONFLICT");
    for (const h of holders)
      if (
        h.exists() &&
        h.data().schoolId === p.schoolId &&
        h.data().office &&
        !settings.offices[h.data().office]
      )
        tx.update(h.ref, { office: null });
    tx.set(ref, {
      ...settings,
      schoolId: p.schoolId,
      revision: input.revision + 1,
      updatedBy: p.userId,
      updatedAt: Date.now(),
    });
    tx.set(doc(db(), "gradingSettings", p.schoolId!), {
      schoolId: p.schoolId,
      allowSelfAssessment: settings.allowSelfAssessment,
      updatedBy: p.userId,
      updatedAt: Date.now(),
    });
    tx.set(lock, {
      schoolId: p.schoolId,
      revision: (Number(lockSnap.data()?.revision) || 0) + 1,
      updatedBy: p.userId,
    });
    return { settings, revision: input.revision + 1 };
  });
}
export async function requireFeature(
  p: Profile,
  key: "points" | "chat" | "selfGovernment" | "clubs" | "studentHomework" | "studentArticles",
) {
  if (!p.schoolId || !(await readSchoolSettings(p.schoolId)).settings[key])
    throw new Error("FEATURE_DISABLED");
}
export async function hasOfficePermission(p: Profile, capability: Capability) {
  if (!p.schoolId) return false;
  return canOffice((await readSchoolSettings(p.schoolId)).settings, p, capability);
}
