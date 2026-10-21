import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  applyWorldPatch,
  compareWorldDates,
  formatWorldDate,
  shiftWorldDay,
  uniqueWorldPlaces,
  validateWorldManifest,
  validateWorldSearchDate,
  worldDate,
  worldFrameAt,
} from "../src/lib/atlas/world.ts";
import { validateHistoricalCollection, type HistoricalFeature } from "../src/lib/atlas/model.ts";
const dir = new URL("../public/atlas/world/", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, dir), "utf8"));
const manifest = validateWorldManifest(read("manifest.json"));
const collection = (y: number, m = 1, d = 1) => {
  const frame = worldFrameAt(manifest, worldDate(y, m, d))!;
  return applyWorldPatch(read(`base-${frame.baseYear}.geojson`), read(frame.path));
};
function inside(ring: number[][], [x, y]: number[]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      result = !result;
  }
  return result;
}
function covers(f: HistoricalFeature, point: number[]) {
  const g = f.geometry;
  const polygons =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polygons.some((p) => inside(p[0], point) && !p.slice(1).some((r) => inside(r, point)));
}
const at = (year: number, point: number[], month = 1, day = 1) =>
  collection(year, month, day).features.filter(
    (f) =>
      (f.properties.layer === "state" || !f.properties.layer) &&
      f.properties.control !== "relative" &&
      covers(f, point),
  );
test("One dated world has complete source coverage before 500 and after 1400; never borrows a future snapshot", () => {
  for (let y = -500; y <= 1994; y++) {
    if (!y) continue;
    const f = worldFrameAt(manifest, worldDate(y))!;
    assert.ok(f && f.baseYear <= y && f.year <= y, String(y));
  }
  assert.equal(worldFrameAt(manifest, worldDate(1806))!.baseYear, 1800);
  assert.equal(worldFrameAt(manifest, worldDate(1815))!.baseYear, 1815);
  assert.ok(at(1806, [2.35, 48.86]).some((f) => f.properties.name === "France"));
  assert.ok(at(1806, [116.4, 39.9]).some((f) => f.properties.name === "Qing Empire"));
  assert.ok(at(1994, [30.52, 50.45]).some((f) => f.properties.name === "Ukraine"));
  assert.ok(at(1930, [30.52, 50.45]).some((f) => f.properties.name === "USSR"));
  assert.ok(
    !collection(1806).features.some((f) =>
      ["napoleon", "germany", "isles", "antiquity"].includes(f.properties.region ?? ""),
    ),
  );
});
test("The three partitions change on the exact shared dates, including their previous day", () => {
  for (const [year, month, day, count] of [
    [1772, 8, 5, 3],
    [1793, 1, 23, 5],
    [1795, 10, 24, 8],
  ]) {
    const next = collection(year, month, day).features.filter((f) =>
      String(f.id).startsWith("pllt-partition-"),
    );
    const prevDate = shiftWorldDay(worldDate(year, month, day), -1);
    const prev = collection(prevDate.year, prevDate.month, prevDate.day).features.filter((f) =>
      String(f.id).startsWith("pllt-partition-"),
    );
    assert.equal(next.length, count);
    assert.ok(prev.length < count);
  }
  assert.ok(
    at(1795, [21.01, 52.23], 10, 23).some(
      (f) => f.properties.name === "Polish-Lithuanian Commonwealth",
    ),
  );
  assert.ok(at(1795, [21.01, 52.23], 10, 24).some((f) => f.properties.subject === "Prussia"));
  assert.ok(
    !collection(1795, 10, 24).features.some(
      (f) => f.properties.name === "Polish-Lithuanian Commonwealth",
    ),
  );
  assert.ok(
    collection(1500).features.some(
      (f) => f.properties.subject === "Poland" && covers(f, [21.01, 52.23]),
    ),
  );
  assert.ok(!at(1500, [38, 55]).some((f) => /Poland/.test(f.properties.name)));
});
test("Monthly Spanish fronts and Byzantine expiry are preserved in the common map", () => {
  assert.equal(
    worldFrameAt(manifest, worldDate(1936, 9, 29))!.sources.find((s) => s.name === "front")!.date,
    "1936-07-31",
  );
  assert.equal(
    worldFrameAt(manifest, worldDate(1936, 9, 30))!.sources.find((s) => s.name === "front")!.date,
    "1936-09-30",
  );
  assert.ok(collection(1939, 3, 31).features.some((f) => f.id === "es-civil-republic"));
  assert.ok(!collection(1939, 4, 1).features.some((f) => f.id === "es-civil-republic"));
  assert.ok(
    !collection(1453, 5, 29).features.some((f) => f.properties.name === "Byzantine Empire"),
  );
});
test("Dates retain month/day in old country links, handle leap years, BCE and the absence of year zero", () => {
  for (const view of ["world", "spain", "rus", "germany", "england"])
    assert.deepEqual(validateWorldSearchDate({ year: 1936, month: 9, day: 30, view }), {
      year: 1936,
      month: 9,
      day: 30,
    });
  assert.deepEqual(worldDate(1937, 2, 31), { year: 1937, month: 2, day: 28 });
  assert.deepEqual(shiftWorldDay(worldDate(-1, 12, 31), 1), { year: 1, month: 1, day: 1 });
  assert.deepEqual(shiftWorldDay(worldDate(1, 1, 1), -1), { year: -1, month: 12, day: 31 });
  assert.deepEqual(shiftWorldDay(worldDate(1936, 2, 28), 1), { year: 1936, month: 2, day: 29 });
  assert.equal(formatWorldDate(worldDate(-1, 12, 31)), "31.12.1 до н. е.");
  assert.deepEqual(shiftWorldDay(worldDate(-500), -1), worldDate(-500));
  assert.deepEqual(shiftWorldDay(worldDate(1994, 12, 31), 1), worldDate(1994, 12, 31));
});
test("All published world files have pinned checksums, valid coordinates and unique IDs", () => {
  assert.equal(manifest.baseFiles.length, 42);
  for (const file of [...manifest.baseFiles, ...manifest.frames]) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL(file.path, dir)))
        .digest("hex"),
      file.sha256,
      file.path,
    );
  }
  for (const f of manifest.frames) {
    assert.ok(compareWorldDates(f, worldDate(f.year, f.month, f.day)) === 0);
    const world = collection(f.year, f.month, f.day);
    validateHistoricalCollection(world);
    assert.equal(new Set(world.features.map((f) => f.id)).size, world.features.length);
  }
});
test("Merged settlement datasets give a city one marker and preserve capitals", () => {
  const places = uniqueWorldPlaces([
    { lat: 50.45, lng: 30.52, type: "city", capital: false },
    { lat: 50.4501, lng: 30.5201, type: "city", capital: true },
  ]);
  assert.equal(places.length, 1);
  assert.ok(places[0].capital);
});
