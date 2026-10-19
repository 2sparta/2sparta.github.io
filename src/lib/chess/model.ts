import { Chess, DEFAULT_POSITION, type Color, type PieceSymbol } from "chess.js";
export type ChessScope = "school" | "site";
export type ChessPlayer = { id: string; name: string };
export type ChessResult = "1-0" | "0-1" | "1/2-1/2";
export type ChessGame = {
  id: string;
  scope: ChessScope;
  schoolId: string | null;
  hostId: string;
  white: ChessPlayer | null;
  black: ChessPlayer | null;
  playerIds: string[];
  status: "waiting" | "active" | "finished" | "cancelled";
  moves: string[];
  fen: string;
  turn: Color;
  clocks: { w: number; b: number };
  initialMs: number;
  incrementMs: number;
  lastMoveAt: number | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  revision: number;
  result: ChessResult | null;
  reason: string | null;
  drawOffer: string | null;
  tournamentId: string | null;
  round: number | null;
};
export const TIME_CONTROLS = [
  { label: "3 + 2", minutes: 3, increment: 2 },
  { label: "5 + 3", minutes: 5, increment: 3 },
  { label: "10 + 0", minutes: 10, increment: 0 },
  { label: "15 + 10", minutes: 15, increment: 10 },
] as const;
export function control(index: unknown) {
  if (!Number.isInteger(index) || !TIME_CONTROLS[index as number])
    throw new Error("INVALID_CONTROL");
  return TIME_CONTROLS[index as number];
}
export function chessId(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new Error("INVALID_ID");
  return value;
}
export function replay(moves: readonly string[], initialFen = DEFAULT_POSITION) {
  if (moves.length > 600) throw new Error("TOO_MANY_MOVES");
  const board = new Chess(initialFen);
  for (const uci of moves) board.move(parseUci(uci));
  return board;
}
export function parseUci(value: unknown) {
  if (typeof value !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value))
    throw new Error("ILLEGAL_MOVE");
  return {
    from: value.slice(0, 2),
    to: value.slice(2, 4),
    ...(value[4] ? { promotion: value[4] } : {}),
  };
}
export const uciOf = (m: { from: string; to: string; promotion?: string }) =>
  m.from + m.to + (m.promotion ?? "");
export function colorOf(game: ChessGame, uid: string): Color | null {
  return game.white?.id === uid ? "w" : game.black?.id === uid ? "b" : null;
}
export function terminal(board: Chess): { result: ChessResult; reason: string } | null {
  if (board.isCheckmate())
    return { result: board.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (board.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (board.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "repetition" };
  if (board.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "material" };
  if (board.isDrawByFiftyMoves()) return { result: "1/2-1/2", reason: "fifty" };
  return null;
}
export function createGame(
  id: string,
  player: ChessPlayer,
  scope: ChessScope,
  schoolId: string | null,
  color: Color,
  time: number,
  now: number,
): ChessGame {
  const c = control(time);
  if (scope !== "school" && scope !== "site") throw new Error("INVALID_SCOPE");
  if (scope === "school" && !schoolId) throw new Error("NO_SCHOOL");
  return {
    id,
    scope,
    schoolId: scope === "school" ? schoolId : null,
    hostId: player.id,
    white: color === "w" ? player : null,
    black: color === "b" ? player : null,
    playerIds: [player.id],
    status: "waiting",
    moves: [],
    fen: DEFAULT_POSITION,
    turn: "w",
    clocks: { w: c.minutes * 60_000, b: c.minutes * 60_000 },
    initialMs: c.minutes * 60_000,
    incrementMs: c.increment * 1000,
    lastMoveAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 15 * 60_000,
    revision: 0,
    result: null,
    reason: null,
    drawOffer: null,
    tournamentId: null,
    round: null,
  };
}
export function joinGame(
  game: ChessGame,
  player: ChessPlayer,
  schoolId: string | null,
  now: number,
): ChessGame {
  if (game.status !== "waiting" || now >= game.expiresAt) throw new Error("ROOM_CLOSED");
  if (game.playerIds.includes(player.id)) throw new Error("OWN_ROOM");
  if (game.scope === "school" && game.schoolId !== schoolId) throw new Error("FORBIDDEN");
  return {
    ...game,
    white: game.white ?? player,
    black: game.black ?? player,
    playerIds: [...game.playerIds, player.id],
    status: "active",
    lastMoveAt: now,
    updatedAt: now,
    revision: game.revision + 1,
  };
}
export function remaining(game: ChessGame, color: Color, now: number) {
  return Math.max(
    0,
    game.clocks[color] -
      (game.status === "active" && game.turn === color && game.lastMoveAt !== null
        ? Math.max(0, now - game.lastMoveAt)
        : 0),
  );
}
function finish(game: ChessGame, result: ChessResult, reason: string, now: number): ChessGame {
  return {
    ...game,
    status: "finished",
    result,
    reason,
    drawOffer: null,
    clocks: { w: remaining(game, "w", now), b: remaining(game, "b", now) },
    lastMoveAt: null,
    updatedAt: now,
    revision: game.revision + 1,
  };
}
function active(game: ChessGame, uid: string) {
  if (!colorOf(game, uid)) throw new Error("FORBIDDEN");
  if (game.status !== "active") throw new Error("GAME_CLOSED");
}
export function flagGame(game: ChessGame, now: number): ChessGame | null {
  if (game.status !== "active" || remaining(game, game.turn, now) > 0) return null;
  const board = replay(game.moves),
    winner = game.turn === "w" ? "b" : "w";
  const canMate = board
    .board()
    .flat()
    .some((p) => p?.color === winner && p.type !== "k");
  return finish(game, canMate ? (winner === "w" ? "1-0" : "0-1") : "1/2-1/2", "timeout", now);
}
export function moveGame(
  game: ChessGame,
  uid: string,
  move: unknown,
  revision: unknown,
  now: number,
): ChessGame {
  active(game, uid);
  if (revision !== game.revision) throw new Error("STALE_GAME");
  const flagged = flagGame(game, now);
  if (flagged) return flagged;
  if (colorOf(game, uid) !== game.turn) throw new Error("NOT_YOUR_TURN");
  const board = replay(game.moves);
  const parsed = parseUci(move);
  try {
    board.move(parsed);
  } catch {
    throw new Error("ILLEGAL_MOVE");
  }
  const moves = [...game.moves, move as string];
  const ended =
    terminal(board) ??
    (moves.length >= 600 ? { result: "1/2-1/2" as const, reason: "move-limit" } : null);
  return {
    ...game,
    moves,
    fen: board.fen(),
    turn: board.turn(),
    drawOffer: null,
    clocks: { ...game.clocks, [game.turn]: remaining(game, game.turn, now) + game.incrementMs },
    status: ended ? "finished" : "active",
    result: ended?.result ?? null,
    reason: ended?.reason ?? null,
    lastMoveAt: ended ? null : now,
    updatedAt: now,
    revision: game.revision + 1,
  };
}
export function resignGame(game: ChessGame, uid: string, now: number) {
  active(game, uid);
  return (
    flagGame(game, now) ??
    finish(game, colorOf(game, uid) === "w" ? "0-1" : "1-0", "resignation", now)
  );
}
export function drawGame(
  game: ChessGame,
  uid: string,
  action: "offer" | "accept" | "decline",
  now: number,
): ChessGame {
  active(game, uid);
  const flagged = flagGame(game, now);
  if (flagged) return flagged;
  if (action === "offer" && game.drawOffer) throw new Error("DRAW_OFFER_PENDING");
  if (action === "accept") {
    if (!game.drawOffer || game.drawOffer === uid) throw new Error("NO_DRAW_OFFER");
    return finish(game, "1/2-1/2", "agreement", now);
  }
  if (action === "decline" && (!game.drawOffer || game.drawOffer === uid))
    throw new Error("NO_DRAW_OFFER");
  return {
    ...game,
    drawOffer: action === "offer" ? uid : null,
    updatedAt: now,
    revision: game.revision + 1,
  };
}
export type ChessTournament = {
  id: string;
  title: string;
  description: string;
  scope: ChessScope;
  schoolId: string | null;
  organizer: ChessPlayer;
  players: ChessPlayer[];
  status: "registration" | "running" | "finished" | "cancelled";
  timeControl: number;
  rounds: { pairs: { white: string; black: string }[] }[];
  round: number;
  gameIds: string[];
  createdAt: number;
  updatedAt: number;
  revision: number;
};
export function roundRobin(ids: string[]): [string, string][][] {
  if (ids.length < 2 || ids.length > 16 || new Set(ids).size !== ids.length)
    throw new Error("INVALID_PLAYERS");
  const ring: (string | null)[] = [...ids];
  if (ring.length % 2) ring.push(null);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < ring.length - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i],
        b = ring[ring.length - 1 - i];
      if (a && b) pairs.push((r + i) % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}
export function standings(t: ChessTournament, games: ChessGame[]) {
  const rows = t.players.map((p) => ({ ...p, points: 0, played: 0, wins: 0, draws: 0 }));
  const seen = new Set<string>();
  for (const g of games) {
    if (seen.has(g.id) || g.tournamentId !== t.id || g.status !== "finished" || !g.result) continue;
    seen.add(g.id);
    for (const [p, score] of [
      [g.white, g.result === "1-0" ? 1 : g.result === "1/2-1/2" ? 0.5 : 0],
      [g.black, g.result === "0-1" ? 1 : g.result === "1/2-1/2" ? 0.5 : 0],
    ] as const) {
      const row = rows.find((r) => r.id === p?.id);
      if (!row) continue;
      row.points += score;
      row.played++;
      if (score === 1) row.wins++;
      if (score === 0.5) row.draws++;
    }
  }
  return rows
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
    .map((row, _, all) => ({
      ...row,
      rank:
        1 +
        all.filter((r) => r.points > row.points || (r.points === row.points && r.wins > row.wins))
          .length,
    }));
}
export function validatePgn(value: string) {
  if (!value.trim() || value.length > 30_000) throw new Error("INVALID_PGN");
  const b = new Chess();
  b.loadPgn(value);
  if (b.history().length > 600) throw new Error("TOO_MANY_MOVES");
  return b;
}
export const PIECE_NAMES: Record<PieceSymbol, [string, string]> = {
  k: ["король", "king"],
  q: ["ферзь", "queen"],
  r: ["тура", "rook"],
  b: ["слон", "bishop"],
  n: ["кінь", "knight"],
  p: ["пішак", "pawn"],
};
