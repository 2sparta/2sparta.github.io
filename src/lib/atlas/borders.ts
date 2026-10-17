import type { Position } from "geojson";
import type { HistoricalCollection, HistoricalFeature } from "./model.ts";
import {
  geometryParts,
  matchesAtlasTarget,
  openGeometry,
  openRing,
  newAtlasEdit,
  type AtlasEdit,
  type TerritoryGeometry,
} from "./edits.ts";
export type BorderMove = { from: Position; to: Position };
export const samePoint = (a: Position, b: Position) =>
  Math.abs(a[0] - b[0]) < 0.0000005 && Math.abs(a[1] - b[1]) < 0.0000005;
export function borderMoves(before: TerritoryGeometry, after: TerritoryGeometry): BorderMove[] {
  const result: BorderMove[] = [];
  const next = geometryParts(after);
  geometryParts(before).forEach((part, pi) =>
    part.forEach((ring, ri) => {
      const a = openRing(ring),
        b = next[pi]?.[ri] ? openRing(next[pi][ri]) : [];
      // Insertions and removals don't relabel the remaining vertices.
      if (a.length !== b.length) return;
      a.forEach((p, i) => {
        if (!samePoint(p, b[i])) result.push({ from: p, to: b[i] });
      });
    }),
  );
  return result;
}
export function borderFeatures(collection: HistoricalCollection | undefined, draft: AtlasEdit) {
  return (collection?.features ?? []).filter(
    (f) =>
      ["Polygon", "MultiPolygon"].includes(f.geometry.type) &&
      String(f.id) !== `manual-${draft.id}` &&
      !(draft.target && matchesAtlasTarget(f, draft.target)),
  );
}
/** Coordinates shared by two rings act as a common node; save both in one atlas revision. */
export function saveSharedBorders(
  entries: AtlasEdit[],
  draft: AtlasEdit,
  collection: HistoricalCollection | undefined,
  moves: BorderMove[],
): AtlasEdit[] {
  const result = [...entries.filter((e) => e.id !== draft.id), draft];
  for (const feature of borderFeatures(collection, draft)) {
    let geometry = openGeometry(feature.geometry as TerritoryGeometry);
    let changed = false;
    for (const move of moves) {
      const parts = geometryParts(geometry).map((p) =>
        p.map((r) =>
          r.map((v) => {
            if (!samePoint(v, move.from)) return v;
            changed = true;
            return [...move.to];
          }),
        ),
      );
      geometry =
        geometry.type === "Polygon"
          ? { type: "Polygon", coordinates: parts[0] }
          : { type: "MultiPolygon", coordinates: parts };
    }
    if (!changed) continue;
    const existing = entries.find((e) => `manual-${e.id}` === String(feature.id));
    const neighbor = existing
      ? structuredClone(existing)
      : newAtlasEdit(draft.from, feature as HistoricalFeature);
    const from = Math.max(draft.from, existing?.from ?? draft.from);
    const to = Math.min(draft.to, existing?.to ?? draft.to);
    if (from > to) continue;
    if (existing) {
      const index = result.findIndex((e) => e.id === existing.id);
      if (index >= 0) result.splice(index, 1);
      // Preserve the neighbour outside the edited period.
      if (existing.from < from) result.push({ ...existing, id: crypto.randomUUID(), to: from - 1 });
      if (existing.to > to) result.push({ ...existing, id: crypto.randomUUID(), from: to + 1 });
    }
    result.push({ ...neighbor, from, to, geometry });
  }
  return result;
}
