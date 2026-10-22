import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { chessService } from "./service";
import { rewardService } from "./rewards";
import { firestoreStore } from "./store";
import { membershipService } from "./membership";
const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });
if (!getApps().length) initializeApp();
const db = getFirestore();
const store = firestoreStore(db);
const membership = membershipService(store);
export const schoolMembership = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 10,
    cors: true,
    enforceAppCheck,
  },
  async (request) => {
    try {
      return await membership(
        request.auth ? { uid: request.auth.uid, email: request.auth.token.email } : undefined,
        request.data,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const allowed = [
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "ALREADY_LINKED",
        "RATE_LIMIT",
        "CODE_NOT_FOUND",
        "CODE_USED",
        "FEATURE_DISABLED",
        "INVALID_ID",
        "INVALID_INPUT",
        "INVALID_NAME",
        "INVALID_MEMBERS",
        "INVALID_ACTION",
      ];
      if (allowed.includes(message))
        throw new HttpsError(
          message === "UNAUTHENTICATED"
            ? "unauthenticated"
            : message === "RATE_LIMIT"
              ? "resource-exhausted"
              : message === "FORBIDDEN"
                ? "permission-denied"
                : "failed-precondition",
          message,
        );
      console.error("School membership failed", e);
      throw new HttpsError("internal", "MEMBERSHIP_ERROR");
    }
  },
);
const run = chessService(store);
const award = rewardService(store);
export const awardSchoolReward = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 10,
    cors: true,
    enforceAppCheck,
  },
  async (request) => {
    try {
      return await award(request.auth?.uid, request.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (
        ["UNAUTHENTICATED", "FORBIDDEN", "BUDGET", "INVALID_INPUT", "INVALID_RECIPIENTS"].includes(
          message,
        )
      )
        throw new HttpsError(
          message === "UNAUTHENTICATED"
            ? "unauthenticated"
            : message === "FORBIDDEN"
              ? "permission-denied"
              : "failed-precondition",
          message,
        );
      console.error("Reward failed", e);
      throw new HttpsError("internal", "REWARD_ERROR");
    }
  },
);
export const chessAction = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 10,
    cors: true,
    enforceAppCheck,
  },
  async (request) => {
    try {
      return await run(request.auth?.uid, request.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "CHESS_ERROR";
      const code =
        message === "UNAUTHENTICATED"
          ? "unauthenticated"
          : message === "FORBIDDEN"
            ? "permission-denied"
            : message === "NOT_FOUND"
              ? "not-found"
              : message === "RATE_LIMIT"
                ? "resource-exhausted"
                : message.startsWith("INVALID") || message === "ILLEGAL_MOVE"
                  ? "invalid-argument"
                  : "failed-precondition";
      // Only known domain errors are returned to clients; database internals stay private.
      if (/^[A-Z_]+$/.test(message)) throw new HttpsError(code, message);
      console.error("Chess action failed", e);
      throw new HttpsError("internal", "CHESS_ERROR");
    }
  },
);
