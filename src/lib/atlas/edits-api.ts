import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadProfile } from "@/lib/school/firebase-api";
import { atlasWritePatch, parseAtlasEdits, type AtlasEdit } from "./edits";
export async function loadSchoolAtlas() {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Forbidden");
  const snap = await getDoc(doc(db(), "schools", p.schoolId));
  if (!snap.exists()) throw new Error("Not found");
  const school = snap.data();
  return {
    schoolId: p.schoolId,
    entries: parseAtlasEdits(school.atlasEdits),
    revision: Number(school.atlasRevision) || 0,
    canEdit: school.createdBy === p.userId,
  };
}
export async function saveSchoolAtlas(input: {
  schoolId: string;
  revision: number;
  entries: AtlasEdit[];
}) {
  const p = await loadProfile();
  if (!p.schoolId || input.schoolId !== p.schoolId) throw new Error("Forbidden");
  const ref = doc(db(), "schools", p.schoolId);
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Not found");
    const patch = atlasWritePatch(snap.data(), p.userId, input.revision, input.entries, Date.now());
    tx.update(ref, patch);
    return { revision: patch.atlasRevision, entries: parseAtlasEdits(patch.atlasEdits) };
  });
}
