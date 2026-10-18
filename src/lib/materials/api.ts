import { collection, doc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadProfile } from "@/lib/school/firebase-api";
import { requireFeature } from "@/lib/school/settings-api";
import { newId } from "@/lib/school/ids";
import { validateMaterial, type Material, type MaterialInput } from "./model";

async function member() {
  const p = await loadProfile();
  if (!p.schoolId || !p.role) throw new Error("Forbidden");
  return p;
}
export async function listMaterials(): Promise<Material[]> {
  const p = await member();
  const scope = where("schoolId", "==", p.schoolId);
  const col = collection(db(), "materials");
  const requests =
    p.role === "teacher"
      ? [query(col, scope)]
      : [
          query(col, scope, where("status", "==", "published")),
          query(col, scope, where("authorId", "==", p.userId)),
        ];
  const snapshots = await Promise.all(requests.map((q) => getDocs(q)));
  const found = new Map<string, Material>();
  for (const snap of snapshots)
    for (const d of snap.docs)
      found.set(d.id, {
        ...d.data(),
        id: d.id,
        revision: Number(d.data().revision) || 0,
      } as Material);
  return [...found.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function saveMaterial(input: {
  id?: string;
  revision?: number;
  material: MaterialInput;
}) {
  const p = await member();
  const data = validateMaterial(input.material);
  if (p.role === "student") await requireFeature(p, "studentArticles");
  if (p.role !== "teacher" && (p.role !== "student" || data.kind !== "article"))
    throw new Error("Forbidden");
  const ref = doc(db(), "materials", input.id || newId());
  return runTransaction(db(), async (tx) => {
    const old = await tx.get(ref);
    if (input.id && !old.exists()) throw new Error("Not found");
    if (
      old.exists() &&
      (old.data().schoolId !== p.schoolId ||
        (p.role !== "teacher" && old.data().authorId !== p.userId) ||
        old.data().kind !== data.kind)
    )
      throw new Error("Forbidden");
    const revision = Number(old.data()?.revision) || 0;
    if (old.exists() && revision !== input.revision) throw new Error("CONFLICT");
    const now = Date.now();
    tx.set(ref, {
      ...data,
      schoolId: p.schoolId,
      authorId: old.data()?.authorId ?? p.userId,
      authorName: old.data()?.authorName ?? p.displayName,
      createdAt: old.data()?.createdAt ?? now,
      updatedAt: now,
      revision: revision + 1,
    });
    return { id: ref.id, revision: revision + 1 };
  });
}
export async function removeMaterial(input: { id: string; revision: number }) {
  const p = await member();
  if (p.role === "student") await requireFeature(p, "studentArticles");
  const ref = doc(db(), "materials", input.id);
  await runTransaction(db(), async (tx) => {
    const old = await tx.get(ref);
    if (!old.exists() || old.data().schoolId !== p.schoolId) throw new Error("Not found");
    if (p.role !== "teacher" && old.data().authorId !== p.userId) throw new Error("Forbidden");
    if ((Number(old.data().revision) || 0) !== input.revision) throw new Error("CONFLICT");
    tx.delete(ref);
  });
}
