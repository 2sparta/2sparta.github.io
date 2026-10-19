import { Chess, type Move } from "chess.js";
import { parseUci, uciOf } from "./model.ts";
const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
export type EngineLine = { move: string; san: string; score: number; pv: string[] };
export type EngineResult = { lines: EngineLine[]; depth: number; nodes: number; elapsed: number };
/** Small local teaching engine. Scores are approximate pawns, from White's view. */
export function evaluate(board: Chess) {
  if (board.isCheckmate()) return board.turn() === "w" ? -100000 : 100000;
  if (board.isDraw()) return 0;
  let score = 0;
  board.board().forEach((rank, y) =>
    rank.forEach((p, x) => {
      if (!p) return;
      const center = 3.5 - (Math.abs(3.5 - x) + Math.abs(3.5 - y)) / 2;
      const advance = p.color === "w" ? 6 - y : y - 1;
      const position =
        p.type === "p"
          ? advance * 7 + center * 4
          : p.type === "n"
            ? center * 18
            : p.type === "b"
              ? center * 10
              : p.type === "k"
                ? -center * 5
                : center * 3;
      score += (VALUES[p.type] + position) * (p.color === "w" ? 1 : -1);
    }),
  );
  return score;
}
const order = (moves: Move[], hint?: string) =>
  moves.sort((a, b) => {
    const rank = (m: Move) =>
      (uciOf(m) === hint ? 100000 : 0) +
      (m.captured ? VALUES[m.captured] * 10 - VALUES[m.piece] : 0) +
      (m.promotion ? VALUES[m.promotion] * 5 : 0) +
      (m.san.includes("+") ? 40 : 0);
    return rank(b) - rank(a);
  });
export function searchPosition(
  fen: string,
  depth = 3,
  milliseconds = 1000,
  history: string[] = [],
): EngineResult {
  const board = new Chess(fen); // History is supplied only when it ends at this position.
  if (history.length) {
    const b = new Chess();
    for (const m of history) b.move(parseUci(m));
    if (b.fen() === fen) {
      board.loadPgn(b.pgn());
    }
  }
  const start = Date.now(),
    deadline = start + Math.max(50, Math.min(3000, milliseconds));
  let nodes = 0;
  const stop = Symbol("deadline");
  function negamax(
    d: number,
    alpha: number,
    beta: number,
    ply: number,
  ): { score: number; pv: string[] } {
    nodes++;
    if (nodes % 32 === 0 && Date.now() > deadline) throw stop;
    if (board.isCheckmate()) return { score: -100000 + ply, pv: [] };
    if (board.isDraw()) return { score: 0, pv: [] };
    if (d === 0) return { score: evaluate(board) * (board.turn() === "w" ? 1 : -1), pv: [] };
    let best = -Infinity,
      pv: string[] = [];
    for (const move of order(board.moves({ verbose: true }))) {
      board.move(move);
      let child;
      try {
        child = negamax(d - 1, -beta, -alpha, ply + 1);
      } finally {
        board.undo();
      }
      const score = -child.score;
      if (score > best) {
        best = score;
        pv = [uciOf(move), ...child.pv];
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return { score: best, pv };
  }
  const rootSign = board.turn() === "w" ? 1 : -1;
  let lines: EngineLine[] = [],
    complete = 0;
  const roots = order(board.moves({ verbose: true }));
  for (let d = 1; d <= Math.max(1, Math.min(4, depth)); d++) {
    const round: EngineLine[] = [];
    try {
      for (const move of order([...roots], lines[0]?.move)) {
        board.move(move);
        let child;
        try {
          child = negamax(d - 1, -Infinity, Infinity, 1);
        } finally {
          board.undo();
        }
        round.push({
          move: uciOf(move),
          san: move.san,
          score: -child.score * rootSign,
          pv: [uciOf(move), ...child.pv],
        });
        if (Date.now() > deadline) throw stop;
      }
      lines = round.sort((a, b) => (b.score - a.score) * rootSign);
      complete = d;
    } catch (e) {
      if (e !== stop) throw e;
      break;
    }
  }
  if (!lines.length && roots.length)
    lines = [
      { move: uciOf(roots[0]), san: roots[0].san, score: evaluate(board), pv: [uciOf(roots[0])] },
    ];
  return { lines: lines.slice(0, 3), depth: complete, nodes, elapsed: Date.now() - start };
}
