import { randomBytes, generateKeyPairSync } from "node:crypto";
import { initializeApp, deleteApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Dry run by default. Credentials are supplied through Application Default
// Credentials, never stored in the repository or printed in the report.
const args = process.argv.slice(2),
  project = args[args.indexOf("--project") + 1];
if (!args.includes("--project") || !project || !/^[a-z][a-z0-9-]+$/.test(project))
  throw new Error("Explicit --project PROJECT_ID required");
const apply = args.includes("--apply");
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (emulator && (!project.startsWith("demo-") || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)))
  throw new Error("Migration tests require a loopback demo project");
const app = initializeApp({
    projectId: project,
    ...(emulator
      ? {
          credential: cert({
            projectId: project,
            clientEmail: `emulator@${project}.iam.gserviceaccount.com`,
            privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 })
              .privateKey.export({ type: "pkcs8", format: "pem" })
              .toString(),
          }),
        }
      : {}),
  }),
  db = getFirestore(app);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");
const counts = {
  studentCodes: 0,
  teacherCodes: 0,
  chatMemberships: 0,
  privilegedProfilesToReview: 0,
  legacyRewardHoldsToReview: 0,
};
try {
  const users = new Map((await db.collection("users").get()).docs.map((d) => [d.id, d.data()]));
  counts.privilegedProfilesToReview = [...users.values()].filter(
    (p) => ["teacher", "admin"].includes(p.role) || p.isAdmin === true,
  ).length;
  for await (const row of db.collection("students").stream()) {
    if (!row.get("schoolId")) continue;
    const ref = db.doc(`studentInvites/${row.id}`),
      invite = await ref.get();
    if (row.get("inviteCode") !== undefined || !invite.exists) {
      counts.studentCodes++;
      if (apply)
        await db.runTransaction(async (tx) => {
          const current = await tx.get(row.ref),
            secret = await tx.get(ref);
          if (current.get("inviteCode") === undefined && secret.exists) return;
          tx.set(ref, { schoolId: current.get("schoolId"), code: code() });
          tx.update(row.ref, { inviteCode: FieldValue.delete() });
        });
    }
  }
  // Old unused teacher invitations were readable by all signed-in accounts.
  // A marker makes this rotation safe to resume without rotating twice.
  for await (const row of db.collection("teacherInvites").stream()) {
    if (row.get("usedBy") || row.get("securityVersion") === 1) continue;
    counts.teacherCodes++;
    if (apply) {
      const batch = db.batch();
      batch.create(db.collection("teacherInvites").doc(code()), {
        ...row.data(),
        securityVersion: 1,
      });
      batch.delete(row.ref);
      await batch.commit();
    }
  }
  for await (const row of db.collection("chats").stream()) {
    const d = row.data(),
      original = Array.isArray(d.memberUids) ? d.memberUids : [];
    const members = [...new Set(original)].filter((uid) => {
      const p = users.get(uid);
      if (!p || p.schoolId !== d.schoolId) return false;
      if (!d.isAuto || d.kind === "school") return true;
      const teacher = ["teacher", "admin"].includes(p.role);
      return d.kind === "teachers"
        ? teacher
        : d.kind === "class" && (teacher || p.classId === d.classId);
    });
    if (JSON.stringify(original) !== JSON.stringify(members)) {
      counts.chatMemberships++;
      if (apply) await row.ref.update({ memberUids: members });
    }
  }
  for await (const row of db.collection("rewards").stream()) {
    // Legacy holds came from client writes. Never turn unverified holds into a
    // budget refund; the school administrator reconciles these separately.
    if (row.get("hold") > 0) counts.legacyRewardHoldsToReview++;
  }
  console.log(JSON.stringify({ project, mode: apply ? "applied" : "dry-run", ...counts }));
} finally {
  await db.terminate();
  await deleteApp(app);
}
