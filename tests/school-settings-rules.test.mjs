import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import { DEFAULT_SETTINGS } from "../src/lib/school/settings.ts";
const env = await initializeTestEnvironment({
  projectId: "demo-settings",
  firestore: {
    host: "127.0.0.1",
    port: 8185,
    rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  },
});
const config = {
  ...structuredClone(DEFAULT_SETTINGS),
  schoolId: "s",
  preset: "custom",
  feedMode: "proposals",
  revision: 1,
  updatedBy: "t",
  updatedAt: 1,
  offices: {
    editor: { name: "Editor", permissions: ["publishNews", "postHomework", "manageDuty"] },
    awarder: { name: "Award only", permissions: ["awardRewards"] },
    rewarder: { name: "Rewards", permissions: ["createRewards", "awardRewards"] },
  },
};
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "t"), { role: "teacher", schoolId: "s" }),
      setDoc(doc(db, "users", "a"), { role: "student", schoolId: "s", rosterId: "ra" }),
      setDoc(doc(db, "users", "b"), { role: "student", schoolId: "s", rosterId: "rb" }),
      setDoc(doc(db, "users", "e"), { role: "student", schoolId: "s", rosterId: "re" }),
      setDoc(doc(db, "users", "outsider"), { role: "teacher", schoolId: "other" }),
      setDoc(doc(db, "students", "ra"), {
        authUid: "a",
        schoolId: "s",
        classId: "c",
        points: 10,
        budget: 0,
        office: null,
      }),
      setDoc(doc(db, "students", "rb"), {
        authUid: "b",
        schoolId: "s",
        classId: "d",
        points: 10,
        budget: 0,
        office: null,
      }),
      setDoc(doc(db, "students", "re"), {
        authUid: "e",
        schoolId: "s",
        classId: "c",
        points: 10,
        budget: 0,
        office: "editor",
      }),
      setDoc(doc(db, "users", "w"), { role: "student", schoolId: "s", rosterId: "rw" }),
      setDoc(doc(db, "students", "rw"), {
        authUid: "w",
        schoolId: "s",
        classId: "c",
        office: "awarder",
        budget: 100,
        points: 0,
      }),
      setDoc(doc(db, "rewards", "award-only"), {
        schoolId: "s",
        authorRosterId: "rw",
        office: "awarder",
        title: "Reward",
        body: "Text",
        points: 5,
        awarded: [],
        hold: 0,
      }),
      setDoc(doc(db, "gradingSettings", "s"), { schoolId: "s", allowSelfAssessment: true }),
      setDoc(doc(db, "lessons", "regular"), {
        schoolId: "s",
        subjectId: "math",
        classIds: ["c"],
        title: "Lesson",
        lessonDate: "2026-01-01",
        workType: "lesson",
      }),
      setDoc(doc(db, "lessons", "test"), {
        schoolId: "s",
        subjectId: "math",
        classIds: ["c"],
        title: "Lesson",
        lessonDate: "2026-01-01",
        workType: "test",
      }),
      setDoc(doc(db, "schoolSettings", "s"), config),
      setDoc(doc(db, "materials", "article"), {
        schoolId: "s",
        kind: "article",
        status: "published",
        authorId: "a",
        authorName: "A",
        title: "Article",
        topic: "History",
        summary: "",
        body: "Text",
        url: "",
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
      setDoc(doc(db, "chats", "chat"), { schoolId: "s", memberUids: ["a", "e"], isAuto: true }),
      setDoc(doc(db, "classes", "c"), { schoolId: "s", dutyGrid: "", dutyRevision: 0 }),
    ]);
  });
  const teacher = env.authenticatedContext("t").firestore(),
    a = env.authenticatedContext("a").firestore(),
    b = env.authenticatedContext("b").firestore(),
    editor = env.authenticatedContext("e").firestore(),
    outsider = env.authenticatedContext("outsider").firestore();
  await assertFails(
    updateDoc(doc(a, "schoolSettings", "s"), { points: false, revision: 2, updatedBy: "a" }),
  );
  await assertFails(getDoc(doc(outsider, "schoolSettings", "s")));
  const post = {
    schoolId: "s",
    kind: "proposal",
    title: "Suggestion",
    body: "A reading club",
    authorId: "a",
    authorName: "A",
    createdAt: 1,
  };
  await assertSucceeds(setDoc(doc(a, "schoolPosts", "p"), post));
  await assertFails(setDoc(doc(b, "schoolPosts", "spoof"), post));
  await assertFails(setDoc(doc(a, "schoolPosts", "news"), { ...post, kind: "news" }));
  const like = { schoolId: "s", userId: "a", createdAt: 1 };
  await assertSucceeds(setDoc(doc(a, "schoolPosts", "p", "likes", "a"), like));
  await assertFails(setDoc(doc(a, "schoolPosts", "p", "likes", "b"), like));
  await assertFails(updateDoc(doc(a, "schoolPosts", "p", "likes", "a"), { createdAt: 2 }));
  await assertSucceeds(deleteDoc(doc(a, "schoolPosts", "p", "likes", "a")));
  await assertSucceeds(setDoc(doc(a, "materials", "article", "likes", "a"), like));
  const comment = {
    schoolId: "s",
    authorId: "a",
    authorName: "A",
    body: "Great idea",
    createdAt: 1,
  };
  await assertSucceeds(setDoc(doc(a, "schoolPosts", "p", "comments", "comment"), comment));
  await assertFails(deleteDoc(doc(b, "schoolPosts", "p", "comments", "comment")));
  await assertSucceeds(deleteDoc(doc(teacher, "schoolPosts", "p", "comments", "comment")));
  await assertFails(
    setDoc(doc(a, "schoolPosts", "p", "comments", "too-long"), {
      ...comment,
      body: "x".repeat(2001),
    }),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "schoolPosts"),
        where("schoolId", "==", "s"),
        where("kind", "==", "proposal"),
      ),
    ),
  );
  await assertSucceeds(
    updateDoc(doc(editor, "classes", "c"), { dutyGrid: "new", dutyRevision: 1 }),
  );
  await assertFails(updateDoc(doc(a, "classes", "c"), { dutyGrid: "hijack", dutyRevision: 2 }));
  await assertFails(updateDoc(doc(a, "students", "ra"), { office: "editor" }));
  await assertFails(
    setDoc(doc(editor, "grades", "fake"), { schoolId: "s", value: "12", kind: "final" }),
  );
  const awarder = env.authenticatedContext("w").firestore();
  await assertFails(updateDoc(doc(awarder, "rewards", "award-only"), { points: 999 }));
  await assertFails(updateDoc(doc(awarder, "rewards", "award-only"), { title: "Changed" }));
  await assertSucceeds(
    updateDoc(doc(awarder, "rewards", "award-only"), {
      awarded: [{ rosterId: "ra", name: "A" }],
      hold: 0,
    }),
  );
  const assessment = {
    schoolId: "s",
    rosterId: "ra",
    authorId: "a",
    lessonId: "regular",
    subjectId: "math",
    lessonTitle: "Lesson",
    lessonDate: "2026-01-01",
    value: "10",
    status: "pending",
    submittedAt: 1,
  };
  // Canonical flag revokes legacy permission even before its mirror is updated.
  await assertFails(setDoc(doc(a, "selfAssessments", "regular_ra"), assessment));
  await env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), "schoolSettings", "s"), { allowSelfAssessment: true }),
  );
  await assertSucceeds(setDoc(doc(a, "selfAssessments", "regular_ra"), assessment));
  await assertFails(
    setDoc(doc(a, "selfAssessments", "test_ra"), { ...assessment, lessonId: "test" }),
  );
  // News permission works only for configured office holders, not every student.
  await assertSucceeds(
    updateDoc(doc(teacher, "schoolSettings", "s"), { feedMode: "news", revision: 2 }),
  );
  await assertSucceeds(
    setDoc(doc(editor, "schoolPosts", "n"), { ...post, kind: "news", authorId: "e" }),
  );
  await assertFails(setDoc(doc(a, "schoolPosts", "n2"), { ...post, kind: "news" }));
  await assertSucceeds(
    updateDoc(doc(teacher, "schoolSettings", "s"), { offices: {}, revision: 3 }),
  );
  await assertFails(
    setDoc(doc(editor, "schoolPosts", "n3"), { ...post, kind: "news", authorId: "e" }),
  );
  // Turning off a feature denies direct SDK writes as well as UI actions.
  await assertSucceeds(
    updateDoc(doc(teacher, "schoolSettings", "s"), {
      feedLikes: false,
      feedComments: false,
      articleLikes: false,
      studentArticles: false,
      chat: false,
      points: false,
      revision: 4,
    }),
  );
  await assertFails(setDoc(doc(a, "schoolPosts", "n", "likes", "a"), like));
  await assertFails(setDoc(doc(a, "schoolPosts", "n", "comments", "blocked"), comment));
  await assertFails(setDoc(doc(a, "materials", "article", "likes", "a"), like));
  await assertFails(
    updateDoc(doc(a, "materials", "article"), { title: "Edited", revision: 2, updatedAt: 2 }),
  );
  await assertFails(updateDoc(doc(teacher, "students", "ra"), { points: 11 }));
  await assertFails(getDoc(doc(a, "chats", "chat")));
  console.log(
    "PASS: school settings, presets policy, feed authoring, unique likes, comments/moderation, article switch, office permissions, revoked rights, points and chat switches.",
  );
} finally {
  await env.cleanup();
}
