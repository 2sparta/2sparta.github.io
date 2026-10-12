import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  activePlaces,
  ATLAS_YEARS,
  clampAtlasYear,
  featureNote,
  nearestSnapshot,
  placeEpoch,
  validateHistoricalCollection,
} from "../src/lib/atlas/model.ts";
import {
  ATLAS_EVENTS,
  ATLAS_PERIODS,
  ATLAS_PLACES,
  ATLAS_SOURCES,
} from "../src/lib/atlas/content.ts";

test("years are bounded and nearest snapshots are explicit, never interpolated", () => {
  assert.equal(clampAtlasYear(NaN), 1000);
  assert.equal(clampAtlasYear(499), 500);
  assert.equal(clampAtlasYear(2000), 1400);
  assert.equal(nearestSnapshot(988), 1000);
  assert.equal(nearestSnapshot(1240), 1279);
  assert.equal(nearestSnapshot(550), 500);
  for (let year = 500; year <= 1400; year++)
    assert.ok(ATLAS_YEARS.includes(nearestSnapshot(year) as (typeof ATLAS_YEARS)[number]));
});
test("all 900 years have one historical period and sourced dated references", () => {
  for (let year = 500; year <= 1400; year++)
    assert.equal(ATLAS_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  assert.equal(ids.size, ATLAS_SOURCES.length);
  for (const item of [...ATLAS_PERIODS, ...ATLAS_PLACES, ...ATLAS_EVENTS]) {
    assert.ok(item.sources.length);
    for (const source of item.sources) assert.ok(ids.has(source), source);
  }
  for (const source of ATLAS_SOURCES) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
  }
});
test("town markers use documented stages, not an invented uniform founding date", () => {
  assert.ok(!activePlaces(ATLAS_PLACES, 500).some((p) => p.id === "kyiv-city"));
  assert.ok(!activePlaces(ATLAS_PLACES, 1255).some((p) => p.id === "lviv-city"));
  assert.ok(activePlaces(ATLAS_PLACES, 1256).some((p) => p.id === "lviv-city"));
  assert.ok(activePlaces(ATLAS_PLACES, 1300).some((p) => p.id === "galicia-volhynia-polity"));
  assert.ok(!activePlaces(ATLAS_PLACES, 1200).some((p) => p.id === "tmutorokan-polity"));
  assert.match(featureNote("Rus' Khaganate", 800), /гіпотетична/);
  assert.match(featureNote("Poland-Lithuania", 1400), /окремі держави/);
});
test("stable marker epochs preserve date filters for every year, including first and last records", () => {
  for (let year = 500; year <= 1400; year++)
    assert.deepEqual(
      activePlaces(ATLAS_PLACES, placeEpoch(ATLAS_PLACES, year)).map((p) => p.id),
      activePlaces(ATLAS_PLACES, year).map((p) => p.id),
    );
  assert.equal(placeEpoch(ATLAS_PLACES, 1000), placeEpoch(ATLAS_PLACES, 1001));
  assert.notEqual(placeEpoch(ATLAS_PLACES, 1255), placeEpoch(ATLAS_PLACES, 1256));
});
test("every bundled historical map is valid and matches the provenance manifest", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/manifest.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    manifest.files.map((f: { year: number }) => f.year),
    ATLAS_YEARS,
  );
  for (const file of manifest.files) {
    const raw = readFileSync(new URL(`../public/atlas/${file.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(raw).digest("hex"), file.sha256);
    assert.equal(raw.length, file.bytes);
    const map = validateHistoricalCollection(JSON.parse(raw.toString()));
    assert.equal(map.features.length, file.features);
    assert.ok(map.features.length > 150);
    const ids = new Set(map.features.map((f) => f.id));
    assert.equal(ids.size, map.features.length);
    for (const feature of map.features) assert.ok([1, 2, 3].includes(feature.properties.precision));
  }
});
test("local land/rivers and the original historical data license are retained", () => {
  for (const name of ["land", "rivers"]) {
    const map = JSON.parse(
      readFileSync(new URL(`../public/atlas/${name}.geojson`, import.meta.url), "utf8"),
    );
    assert.equal(map.type, "FeatureCollection");
    assert.ok(map.features.length);
    if (name === "rivers")
      assert.ok(
        map.features.some((f: { properties: { name: string } }) =>
          ["Dnipro", "Dnepre"].includes(f.properties.name),
        ),
        "Dnipro must be present",
      );
  }
  assert.match(
    readFileSync(
      new URL("../public/atlas/historical-basemaps-LICENSE.txt", import.meta.url),
      "utf8",
    ),
    /GNU GENERAL PUBLIC LICENSE/,
  );
  assert.match(
    readFileSync(new URL("../public/atlas/NOTICE.md", import.meta.url), "utf8"),
    /No temporal interpolation/,
  );
});
