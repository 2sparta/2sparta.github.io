import type { Firestore } from "firebase-admin/firestore";
import type { MembershipStore } from "./membership";

export function firestoreStore(db: Firestore): MembershipStore {
  return {
    transaction: (work) =>
      db.runTransaction(async (t) =>
        work({
          get: async <T>(collection: string, id: string) => {
            const snap = await t.get(db.collection(collection).doc(id));
            return snap.exists ? (snap.data() as T) : null;
          },
          find: async (collection, field, value) => {
            const snap = await t.get(db.collection(collection).where(field, "==", value).limit(2));
            return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
          },
          set: (collection, id, value) => {
            t.set(db.collection(collection).doc(id), value as FirebaseFirestore.DocumentData);
          },
        }),
      ),
  };
}
