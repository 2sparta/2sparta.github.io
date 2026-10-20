import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { legalPremove, premoveTargets } from "../src/lib/chess/premove.ts";
import { DEFAULT_CHESS_PREFERENCES, parseChessPreferences } from "../src/lib/chess/preferences.ts";
test("Preferences tolerate invalid persisted values without losing valid toggles", () => {
  assert.deepEqual(parseChessPreferences(null), DEFAULT_CHESS_PREFERENCES);
  const parsed = parseChessPreferences({ pieces: "classic", board: "alien", coordinates: "false", premoves: false, autoQueen: true });
  assert.equal(parsed.board, "forest");
  assert.equal(parsed.coordinates, true);
  assert.equal(parsed.premoves, false);
  assert.equal(parsed.autoQueen, true);
});
test("Premove geometry permits a future capture but does not submit moves", () => {
  const board = new Chess(); board.move("e4");
  const before = board.fen();
  assert.ok(premoveTargets(board, "e4", "w").includes("d5"));
  assert.ok(premoveTargets(board, "g1", "w").includes("f3"));
  assert.deepEqual(premoveTargets(board, "g8", "w"), []);
  assert.ok(!premoveTargets(board, "g1", "w").includes("g3"));
  assert.equal(board.fen(), before);
});
test("Only a currently legal move is resolved after the opponent replies", () => {
  const board = new Chess(); board.move("e4");
  assert.equal(legalPremove(board.fen(), "g1f3", "w"), null);
  board.move("e5");
  assert.equal(legalPremove(board.fen(), "g1f3", "w"), "g1f3");
  assert.equal(legalPremove(board.fen(), "e4e5", "w"), null);
  assert.equal(legalPremove(board.fen(), "e2e4", "w"), null);
  assert.equal(legalPremove(board.fen(), "../fake", "w"), null);
});
test("Castling, en passant, check and underpromotion use the real rules", () => {
  assert.equal(legalPremove("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", "w"), "e1g1");
  assert.equal(legalPremove("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1", "e1g1", "w"), null);
  const ep = new Chess(); for (const move of ["e4", "a6", "e5", "d5"]) ep.move(move);
  assert.equal(legalPremove(ep.fen(), "e5d6", "w"), "e5d6");
  assert.equal(legalPremove("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8n", "w"), "a7a8n");
  assert.equal(legalPremove("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8", "w"), null);
});
