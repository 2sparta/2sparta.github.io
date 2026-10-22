import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generateKeyPairSync } from "node:crypto";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
const env = await initializeTestEnvironment({
  projectId: "demo-chess",
  firestore: {
    host: "127.0.0.1",
    port: 8185,
    rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  },
});
const base = {
  scope: "school",
  schoolId: "s",
  hostId: "a",
  white: { id: "a", name: "Alice" },
  black: null,
  playerIds: ["a"],
  status: "waiting",
  moves: [],
  fen: "initial",
  turn: "w",
  clocks: { w: 300000, b: 300000 },
  initialMs: 300000,
  incrementMs: 3000,
  lastMoveAt: null,
  createdAt: 1,
  updatedAt: 1,
  expiresAt: 9999999999999,
  revision: 0,
  result: null,
  reason: null,
  drawOffer: null,
  tournamentId: null,
  round: null,
};
try {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await Promise.all([
      ...[
        ["a", "s"],
        ["b", "other"],
        ["c", "s"],
        ["o", "s"],
      ].map(([id, schoolId]) =>
        setDoc(doc(db, "users", id), { displayName: id.toUpperCase(), schoolId, role: "student" }),
      ),
      setDoc(doc(db, "chessGames", "private"), { ...base, id: "private" }),
      setDoc(doc(db, "chessGames", "site"), { ...base, id: "site", scope: "site", schoolId: null }),
      setDoc(doc(db, "chessGames", "old-school"), { ...base, id: "old-school", schoolId: "other" }),
      setDoc(doc(db, "chessGames", "round"), { ...base, id: "round", tournamentId: "school-cup" }),
      setDoc(doc(db, "chessTournaments", "school-cup"), {
        scope: "school",
        schoolId: "s",
        organizer: { id: "o" },
        players: [],
        status: "registration",
        createdAt: 1,
      }),
      setDoc(doc(db, "chessTournaments", "site-cup"), {
        scope: "site",
        schoolId: null,
        organizer: { id: "o" },
        players: [],
        status: "registration",
        createdAt: 1,
      }),
      setDoc(doc(db, "chessLimits", "a"), { room: 1 }),
    ]);
  });
  const a = env.authenticatedContext("a").firestore(),
    b = env.authenticatedContext("b").firestore(),
    c = env.authenticatedContext("c").firestore(),
    anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(a, "chessGames", "private")));
  await assertSucceeds(getDoc(doc(c, "chessGames", "private")));
  await assertFails(getDoc(doc(b, "chessGames", "private")));
  await assertFails(getDoc(doc(anon, "chessGames", "site")));
  await assertSucceeds(getDoc(doc(b, "chessGames", "site")));
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "chessGames"),
        where("scope", "==", "school"),
        where("schoolId", "==", "s"),
        where("status", "==", "waiting"),
        orderBy("createdAt", "desc"),
      ),
    ),
  );
  await assertFails(
    getDocs(
      query(
        collection(b, "chessGames"),
        where("scope", "==", "school"),
        where("schoolId", "==", "s"),
        where("status", "==", "waiting"),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "chessGames"),
        where("playerIds", "array-contains", "a"),
        orderBy("updatedAt", "desc"),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(query(collection(c, "chessGames"), where("tournamentId", "==", "school-cup"))),
  );
  await assertFails(
    getDocs(query(collection(b, "chessGames"), where("tournamentId", "==", "school-cup"))),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "chessTournaments"),
        where("scope", "==", "school"),
        where("schoolId", "==", "s"),
        orderBy("createdAt", "desc"),
      ),
    ),
  );
  await assertFails(getDoc(doc(b, "chessTournaments", "school-cup")));
  await assertSucceeds(getDoc(doc(b, "chessTournaments", "site-cup")));
  for (const db of [a, b, c]) {
    await assertFails(setDoc(doc(db, "chessGames", "forged"), { ...base }));
    await assertFails(
      updateDoc(doc(db, "chessGames", "private"), {
        fen: "forged",
        result: "1-0",
        status: "finished",
      }),
    );
    await assertFails(
      updateDoc(doc(db, "chessGames", "private"), { clocks: { w: 999999999, b: 0 } }),
    );
    await assertFails(
      updateDoc(doc(db, "chessTournaments", "school-cup"), {
        organizer: { id: "a" },
        players: [{ id: "a" }],
      }),
    );
  }
  await assertFails(getDoc(doc(a, "chessLimits", "a")));
  // Exercise the actual compiled callable handler and Admin SDK transactions against Firestore.
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Loopback emulator required");
  const { initializeApp, cert } = createRequire(new URL("../functions/package.json", import.meta.url))("firebase-admin/app");
  initializeApp({ projectId: "demo-chess", credential: cert({
    projectId: "demo-chess", clientEmail: "emulator@demo-chess.iam.gserviceaccount.com",
    privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  }) });
  const { chessAction } = await import("../functions/dist/index.cjs");
  const call = (uid, data) =>
    chessAction.run({ data, auth: uid ? { uid, token: { uid, sub: uid } } : undefined });
  await assert.rejects(() => call(undefined, { action: "create" }), /UNAUTHENTICATED/);
  const created = await call("a", { action: "create", scope: "site", color: "w", timeControl: 1 });
  const joined = await Promise.allSettled([
    call("b", { action: "join", id: created.id }),
    call("c", { action: "join", id: created.id }),
  ]);
  assert.equal(joined.filter((r) => r.status === "fulfilled").length, 1);
  let g = (await getDoc(doc(a, "chessGames", created.id))).data();
  assert.equal(g.playerIds.length, 2);
  const moves = await Promise.allSettled([
    call("a", { action: "move", id: created.id, move: "e2e4", revision: g.revision }),
    call("a", { action: "move", id: created.id, move: "d2d4", revision: g.revision }),
  ]);
  assert.equal(moves.filter((r) => r.status === "fulfilled").length, 1);
  g = (await getDoc(doc(a, "chessGames", created.id))).data();
  assert.equal(g.moves.length, 1);
  assert.equal(g.clocks.w <= 303000, true);
  await assert.rejects(
    () => call("a", { action: "move", id: created.id, move: "e4e5", revision: g.revision }),
    /NOT_YOUR_TURN/,
  );
  await call(g.black.id, { action: "resign", id: created.id, result: "0-1" });
  assert.equal((await getDoc(doc(a, "chessGames", created.id))).data().result, "1-0");
  const cup = await call("o", {
    action: "createTournament",
    title: "Emulator Cup",
    scope: "site",
    timeControl: 0,
  });
  for (const uid of ["a", "b", "c"]) await call(uid, { action: "joinTournament", id: cup.id });
  await call("o", { action: "startTournament", id: cup.id });
  for (let r = 1; r <= 3; r++) {
    const t = (await getDoc(doc(a, "chessTournaments", cup.id))).data();
    const game = (await getDoc(doc(a, "chessGames", t.gameIds.at(-1)))).data();
    assert.equal(game.round, r);
    await call(game.white.id, { action: "resign", id: game.id });
    await call("o", { action: "advanceTournament", id: cup.id });
  }
  assert.equal((await getDoc(doc(a, "chessTournaments", cup.id))).data().status, "finished");
  console.log(
    "Chess rules and callable/Firestore integration passed: privacy, write denial, concurrent joins/moves and complete 3-player tournament.",
  );
} finally {
  await env.cleanup();
}
