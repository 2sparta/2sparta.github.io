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
  // Self-assessment: the only student-writable mark is their pending lesson submission.
  const assessment = { schoolId: "school-a", rosterId: "roster-a", authorId: "student-a", lessonId: "lesson-a", subjectId: "math", lessonTitle: "Algebra", lessonDate: "2026-01-01", value: "10", status: "pending", submittedAt: 1 };
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "gradingSettings", "school-a"), { schoolId: "school-a", allowSelfAssessment: true }),
      setDoc(doc(db, "students", "roster-a"), { schoolId: "school-a", classId: "class-a", authUid: "student-a" }),
      setDoc(doc(db, "lessons", "lesson-a"), { schoolId: "school-a", subjectId: "math", title: "Algebra", lessonDate: "2026-01-01", classIds: ["class-a"], publishAt: null }),
      setDoc(doc(db, "lessons", "other-class"), { schoolId: "school-a", subjectId: "math", title: "Algebra", lessonDate: "2026-01-01", classIds: ["class-b"], publishAt: null }),
      setDoc(doc(db, "lessons", "unpublished"), { schoolId: "school-a", subjectId: "math", title: "Algebra", lessonDate: "2026-01-01", classIds: ["class-a"], publishAt: "2099-01-01T00:00:00.000Z" }),
    ]);
  });
  await assertFails(updateDoc(doc(other, "students", "roster-a"), { authUid: "student-b", linkedUserId: "student-b" }));
  await assertFails(updateDoc(doc(student, "students", "roster-a"), { classId: "class-b" }));
  await assertFails(updateDoc(doc(student, "lessons", "other-class"), { classIds: ["class-a"] }));
  const selfRef = doc(student, "selfAssessments", "lesson-a_roster-a");
  await assertFails(setDoc(doc(student, "gradingSettings", "school-a"), { schoolId: "school-a", allowSelfAssessment: false, updatedBy: "student-a" }));
  await assertSucceeds(setDoc(selfRef, assessment));
  await assertSucceeds(updateDoc(selfRef, { value: "11", submittedAt: 2 }));
  await assertFails(updateDoc(selfRef, { value: "13" }));
  await assertFails(updateDoc(selfRef, { value: "Н" }));
  await assertFails(updateDoc(selfRef, { kind: "homework" }));
  await assertFails(updateDoc(selfRef, { authorId: "student-b" }));
  await assertFails(setDoc(doc(other, "selfAssessments", "lesson-a_roster-a"), assessment));
  await assertFails(setDoc(doc(parent, "selfAssessments", "lesson-a_roster-a"), assessment));
  await assertFails(getDoc(doc(other, "selfAssessments", "lesson-a_roster-a")));
  await assertFails(setDoc(doc(student, "selfAssessments", "other-class_roster-a"), { ...assessment, lessonId: "other-class" }));
  await assertFails(setDoc(doc(student, "selfAssessments", "unpublished_roster-a"), { ...assessment, lessonId: "unpublished" }));
  await assertFails(setDoc(doc(student, "grades", "forged-final"), { schoolId: "school-a", kind: "final", value: "12" }));
  await assertSucceeds(updateDoc(doc(teacher, "selfAssessments", "lesson-a_roster-a"), { status: "reviewed", reviewedValue: "10", reviewedBy: "teacher-a", reviewedAt: 3 }));
  await assertFails(updateDoc(selfRef, { value: "12" }));
  await assertSucceeds(setDoc(doc(teacher, "gradingSettings", "school-a"), { schoolId: "school-a", allowSelfAssessment: false, updatedBy: "teacher-a", updatedAt: 4 }));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "selfAssessments", "lesson-a_roster-a"), assessment);
  });
  await assertFails(updateDoc(selfRef, { value: "9" }));
  await assertSucceeds(setDoc(doc(teacher, "grades", "official"), { schoolId: "school-a", kind: "lesson", value: "10" }));
  await assertFails(updateDoc(doc(student, "grades", "official"), { value: "12" }));
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
    "PASS: Firestore checks: pending lesson self-assessment, review locks, identities/classes, disabled permission, official grade writes, materials, and office locks.",
  );
} finally {
  await env.cleanup();
}
