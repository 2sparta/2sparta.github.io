import { ATLAS_MIN_YEAR, ATLAS_MAX_YEAR, clampAtlasYear } from "./model.ts";

export type AtlasDate = { year: number; month: number; day: number };
export function daysInAtlasMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
const bounded = (value: number, min: number, max: number, fallback: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : fallback));
export function normalizeAtlasDate(year: number, month = 1, day = 1): AtlasDate {
  year = clampAtlasYear(year);
  month = bounded(month, 1, 12, 1);
  return { year, month, day: bounded(day, 1, daysInAtlasMonth(year, month), 1) };
}
export function atlasDateKey(date: AtlasDate) {
  const d = normalizeAtlasDate(date.year, date.month, date.day);
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
export function parseAtlasDate(key: string): AtlasDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return undefined;
  const raw = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const d = normalizeAtlasDate(raw.year, raw.month, raw.day);
  return atlasDateKey(d) === key ? d : undefined;
}
const MS_DAY = 86_400_000;
const EPOCH = Date.UTC(ATLAS_MIN_YEAR, 0, 1);
export const ATLAS_LAST_DAY = (Date.UTC(ATLAS_MAX_YEAR, 11, 31) - EPOCH) / MS_DAY;
export function atlasDateOrdinal(date: AtlasDate) {
  const d = normalizeAtlasDate(date.year, date.month, date.day);
  return (Date.UTC(d.year, d.month - 1, d.day) - EPOCH) / MS_DAY;
}
export function atlasDateFromOrdinal(value: number): AtlasDate {
  const d = new Date(EPOCH + bounded(value, 0, ATLAS_LAST_DAY, 0) * MS_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
export function shiftAtlasDay(date: AtlasDate, days: number) {
  return atlasDateFromOrdinal(atlasDateOrdinal(date) + days);
}
export function formatAtlasDate(date: AtlasDate, precision: "year" | "month" | "day" = "day") {
  const d = normalizeAtlasDate(date.year, date.month, date.day);
  const year = String(d.year);
  if (precision === "year") return year;
  const month = String(d.month).padStart(2, "0");
  return precision === "month"
    ? `${month}.${year}`
    : `${String(d.day).padStart(2, "0")}.${month}.${year}`;
}
export function validateAtlasSearchDate(search: Record<string, unknown>) {
  if (search.year === undefined && search.month === undefined && search.day === undefined)
    return {};
  const d = normalizeAtlasDate(
    Number(search.year ?? 1000),
    Number(search.month ?? 1),
    Number(search.day ?? 1),
  );
  return d;
}
