import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import Overlay from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import type { FeatureCollection, Geometry, Polygon, MultiPolygon, Position } from "geojson";
import type { HistoricalCollection, HistoricalFeature } from "./model.ts";
export type TerritoryChange = { from: string; to: string };
export type ChangeCollection = FeatureCollection<Polygon | MultiPolygon, TerritoryChange>;
export type ComparisonResult = { collection: ChangeCollection; skipped: number };
type Shape = { getArea(): number; isEmpty(): boolean };
const reader = new GeoJSONReader(),
  writer = new GeoJSONWriter();
const aliases: Record<string, string> = {
  commonwealth: "Polish-Lithuanian Commonwealth",
  "poland-lithuania": "Polish-Lithuanian Commonwealth",
  "polish-lithuanian commonwealth": "Polish-Lithuanian Commonwealth",
  russia: "Russian Empire",
  "russian empire": "Russian Empire",
  austria: "Austrian Empire",
  "austrian empire": "Austrian Empire",
  "habsburg monarchy": "Austrian Empire",
  prussia: "Prussia",
  "kingdom of prussia": "Prussia",
  "byzantine empire": "Byzantine Empire",
  "eastern roman empire": "Byzantine Empire",
};
export function territoryOwner(feature: HistoricalFeature) {
  const raw = (feature.properties.subject || feature.properties.name)
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .trim();
  return aliases[raw.toLowerCase()] ?? raw;
}
function bbox(geometry: Geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (v: unknown) => {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === "number") {
      b[0] = Math.min(b[0], v[0]);
      b[1] = Math.min(b[1], v[1]);
      b[2] = Math.max(b[2], v[0]);
      b[3] = Math.max(b[3], v[1]);
    } else v.forEach(visit);
  };
  if ("coordinates" in geometry) visit(geometry.coordinates);
  return b;
}
function polygonParts(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  if (g.type === "GeometryCollection") return g.geometries.flatMap(polygonParts);
  return [];
}
/** Only overlaps with known, different owners count. Missing coverage never means conquest. */
export function compareTerritories(
  before: HistoricalCollection,
  after: HistoricalCollection,
): ComparisonResult {
  const records = (c: HistoricalCollection) =>
    c.features
      .filter(
        (f) =>
          [undefined, "state", "dependency", "colony"].includes(f.properties.layer) &&
          ["Polygon", "MultiPolygon"].includes(f.geometry.type) &&
          !/^(unspecified|unknown)?$/i.test(territoryOwner(f)),
      )
      .map((f) => ({
        owner: territoryOwner(f),
        geometry: f.geometry,
        bounds: bbox(f.geometry),
        signature: `${territoryOwner(f)}:${JSON.stringify(f.geometry)}`,
        shape: undefined as Shape | undefined,
      }));
  const a = records(before),
    b = records(after);
  type RecordShape = (typeof a)[number];
  const overlaps = (x: RecordShape, y: RecordShape) =>
    x.bounds[2] > y.bounds[0] &&
    y.bounds[2] > x.bounds[0] &&
    x.bounds[3] > y.bounds[1] &&
    y.bounds[3] > x.bounds[1];
  const shape = (r: RecordShape) => (r.shape ??= reader.read(r.geometry) as Shape);
  const operate = (x: Shape, y: Shape, difference = false): Shape => {
    const op = difference ? Overlay.difference : Overlay.intersection;
    try {
      return op(x, y) as Shape;
    } catch {
      return op(BufferOp.bufferOp(x, 0), BufferOp.bufferOp(y, 0)) as Shape;
    }
  };
  const result: ComparisonResult = {
    collection: { type: "FeatureCollection", features: [] },
    skipped: 0,
  };
  // Net losses and net gains exclude unchanged overlapping generalized outlines.
  const changed = (current: RecordShape[], other: RecordShape[]) => {
    const signatures = new Set(other.map((r) => r.signature));
    return current
      .filter((r) => !signatures.has(r.signature))
      .flatMap((r) => {
        try {
          let delta = shape(r);
          for (const same of other)
            if (same.owner === r.owner && overlaps(r, same)) {
              delta = operate(delta, shape(same), true);
              if (delta.isEmpty()) break;
            }
          return delta.isEmpty() || delta.getArea() < 1e-7 ? [] : [{ ...r, shape: delta }];
        } catch {
          result.skipped++;
          return [];
        }
      });
  };
  const losses = changed(a, b),
    gains = changed(b, a);
  for (const from of losses)
    for (const to of gains) {
      if (from.owner === to.owner || !overlaps(from, to)) continue;
      try {
        const intersection = operate(from.shape, to.shape);
        if (intersection.isEmpty() || intersection.getArea() < 1e-7) continue;
        const parts = polygonParts(writer.write(intersection) as Geometry);
        if (parts.length)
          result.collection.features.push({
            type: "Feature",
            id: `change-${result.collection.features.length}`,
            properties: { from: from.owner, to: to.owner },
            geometry: { type: "MultiPolygon", coordinates: parts },
          });
      } catch {
        result.skipped++;
      }
    }
  return result;
}
