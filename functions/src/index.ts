import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { chessService } from "./service";
initializeApp();
const db = getFirestore();
const run = chessService({
  transaction: (work) =>
    db.runTransaction(async (t) =>
      work({
        get: async <T>(collection: string, id: string) => {
          const d = await t.get(db.collection(collection).doc(id));
          return d.exists ? (d.data() as T) : null;
        },
        set: (collection, id, value) => {
          t.set(db.collection(collection).doc(id), value as FirebaseFirestore.DocumentData);
        },
      }),
    ),
});
export const chessAction = onCall(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 30, maxInstances: 10, cors: true },
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
