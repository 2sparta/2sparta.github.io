import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadProfile } from "./firebase-api";
import { readSchoolSettings } from "./settings-api";
import { canOffice } from "./settings";
import { newId } from "./ids";
export type SchoolPost = {
  id: string;
  schoolId: string;
  kind: "proposal" | "news";
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};
export type EngagementTarget = "post" | "article";
export type ContentComment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};
const parent = (target: EngagementTarget, id: string) => {
  if (!["post", "article"].includes(target) || !/^[-a-zA-Z0-9_]{1,150}$/.test(id))
    throw new Error("INVALID_TARGET");
  return doc(db(), target === "post" ? "schoolPosts" : "materials", id);
};
export async function listSchoolPosts(): Promise<SchoolPost[]> {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Forbidden");
  const { settings } = await readSchoolSettings(p.schoolId);
  if (settings.feedMode === "off") return [];
  const kind = settings.feedMode === "proposals" ? "proposal" : "news";
  const snap = await getDocs(
    query(
      collection(db(), "schoolPosts"),
      where("schoolId", "==", p.schoolId),
      where("kind", "==", kind),
    ),
  );
  return snap.docs
    .map((s) => ({ ...s.data(), id: s.id }) as SchoolPost)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
}
export async function saveSchoolPost(input: { id?: string; title: string; body: string }) {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Forbidden");
  const { settings } = await readSchoolSettings(p.schoolId);
  const kind = settings.feedMode === "proposals" ? "proposal" : "news";
  if (
    settings.feedMode === "off" ||
    (kind === "proposal"
      ? p.role !== "student" || !p.linked
      : p.role !== "teacher" && !canOffice(settings, p, "publishNews"))
  )
    throw new Error("Forbidden");
  const title = input.title.trim(),
    body = input.body.trim();
  if (!title || title.length > 160 || !body || body.length > 4000) throw new Error("INVALID_POST");
  const ref = parent("post", input.id || newId());
  await runTransaction(db(), async (tx) => {
    const old = await tx.get(ref);
    if (
      input.id &&
      (!old.exists() ||
        old.data().schoolId !== p.schoolId ||
        old.data().kind !== kind ||
        old.data().authorId !== p.userId)
    )
      throw new Error("Forbidden");
    tx.set(ref, {
      schoolId: p.schoolId,
      kind,
      title,
      body,
      authorId: p.userId,
      authorName: p.displayName,
      createdAt: old.data()?.createdAt ?? Date.now(),
    });
  });
  return { id: ref.id };
}
export async function removeSchoolPost(id: string) {
  const p = await loadProfile(),
    ref = parent("post", id),
    snap = await getDoc(ref);
  if (
    !snap.exists() ||
    snap.data().schoolId !== p.schoolId ||
    (p.role !== "teacher" && snap.data().authorId !== p.userId)
  )
    throw new Error("Forbidden");
  await deleteDoc(ref);
}
async function context(target: EngagementTarget, id: string) {
  const p = await loadProfile();
  if (!p.schoolId) throw new Error("Forbidden");
  const ref = parent(target, id);
  const [snap, config] = await Promise.all([getDoc(ref), readSchoolSettings(p.schoolId)]);
  if (!snap.exists() || snap.data().schoolId !== p.schoolId) throw new Error("Not found");
  const settings = config.settings;
  if (
    target === "article"
      ? snap.data().kind !== "article" || snap.data().status !== "published"
      : settings.feedMode !== (snap.data().kind === "proposal" ? "proposals" : "news")
  )
    throw new Error("FEATURE_DISABLED");
  return {
    p,
    ref,
    likes: target === "article" ? settings.articleLikes : settings.feedLikes,
    comments: target === "post" && settings.feedComments,
  };
}
export async function listContentInteractions(target: EngagementTarget, id: string) {
  const c = await context(target, id);
  const [likes, comments] = await Promise.all([
    c.likes ? getDocs(collection(c.ref, "likes")) : null,
    c.comments
      ? getDocs(query(collection(c.ref, "comments"), orderBy("createdAt", "desc"), limit(100)))
      : null,
  ]);
  return {
    count: likes?.size ?? 0,
    liked: likes?.docs.some((d) => d.id === c.p.userId) ?? false,
    comments:
      comments?.docs.map((d) => ({ ...d.data(), id: d.id }) as ContentComment).reverse() ?? [],
  };
}
export async function toggleContentLike(target: EngagementTarget, id: string) {
  const c = await context(target, id);
  if (!c.likes) throw new Error("FEATURE_DISABLED");
  const ref = doc(c.ref, "likes", c.p.userId);
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) tx.delete(ref);
    else tx.set(ref, { schoolId: c.p.schoolId, userId: c.p.userId, createdAt: Date.now() });
  });
}
export async function addContentComment(id: string, body: string) {
  const c = await context("post", id);
  if (!c.comments) throw new Error("FEATURE_DISABLED");
  const text = body.trim();
  if (!text || text.length > 2000) throw new Error("INVALID_COMMENT");
  await setDoc(doc(c.ref, "comments", newId()), {
    schoolId: c.p.schoolId,
    authorId: c.p.userId,
    authorName: c.p.displayName,
    body: text,
    createdAt: Date.now(),
  });
}
export async function removeContentComment(id: string, commentId: string) {
  const c = await context("post", id);
  if (!c.comments) throw new Error("FEATURE_DISABLED");
  const ref = doc(c.ref, "comments", commentId),
    snap = await getDoc(ref);
  if (!snap.exists() || (c.p.role !== "teacher" && snap.data().authorId !== c.p.userId))
    throw new Error("Forbidden");
  await deleteDoc(ref);
}
