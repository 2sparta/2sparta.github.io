import type { Polygon, MultiPolygon, Position } from "geojson";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import {
  ATLAS_MIN_YEAR,
  ATLAS_MAX_YEAR,
  type HistoricalFeature,
  type HistoricalCollection,
} from "./model.ts";
export type TerritoryGeometry = Polygon | MultiPolygon;
export type AtlasEdit = {
  id: string;
  name: string;
  subject: string;
  from: number;
  to: number;
  control: "direct" | "relative";
  relation: string;
  operation: "add" | "replace" | "hide";
  target?: { name: string; region: string };
  color: string;
  description: string;
  sourceUrl: string;
  sourceId?: string;
  sourceYear?: number;
  geometry: TerritoryGeometry;
};
export const MAX_ATLAS_EDIT_BYTES = 450_000;
export const MAX_EDIT_VERTICES = 20_000;
export const RELATIONS = [
  "Неповний контроль",
  "Данницька залежність",
  "Васалітет",
  "Сфера впливу",
  "Спірна територія",
] as const;
const clone = <T>(x: T): T => structuredClone(x);
export function geometryParts(g: TerritoryGeometry): Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}
export function openRing(r: Position[]): Position[] {
  const result = clone(r);
  if (result.length > 1 && result[0][0] === result.at(-1)![0] && result[0][1] === result.at(-1)![1])
    result.pop();
  return result;
}
export function openGeometry(g: TerritoryGeometry): TerritoryGeometry {
  const parts = geometryParts(g).map((p) => p.map(openRing));
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: parts[0] }
    : { type: "MultiPolygon", coordinates: parts };
}
export function editRing(
  g: TerritoryGeometry,
  part: number,
  ring: number,
  points: Position[],
): TerritoryGeometry {
  const parts = clone(geometryParts(g));
  if (!parts[part]?.[ring]) throw new Error("INVALID_RING");
  parts[part][ring] = clone(points);
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: parts[0] }
    : { type: "MultiPolygon", coordinates: parts };
}
export function addGeometryPart(g: TerritoryGeometry): TerritoryGeometry {
  return { type: "MultiPolygon", coordinates: [...clone(geometryParts(g)), [[]]] };
}
export function addGeometryHole(g: TerritoryGeometry, part: number): TerritoryGeometry {
  const ps = clone(geometryParts(g));
  if (!ps[part]) throw new Error("INVALID_RING");
  ps[part].push([]);
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: ps[0] }
    : { type: "MultiPolygon", coordinates: ps };
}
export function removeGeometryRing(
  g: TerritoryGeometry,
  part: number,
  ring: number,
): TerritoryGeometry {
  const ps = clone(geometryParts(g));
  if (!ps[part]?.[ring]) throw new Error("INVALID_RING");
  if (ring === 0) {
    if (ps.length === 1) throw new Error("LAST_OUTLINE");
    ps.splice(part, 1);
  } else ps[part].splice(ring, 1);
  return ps.length === 1
    ? { type: "Polygon", coordinates: ps[0] }
    : { type: "MultiPolygon", coordinates: ps };
}
export function normalizeTerritoryGeometry(raw: unknown): TerritoryGeometry {
  const g = raw as TerritoryGeometry;
  if (!g || !["Polygon", "MultiPolygon"].includes(g.type) || !Array.isArray(g.coordinates))
    throw new Error("INVALID_GEOMETRY");
  const parts = geometryParts(g);
  let count = 0;
  if (!parts.length || parts.length > 3000) throw new Error("INVALID_GEOMETRY");
  const normalized = parts.map((p) => {
    if (!Array.isArray(p) || !p.length || p.length > 100) throw new Error("INVALID_GEOMETRY");
    return p.map((r) => {
      if (!Array.isArray(r)) throw new Error("INVALID_GEOMETRY");
      const pts = r.map((c) => {
        if (
          !Array.isArray(c) ||
          c.length !== 2 ||
          c.some((x) => typeof x !== "number" || !Number.isFinite(x)) ||
          Math.abs(c[0]) > 180 ||
          Math.abs(c[1]) > 90
        )
          throw new Error("INVALID_COORDINATES");
        if (++count > MAX_EDIT_VERTICES) throw new Error("TOO_MANY_VERTICES");
        return c.map((x) => Math.round(x * 1e6) / 1e6);
      });
      const opened = openRing(pts);
      if (opened.length < 3 || new Set(opened.map((c) => c.join(","))).size < 3)
        throw new Error("THREE_POINTS_REQUIRED");
      return [...opened, clone(opened[0])];
    });
  });
  const result: TerritoryGeometry =
    g.type === "Polygon"
      ? { type: "Polygon", coordinates: normalized[0] }
      : { type: "MultiPolygon", coordinates: normalized };
  try {
    if (!new IsValidOp(new GeoJSONReader().read(result)).isValid())
      throw new Error("INVALID_TOPOLOGY");
  } catch {
    throw new Error("INVALID_TOPOLOGY");
  }
  return result;
}
function str(x: unknown, max: number, required = false) {
  if (typeof x !== "string" || x.length > max || (required && !x.trim()))
    throw new Error("INVALID_ATLAS_EDIT");
  return x.trim();
}
export function validateAtlasEdit(raw: unknown): AtlasEdit {
  const x = raw as AtlasEdit;
  if (!x || typeof x !== "object") throw new Error("INVALID_ATLAS_EDIT");
  if (
    !Number.isInteger(x.from) ||
    !Number.isInteger(x.to) ||
    x.from < ATLAS_MIN_YEAR ||
    x.to > ATLAS_MAX_YEAR ||
    x.from > x.to
  )
    throw new Error("INVALID_EDIT_DATES");
  if (
    !["direct", "relative"].includes(x.control) ||
    !["add", "replace", "hide"].includes(x.operation) ||
    !/^#[0-9a-f]{6}$/i.test(x.color)
  )
    throw new Error("INVALID_ATLAS_EDIT");
  if (!/^[-a-zA-Z0-9_]{1,100}$/.test(x.id)) throw new Error("INVALID_ATLAS_EDIT");
  let target: AtlasEdit["target"];
  if (x.target) {
    target = { name: str(x.target.name, 200, true), region: str(x.target.region, 30) };
    if (!["", "rus", "franks", "mongols", "france"].includes(target.region))
      throw new Error("INVALID_ATLAS_EDIT");
  }
  if (x.operation !== "add" && !target) throw new Error("EDIT_TARGET_REQUIRED");
  const sourceUrl = str(x.sourceUrl, 2000);
  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) throw 0;
    } catch {
      throw new Error("INVALID_SOURCE_URL");
    }
  }
  return {
    id: x.id,
    name: str(x.name, 200, true),
    subject: str(x.subject, 200, true),
    from: x.from,
    to: x.to,
    control: x.control,
    relation: str(x.relation, 100, x.control === "relative"),
    operation: x.operation,
    ...(target ? { target } : {}),
    color: x.color,
    description: str(x.description, 4000),
    sourceUrl,
    ...(x.sourceId ? { sourceId: str(x.sourceId, 100) } : {}),
    ...(Number.isInteger(x.sourceYear) ? { sourceYear: x.sourceYear } : {}),
    geometry: normalizeTerritoryGeometry(x.geometry),
  };
}
export function validateAtlasEdits(raw: unknown): AtlasEdit[] {
  if (!Array.isArray(raw) || raw.length > 200) throw new Error("TOO_MANY_EDITS");
  if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_ATLAS_EDIT_BYTES)
    throw new Error("ATLAS_EDIT_LIMIT");
  const entries = raw.map(validateAtlasEdit);
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error("DUPLICATE_EDIT");
    ids.add(e.id);
  }
  const replacements = entries.filter((e) => e.operation !== "add");
  for (let i = 0; i < replacements.length; i++)
    for (const b of replacements.slice(i + 1)) {
      const a = replacements[i];
      if (
        a.target!.name === b.target!.name &&
        a.target!.region === b.target!.region &&
        a.from <= b.to &&
        b.from <= a.to
      )
        throw new Error("OVERLAPPING_REPLACEMENTS");
    }
  return entries;
}
export function serializeAtlasEdits(entries: AtlasEdit[]) {
  const text = JSON.stringify(validateAtlasEdits(entries));
  if (new TextEncoder().encode(text).length > MAX_ATLAS_EDIT_BYTES)
    throw new Error("ATLAS_EDIT_LIMIT");
  return text;
}
export function parseAtlasEdits(raw: unknown): AtlasEdit[] {
  if (raw == null) return [];
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_ATLAS_EDIT_BYTES)
    throw new Error("INVALID_ATLAS_DATA");
  try {
    return validateAtlasEdits(JSON.parse(raw));
  } catch (e) {
    throw e instanceof Error ? e : new Error("INVALID_ATLAS_DATA");
  }
}
export function matchesAtlasTarget(f: HistoricalFeature, target: NonNullable<AtlasEdit["target"]>) {
  return target.name === f.properties.name && target.region === (f.properties.region ?? "");
}
export function applyAtlasEdits(
  base: HistoricalCollection | undefined,
  entries: AtlasEdit[],
  year: number,
): HistoricalCollection | undefined {
  const active = entries.filter((e) => year >= e.from && year <= e.to);
  if (!active.length) return base;
  const features = (base?.features ?? []).filter(
    (f) => !active.some((e) => e.operation !== "add" && matchesAtlasTarget(f, e.target!)),
  );
  for (const e of active) {
    if (e.operation === "hide") continue;
    features.push({
      type: "Feature",
      id: `manual-${e.id}`,
      geometry: e.geometry,
      properties: {
        name: e.name,
        subject: e.subject,
        color: e.color,
        precision: 1,
        detailed: true,
        custom: true,
        control: e.control,
        relation: e.relation,
        validFrom: e.from,
        validTo: e.to,
        description: e.description,
        sourceUrl: e.sourceUrl,
        sourceId: e.sourceId ?? "manual-atlas",
        ...(e.sourceYear !== undefined ? { sourceYear: e.sourceYear } : {}),
      },
    });
  }
  return { type: "FeatureCollection", features };
}
export function newAtlasEdit(
  year: number,
  feature?: HistoricalFeature,
  relative = false,
): AtlasEdit {
  if (feature && !["Polygon", "MultiPolygon"].includes(feature.geometry.type))
    throw new Error("INVALID_GEOMETRY");
  return {
    id: crypto.randomUUID(),
    name: feature ? `${relative ? "Залежна територія: " : ""}${feature.properties.name}` : "",
    subject: feature?.properties.subject ?? "",
    from: year,
    to: year,
    control: relative ? "relative" : "direct",
    relation: relative ? "Неповний контроль" : "",
    operation: feature && !relative ? "replace" : "add",
    ...(feature && !relative
      ? { target: { name: feature.properties.name, region: feature.properties.region ?? "" } }
      : {}),
    color: feature?.properties.color ?? "#a65839",
    description: feature?.properties.description ?? "",
    sourceUrl: feature?.properties.sourceUrl ?? "",
    ...(feature?.properties.sourceId ? { sourceId: feature.properties.sourceId } : {}),
    ...(feature?.properties.sourceYear ? { sourceYear: feature.properties.sourceYear } : {}),
    geometry: feature
      ? openGeometry(feature.geometry as TerritoryGeometry)
      : { type: "Polygon", coordinates: [[]] },
  };
}
export function atlasWritePatch(
  existing: { createdBy?: unknown; atlasRevision?: unknown },
  userId: string,
  expectedRevision: number,
  entries: AtlasEdit[],
  now: number,
) {
  if (existing.createdBy !== userId) throw new Error("ATLAS_OWNER_REQUIRED");
  const revision = Number(existing.atlasRevision) || 0;
  if (revision !== expectedRevision) throw new Error("CONFLICT");
  const patch = {
    atlasEdits: serializeAtlasEdits(entries),
    atlasRevision: revision + 1,
    atlasUpdatedBy: userId,
    atlasUpdatedAt: now,
  };
  if (new TextEncoder().encode(JSON.stringify({ ...existing, ...patch })).length > 900_000)
    throw new Error("ATLAS_EDIT_LIMIT");
  return patch;
}
export function atlasEditError(e: unknown, uk = true) {
  const code = e instanceof Error ? e.message : String(e);
  const messages: Record<string, [string, string]> = {
    INVALID_EDIT_DATES: ["Перевірте роки початку й завершення.", "Check the start and end years."],
    THREE_POINTS_REQUIRED: [
      "Контур потребує щонайменше трьох різних точок.",
      "An outline needs at least three different points.",
    ],
    INVALID_TOPOLOGY: [
      "Контур перетинає сам себе, має перетинні частини або отвір поза територією. Виправте точки.",
      "The shape crosses itself, has overlapping parts or a hole outside the territory. Fix its vertices.",
    ],
    INVALID_COORDINATES: [
      "Координати: довгота від −180 до 180, широта від −90 до 90.",
      "Longitude: −180 to 180; latitude: −90 to 90.",
    ],
    OVERLAPPING_REPLACEMENTS: [
      "Для цього базового контуру вже є правка на ці роки. Змініть її або розділіть періоди.",
      "Another replacement of this base territory covers these years. Edit it or separate the periods.",
    ],
    CONFLICT: [
      "Атлас змінився в іншому вікні. Чернетка збережена: оновіть список і повторіть збереження.",
      "The atlas changed in another window. Your draft remains: refresh the list and save again.",
    ],
    ATLAS_OWNER_REQUIRED: [
      "Редагувати спільний атлас може власник школи.",
      "Only the school owner can edit the shared atlas.",
    ],
    ATLAS_EDIT_LIMIT: [
      "Ручні шари перевищують ліміт розміру. Скоротіть деталізацію або кількість територій.",
      "The manual layers exceed the size limit. Reduce detail or the number of territories.",
    ],
    INVALID_SOURCE_URL: [
      "Джерело має бути посиланням http або https.",
      "The source must be an HTTP or HTTPS link.",
    ],
    INVALID_ATLAS_EDIT: [
      "Заповніть назву, державу та коректний колір території.",
      "Enter a name, polity and valid territory colour.",
    ],
    TOO_MANY_VERTICES: ["Контур перевищує 20 000 точок.", "The shape exceeds 20,000 vertices."],
    LAST_OUTLINE: [
      "Останній зовнішній контур можна очистити й намалювати заново.",
      "Clear and redraw the final outer outline.",
    ],
  };
  return (
    messages[code]?.[uk ? 0 : 1] ??
    (uk
      ? "Не вдалося виконати дію. Перевірте дані та з’єднання; чернетка лишається відкритою."
      : "Could not complete the action. Check the data and connection; the draft remains open.")
  );
}
