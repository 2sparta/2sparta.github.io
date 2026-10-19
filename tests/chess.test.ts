import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Chess, DEFAULT_POSITION } from "chess.js";
import {
  createGame,
  joinGame,
  moveGame,
  resignGame,
  drawGame,
  flagGame,
  remaining,
  replay,
  parseUci,
  roundRobin,
  standings,
  terminal,
  validatePgn,
  type ChessTournament,
} from "../src/lib/chess/model.ts";
import { searchPosition } from "../src/lib/chess/engine.ts";
import {
  OPENING_GUIDES,
  lineMoves,
  openingLabel,
  findOpening,
  type Opening,
} from "../src/lib/chess/openings.ts";
import { validateToolSearch } from "../src/lib/learning-tools.ts";
const alice = { id: "a", name: "Alice" },
  bob = { id: "b", name: "Bob" };
const fresh = () => joinGame(createGame("g", alice, "school", "s", "w", 1, 1000), bob, "s", 2000);
test("Room scope, duplicate join, expiration and identity remain bounded", () => {
  const g = createGame("g", alice, "school", "s", "b", 1, 1000);
  assert.equal(g.black?.id, "a");
  assert.equal(g.lastMoveAt, null);
  assert.throws(() => joinGame(g, bob, "other", 2000), /FORBIDDEN/);
  assert.throws(() => joinGame(g, alice, "s", 2000), /OWN_ROOM/);
  assert.throws(() => joinGame(g, bob, "s", g.expiresAt), /ROOM_CLOSED/);
  const ready = joinGame(g, bob, "s", 2000);
  assert.equal(ready.white?.id, "b");
  assert.equal(ready.lastMoveAt, 2000);
  assert.throws(() => joinGame(ready, { id: "c", name: "C" }, "s", 2001), /ROOM_CLOSED/);
  assert.throws(() => createGame("g", alice, "school", null, "w", 1, 0), /NO_SCHOOL/);
  assert.throws(() => createGame("g", alice, "site", null, "w", 99, 0), /INVALID_CONTROL/);
});
test("Moves enforce player/turn/revision/legality; clocks deduct server elapsed and award increments", () => {
  const g = fresh(),
    serialized = JSON.stringify(g);
  assert.throws(() => moveGame(g, "intruder", "e2e4", g.revision, 4000), /FORBIDDEN/);
  assert.throws(() => moveGame(g, "b", "e7e5", g.revision, 4000), /NOT_YOUR_TURN/);
  assert.throws(() => moveGame(g, "a", "e2e5", g.revision, 4000), /ILLEGAL_MOVE/);
  assert.throws(() => moveGame(g, "a", "e2e4", 0, 4000), /STALE_GAME/);
  const next = moveGame(g, "a", "e2e4", g.revision, 4500);
  assert.equal(next.clocks.w, 300500);
  assert.equal(next.clocks.b, 300000);
  assert.equal(next.turn, "b");
  assert.equal(remaining(next, "b", 6500), 298000);
  assert.equal(JSON.stringify(g), serialized);
  assert.equal(replay(next.moves).fen(), next.fen);
  assert.throws(() => parseUci("e2e4<script>"));
});
test("Castling, en passant, pins and underpromotion follow chess rules", () => {
  const b = replay(["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
  assert.equal(b.get("d5"), undefined);
  assert.equal(b.get("d6")?.type, "p");
  const castle = replay(["e2e4", "e7e5", "g1f3", "b8c6", "f1e2", "g8f6", "e1g1"]);
  assert.equal(castle.get("f1")?.type, "r");
  assert.equal(castle.get("g1")?.type, "k");
  assert.throws(() =>
    new Chess("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1").move({ from: "e2", to: "d2" }),
  );
  const promote = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  promote.move(parseUci("a7a8n"));
  assert.equal(promote.get("a8")?.type, "n");
});
test("Checkmate is derived from replay and ended games reject moves", () => {
  let g = fresh();
  for (const [id, move] of [
    ["a", "f2f3"],
    ["b", "e7e5"],
    ["a", "g2g4"],
    ["b", "d8h4"],
  ])
    g = moveGame(g, id, move, g.revision, g.updatedAt + 100);
  assert.equal(g.status, "finished");
  assert.equal(g.result, "0-1");
  assert.equal(g.reason, "checkmate");
  assert.equal(g.lastMoveAt, null);
  assert.throws(() => moveGame(g, "a", "e2e4", g.revision, 4000), /GAME_CLOSED/);
  assert.equal(terminal(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))?.reason, "stalemate");
  assert.equal(terminal(new Chess("7k/8/6K1/8/8/8/8/8 b - - 0 1"))?.reason, "material");
});
test("Timeouts outrank late moves/resignations and displayed clocks stop at zero", () => {
  const g = fresh();
  assert.equal(flagGame(g, 301999), null);
  const ended = moveGame(g, "a", "e2e4", g.revision, 302000);
  assert.equal(ended.result, "0-1");
  assert.equal(ended.reason, "timeout");
  assert.equal(ended.moves.length, 0);
  assert.equal(resignGame(g, "b", 302000).result, "0-1");
  assert.equal(remaining({ ...g, clocks: { w: 1, b: 2 } }, "w", 999999), 0);
});
test("Only an opponent accepts a draw, a move declines it, and resignation cannot choose a winner", () => {
  const g = fresh(),
    offer = drawGame(g, "a", "offer", 2500);
  assert.throws(() => drawGame(offer, "a", "accept", 2600), /NO_DRAW_OFFER/);
  assert.throws(() => drawGame(offer, "a", "offer", 2600), /PENDING/);
  assert.equal(drawGame(offer, "b", "accept", 2600).result, "1/2-1/2");
  assert.equal(moveGame(offer, "a", "e2e4", offer.revision, 2700).drawOffer, null);
  assert.equal(resignGame(g, "a", 2500).result, "0-1");
  assert.equal(resignGame(g, "b", 2500).result, "1-0");
});
test("Every round-robin size covers each pair once with one game per player per round", () => {
  for (let n = 2; n <= 16; n++) {
    const ids = Array.from({ length: n }, (_, i) => String(i)),
      rounds = roundRobin(ids),
      pairs = new Set<string>();
    assert.equal(rounds.length, n % 2 ? n : n - 1);
    for (const round of rounds) {
      const played = new Set<string>();
      for (const [a, b] of round) {
        assert.notEqual(a, b);
        assert.ok(!played.has(a) && !played.has(b));
        played.add(a);
        played.add(b);
        const key = [a, b].sort().join(":");
        assert.ok(!pairs.has(key));
        pairs.add(key);
      }
    }
    assert.equal(pairs.size, (n * (n - 1)) / 2);
  }
  assert.throws(() => roundRobin(["a"]));
  assert.throws(() => roundRobin(["a", "a"]));
});
test("Standings use only finished tournament games and equal scores share ranks", () => {
  const t = { id: "t", players: [alice, bob, { id: "c", name: "Cara" }] } as ChessTournament;
  const g = { ...fresh(), tournamentId: "t", status: "finished" as const, result: "1-0" as const };
  const draw = {
    ...g,
    id: "g2",
    white: bob,
    black: { id: "c", name: "Cara" },
    result: "1/2-1/2" as const,
  };
  const rows = standings(t, [g, g, draw, { ...g, id: "foreign", tournamentId: "other" }]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.points, r.rank]),
    [
      ["a", 1, 1],
      ["b", 0.5, 2],
      ["c", 0.5, 2],
    ],
  );
});
test("The pinned opening catalogue and curated notes replay legally and roundtrip PGN", () => {
  const raw = readFileSync(new URL("../public/chess/openings.json", import.meta.url));
  const manifest = JSON.parse(
    readFileSync(new URL("../public/chess/openings-manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.dataSha256);
  const openings = JSON.parse(raw.toString()) as Opening[];
  assert.equal(openings.length, manifest.count);
  assert.ok(openings.length > 3000);
  for (const o of openings) {
    assert.match(o.eco, /^[A-E]\d\d$/);
    const b = replay(o.uci);
    assert.equal(b.fen(), o.fen);
    assert.deepEqual(lineMoves(o.pgn), o.uci);
  }
  for (const guide of OPENING_GUIDES) assert.ok(lineMoves(guide.pgn).length);
  assert.match(openingLabel({ name: "Sicilian Defense: Open" }, true), /Сицилійський/);
  assert.equal(findOpening(openings, ["e2e4", "c7c5"])?.name, "Sicilian Defense");
  const b = validatePgn("1. e4 e5 2. Nf3 Nc6");
  assert.equal(validatePgn(b.pgn()).fen(), b.fen());
  assert.throws(() => validatePgn("not a PGN"));
  assert.throws(() => validatePgn("x".repeat(30001)));
});
test("The teaching engine returns legal moves, a white-relative score and finds mate in one", () => {
  const game = new Chess("7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
  const result = searchPosition(game.fen(), 2, 1000);
  assert.ok(result.lines.length > 0);
  game.move(parseUci(result.lines[0].move));
  assert.ok(game.isCheckmate());
  assert.ok(result.lines[0].score > 90000);
  const start = searchPosition(DEFAULT_POSITION, 2, 300);
  assert.ok(new Chess().move(parseUci(start.lines[0].move)));
  assert.ok(start.elapsed < 2500);
  assert.equal(searchPosition(game.fen(), 2, 100).lines.length, 0);
});
test("Tool links validate shared game IDs and do not accept injected path fragments", () => {
  assert.deepEqual(validateToolSearch({ tool: "chess", chessTab: "play", chessGame: "game_123" }), {
    tool: "chess",
    chessTab: "play",
    chessGame: "game_123",
  });
  assert.equal(
    validateToolSearch({ tool: "chess", chessGame: "../users/a", chessTab: "bad" }).chessGame,
    undefined,
  );
});
