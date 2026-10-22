import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

let env;
const db = (uid) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8185").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-security-rules",
    firestore: {
      host,
      port: Number(port),
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const rows = {
      "users/admin": { role: "admin", schoolId: "a", isAdmin: true },
      "users/teacher": { role: "teacher", schoolId: "a", isAdmin: false },
      "users/student": {
        role: "student",
        schoolId: "a",
        classId: "class-a",
        rosterId: "r1",
        displayName: "Учень",
        isAdmin: false,
      },
      "users/peer": {
        role: "student",
        schoolId: "a",
        classId: "other-class",
        rosterId: "r2",
        isAdmin: false,
      },
      "users/parent": {
        role: "parent",
        schoolId: "a",
        classId: "class-a",
        rosterId: "r1",
        isAdmin: false,
      },
      "users/outsider": { role: "admin", schoolId: "b", isAdmin: true },
      "users/pending": { role: "pending-teacher", schoolId: null, isAdmin: false },
      "schools/a": { name: "A", createdBy: "admin" },
      "students/r1": {
        schoolId: "a",
        classId: "class-a",
        authUid: "student",
        points: 1,
        budget: 50,
        office: "sport",
      },
      "students/r2": { schoolId: "a", classId: "other-class", authUid: "peer", points: 1 },
      "students/unclaimed": { schoolId: "a", authUid: null, linkedUserId: null },
      "classes/class-a": { schoolId: "a", name: "8-А" },
      "teacherInvites/ABCDEFGHJKLMNPQR": { schoolId: "a", createdBy: "admin", usedBy: null },
      "studentInvites/unclaimed": { schoolId: "a", code: "ABCDEFGHJKLMNPQS" },
      "grades/g1": { schoolId: "a", rosterId: "r1", value: "10" },
      "grades/g2": { schoolId: "a", rosterId: "r2", value: "8" },
      "chats/dm": {
        schoolId: "a",
        memberUids: ["teacher", "peer"],
        isAuto: false,
        kind: "dm",
        createdBy: "teacher",
      },
      "chats/teachers": {
        schoolId: "a",
        memberUids: ["teacher"],
        isAuto: true,
        kind: "teachers",
        createdBy: "teacher",
      },
      "chats/class": {
        schoolId: "a",
        memberUids: ["teacher"],
        isAuto: true,
        kind: "class",
        classId: "class-a",
        createdBy: "teacher",
      },
      "chatMessages/m1": { chatId: "dm", senderUid: "teacher", body: "Private" },
      "notifications/n1": {
        recipientUid: "student",
        schoolId: "a",
        title: "Original",
        read: false,
      },
      "elections/e1": {
        schoolId: "a",
        classId: "class-a",
        closed: false,
        votes: { r2: "r1" },
        candidates: [],
      },
      "clubs/c1": { schoolId: "a", memberIds: ["r2"] },
    };
    for (const name of [
      "subjects",
      "schedule",
      "groups",
      "lessons",
      "announcements",
      "starostaHistory",
    ])
      rows[`${name}/a`] = { schoolId: "a", title: "original" };
    await Promise.all(
      Object.entries(rows).map(([path, data]) => setDoc(doc(c.firestore(), path), data)),
    );
  });
});
after(async () => {
  await env?.cleanup();
});

test("profile edits cannot escalate a role, change school or forge a roster link", async () => {
  await assertFails(
    updateDoc(doc(db("pending"), "users/pending"), { role: "admin", schoolId: "a", isAdmin: true }),
  );
  await assertFails(
    updateDoc(doc(db("teacher"), "users/teacher"), { role: "admin", isAdmin: true }),
  );
  for (const patch of [
    { schoolId: "b" },
    { rosterId: "r2" },
    { isAdmin: true },
    { classId: "other-class" },
  ])
    await assertFails(updateDoc(doc(db("student"), "users/student"), patch));
  await assertFails(
    setDoc(doc(db("new"), "users/new"), {
      role: "student",
      schoolId: "a",
      isAdmin: false,
      setupComplete: false,
    }),
  );
  await assertSucceeds(
    setDoc(doc(db("new"), "users/new"), {
      role: "student",
      schoolId: null,
      isAdmin: false,
      setupComplete: false,
    }),
  );
  await assertSucceeds(updateDoc(doc(db("student"), "users/student"), { displayName: "Учень" }));
  await assertFails(getDoc(doc(db("outsider"), "users/student")));
});
test("only the school's administrator can grant a teacher an admin role", async () => {
  await assertFails(
    updateDoc(doc(db("outsider"), "users/teacher"), { role: "admin", isAdmin: true }),
  );
  await assertSucceeds(
    updateDoc(doc(db("admin"), "users/teacher"), { role: "admin", isAdmin: true }),
  );
  await assertSucceeds(
    updateDoc(doc(db("admin"), "users/teacher"), { role: "teacher", isAdmin: false }),
  );
});
test("initial login can find its own legacy roster without an existing profile", async () => {
  await assertSucceeds(getDoc(doc(db("fresh"), "users/fresh")));
  await assertSucceeds(
    getDocs(query(collection(db("fresh"), "students"), where("authUid", "==", "fresh"))),
  );
  await assertSucceeds(
    getDocs(query(collection(db("fresh"), "students"), where("linkedUserId", "==", "fresh"))),
  );
});
test("teachers can seed a class, private student code and auto chat atomically", async () => {
  const fire = db("teacher"),
    batch = writeBatch(fire);
  batch.set(doc(fire, "classes/seed-class"), { schoolId: "a", name: "Нова" });
  batch.set(doc(fire, "students/seed-student"), {
    schoolId: "a",
    classId: "seed-class",
    authUid: null,
    linkedUserId: null,
  });
  batch.set(doc(fire, "studentInvites/seed-student"), { schoolId: "a", code: "ABCDEFGHJKLMNPQT" });
  batch.set(doc(fire, "chats/seed-class"), {
    schoolId: "a",
    classId: "seed-class",
    kind: "class",
    isAuto: true,
    memberUids: ["teacher"],
    createdBy: "teacher",
  });
  await assertSucceeds(batch.commit());
  await assertFails(getDoc(doc(db("student"), "studentInvites/seed-student")));
});
test("invitation secrets and unclaimed identities cannot be taken directly", async () => {
  for (const uid of ["pending", "student", "outsider"]) {
    await assertFails(getDoc(doc(db(uid), "teacherInvites/ABCDEFGHJKLMNPQR")));
    await assertFails(getDoc(doc(db(uid), "studentInvites/unclaimed")));
    await assertFails(updateDoc(doc(db(uid), "teacherInvites/ABCDEFGHJKLMNPQR"), { usedBy: uid }));
    await assertFails(
      updateDoc(doc(db(uid), "students/unclaimed"), { authUid: uid, linkedUserId: uid }),
    );
  }
  await assertSucceeds(getDoc(doc(db("teacher"), "studentInvites/unclaimed")));
  await assertFails(
    setDoc(doc(db("student"), "teacherInvites/ABCDEFGHJKLMNPQT"), {
      schoolId: "a",
      createdBy: "student",
      usedBy: null,
    }),
  );
  await assertFails(updateDoc(doc(db("parent"), "students/r1"), { parentUids: ["parent"] }));
});
test("school collections reject student writes and cross-school reads and writes", async () => {
  for (const name of [
    "subjects",
    "schedule",
    "groups",
    "classes",
    "lessons",
    "announcements",
    "starostaHistory",
  ]) {
    const path = `${name}/${name === "classes" ? "class-a" : "a"}`;
    await assertFails(getDoc(doc(db("outsider"), path)));
    await assertFails(updateDoc(doc(db("outsider"), path), { title: "forged" }));
    await assertFails(updateDoc(doc(db("student"), path), { title: "forged" }));
    await assertFails(updateDoc(doc(db("teacher"), path), { schoolId: "b" }));
  }
  await assertSucceeds(updateDoc(doc(db("teacher"), "schedule/a"), { title: "changed" }));
  await assertFails(setDoc(doc(db("student"), "mail/spam"), { to: "victim@example.com" }));
});
test("marks are private to teachers and the linked student or parent", async () => {
  for (const uid of ["student", "parent", "teacher"])
    await assertSucceeds(getDoc(doc(db(uid), "grades/g1")));
  for (const uid of ["peer", "outsider", null])
    await assertFails(getDoc(doc(db(uid), "grades/g1")));
  await assertSucceeds(
    getDocs(
      query(
        collection(db("student"), "grades"),
        where("schoolId", "==", "a"),
        where("rosterId", "==", "r1"),
      ),
    ),
  );
  await assertFails(
    getDocs(query(collection(db("student"), "grades"), where("schoolId", "==", "a"))),
  );
});
test("a nonmember cannot add themselves to a private chat or edit its messages", async () => {
  for (const uid of ["student", "outsider"]) {
    await assertFails(getDoc(doc(db(uid), "chats/dm")));
    await assertFails(
      updateDoc(doc(db(uid), "chats/dm"), { memberUids: ["teacher", "peer", uid] }),
    );
    await assertFails(getDoc(doc(db(uid), "chatMessages/m1")));
  }
  await assertFails(updateDoc(doc(db("peer"), "chatMessages/m1"), { body: "forged" }));
  await assertSucceeds(
    updateDoc(doc(db("peer"), "chatMessages/m1"), { pinned: true, pinnedAt: 1 }),
  );
  await assertFails(updateDoc(doc(db("teacher"), "chatMessages/m1"), { senderUid: "peer" }));
});
test("automatic chats enforce teacher and class membership", async () => {
  await assertFails(getDoc(doc(db("student"), "chats/teachers")));
  await assertFails(
    updateDoc(doc(db("student"), "chats/teachers"), { memberUids: ["teacher", "student"] }),
  );
  await assertFails(getDoc(doc(db("peer"), "chats/class")));
  await assertSucceeds(getDoc(doc(db("student"), "chats/class")));
  await assertSucceeds(
    updateDoc(doc(db("student"), "chats/class"), { memberUids: ["teacher", "student"] }),
  );
  await assertFails(
    updateDoc(doc(db("student"), "chats/class"), {
      memberUids: ["teacher", "student", "outsider"],
    }),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(db("student"), "chats"),
        where("schoolId", "==", "a"),
        where("memberUids", "array-contains", "student"),
      ),
    ),
  );
});
test("students cannot mint points or tamper with other voters and club members", async () => {
  await assertFails(updateDoc(doc(db("student"), "students/r2"), { points: 999999 }));
  await assertFails(updateDoc(doc(db("student"), "students/r1"), { budget: 1000 }));
  await assertFails(updateDoc(doc(db("student"), "elections/e1"), { votes: { r2: "r2" } }));
  await assertFails(
    updateDoc(doc(db("student"), "elections/e1"), { closed: true, winnerRosterId: "r1" }),
  );
  await assertSucceeds(
    updateDoc(doc(db("student"), "elections/e1"), {
      candidates: [{ rosterId: "r1", name: "Учень" }],
    }),
  );
  await assertFails(updateDoc(doc(db("student"), "clubs/c1"), { memberIds: [] }));
  await assertSucceeds(updateDoc(doc(db("student"), "clubs/c1"), { memberIds: ["r2", "r1"] }));
});
test("notifications can only be marked read by their recipient", async () => {
  await assertFails(
    updateDoc(doc(db("student"), "notifications/n1"), { recipientUid: "peer", title: "forged" }),
  );
  await assertSucceeds(updateDoc(doc(db("student"), "notifications/n1"), { read: true }));
  await assertFails(getDoc(doc(db("peer"), "notifications/n1")));
  await assertFails(
    setDoc(doc(db("outsider"), "notifications/spam"), {
      schoolId: "a",
      recipientUid: "student",
      title: "Spam",
      body: "Spam",
    }),
  );
});
