import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp, cert } from "firebase-admin/app";
import { generateKeyPairSync } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreStore } from "../src/store";
import { membershipService } from "../src/membership";
import { rewardService } from "../src/rewards";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
  throw new Error("Security tests require a loopback Firestore emulator");
const app = initializeApp(
  {
    projectId: "demo-school-security",
    credential: cert({
      projectId: "demo-school-security",
      clientEmail: "emulator@demo-school-security.iam.gserviceaccount.com",
      privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 })
        .privateKey.export({ type: "pkcs8", format: "pem" })
        .toString(),
    }),
  },
  "security-test",
);
const db = getFirestore(app),
  store = firestoreStore(db);
const membership = membershipService(store),
  award = rewardService(store);
const actor = (uid: string) => ({ uid, email: `${uid}@example.com` });
const teacherCode = "ABCDEFGHJKLMNPQR",
  studentCode = "ABCDEFGHJKLMNPQS";
before(async () => {
  const rows: Record<string, object> = {
    "schools/a": { name: "A", createdBy: "admin" },
    "schools/b": { name: "B", createdBy: "other" },
    "users/admin": { role: "admin", isAdmin: true, schoolId: "a" },
    "users/other": { role: "admin", isAdmin: true, schoolId: "b" },
    "users/treasurer": { role: "student", schoolId: "a", rosterId: "author", displayName: "Автор" },
    "teacherInvites/ABCDEFGHJKLMNPQR": { schoolId: "a", createdBy: "admin", usedBy: null },
    "studentInvites/roster": { schoolId: "a", code: studentCode },
    "students/roster": { schoolId: "a", classId: "class-a", name: "Учень", authUid: null },
    "students/author": {
      schoolId: "a",
      authUid: "treasurer",
      office: "sport",
      budget: 25,
      points: 0,
    },
    "students/recipient": { schoolId: "a", points: 1, name: "Одержувач" },
    "students/foreign": { schoolId: "b", points: 1, name: "Інша школа" },
    "rewards/reward": {
      schoolId: "a",
      authorRosterId: "author",
      points: 10,
      title: "Нагорода",
      hold: 99999,
      awarded: [],
    },
    "rewards/foreign": {
      schoolId: "a",
      authorRosterId: "author",
      points: 10,
      title: "Нагорода",
      awarded: [],
    },
  };
  await Promise.all(Object.entries(rows).map(([path, value]) => db.doc(path).set(value)));
});
after(async () => {
  await db.terminate();
  await deleteApp(app);
});

test("unauthenticated membership and reward calls are rejected", async () => {
  await assert.rejects(
    membership(undefined, { action: "createSchool", name: "X" }),
    /UNAUTHENTICATED/,
  );
  await assert.rejects(award(undefined, {}), /UNAUTHENTICATED/);
});
test("school creation grants administration only in a new school", async () => {
  const result = await membership(actor("creator"), {
    action: "createSchool",
    name: "New school",
    schoolId: "a",
    role: "admin",
  });
  assert.notEqual(result.schoolId, "a");
  const profile = (await db.doc("users/creator").get()).data()!;
  assert.equal(profile.role, "admin");
  assert.equal(profile.schoolId, result.schoolId);
  await assert.rejects(
    membership(actor("creator"), { action: "createSchool", name: "Second" }),
    /ALREADY_LINKED/,
  );
  await assert.rejects(
    membership(actor("other"), { action: "joinTeacher", code: teacherCode }),
    /ALREADY_LINKED/,
  );
});
test("concurrent redemption of one teacher invitation admits exactly one teacher", async () => {
  const results = await Promise.allSettled(
    ["joiner1", "joiner2"].map((uid) =>
      membership(actor(uid), {
        action: "joinTeacher",
        code: teacherCode,
        role: "admin",
        isAdmin: true,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const invite = (await db.doc(`teacherInvites/${teacherCode}`).get()).data()!;
  const profile = (await db.doc(`users/${invite.usedBy}`).get()).data()!;
  assert.equal(profile.role, "teacher");
  assert.equal(profile.isAdmin, false);
  await membership(actor(invite.usedBy), { action: "joinTeacher", code: teacherCode });
});
test("student identity linking is atomic and parents keep their own role", async () => {
  const results = await Promise.allSettled(
    ["pupil1", "pupil2"].map((uid) =>
      membership(actor(uid), { action: "linkStudent", code: studentCode }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const roster = (await db.doc("students/roster").get()).data()!;
  assert.equal(roster.authUid, roster.linkedUserId);
  assert.equal((await db.doc(`users/${roster.authUid}`).get()).data()!.rosterId, "roster");
  await membership(actor("parent"), { action: "linkParent", code: studentCode });
  assert.equal((await db.doc("users/parent").get()).data()!.role, "parent");
  assert.deepEqual((await db.doc("students/roster").get()).data()!.parentUids, ["parent"]);
  await assert.rejects(
    membership(actor("other"), { action: "linkStudent", code: studentCode, demo: true }),
    /ALREADY_LINKED/,
  );
});
test("failed invitations consume the rate limit", async () => {
  for (let i = 0; i < 20; i++)
    await assert.rejects(
      membership(actor("guesser"), { action: "joinTeacher", code: "ZZZZZZZZZZZZZZZZ" }),
      /CODE_NOT_FOUND/,
    );
  await assert.rejects(
    membership(actor("guesser"), { action: "joinTeacher", code: teacherCode }),
    /RATE_LIMIT/,
  );
});
test("custom chats validate every member's school and the chat feature", async () => {
  await assert.rejects(
    membership(actor("admin"), { action: "createChat", kind: "dm", memberUids: ["other"] }),
    /FORBIDDEN/,
  );
  const chat = await membership(actor("admin"), {
    action: "createChat",
    kind: "dm",
    memberUids: ["treasurer"],
  });
  assert.ok(chat.id);
  assert.deepEqual((await db.doc(`chats/${chat.id}`).get()).data()!.memberUids, [
    "admin",
    "treasurer",
  ]);
  await db.doc("schoolSettings/a").set({ chat: false });
  await assert.rejects(
    membership(actor("admin"), { action: "createChat", kind: "group", memberUids: ["treasurer"] }),
    /FEATURE_DISABLED/,
  );
});
test("concurrent rewards debit the budget once and ignore forged legacy holds", async () => {
  const results = await Promise.allSettled(
    [1, 2].map(() => award("treasurer", { rewardId: "reward", rosterIds: ["recipient"] })),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.doc("students/author").get()).data()!.budget, 15);
  assert.equal((await db.doc("students/recipient").get()).data()!.points, 11);
  assert.equal(
    (await db.collection("pointsHistory").where("rosterId", "==", "recipient").get()).size,
    1,
  );
  await assert.rejects(
    award("treasurer", { rewardId: "foreign", rosterIds: ["foreign"] }),
    /FORBIDDEN/,
  );
  assert.equal((await db.doc("students/author").get()).data()!.budget, 15);
});
test("migration dry run preserves data, then rotates secrets and is resumable", async () => {
  await db.doc("students/legacy").set({ schoolId: "a", name: "Legacy", inviteCode: "123456" });
  await db
    .doc("teacherInvites/RRRRRRRRRRRRRRRR")
    .set({ schoolId: "a", createdBy: "admin", usedBy: null });
  await db
    .doc("chats/legacy-teachers")
    .set({
      schoolId: "a",
      kind: "teachers",
      isAuto: true,
      memberUids: ["admin", "treasurer", "other"],
    });
  const run = async (apply = false) => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "functions/scripts/migrate-security.mjs",
        "--project",
        "demo-school-security",
        ...(apply ? ["--apply"] : []),
      ],
      { env: process.env, timeout: 30_000 },
    );
    return JSON.parse(stdout.trim());
  };
  const dry = await run();
  assert.equal(dry.mode, "dry-run");
  assert.ok(dry.studentCodes > 0);
  assert.equal((await db.doc("students/legacy").get()).get("inviteCode"), "123456");
  await run(true);
  assert.equal((await db.doc("teacherInvites/RRRRRRRRRRRRRRRR").get()).exists, false);
  assert.equal((await db.doc("students/legacy").get()).get("inviteCode"), undefined);
  assert.match((await db.doc("studentInvites/legacy").get()).get("code"), /^[A-Z2-9]{16}$/);
  assert.deepEqual((await db.doc("chats/legacy-teachers").get()).get("memberUids"), ["admin"]);
  const again = await run();
  assert.equal(again.studentCodes, 0);
  assert.equal(again.teacherCodes, 0);
  assert.equal(again.chatMemberships, 0);
});
