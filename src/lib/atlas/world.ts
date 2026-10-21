import { validateHistoricalCollection, type HistoricalCollection } from "./model.ts";
import type { AtlasDate } from "./date.ts";

export const WORLD_MIN_YEAR = -500;
export const WORLD_MAX_YEAR = 1994;
export type WorldFrame = AtlasDate & {
  baseYear: number;
  path: string;
  sha256: string;
  sources: { name: string; year: number; date?: string; note?: string }[];
};
export type WorldManifest = {
  version: 1;
  historicalCommit: string;
  baseFiles: {
    year: number;
    path: string;
    sha256: string;
    sourceSha256: string;
    features: number;
  }[];
  frames: WorldFrame[];
};
export type WorldPatch = { baseYear: number; remove: string[]; collection: HistoricalCollection };
const bound = (v: number, min: number, max: number, fallback: number) =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? Math.trunc(v) : fallback));
export function worldDate(year: number, month = 1, day = 1): AtlasDate {
  year = bound(year, WORLD_MIN_YEAR, WORLD_MAX_YEAR, 1000) || 1;
  month = bound(month, 1, 12, 1);
  // Civil BCE has no year zero; JavaScript astronomical years do.
  const d = new Date(0);
  d.setUTCFullYear(year < 0 ? year + 1 : year, month, 0);
  return { year, month, day: bound(day, 1, d.getUTCDate(), 1) };
}
export function compareWorldDates(a: AtlasDate, b: AtlasDate) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}
export function worldDateKey(d: AtlasDate) {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
export function formatWorldDate(d: AtlasDate, uk = true) {
  const year = d.year < 0 ? `${-d.year} ${uk ? "до н. е." : "BCE"}` : String(d.year);
  return `${String(d.day).padStart(2, "0")}.${String(d.month).padStart(2, "0")}.${year}`;
}
export function shiftWorldDay(date: AtlasDate, days: number): AtlasDate {
  const d = new Date(0);
  d.setUTCFullYear(date.year < 0 ? date.year + 1 : date.year, date.month - 1, date.day);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const civil = { year: y <= 0 ? y - 1 : y, month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  if (compareWorldDates(civil, worldDate(WORLD_MIN_YEAR)) < 0) return worldDate(WORLD_MIN_YEAR);
  if (compareWorldDates(civil, worldDate(WORLD_MAX_YEAR, 12, 31)) > 0)
    return worldDate(WORLD_MAX_YEAR, 12, 31);
  return civil;
}
export function worldFrameAt(manifest: WorldManifest | undefined, date: AtlasDate) {
  return manifest && [...manifest.frames].reverse().find((f) => compareWorldDates(f, date) <= 0);
}
export function validateWorldManifest(raw: unknown): WorldManifest {
  const m = raw as WorldManifest;
  if (
    m?.version !== 1 ||
    !Array.isArray(m.frames) ||
    !m.frames.length ||
    !Array.isArray(m.baseFiles)
  )
    throw new Error("INVALID_WORLD_MANIFEST");
  for (const b of m.baseFiles) {
    if (
      !Number.isInteger(b.year) ||
      !b.year ||
      !/^base--?\d+\.geojson$/.test(b.path) ||
      !/^[a-f0-9]{64}$/.test(b.sha256)
    )
      throw new Error("INVALID_WORLD_MANIFEST");
  }
  for (let i = 0; i < m.frames.length; i++) {
    const f = m.frames[i];
    if (
      !/^patch--?\d+-\d{2}-\d{2}\.json$/.test(f.path) ||
      f.baseYear > f.year ||
      !m.baseFiles.some((b) => b.year === f.baseYear) ||
      !Array.isArray(f.sources) ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      compareWorldDates(worldDate(f.year, f.month, f.day), f) !== 0 ||
      (i > 0 && compareWorldDates(m.frames[i - 1], f) >= 0)
    )
      throw new Error("INVALID_WORLD_MANIFEST");
  }
  return m;
}
export function validateWorldPatch(raw: unknown): WorldPatch {
  const p = raw as WorldPatch;
  if (
    !Number.isInteger(p?.baseYear) ||
    !Array.isArray(p.remove) ||
    !p.remove.every((id) => typeof id === "string") ||
    p.collection?.type !== "FeatureCollection" ||
    !Array.isArray(p.collection.features)
  )
    throw new Error("INVALID_WORLD_PATCH");
  if (p.collection.features.length) validateHistoricalCollection(p.collection);
  if (new Set(p.collection.features.map((f) => f.id)).size !== p.collection.features.length)
    throw new Error("DUPLICATE_WORLD_FEATURE");
  return p;
}
export function applyWorldPatch(
  base: HistoricalCollection,
  patch: WorldPatch,
): HistoricalCollection {
  if (
    !Array.isArray(patch.remove) ||
    !patch.collection ||
    !Array.isArray(patch.collection.features)
  )
    throw new Error("INVALID_WORLD_PATCH");
  const updated = patch.collection.features;
  if (updated.length) validateHistoricalCollection(patch.collection);
  const ids = new Set(updated.map((f) => String(f.id)));
  const removed = new Set(patch.remove);
  const features = [
    ...base.features.filter((f) => !removed.has(String(f.id)) && !ids.has(String(f.id))),
    ...updated,
  ];
  if (new Set(features.map((f) => f.id)).size !== features.length)
    throw new Error("DUPLICATE_WORLD_FEATURE");
  return { type: "FeatureCollection", features };
}
export function validateWorldSearchDate(search: Record<string, unknown>) {
  if (search.year === undefined && search.month === undefined && search.day === undefined)
    return {};
  return worldDate(Number(search.year ?? 1000), Number(search.month ?? 1), Number(search.day ?? 1));
}

/** City datasets share many reference points. A single town gets one marker. */
export function uniqueWorldPlaces<
  T extends { lat: number; lng: number; type: string; capital?: boolean },
>(places: T[]) {
  const seen = new Map<string, T>();
  for (const p of places) {
    const key = `${Math.round(p.lat * 100)}:${Math.round(p.lng * 100)}:${p.type}`;
    if (!seen.has(key) || p.capital) seen.set(key, p);
  }
  return [...seen.values()];
}
