import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  activePlaces,
  ATLAS_YEARS,
  FRANKISH_YEARS,
  frankishSnapshot,
  isUnknownRegion,
  isCoarseFrankish,
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
import {
  BYZANTINE_EVENTS,
  BYZANTINE_PERIODS,
  BYZANTINE_PLACES,
} from "../src/lib/atlas/byzantine.ts";

import { FRANKISH_EVENTS, FRANKISH_PERIODS, FRANKISH_PLACES } from "../src/lib/atlas/frankish.ts";
import { RUS_YEARS, rusSnapshot, isCoarseRus } from "../src/lib/atlas/model.ts";
import { RUS_EVENTS, RUS_PERIODS, RUS_PLACES, validateRusData } from "../src/lib/atlas/rus.ts";

test("Rus years use the last source and never borrow future expansion", () => {
  assert.equal(rusSnapshot(881), undefined);
  assert.equal(rusSnapshot(882), 882);
  assert.equal(rusSnapshot(988), 882);
  assert.equal(rusSnapshot(1054), 1054);
  assert.equal(rusSnapshot(1112), 1054);
  assert.equal(rusSnapshot(1132), 1132);
  assert.equal(rusSnapshot(1199), 1194);
  assert.equal(rusSnapshot(1240), 1240);
  assert.equal(rusSnapshot(1241), undefined);
  for (let y = 882; y <= 1240; y++) assert.ok(rusSnapshot(y)! <= y);
});

const rusDir = new URL("../public/atlas/rus/", import.meta.url);
const rusRaw = readFileSync(new URL("frames.json", rusDir));
const rusData = validateRusData(JSON.parse(rusRaw.toString()));

test("Rus originals, data hashes, dates and provenance agree", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", rusDir), "utf8"));
  assert.equal(manifest.data.sha256, createHash("sha256").update(rusRaw).digest("hex"));
  assert.equal(manifest.data.bytes, rusRaw.length);
  assert.deepEqual(
    rusData.frames.map((f) => f.year),
    RUS_YEARS,
  );
  for (const source of manifest.originals) {
    const bytes = readFileSync(new URL(`originals/${source.file}`, rusDir));
    assert.equal(source.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(source.bytes, bytes.length);
    assert.ok(source.author && source.license && source.descriptionUrl.startsWith("https://"));
  }
  for (const frame of rusData.frames) {
    const record = manifest.frames.find((f: { year: number }) => f.year === frame.year);
    assert.equal(frame.collection.features.length, record.features);
    assert.equal(frame.sourceYear, record.sourceYear);
    assert.ok(frame.sourceYear <= frame.year);
    assert.ok(ATLAS_SOURCES.some((s) => s.id === frame.sourceId));
    assert.ok(readFileSync(new URL(`../public/${frame.originalPath}`, import.meta.url)).length);
  }
  const end = rusData.frames.at(-1)!;
  assert.equal(end.sourceYear, 1237);
  assert.match(end.note, /не нову карту 1240/);
  assert.equal(end.collection.features.length, 11);
  for (const group of Object.values(manifest.registration) as {
    heldOutPoints: number;
    holdoutMaxSourceUnits: number;
  }[]) {
    assert.ok(group.heldOutPoints >= 2);
    assert.ok(Number.isFinite(group.holdoutMaxSourceUnits));
  }
});

test("Rus replacement leaves every unrelated world feature byte-for-byte equivalent", () => {
  for (const year of ATLAS_YEARS) {
    const world = validateHistoricalCollection(
      JSON.parse(
        readFileSync(new URL(`../public/atlas/world-${year}.geojson`, import.meta.url), "utf8"),
      ),
    );
    const frame = rusData.frames.find((f) => f.year === rusSnapshot(year));
    const combined = combineHistoricalLayers(world, undefined, undefined, frame?.collection)!;
    for (const feature of world.features.filter((f) => !isCoarseRus(f.properties.name)))
      assert.deepEqual(
        combined.features.find((f) => f.id === feature.id),
        feature,
      );
    if (frame) {
      assert.ok(
        !combined.features.some((f) => isCoarseRus(f.properties.name) && !f.properties.detailed),
      );
      assert.equal(
        combined.features.filter((f) => f.properties.region === "rus").length,
        frame.collection.features.length,
      );
    } else assert.equal(combined, world);
  }
  assert.ok(!isCoarseRus("Golden Horde"));
  assert.ok(!isCoarseRus("Khazar Khaganate"));
  assert.ok(!isCoarseRus("Poland-Lithuania"));
});

test("Rus period maps do not pretend to describe simultaneous later states", () => {
  const middle = rusData.frames.find((f) => f.year === 1132)!;
  const names = middle.collection.features.map((f) => f.properties.name);
  assert.ok(names.includes("Principality of Kyiv"));
  assert.ok(names.includes("Murom and Ryazan lands"));
  assert.ok(names.includes("Galician appanages"));
  assert.ok(!names.includes("Principality of Halych"));
  assert.ok(!names.some((name) => /Tmut|Belaya/.test(name)));
  const late = rusData.frames.find((f) => f.year === 1237)!;
  const lateNames = late.collection.features.map((f) => f.properties.name);
  for (const name of [
    "Principality of Murom",
    "Principality of Ryazan",
    "Novgorod Republic",
    "Principality of Galicia-Volhynia",
  ])
    assert.ok(lateNames.includes(name), name);
  assert.equal(new Set(lateNames).size, lateNames.length);
});

test("Rus geographic transfer assigns Kyiv, Murom and Old Ryazan to the correct territories", () => {
  const inRing = (p: number[], ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i],
        [xx, yy] = ring[j];
      if (y > p[1] !== yy > p[1] && p[0] < ((xx - x) * (p[1] - y)) / (yy - y) + x) inside = !inside;
    }
    return inside;
  };
  const namesAt = (year: number, point: number[]) =>
    rusData.frames
      .find((f) => f.year === year)!
      .collection.features.filter((f) => {
        if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return false;
        const polys =
          f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return polys.some(
          (rings) => inRing(point, rings[0]) && !rings.slice(1).some((r) => inRing(point, r)),
        );
      })
      .map((f) => f.properties.name);
  assert.deepEqual(namesAt(1132, [30.523, 50.45]), ["Principality of Kyiv"]);
  assert.deepEqual(namesAt(1132, [42.041, 55.579]), ["Murom and Ryazan lands"]);
  assert.deepEqual(namesAt(1237, [42.041, 55.579]), ["Principality of Murom"]);
  assert.deepEqual(namesAt(1237, [40.579, 54.403]), ["Principality of Ryazan"]);
  assert.deepEqual(namesAt(1237, [30.523, 50.45]), ["Principality of Kyiv"]);
  assert.deepEqual(namesAt(1237, [31.3, 51.498]), ["Principality of Chernihiv"]);
  assert.deepEqual(namesAt(1237, [24.326, 50.848]), ["Principality of Galicia-Volhynia"]);
});

test("Rus data rejects duplicate dates, future sources and incorrect regions", () => {
  for (const change of [
    (d: typeof rusData) => {
      d.frames[1].year = 882;
    },
    (d: typeof rusData) => {
      d.frames[0].sourceYear = 1054;
    },
    (d: typeof rusData) => {
      d.frames[0].collection.features[0].properties.region = "franks";
    },
  ]) {
    const copy = structuredClone(rusData);
    change(copy);
    assert.throws(() => validateRusData(copy), /INVALID_RUS_DATA/);
  }
});

test("Rus history, markers and complete periods resolve their source references", () => {
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (let y = ATLAS_MIN_YEAR; y <= ATLAS_MAX_YEAR; y++)
    assert.equal(RUS_PERIODS.filter((p) => y >= p.from && y <= p.to).length, 1);
  for (const item of [...RUS_PERIODS, ...RUS_EVENTS, ...RUS_PLACES]) {
    assert.ok(item.sources.length);
    for (const source of item.sources) assert.ok(ids.has(source), source);
  }
  assert.ok(RUS_EVENTS.some((e) => e.year === 860));
  assert.ok(RUS_EVENTS.some((e) => e.year === 1240));
  assert.ok(RUS_PLACES.every((p) => p.to === 1240));
});

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
  for (const item of [
    ...ATLAS_PERIODS,
    ...ATLAS_PLACES,
    ...ATLAS_EVENTS,
    ...BYZANTINE_PERIODS,
    ...BYZANTINE_PLACES,
    ...BYZANTINE_EVENTS,
  ]) {
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
  for (let year = 395; year <= 1453; year++) {
    assert.ok(byzantineSnapshot(year) <= year);
    assert.equal(BYZANTINE_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
  }
});
test("detailed Byzantine replacement keeps unrelated overview geometries unchanged", () => {
  const world = validateHistoricalCollection(
    JSON.parse(
      readFileSync(new URL("../public/atlas/world-1000.geojson", import.meta.url), "utf8"),
    ),
  );
  const all = JSON.parse(
    readFileSync(new URL("../public/atlas/byzantium/frames.json", import.meta.url), "utf8"),
  );
  const detail = validateHistoricalCollection(
    all.frames.find((f: { year: number }) => f.year === 1025).collection,
  );
  const combined = combineHistoricalLayers(world, detail)!;
  assert.ok(
    !combined.features.some(
      (f) => f.properties.name === "Byzantine Empire" && !f.properties.detailed,
    ),
  );
  const others = world.features.filter((f) => f.properties.name !== "Byzantine Empire");
  assert.deepEqual(
    combined.features.filter((f) => !f.properties.detailed),
    others,
  );
  assert.equal(combineHistoricalLayers(world, undefined), world);
  assert.deepEqual(combineHistoricalLayers(undefined, detail)?.features, detail.features);
});
test("all 39 source frames, raster assets and control-point records retain provenance", () => {
  const dir = new URL("../public/atlas/byzantium/", import.meta.url);
  const raw = readFileSync(new URL("frames.json", dir));
  const data = JSON.parse(raw.toString());
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.vector.sha256);
  assert.deepEqual(
    data.frames.map((f: { year: number }) => f.year),
    BYZANTINE_YEARS,
  );
  assert.deepEqual(
    manifest.frames.map((f: { year: number }) => f.year),
    BYZANTINE_YEARS,
  );
  for (const frame of data.frames) {
    const collection = validateHistoricalCollection(frame.collection);
    assert.ok(
      collection.features.every(
        (f) => f.properties.detailed && f.properties.sourceYear === frame.year,
      ),
    );
    const raster = readFileSync(new URL(`../public/${frame.raster.path}`, import.meta.url));
    assert.equal(raster.subarray(8, 12).toString(), "WEBP");
    assert.equal(createHash("sha256").update(raster).digest("hex"), frame.raster.sha256);
    assert.equal(raster.length, frame.raster.bytes);
    assert.equal(new URL(frame.sourceUrl).hostname, "lucius-note.net");
    const [sw, ne] = frame.raster.bounds;
    assert.ok(sw[0] < ne[0] && sw[1] < ne[1]);
    const record = manifest.frames.find((f: { year: number }) => f.year === frame.year);
    const grid = manifest.references[record.gridReference];
    assert.ok(grid.points.length >= 15);
    assert.ok(grid.heldout_rms_px < 3);
    assert.match(record.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(record.vertices > 100);
  }
});
test("the geographic transfer preserves critical locations and separates successor states", () => {
  const data = JSON.parse(
    readFileSync(new URL("../public/atlas/byzantium/frames.json", import.meta.url), "utf8"),
  );
  function inRing(point: number[], ring: number[][]) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i],
        [xx, yy] = ring[j];
      if (y > point[1] !== yy > point[1] && point[0] < ((xx - x) * (point[1] - y)) / (yy - y) + x)
        inside = !inside;
    }
    return inside;
  }
  function namesAt(year: number, point: number[]) {
    const frame = data.frames.find((f: { year: number }) => f.year === year);
    return frame.collection.features
      .filter((f: any) => {
        const polys =
          f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return polys.some(
          (rings: number[][][]) =>
            inRing(point, rings[0]) && !rings.slice(1).some((r) => inRing(point, r)),
        );
      })
      .map((f: any) => f.properties.name);
  }
  // Inland controls near coastal cities: source coastlines/label positions are cartographic references.
  assert.ok(namesAt(395, [28.9, 41.05]).includes("Eastern Roman Empire"));
  assert.ok(namesAt(565, [12.48, 41.9]).includes("Byzantine Empire"));
  assert.ok(namesAt(1025, [29.73, 40.42]).includes("Byzantine Empire"));
  assert.ok(namesAt(1205, [29.73, 40.42]).includes("Empire of Nicaea"));
  assert.ok(namesAt(1205, [39.75, 40.95]).includes("Empire of Trebizond"));
  assert.ok(!namesAt(1205, [28.97, 41.02]).includes("Empire of Nicaea"));
  assert.ok(namesAt(1453, [39.75, 40.95]).includes("Empire of Trebizond"));
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
    assert.ok(map.features.length > 80);
    assert.ok(map.features.every((f) => !isUnknownRegion(f.properties.name)));
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

test("Frankish frames stay within their period and never use a future conquest", () => {
  assert.equal(frankishSnapshot(395), undefined);
  assert.equal(frankishSnapshot(480), undefined);
  assert.equal(frankishSnapshot(481), 481);
  assert.equal(frankishSnapshot(800), 768);
  assert.equal(frankishSnapshot(900), 888);
  assert.equal(frankishSnapshot(901), undefined);
  for (let year = 395; year <= 1453; year++) {
    assert.equal(FRANKISH_PERIODS.filter((p) => year >= p.from && year <= p.to).length, 1);
    if (year >= 481 && year <= 900) assert.ok(frankishSnapshot(year)! <= year);
  }
  const ids = new Set(ATLAS_SOURCES.map((s) => s.id));
  for (const item of [...FRANKISH_PERIODS, ...FRANKISH_EVENTS, ...FRANKISH_PLACES])
    for (const id of item.sources) assert.ok(ids.has(id), id);
});
test("unknown regions disappear and Frankish replacement preserves unrelated geometry", () => {
  const world = validateHistoricalCollection(
    JSON.parse(readFileSync(new URL("../public/atlas/world-800.geojson", import.meta.url), "utf8")),
  );
  assert.ok(world.features.every((f) => !isUnknownRegion(f.properties.name)));
  const unknown = {
    ...world.features[0],
    properties: { ...world.features[0].properties, name: "Unspecified" },
  };
  const dirty = { ...world, features: [...world.features, unknown] };
  assert.deepEqual(combineHistoricalLayers(dirty, undefined)?.features, world.features);
  const frank = validateHistoricalCollection(
    JSON.parse(
      readFileSync(new URL("../public/atlas/franks/frames.json", import.meta.url), "utf8"),
    ).frames.find((f: { year: number }) => f.year === 814).collection,
  );
  const combined = combineHistoricalLayers(dirty, undefined, frank)!;
  assert.ok(
    !combined.features.some((f) => isCoarseFrankish(f.properties.name) && !f.properties.detailed),
  );
  for (const f of world.features.filter((f) => !isCoarseFrankish(f.properties.name)))
    assert.strictEqual(
      combined.features.find((x) => x.id === f.id),
      f,
    );
});
test("all Frankish SVGs and dated geometries retain licenses and verifiable provenance", () => {
  const raw = readFileSync(new URL("../public/atlas/franks/frames.json", import.meta.url));
  const data = JSON.parse(raw.toString());
  const manifest = JSON.parse(
    readFileSync(new URL("../public/atlas/franks/manifest.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    data.frames.map((f: { year: number }) => f.year),
    FRANKISH_YEARS,
  );
  assert.equal(manifest.data.bytes, raw.length);
  assert.equal(manifest.data.sha256, createHash("sha256").update(raw).digest("hex"));
  assert.equal(manifest.originals.length, 6);
  for (const source of manifest.originals) {
    const svg = readFileSync(
      new URL(`../public/atlas/franks/originals/${source.file}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(svg).digest("hex"), source.sha256);
    assert.ok(["CC BY-SA 3.0", "Public domain"].includes(source.license));
  }
  for (const frame of data.frames) {
    const map = validateHistoricalCollection(frame.collection);
    assert.ok(
      map.features.every(
        (f) =>
          f.properties.detailed &&
          f.properties.region === "franks" &&
          f.properties.sourceYear === frame.year &&
          f.properties.sourceId === frame.sourceId,
      ),
    );
    assert.ok(manifest.frames.find((f: { year: number }) => f.year === frame.year).vertices > 100);
  }
});
test("Frankish city controls, partitions and disputed Aquitaine remain correctly separated", () => {
  const data = JSON.parse(
    readFileSync(new URL("../public/atlas/franks/frames.json", import.meta.url), "utf8"),
  );
  function ringContains(p: number[], r: number[][]) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [x, y] = r[i],
        [xx, yy] = r[j];
      if (y > p[1] !== yy > p[1] && p[0] < ((xx - x) * (p[1] - y)) / (yy - y) + x) inside = !inside;
    }
    return inside;
  }
  const namesAt = (year: number, p: number[]) =>
    data.frames
      .find((f: { year: number }) => f.year === year)
      .collection.features.filter((f: any) => {
        const polygons =
          f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return polygons.some(
          (r: number[][][]) =>
            ringContains(p, r[0]) && !r.slice(1).some((hole) => ringContains(p, hole)),
        );
      })
      .map((f: any) => f.properties.name);
  assert.deepEqual(namesAt(481, [2.352, 48.857]), []); // Paris is not yet Clovis’s conquest.
  assert.deepEqual(namesAt(511, [2.352, 48.857]), ["Frankish realms"]);
  for (const [city, point] of [
    ["Paris", [2.352, 48.857]],
    ["Orleans", [1.909, 47.902]],
    ["Reims", [4.032, 49.258]],
    ["Soissons", [3.323, 49.381]],
  ] as const)
    assert.deepEqual(namesAt(561, [...point]), [`Kingdom of ${city}`]);
  assert.deepEqual(namesAt(843, [-0.4, 45.0]), ["Disputed Aquitaine"]);
  assert.deepEqual(namesAt(881, [2.352, 48.857]), ["West Francia — Louis III"]);
  assert.deepEqual(namesAt(881, [-0.579, 44.838]), ["West Francia — Carloman II"]);
  assert.deepEqual(namesAt(888, [6.143, 46.204]), ["Upper Burgundy"]);
  for (const year of FRANKISH_YEARS) assert.deepEqual(namesAt(year, [4, 42]), []); // Open Mediterranean.
});
