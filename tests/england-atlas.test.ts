import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ENGLAND_YEARS,
  ENGLAND_PERIODS,
  ENGLAND_EVENTS,
  englandSnapshot,
  clampEnglandYear,
  validateEnglandData,
} from "../src/lib/atlas/england.ts";
import { ATLAS_SOURCES } from "../src/lib/atlas/content.ts";
import { historicalName } from "../src/lib/atlas/model.ts";

const raw = readFileSync(new URL("../public/atlas/england/frames.json", import.meta.url), "utf8");
const data = validateEnglandData(JSON.parse(raw));

test("England frames stay dated, translated and clipped to the documented years", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/england/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.sha256);
  assert.equal(englandSnapshot(42), undefined);
  assert.equal(englandSnapshot(1995), undefined);
  assert.equal(englandSnapshot(43), 43);
  assert.equal(englandSnapshot(410), 43);
  assert.equal(englandSnapshot(1284), 1284);
  assert.equal(englandSnapshot(1922), 1922);
  assert.equal(clampEnglandYear(1), 43);
  for (let year = 43; year <= 1994; year++) assert.ok(englandSnapshot(year)! <= year);
  assert.deepEqual(
    data.frames.map((f) => f.year),
    [...ENGLAND_YEARS],
  );
  for (const frame of data.frames)
    for (const feature of frame.collection.features) {
      assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
      assert.notEqual(historicalName(feature.properties.name, true), feature.properties.name);
      assert.equal(feature.properties.detailed, true);
    }
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (const item of [...ENGLAND_PERIODS, ...ENGLAND_EVENTS])
    for (const id of item.sources) assert.ok(ids.has(id), id);
  for (let year = 43; year <= 1994; year++)
    assert.equal(ENGLAND_PERIODS.filter((p) => p.from <= year && p.to >= year).length, 1);
  const modern = data.frames.at(-1)!;
  const names = modern.collection.features.map((f) => f.properties.name);
  assert.ok(names.includes("United Kingdom"));
  assert.ok(names.includes("Ireland"));
  assert.ok(!names.includes("Irish Free State"));
  const roman = data.frames[0].collection.features.map((f) => f.properties.name);
  assert.ok(roman.includes("Roman Britain"));
  assert.ok(roman.includes("Northern Britain"));
});
