import { Chess, type Color, type Square } from "chess.js";
import { parseUci } from "./model.ts";
/** Geometry only: the opponent may move a blocker or capture the destination piece.
 * Real legality, including checks/castling/en passant, is verified after their move. */
export function premoveTargets(board: Chess, from: Square, color: Color): Square[] {
  const piece = board.get(from);
  if (!piece || piece.color !== color) return [];
  const x = from.charCodeAt(0) - 97, y = Number(from[1]) - 1;
  const squares: Square[] = [];
  for (let tx = 0; tx < 8; tx++) for (let ty = 0; ty < 8; ty++) {
    const dx = tx - x, dy = ty - y;
    if (!dx && !dy) continue;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const step = color === "w" ? 1 : -1;
    let possible = false;
    if (piece.type === "n") possible = ax * ay === 2;
    if (piece.type === "b") possible = ax === ay;
    if (piece.type === "r") possible = !dx || !dy;
    if (piece.type === "q") possible = !dx || !dy || ax === ay;
    if (piece.type === "k") {
      possible = ax <= 1 && ay <= 1;
      if (from === (color === "w" ? "e1" : "e8") && dy === 0 && ax === 2) {
        const rights = board.fen().split(" ")[2];
        possible = rights.includes(dx > 0 ? (color === "w" ? "K" : "k") : (color === "w" ? "Q" : "q"));
      }
    }
    if (piece.type === "p") possible =
      (dy === step && ax <= 1) ||
      (dx === 0 && dy === step * 2 && y === (color === "w" ? 1 : 6));
    if (possible) squares.push(("abcdefgh"[tx] + (ty + 1)) as Square);
  }
  return squares;
}
export function legalPremove(fen: string, move: string, color: Color) {
  try {
    const board = new Chess(fen);
    if (board.turn() !== color || board.get(move.slice(0, 2) as Square)?.color !== color) return null;
    board.move(parseUci(move));
    return move;
  } catch { return null; }
}
