import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { historicalName } from "../src/lib/atlas/model.ts";
import {
  ANTIQUITY_MIN_YEAR,
  ANTIQUITY_YEARS,
  antiquityPeriod,
  antiquitySnapshot,
  formatAtlasYear,
  overlayAntiquity,
  validateAntiquityData,
} from "../src/lib/atlas/antiquity.ts";

test("Rome, Carthage and their neighbours stay on dated frames", () => {
  const data = validateAntiquityData(
    JSON.parse(readFileSync(new URL("../public/atlas/antiquity/frames.json", import.meta.url), "utf8")),
  );
  assert.deepEqual(
    data.frames.map((frame) => frame.year),
    [...ANTIQUITY_YEARS],
  );
  assert.equal(antiquitySnapshot(-501), undefined);
  assert.equal(antiquitySnapshot(-500), -500);
  assert.equal(antiquitySnapshot(-202), -270);
  assert.equal(antiquitySnapshot(116), -27);
  assert.equal(antiquitySnapshot(117), 117);
  assert.equal(antiquitySnapshot(394), 285);
  assert.equal(antiquitySnapshot(395), undefined);
  const namesAt = (year: number) =>
    new Set(
      data.frames.find((frame) => frame.year === year)!.collection.features.map((feature) => feature.properties.name),
    );
  assert.ok(namesAt(-500).has("Carthage"));
  assert.ok(namesAt(-500).has("Achaemenid Empire"));
  assert.ok(namesAt(-500).has("Athens"));
  assert.equal(namesAt(-146).has("Carthage"), false);
  assert.ok(namesAt(-146).has("Roman Republic"));
  assert.ok(namesAt(-146).has("Ptolemaic Egypt"));
  assert.equal(namesAt(-27).has("Roman Empire"), true);
  assert.equal(
    data.frames
      .find((frame) => frame.year === -27)!
      .collection.features.find((feature) => feature.properties.name === "Mauretania")!.properties.control,
    "relative",
  );
  assert.ok(namesAt(117).has("Roman Empire"));
  assert.ok(namesAt(285).has("Sasanian Empire"));
  assert.notEqual(historicalName("Roman Republic"), "Roman Republic");
  assert.notEqual(historicalName("Carthage"), "Carthage");
  assert.equal(formatAtlasYear(-146, true), "146 до н. е.");
  for (let year = ANTIQUITY_MIN_YEAR; year < 395; year += 1) {
    const period = antiquityPeriod(year);
    assert.ok(year >= period.from && year <= period.to);
    assert.equal(antiquitySnapshot(year)! <= year, true);
  }
  const overlaid = overlayAntiquity(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "brittany",
          properties: { name: "Britany", subject: "Britany", precision: 1 },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        },
      ],
    },
    data.frames[0]!.collection,
  );
  const drawn = overlaid?.features.map((feature) => feature.properties.name) ?? [];
  assert.ok(drawn.includes("Britany"));
  assert.ok(drawn.includes("Carthage"));
});
