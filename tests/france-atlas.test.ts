import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  FRANCE_YEARS,
  FRANCE_PERIODS,
  FRANCE_EVENTS,
  franceSnapshot,
  validateFranceData,
  addFranceLayer,
} from "../src/lib/atlas/france.ts";
import { normalizeTerritoryGeometry } from "../src/lib/atlas/edits.ts";
import { ATLAS_SOURCES } from "../src/lib/atlas/content.ts";
const raw = readFileSync(new URL("../public/atlas/france/frames.json", import.meta.url), "utf8");
const data = validateFranceData(JSON.parse(raw));
test("France uses only dated source snapshots and retains provenance", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/france/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.sha256);
  assert.equal(franceSnapshot(842), undefined);
  assert.equal(franceSnapshot(1995), undefined);
  for (let year = 843; year <= 1994; year++) assert.ok(franceSnapshot(year)! <= year);
  assert.deepEqual(
    data.frames.map((f) => f.year),
    FRANCE_YEARS,
  );
  for (const frame of data.frames)
    for (const feature of frame.collection.features) {
      assert.doesNotThrow(() => normalizeTerritoryGeometry(feature.geometry));
      assert.equal(feature.properties.sourceYear, frame.year);
      assert.ok(feature.properties.sourceUrl?.startsWith("https://"));
    }
});
test("France replacement preserves unrelated countries and the full chronology resolves sources", () => {
  const base = {
    type: "FeatureCollection" as const,
    features: data.frames[0].collection.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, name: i === 0 ? "France" : "Other", region: undefined },
    })),
  };
  const merged = addFranceLayer(base, data.frames.at(-1)!.collection)!;
  assert.ok(!merged.features.some((f) => f === base.features[0]));
  for (const f of base.features.slice(1)) assert.ok(merged.features.includes(f));
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (const item of [...FRANCE_PERIODS, ...FRANCE_EVENTS])
    for (const id of item.sources) assert.ok(ids.has(id), id);
  for (let year = 395; year <= 1994; year++)
    assert.equal(FRANCE_PERIODS.filter((p) => p.from <= year && p.to >= year).length, 1);
});
