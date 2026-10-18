import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  validateSpainData,
  spainFrameAt,
  addSpainLayer,
  SPAIN_EVENTS,
  SPAIN_PERIODS,
  SPAIN_PLACES,
  spanishCampaignPlaces,
} from "../src/lib/atlas/spain.ts";
import { parseAtlasDate } from "../src/lib/atlas/date.ts";
import { normalizeTerritoryGeometry, newAtlasEdit } from "../src/lib/atlas/edits.ts";
import { ATLAS_SOURCES } from "../src/lib/atlas/content.ts";
import type { HistoricalFeature } from "../src/lib/atlas/model.ts";
const raw = readFileSync(new URL("../public/atlas/spain/frames.json", import.meta.url));
const data = validateSpainData(JSON.parse(raw.toString()));
const frame = (key: string) => spainFrameAt(data, parseAtlasDate(key)!)!;
function contains(f: HistoricalFeature, [x, y]: [number, number]) {
  const ring = (r: number[][]) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = r[i],
        [c, d] = r[j];
      if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a) inside = !inside;
    }
    return inside;
  };
  if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return false;
  const parts = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return parts.some((p) => ring(p[0]) && !p.slice(1).some(ring));
}
test("Pinned Spain maps retain licensing, topology, editability and independent registration checks", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/spain/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.sha256, createHash("sha256").update(raw).digest("hex"));
  const sources = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (const group of Object.values(data))
    for (const f of group)
      for (const p of f.collection.features) {
        assert.ok(sources.has(p.properties.sourceId!));
        assert.doesNotThrow(() => normalizeTerritoryGeometry(p.geometry));
      }
  for (const p of [...SPAIN_EVENTS, ...SPAIN_PERIODS, ...SPAIN_PLACES])
    for (const source of p.sources) assert.ok(sources.has(source));
  for (const s of manifest.sources) assert.ok(s.licenseUrl && s.author && s.sha256.length === 64);
  for (const reg of Object.values(manifest.registration) as any[])
    assert.ok(reg.holdoutKm.every((p: any) => p.km < 30));
  const relative = frame("1650-01-01").collection.features.find(
    (f) => f.properties.control === "relative",
  )!;
  assert.equal(newAtlasEdit(1650, relative).control, "relative");
});
test("Reconquista never borrows future Christian expansion and Granada changes on 2 January", () => {
  const find = (key: string, name: string) =>
    frame(key).collection.features.find((f) => f.properties.name === name)!;
  assert.ok(contains(find("0750-01-01", "Al-Andalus — survey"), [-4.0273, 39.8628]));
  assert.equal(contains(find("1050-01-01", "Christian Iberian lands"), [-4.0273, 39.8628]), false);
  assert.ok(contains(find("1090-01-01", "Christian Iberian lands"), [-4.0273, 39.8628]));
  assert.ok(frame("1492-01-01").collection.features.some((f) => f.properties.name === "Granada"));
  assert.ok(
    !frame("1492-01-02").collection.features.some(
      (f) => f.properties.name === "Granada" || f.properties.layer === "land",
    ),
  );
  assert.ok(
    !spanishCampaignPlaces(parseAtlasDate("1492-10-11")!).some((p) => p.id.includes("columbus")),
  );
  assert.ok(
    spanishCampaignPlaces(parseAtlasDate("1492-10-12")!).some((p) => p.id.includes("columbus")),
  );
});
test("Empire spans America and the Philippines, then loses colonial contours at documented transitions", () => {
  const cols = (key: string) =>
    frame(key).collection.features.filter((f) => f.properties.layer === "colony");
  for (const point of [
    [-99.13, 19.43],
    [-77.04, -12.04],
    [120.98, 14.6],
  ] as [number, number][])
    assert.ok(
      cols("1650-01-01").some((f) => contains(f, point)),
      String(point),
    );
  assert.ok(
    !cols("1825-01-01").some((f) => contains(f, [-99.13, 19.43]) || contains(f, [-77.04, -12.04])),
  );
  assert.ok(cols("1899-04-10").some((f) => contains(f, [-80, 22])));
  for (const key of ["1899-04-11", "1900-01-01", "1930-01-01"])
    for (const point of [
      [-80, 22],
      [-66.1, 18.46],
      [120.98, 14.6],
    ] as [number, number][])
      assert.ok(!cols(key).some((f) => contains(f, point)), key + point);
  assert.ok(cols("1968-10-11").some((f) => f.properties.name === "Spanish Guinea"));
  assert.ok(!cols("1968-10-12").some((f) => f.properties.name === "Spanish Guinea"));
  assert.ok(cols("1976-02-25").some((f) => f.properties.name === "Spanish Sahara"));
  assert.ok(!cols("1976-02-26").some((f) => f.properties.name === "Spanish Sahara"));
  assert.ok(
    frame("1640-11-30").collection.features.some(
      (f) => f.properties.name === "Portugal — Iberian Union",
    ),
  );
  assert.ok(
    !frame("1640-12-01").collection.features.some(
      (f) => f.properties.name === "Portugal — Iberian Union",
    ),
  );
});
test("Civil War fronts activate at source month end, preserve Republican Madrid and change Barcelona by February 1939", () => {
  assert.ok(!frame("1936-07-30").collection.features.some((f) => f.properties.layer === "front"));
  assert.equal(frame("1936-07-31").date, "1936-07-31");
  assert.equal(frame("1936-09-29").date, "1936-07-31");
  assert.equal(frame("1936-09-30").date, "1936-09-30");
  const faction = (key: string, point: [number, number]) =>
    frame(key).collection.features.find((f) => f.properties.layer === "front" && contains(f, point))
      ?.properties.name;
  assert.equal(faction("1936-07-31", [-3.7038, 40.4168]), "Republican-held Spain");
  assert.equal(faction("1936-07-31", [-5.9845, 37.3891]), "Nationalist-held Spain");
  assert.equal(faction("1936-09-30", [-2.935, 43.263]), "Republican-held Spain");
  assert.equal(faction("1937-10-31", [-2.935, 43.263]), "Nationalist-held Spain");
  assert.equal(faction("1939-02-27", [2.1734, 41.3851]), "Republican-held Spain");
  assert.equal(faction("1939-02-28", [2.1734, 41.3851]), "Nationalist-held Spain");
  assert.equal(faction("1939-03-31", [-3.7038, 40.4168]), "Republican-held Spain");
  assert.equal(faction("1939-04-01", [-3.7038, 40.4168]), "Spain — Franco regime");
  assert.equal(faction("1939-04-01", [2.1734, 41.3851]), "Spain — Franco regime");
});
test("Layer switches preserve data and unrelated atlas regions; date events resolve throughout the chronology", () => {
  const before = JSON.stringify(data);
  const hidden = spainFrameAt(data, parseAtlasDate("1936-09-30")!, {
    reconquista: false,
    colonies: false,
    fronts: false,
  })!;
  assert.ok(
    hidden.collection.features.every(
      (f) => !["land", "colony", "front"].includes(f.properties.layer!),
    ),
  );
  assert.equal(JSON.stringify(data), before);
  const source = frame("1650-01-01").collection.features[0];
  const other = { ...source, properties: { ...source.properties, name: "Other" } };
  const coarse = { ...source, properties: { ...source.properties, name: "Spain" } };
  const merged = addSpainLayer(
    { type: "FeatureCollection", features: [other, coarse] },
    frame("1650-01-01").collection,
  )!;
  assert.equal(merged.features.filter((f) => f === other).length, 1);
  assert.ok(!merged.features.includes(coarse));
  for (let year = 395; year <= 1994; year++)
    assert.equal(SPAIN_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
  const civil = SPAIN_EVENTS.find((e) => e.title === "Військовий заколот")!;
  assert.deepEqual([civil.year, civil.month, civil.day], [1936, 7, 17]);
});
