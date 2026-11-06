import { Chess } from "chess.js";
import type { AppSound } from "../sounds";

/** A live move, not a restored game, takeback, or history seek. */
export function chessMoveSound(
  previous: readonly string[],
  moves: readonly string[],
  initialFen: string,
): AppSound | null {
  if (moves.length !== previous.length + 1 || !previous.every((m, i) => m === moves[i]))
    return null;
  try {
    const board = new Chess(initialFen);
    let captured = false;
    for (const move of moves) {
      const played = board.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.slice(4) || undefined,
      });
      captured = Boolean(played.captured);
    }
    if (board.isGameOver()) return "end";
    if (board.isCheck()) return "check";
    return captured ? "capture" : "move";
  } catch {
    return null;
  }
}
