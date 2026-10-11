export type DutyGrid = { cols: string[]; rows: string[][] };
export const MAX_DUTY_COLS = 12;
export const MAX_DUTY_ROWS = 40;
export function emptyDutyGrid(): DutyGrid {
  return { cols: ["День / дата", "Чергові", "Завдання"], rows: [["", "", ""]] };
}
export function parseDutyGrid(raw: unknown): DutyGrid {
  if (!raw || typeof raw !== "object") return emptyDutyGrid();
  const bag = raw as { cols?: unknown; rows?: unknown };
  const cols = Array.isArray(bag.cols) ? bag.cols.map(String) : [];
  if (!cols.length) cols.push("");
  const rows = Array.isArray(bag.rows)
    ? bag.rows.map((row) => {
        const values = Array.isArray(row)
          ? row
          : row && typeof row === "object" && "cells" in row && Array.isArray(row.cells)
            ? row.cells
            : [];
        return cols.map((_, i) => String(values[i] ?? ""));
      })
    : [];
  return { cols, rows: rows.length ? rows : [cols.map(() => "")] };
}
// Firestore does not accept arrays directly nested inside arrays.
export function serializeDutyGrid(grid: DutyGrid) {
  if (
    !grid.cols.length ||
    grid.cols.length > MAX_DUTY_COLS ||
    !grid.rows.length ||
    grid.rows.length > MAX_DUTY_ROWS ||
    grid.rows.some((r) => r.length !== grid.cols.length)
  )
    throw new Error("GRID_SIZE");
  if ([...grid.cols, ...grid.rows.flat()].some((v) => v.length > 2000))
    throw new Error("CELL_SIZE");
  return { cols: grid.cols, rows: grid.rows.map((cells) => ({ cells })) };
}
export function insertDutyColumn(grid: DutyGrid, index: number): DutyGrid {
  if (grid.cols.length >= MAX_DUTY_COLS) return grid;
  return {
    cols: [...grid.cols.slice(0, index), "", ...grid.cols.slice(index)],
    rows: grid.rows.map((r) => [...r.slice(0, index), "", ...r.slice(index)]),
  };
}
export function insertDutyRow(grid: DutyGrid, index: number): DutyGrid {
  if (grid.rows.length >= MAX_DUTY_ROWS) return grid;
  return {
    ...grid,
    rows: [...grid.rows.slice(0, index), grid.cols.map(() => ""), ...grid.rows.slice(index)],
  };
}
export function pasteDutyCells(grid: DutyGrid, row: number, col: number, text: string): DutyGrid {
  const lines = text
    .replace(/\r/g, "")
    .replace(/\n$/, "")
    .split("\n")
    .map((l) => l.split("\t"));
  const width = Math.max(grid.cols.length, col + Math.max(...lines.map((l) => l.length)));
  const height = Math.max(grid.rows.length, row + lines.length);
  if (width > MAX_DUTY_COLS || height > MAX_DUTY_ROWS) throw new Error("GRID_SIZE");
  return {
    cols: Array.from({ length: width }, (_, c) => grid.cols[c] ?? ""),
    rows: Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => lines[r - row]?.[c - col] ?? grid.rows[r]?.[c] ?? ""),
    ),
  };
}
