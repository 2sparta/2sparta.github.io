import { test } from "node:test";
import assert from "node:assert/strict";
import { chessService, type ChessStore, type ChessTransaction } from "../src/service.ts";
import { standings, type ChessGame, type ChessTournament } from "../../src/lib/chess/model.ts";
class MemoryStore implements ChessStore {
  docs = new Map<string, unknown>();
  queue = Promise.resolve();
  seed(c: string, id: string, v: unknown) {
    this.docs.set(c + "/" + id, structuredClone(v));
  }
  read<T>(c: string, id: string) {
    return structuredClone(this.docs.get(c + "/" + id)) as T;
  }
  async transaction<T>(work: (tx: ChessTransaction) => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => (release = resolve)),
      before = this.queue;
    this.queue = next;
    await before;
    const writes = new Map<string, unknown>();
    try {
      const value = await work({
        get: async <T>(c: string, id: string) =>
          structuredClone(this.docs.get(c + "/" + id) ?? null) as T | null,
        set: (c, id, v) => writes.set(c + "/" + id, structuredClone(v)),
      });
      for (const [k, v] of writes) this.docs.set(k, v);
      return value;
    } finally {
      release();
    }
  }
}
function setup() {
  const store = new MemoryStore();
  for (const [id, school] of [
    ["a", "s"],
    ["b", "s"],
    ["c", "other"],
    ["o", "s"],
  ])
    store.seed("users", id, { displayName: id.toUpperCase(), schoolId: school, role: "student" });
  let clock = 1_000_000,
    counter = 0;
  const run = chessService(
    store,
    () => clock,
    () => `id${++counter}`,
  );
  return { store, run, setTime: (n: number) => (clock = n) };
}
test("Callable service rejects missing auth/profile and ignores forged owner, scope and clocks", async () => {
  const { store, run } = setup();
  await assert.rejects(() => run(undefined, { action: "ping" }), /UNAUTHENTICATED/);
  await assert.rejects(() => run("unknown", { action: "ping" }), /NO_PROFILE/);
  const { id } = await run("a", {
    action: "create",
    scope: "school",
    schoolId: "other",
    color: "w",
    timeControl: 1,
    hostId: "b",
    clocks: { w: 1 },
  });
  const g = store.read<ChessGame>("chessGames", id as string);
  assert.equal(g.hostId, "a");
  assert.equal(g.schoolId, "s");
  assert.equal(g.clocks.w, 300000);
  await assert.rejects(() => run("c", { action: "join", id }), /FORBIDDEN/);
  await assert.rejects(
    () => run("b", { action: "move", id, move: "e7e5", revision: 0 }),
    /FORBIDDEN/,
  );
  await run("b", { action: "join", id });
  await run("a", {
    action: "move",
    id,
    move: "e2e4",
    revision: 1,
    result: "1-0",
    fen: "bad",
    clocks: { w: 99999999 },
  });
  const moved = store.read<ChessGame>("chessGames", id as string);
  assert.equal(moved.moves.length, 1);
  assert.equal(moved.result, null);
  assert.equal(moved.clocks.w, 303000);
});
test("Atomic claims admit one joining opponent and one move per revision", async () => {
  const { store, run } = setup();
  const { id } = await run("a", { action: "create", scope: "site", color: "w", timeControl: 1 });
  const joins = await Promise.allSettled([
    run("b", { action: "join", id }),
    run("c", { action: "join", id }),
  ]);
  assert.equal(joins.filter((r) => r.status === "fulfilled").length, 1);
  const moves = await Promise.allSettled([
    run("a", { action: "move", id, move: "e2e4", revision: 1 }),
    run("a", { action: "move", id, move: "d2d4", revision: 1 }),
  ]);
  assert.equal(moves.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(store.read<ChessGame>("chessGames", id as string).moves.length, 1);
});
test("School rooms stay private while site rooms accept another school's participant", async () => {
  const { run } = setup();
  const { id } = await run("a", { action: "create", scope: "site", color: "b", timeControl: 0 });
  await run("c", { action: "join", id });
  await run("c", { action: "move", id, move: "e2e4", revision: 1 });
  await assert.rejects(() => run("b", { action: "resign", id }), /FORBIDDEN/);
});
test("Tournament lifecycle preserves organizer control, immutable pairs and derives all results", async () => {
  const { store, run } = setup();
  const { id } = await run("o", {
    action: "createTournament",
    scope: "site",
    title: "Cup",
    description: "Friendly",
    timeControl: 1,
    players: [{ id: "fake" }],
    organizer: { id: "a" },
  });
  assert.equal(store.read<ChessTournament>("chessTournaments", id as string).organizer.id, "o");
  for (const uid of ["a", "b", "c"]) await run(uid, { action: "joinTournament", id });
  await assert.rejects(() => run("a", { action: "startTournament", id }), /FORBIDDEN/);
  await run("o", { action: "startTournament", id });
  await assert.rejects(() => run("a", { action: "leaveTournament", id }), /REGISTRATION_CLOSED/);
  await assert.rejects(() => run("o", { action: "advanceTournament", id }), /ROUND_NOT_FINISHED/);
  let t = store.read<ChessTournament>("chessTournaments", id as string);
  const initial = JSON.stringify(t.rounds);
  assert.equal(t.round, 1);
  assert.equal(t.rounds.length, 3);
  for (let round = 1; round <= 3; round++) {
    t = store.read<ChessTournament>("chessTournaments", id as string);
    const g = store.read<ChessGame>("chessGames", t.gameIds.at(-1)!);
    assert.equal(g.round, round);
    await run(g.white!.id, { action: "resign", id: g.id, result: "1-0" });
    assert.equal(store.read<ChessGame>("chessGames", g.id).result, "0-1");
    await run("o", { action: "advanceTournament", id });
  }
  t = store.read<ChessTournament>("chessTournaments", id as string);
  assert.equal(t.status, "finished");
  assert.equal(t.gameIds.length, 3);
  assert.equal(JSON.stringify(t.rounds), initial);
  assert.equal(
    standings(
      t,
      t.gameIds.map((id) => store.read<ChessGame>("chessGames", id)),
    ).reduce((n, r) => n + r.played, 0),
    6,
  );
  await assert.rejects(() => run("o", { action: "advanceTournament", id }), /TOURNAMENT_CLOSED/);
  // Firestore cannot store directly nested arrays: pairings are arrays of objects.
  assert.ok(t.rounds.every((r) => !Array.isArray(r) && r.pairs.every((p) => !Array.isArray(p))));
});
test("Timed-out rounds can be finalized by the organizer without player cooperation", async () => {
  const { store, run, setTime } = setup();
  const { id } = await run("o", {
    action: "createTournament",
    scope: "school",
    title: "Clock",
    timeControl: 0,
  });
  for (const uid of ["a", "b"]) await run(uid, { action: "joinTournament", id });
  await run("o", { action: "startTournament", id });
  setTime(1_180_000);
  await run("o", { action: "advanceTournament", id });
  const t = store.read<ChessTournament>("chessTournaments", id as string);
  assert.equal(t.status, "finished");
  assert.equal(store.read<ChessGame>("chessGames", t.gameIds[0]).reason, "timeout");
});
test("Registration is race-safe, bounded at 16, and school membership is checked", async () => {
  const { store, run } = setup();
  const { id } = await run("o", {
    action: "createTournament",
    scope: "school",
    title: "Class",
    timeControl: 1,
  });
  await assert.rejects(() => run("c", { action: "joinTournament", id }), /FORBIDDEN/);
  for (let i = 0; i < 17; i++)
    store.seed("users", "p" + i, { displayName: "P" + i, schoolId: "s" });
  const joined = await Promise.allSettled(
    Array.from({ length: 17 }, (_, i) => run("p" + i, { action: "joinTournament", id })),
  );
  assert.equal(joined.filter((x) => x.status === "fulfilled").length, 16);
  assert.equal(store.read<ChessTournament>("chessTournaments", id as string).players.length, 16);
  await assert.rejects(
    () => run("o", { action: "createTournament", scope: "site", title: "Again", timeControl: 1 }),
    /RATE_LIMIT/,
  );
});
