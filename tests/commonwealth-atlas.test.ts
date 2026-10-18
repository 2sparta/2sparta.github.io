import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  COMMONWEALTH_YEARS,
  COMMONWEALTH_PERIODS,
  COMMONWEALTH_EVENTS,
  COMMONWEALTH_PLACES,
  COSSACK_UPRISINGS,
  validateCommonwealthData,
  commonwealthSnapshot,
  commonwealthFrameAt,
  addCommonwealthLayer,
  cossackPlacesAt,
  occupationPlacesAt,
} from "../src/lib/atlas/commonwealth.ts";
import { ATLAS_SOURCES } from "../src/lib/atlas/content.ts";
import { newAtlasEdit, normalizeTerritoryGeometry } from "../src/lib/atlas/edits.ts";
import type { HistoricalFeature } from "../src/lib/atlas/model.ts";
const raw = readFileSync(new URL("../public/atlas/commonwealth/frames.json", import.meta.url));
const data = validateCommonwealthData(JSON.parse(raw.toString()));
const frame = (year: number) => commonwealthFrameAt(data, year)!;
function contains(f: HistoricalFeature, point: [number, number]) {
  const ringHas = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i],
        [xx, yy] = ring[j];
      if (y > point[1] !== yy > point[1] && point[0] < ((xx - x) * (point[1] - y)) / (yy - y) + x)
        inside = !inside;
    }
    return inside;
  };
  if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return false;
  const parts = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return parts.some((p) => ringHas(p[0]) && !p.slice(1).some(ringHas));
}
const stateAt = (year: number, p: [number, number]) =>
  frame(year).collection.features.filter((f) => f.properties.layer === "state" && contains(f, p));
test("Dated dataset is pinned, valid, editable, and has no uncredited sources", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/commonwealth/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.sha256, createHash("sha256").update(raw).digest("hex"));
  assert.deepEqual(
    data.frames.map((f) => f.year),
    COMMONWEALTH_YEARS,
  );
  const sources = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (const f of data.frames)
    for (const p of f.collection.features) {
      assert.ok(sources.has(p.properties.sourceId!));
      assert.doesNotThrow(() => normalizeTerritoryGeometry(p.geometry));
    }
  for (const item of [...COMMONWEALTH_PERIODS, ...COMMONWEALTH_EVENTS, ...COMMONWEALTH_PLACES])
    for (const source of item.sources) assert.ok(sources.has(source), source);
  for (const r of Object.values(manifest.registration) as any[])
    assert.ok(r.holdoutKm.every((p: any) => p.km < 45));
});
test("Lublin changes Ukrainian lands from Lithuania to the Crown without backdating the Commonwealth", () => {
  for (const p of [
    [30.523, 50.45],
    [25.3254, 50.7472],
    [28.941, 48.821],
  ] as [number, number][]) {
    assert.equal(stateAt(1530, p)[0]?.properties.subject, "Lithuania");
    assert.equal(stateAt(1569, p)[0]?.properties.name, "Crown of the Kingdom of Poland");
  }
  assert.equal(stateAt(1530, [24.0316, 49.8429])[0]?.properties.subject, "Poland");
  assert.equal(
    stateAt(1569, [25.2797, 54.6872])[0]?.properties.name,
    "Grand Duchy of Lithuania in the Commonwealth",
  );
  assert.equal(
    stateAt(1569, [23.6877, 52.0976])[0]?.properties.name,
    "Grand Duchy of Lithuania in the Commonwealth",
  );
  assert.equal(stateAt(1492, [31.3, 51.498])[0]?.properties.subject, "Lithuania");
  assert.equal(stateAt(1530, [31.3, 51.498]).length, 0);
  assert.equal(stateAt(1530, [24.1052, 56.9496]).length, 0);
});
test("Swedish occupation is a separate bounded hatch and never paints uncaptured cities or permanent Swedish Livonia", () => {
  const occ = frame(1655).collection.features.find((f) => f.properties.layer === "occupation")!;
  assert.equal(occ.properties.control, "relative");
  assert.equal(occ.properties.subject, "Sweden");
  for (const p of [
    [21.0122, 52.2297],
    [19.9445, 50.0647],
    [23.973, 55.288],
  ] as [number, number][])
    assert.ok(contains(occ, p), String(p));
  for (const p of [
    [18.6466, 54.352],
    [19.036, 50.812],
    [24.0316, 49.8429],
    [23.251, 50.723],
    [30.523, 50.45],
    [24.1052, 56.9496],
  ] as [number, number][])
    assert.equal(contains(occ, p), false, String(p));
  for (const year of [1654, 1658, 1659, 1660])
    assert.ok(!frame(year).collection.features.some((f) => f.properties.subject === "Sweden"));
  assert.ok(occupationPlacesAt(1658).some((p) => p.id.includes("torun")));
  assert.ok(!occupationPlacesAt(1659).some((p) => p.id.includes("torun")));
  assert.ok(occupationPlacesAt(1660).some((p) => p.id.includes("elblag")));
  assert.equal(occupationPlacesAt(1661).length, 0);
  assert.ok(frame(1657).collection.features.some((f) => f.properties.subject === "Sweden"));
  const edit = newAtlasEdit(1655, occ);
  assert.equal(edit.control, "relative");
  assert.equal(edit.relation, occ.properties.relation);
});
test("Autonomy, territorial losses and Ottoman Podolia follow their dated layers", () => {
  const autonomy = (year: number) =>
    frame(year).collection.features.find((f) => f.properties.layer === "cossack")!;
  assert.ok(contains(autonomy(1649), [28.941, 48.821]));
  assert.equal(contains(autonomy(1651), [28.941, 48.821]), false);
  assert.ok(contains(autonomy(1651), [30.523, 50.45]));
  for (const p of [
    [30.523, 50.45],
    [31.3, 51.498],
    [32.0453, 54.7826],
  ] as [number, number][])
    assert.equal(stateAt(1667, p).length, 0);
  assert.ok(stateAt(1667, [24.0316, 49.8429]).length);
  assert.equal(stateAt(1672, [26.583, 48.684]).length, 0);
  assert.ok(
    frame(1672).collection.features.some(
      (f) => f.properties.name === "Ottoman Podolia" && contains(f, [26.583, 48.684]),
    ),
  );
  assert.ok(
    !frame(1686).collection.features.some((f) => f.properties.name.includes("joint suzerainty")),
  );
});
test("Gaps and partitions never reuse prewar or pre-partition borders; layer controls preserve input data", () => {
  for (const y of [999, 1793, 1794, 1939, 1940, 1944, 1995])
    assert.equal(commonwealthSnapshot(y), undefined);
  assert.equal(frame(1795).collection.features.length, 0);
  assert.equal(frame(1910).collection.features.length, 0);
  for (let y = 1000; y <= 1994; y++) {
    const snapshot = commonwealthSnapshot(y);
    if (snapshot !== undefined) assert.ok(snapshot <= y);
  }
  const initial = JSON.stringify(data);
  const hidden = commonwealthFrameAt(data, 1655, {
    lands: false,
    occupations: false,
    cossacks: false,
  })!;
  assert.ok(
    hidden.collection.features.every(
      (f) => !["land", "occupation", "cossack"].includes(f.properties.layer!),
    ),
  );
  assert.equal(JSON.stringify(data), initial);
  const other = {
    ...frame(1569).collection.features[0],
    properties: { ...frame(1569).collection.features[0].properties, name: "Other" },
  };
  const coarse = { ...other, properties: { ...other.properties, name: "Poland-Lithuania" } };
  const merged = addCommonwealthLayer(
    { type: "FeatureCollection", features: [other, coarse] },
    frame(1569).collection,
  )!;
  assert.ok(merged.features.includes(other));
  assert.ok(!merged.features.includes(coarse));
});
test("All requested uprisings have time-scoped markers and periods cover the atlas chronology", () => {
  for (const id of [
    "kosynsky",
    "nalyvaiko",
    "zhmailo",
    "fedorovych",
    "sulyma",
    "pavliuk",
    "ostrianin",
    "khmelnytsky",
    "palii",
  ])
    assert.ok(COSSACK_UPRISINGS.some((u) => u.id === id));
  assert.ok(cossackPlacesAt(1592).some((p) => p.id.includes("kosynsky")));
  assert.ok(!cossackPlacesAt(1594).some((p) => p.id.includes("kosynsky")));
  assert.ok(!cossackPlacesAt(1594).some((p) => p.name.includes("Лубни")));
  assert.ok(cossackPlacesAt(1596).some((p) => p.name.includes("Лубни")));
  assert.ok(!cossackPlacesAt(1592).some((p) => p.name.includes("Черкаси")));
  assert.ok(cossackPlacesAt(1635).some((p) => p.id.includes("sulyma")));
  assert.ok(!cossackPlacesAt(1636).some((p) => p.id.includes("sulyma")));
  for (let y = 395; y <= 1994; y++)
    assert.equal(COMMONWEALTH_PERIODS.filter((p) => y >= p.from && y <= p.to).length, 1, String(y));
});
