import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  activePlaces,
  ATLAS_YEARS,
  ATLAS_MIN_YEAR,
  ATLAS_MAX_YEAR,
  BYZANTINE_YEARS,
  byzantineSnapshot,
  overviewSnapshot,
  combineHistoricalLayers,
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
import { BYZANTINE_EVENTS, BYZANTINE_PERIODS, BYZANTINE_PLACES } from "../src/lib/atlas/byzantine.ts";

test("years are bounded and nearest snapshots are explicit, never interpolated", () => {
  assert.equal(clampAtlasYear(NaN), 1000);
  assert.equal(clampAtlasYear(300), 395);
  assert.equal(clampAtlasYear(499), 499);
  assert.equal(clampAtlasYear(2000), 1453);
  assert.equal(nearestSnapshot(988), 1000);
  assert.equal(nearestSnapshot(1240), 1279);
  assert.equal(nearestSnapshot(550), 500);
  for (let year = ATLAS_MIN_YEAR; year <= ATLAS_MAX_YEAR; year++)
    assert.ok(ATLAS_YEARS.includes(nearestSnapshot(year) as (typeof ATLAS_YEARS)[number]));
});
test("every configured year has one historical period and sourced dated references", () => {
  for (let year = 500; year <= 1400; year++)
    assert.equal(ATLAS_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  assert.equal(ids.size, ATLAS_SOURCES.length);
  for (const item of [...ATLAS_PERIODS, ...ATLAS_PLACES, ...ATLAS_EVENTS, ...BYZANTINE_PERIODS, ...BYZANTINE_PLACES, ...BYZANTINE_EVENTS]) {
    assert.ok(item.sources.length);
    for (const source of item.sources) assert.ok(ids.has(source), source);
  }
  for (const source of ATLAS_SOURCES) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
  }
});
test("Byzantine frames never borrow future territory and other countries remain unconfigured outside their range", () => {
  assert.equal(byzantineSnapshot(500), 476);
  assert.equal(byzantineSnapshot(988), 975);
  assert.equal(byzantineSnapshot(1204), 1203);
  assert.equal(byzantineSnapshot(1261), 1254);
  assert.equal(byzantineSnapshot(1453), 1453);
  assert.equal(overviewSnapshot(395), undefined);
  assert.equal(overviewSnapshot(499), undefined);
  assert.equal(overviewSnapshot(500), 500);
  assert.equal(overviewSnapshot(1400), 1400);
  assert.equal(overviewSnapshot(1401), undefined);
  assert.equal(overviewSnapshot(1453), undefined);
  for (let year=395; year<=1453; year++) {
    assert.ok(byzantineSnapshot(year) <= year);
    assert.equal(BYZANTINE_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
  }
});
test("detailed Byzantine replacement keeps unrelated overview geometries unchanged", () => {
  const world = validateHistoricalCollection(JSON.parse(readFileSync(new URL("../public/atlas/world-1000.geojson", import.meta.url), "utf8")));
  const all = JSON.parse(readFileSync(new URL("../public/atlas/byzantium/frames.json", import.meta.url), "utf8"));
  const detail = validateHistoricalCollection(all.frames.find((f: {year:number}) => f.year===1025).collection);
  const combined = combineHistoricalLayers(world, detail)!;
  assert.ok(!combined.features.some((f) => f.properties.name === "Byzantine Empire" && !f.properties.detailed));
  const others = world.features.filter((f) => f.properties.name !== "Byzantine Empire");
  assert.deepEqual(combined.features.filter((f) => !f.properties.detailed), others);
  assert.equal(combineHistoricalLayers(world, undefined), world);
  assert.deepEqual(combineHistoricalLayers(undefined, detail)?.features, detail.features);
});
test("all 39 source frames, raster assets and control-point records retain provenance", () => {
  const dir = new URL("../public/atlas/byzantium/", import.meta.url);
  const raw = readFileSync(new URL("frames.json", dir));
  const data = JSON.parse(raw.toString());
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.vector.sha256);
  assert.deepEqual(data.frames.map((f: {year:number}) => f.year), BYZANTINE_YEARS);
  assert.deepEqual(manifest.frames.map((f: {year:number}) => f.year), BYZANTINE_YEARS);
  for (const frame of data.frames) {
    const collection = validateHistoricalCollection(frame.collection);
    assert.ok(collection.features.every((f) => f.properties.detailed && f.properties.sourceYear===frame.year));
    const raster = readFileSync(new URL(`../public/${frame.raster.path}`, import.meta.url));
    assert.equal(raster.subarray(8,12).toString(), "WEBP");
    assert.equal(createHash("sha256").update(raster).digest("hex"), frame.raster.sha256);
    assert.equal(raster.length, frame.raster.bytes);
    assert.equal(new URL(frame.sourceUrl).hostname, "lucius-note.net");
    const [sw,ne] = frame.raster.bounds;
    assert.ok(sw[0]<ne[0] && sw[1]<ne[1]);
    const record = manifest.frames.find((f: {year:number}) => f.year===frame.year);
    const grid = manifest.references[record.gridReference];
    assert.ok(grid.points.length>=15);
    assert.ok(grid.heldout_rms_px<3);
    assert.match(record.sourceSha256,/^[a-f0-9]{64}$/);
    assert.ok(record.vertices>100);
  }
});
test("the geographic transfer preserves critical locations and separates successor states", () => {
  const data = JSON.parse(readFileSync(new URL("../public/atlas/byzantium/frames.json", import.meta.url), "utf8"));
  function inRing(point: number[], ring: number[][]) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [x,y]=ring[i], [xx,yy]=ring[j];
      if((y>point[1]) !== (yy>point[1]) && point[0] < (xx-x)*(point[1]-y)/(yy-y)+x) inside=!inside;
    }
    return inside;
  }
  function namesAt(year:number, point:number[]) {
    const frame=data.frames.find((f: {year:number})=>f.year===year);
    return frame.collection.features.filter((f:any)=> {
      const polys=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
      return polys.some((rings:number[][][])=>inRing(point,rings[0]) && !rings.slice(1).some((r)=>inRing(point,r)));
    }).map((f:any)=>f.properties.name);
  }
  // Inland controls near coastal cities: source coastlines/label positions are cartographic references.
  assert.ok(namesAt(395,[28.9,41.05]).includes("Eastern Roman Empire"));
  assert.ok(namesAt(565,[12.48,41.9]).includes("Byzantine Empire"));
  assert.ok(namesAt(1025,[29.73,40.42]).includes("Byzantine Empire"));
  assert.ok(namesAt(1205,[29.73,40.42]).includes("Empire of Nicaea"));
  assert.ok(namesAt(1205,[39.75,40.95]).includes("Empire of Trebizond"));
  assert.ok(!namesAt(1205,[28.97,41.02]).includes("Empire of Nicaea"));
  assert.ok(namesAt(1453,[39.75,40.95]).includes("Empire of Trebizond"));
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
