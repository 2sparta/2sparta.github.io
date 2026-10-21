import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { historicalName } from "../src/lib/atlas/model.ts";
import {
  ISLES_MAX_YEAR,
  ISLES_MIN_YEAR,
  ISLES_VIEWS,
  ISLES_YEARS,
  islesPeriod,
  islesSnapshot,
  overlayBritishIsles,
  overseasSnapshot,
  OVERSEAS_YEARS,
  validateIslesData,
  validateOverseasData,
} from "../src/lib/atlas/isles.ts";

test("British Isles frames stay on the land mask and cover every snapshot", () => {
  const data = validateIslesData(
    JSON.parse(readFileSync(new URL("../public/atlas/isles/frames.json", import.meta.url), "utf8")),
  );
  for (const view of ISLES_VIEWS) {
    assert.deepEqual(
      data[view].map((frame) => frame.year),
      [...ISLES_YEARS],
    );
    for (const frame of data[view]) assert.ok(frame.collection.features.length > 0);
  }
  const names = new Set(
    data.isles.flatMap((frame) => frame.collection.features.map((f) => f.properties.name)),
  );
  for (const name of ["Ulaid", "Connacht", "Gwynedd", "Pictland", "Danelaw", "Kingdom of Scotland", "Irish Free State", "Northern Ireland"])
    assert.equal(typeof historicalName(name), "string");
  assert.notEqual(historicalName("Kingdom of Ireland"), "Kingdom of Ireland");
  assert.ok(names.has("Lordship of Ireland"));
  assert.ok(names.has("Irish Free State"));
  for (let year = ISLES_MIN_YEAR; year <= ISLES_MAX_YEAR; year += 1) {
    assert.ok(islesSnapshot(year));
    for (const view of ISLES_VIEWS) {
      const period = islesPeriod(view, year);
      assert.ok(year >= period.from && year <= period.to);
    }
  }
});

test("English possessions and the empire share the main map", () => {
  const overseas = validateOverseasData(
    JSON.parse(readFileSync(new URL("../public/atlas/isles/overseas.json", import.meta.url), "utf8")),
  );
  assert.deepEqual(
    overseas.frames.map((frame) => frame.year),
    [...OVERSEAS_YEARS],
  );
  assert.equal(overseasSnapshot(1065), undefined);
  assert.equal(overseasSnapshot(1500), 1453);
  assert.equal(overseasSnapshot(1558), undefined);
  assert.equal(overseasSnapshot(1654), undefined);
  assert.equal(overseasSnapshot(1655), 1655);
  const namesAt = (year: number) =>
    new Set(
      overseas.frames
        .find((frame) => frame.year === year)!
        .collection.features.map((feature) => feature.properties.name),
    );
  assert.ok(namesAt(1154).has("Duchy of Aquitaine"));
  assert.equal(namesAt(1204).has("Duchy of Normandy"), false);
  assert.deepEqual([...namesAt(1453)], ["Pale of Calais"]);
  assert.equal(namesAt(1783).has("Thirteen Colonies"), false);
  assert.ok(namesAt(1858).has("British India"));
  assert.equal(namesAt(1947).has("British India"), false);
  assert.equal(namesAt(1947).has("Australia"), false);
  const box = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  const overlaid = overlayBritishIsles(
    {
      type: "FeatureCollection",
      features: [
        { type: "Feature", id: "angevin", properties: { name: "Angevin Empire", subject: "Angevin Empire", precision: 1 }, geometry: box },
        { type: "Feature", id: "brittany", properties: { name: "Britany", subject: "Britany", precision: 1 }, geometry: box },
        { type: "Feature", id: "toehold", properties: { name: "English territory", subject: "English territory", precision: 1 }, geometry: box },
      ],
    },
    overseas.frames[0]!.collection,
    undefined,
  );
  const drawn = overlaid?.features.map((feature) => feature.properties.name) ?? [];
  assert.ok(drawn.includes("Britany"));
  assert.equal(drawn.includes("Angevin Empire"), false);
  assert.equal(drawn.includes("English territory"), false);
  assert.ok(drawn.includes("Duchy of Normandy"));
});
