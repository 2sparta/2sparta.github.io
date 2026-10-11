import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  updateDoc,
} from "firebase/firestore";
import assert from "node:assert/strict";
const env = await initializeTestEnvironment({
  projectId: "demo-school-tools",
  firestore: {
    host: (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8185").split(":")[0],
    port: Number((process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8185").split(":")[1]),
    rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  },
});
const material = {
  schoolId: "school-a",
  kind: "article",
  status: "draft",
  title: "Test article",
  topic: "History",
  summary: "",
  body: "## Text\nHello",
  url: "",
  authorId: "student-a",
  authorName: "Test student",
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
};
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "teacher-a"), { schoolId: "school-a", role: "teacher" }),
      setDoc(doc(db, "users", "student-a"), { schoolId: "school-a", role: "student" }),
      setDoc(doc(db, "users", "student-b"), { schoolId: "school-a", role: "student" }),
      setDoc(doc(db, "users", "parent-a"), { schoolId: "school-a", role: "parent" }),
      setDoc(doc(db, "users", "outsider"), { schoolId: "school-b", role: "teacher" }),
      setDoc(doc(db, "materials", "draft"), material),
      setDoc(doc(db, "materials", "published"), { ...material, status: "published" }),
      setDoc(doc(db, "materials", "other-draft"), { ...material, authorId: "student-b" }),
    ]);
  });
  const student = env.authenticatedContext("student-a").firestore();
  const other = env.authenticatedContext("student-b").firestore();
  const teacher = env.authenticatedContext("teacher-a").firestore();
  const parent = env.authenticatedContext("parent-a").firestore();
  const outsider = env.authenticatedContext("outsider").firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(student, "materials", "draft")));
  await assertFails(getDoc(doc(other, "materials", "draft")));
  await assertSucceeds(getDoc(doc(other, "materials", "published")));
  await assertSucceeds(getDoc(doc(parent, "materials", "published")));
  await assertFails(getDoc(doc(parent, "materials", "draft")));
  await assertSucceeds(
    getDocs(
      query(
        collection(student, "materials"),
        where("schoolId", "==", "school-a"),
        where("status", "==", "published"),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(student, "materials"),
        where("schoolId", "==", "school-a"),
        where("authorId", "==", "student-a"),
      ),
    ),
  );
  await assertFails(
    getDocs(query(collection(student, "materials"), where("schoolId", "==", "school-a"))),
  );
  await assertSucceeds(
    getDocs(query(collection(teacher, "materials"), where("schoolId", "==", "school-a"))),
  );
  await assertFails(getDoc(doc(outsider, "materials", "published")));
  await assertFails(getDoc(doc(anon, "materials", "published")));
  await assertSucceeds(getDoc(doc(student, "materials", "missing")));
  await assertSucceeds(setDoc(doc(student, "materials", "own-new"), material));
  await assertFails(
    setDoc(doc(student, "materials", "forged"), { ...material, authorId: "teacher-a" }),
  );
  await assertFails(
    setDoc(doc(student, "materials", "bad-url"), {
      ...material,
      kind: "link",
      url: "javascript:alert(1)",
    }),
  );
  await assertFails(
    setDoc(doc(student, "materials", "student-video"), {
      ...material,
      kind: "video",
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(student, "materials", "draft"), {
      status: "published",
      revision: 2,
      updatedAt: 2,
    }),
  );
  await assertFails(updateDoc(doc(other, "materials", "draft"), { title: "Forged", revision: 3 }));
  await assertFails(
    updateDoc(doc(student, "materials", "draft"), { authorId: "teacher-a", revision: 3 }),
  );
  await assertFails(updateDoc(doc(student, "materials", "draft"), { revision: 2 }));
  await assertSucceeds(
    updateDoc(doc(teacher, "materials", "draft"), { title: "Reviewed", revision: 3 }),
  );
  await assertSucceeds(
    setDoc(doc(teacher, "officeAssignments", "school-a"), {
      schoolId: "school-a",
      revision: 1,
      updatedBy: "teacher-a",
    }),
  );
  await assertFails(
    setDoc(doc(student, "officeAssignments", "school-a"), {
      schoolId: "school-a",
      revision: 2,
      updatedBy: "student-a",
    }),
  );
  await assertFails(getDoc(doc(outsider, "officeAssignments", "school-a")));
  console.log(
    "PASS: 24 Firestore checks: drafts, authorship, school isolation, URL/type validation, revisions, office lock permissions.",
  );
} finally {
  await env.cleanup();
}
