import { create } from "zustand";
import { persist } from "zustand/middleware";
export const PIECE_SETS = ["classic", "club", "minimal"] as const;
export const BOARD_THEMES = ["forest", "wood", "slate"] as const;
export type PieceSet = typeof PIECE_SETS[number];
export type BoardTheme = typeof BOARD_THEMES[number];
export type ChessPreferences = {
  pieces: PieceSet;
  board: BoardTheme;
  coordinates: boolean;
  legalHints: boolean;
  highlightLast: boolean;
  premoves: boolean;
  autoQueen: boolean;
};
export const DEFAULT_CHESS_PREFERENCES: ChessPreferences = {
  pieces: "classic", board: "forest", coordinates: true,
  legalHints: true, highlightLast: true, premoves: true, autoQueen: false,
};
export function parseChessPreferences(raw: unknown): ChessPreferences {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const result = { ...DEFAULT_CHESS_PREFERENCES };
  if (PIECE_SETS.includes(value.pieces as PieceSet)) result.pieces = value.pieces as PieceSet;
  if (BOARD_THEMES.includes(value.board as BoardTheme)) result.board = value.board as BoardTheme;
  for (const key of ["coordinates", "legalHints", "highlightLast", "premoves", "autoQueen"] as const)
    if (typeof value[key] === "boolean") result[key] = value[key];
  return result;
}
export const useChessPreferences = create<ChessPreferences & {
  update: (patch: Partial<ChessPreferences>) => void;
  reset: () => void;
}>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CHESS_PREFERENCES,
      update: (patch) => set(parseChessPreferences({ ...get(), ...patch })),
      reset: () => set(DEFAULT_CHESS_PREFERENCES),
    }),
    {
      name: "school-chess-preferences:v1",
      merge: (persisted, current) => ({ ...current, ...parseChessPreferences(persisted) }),
    },
  ),
);
