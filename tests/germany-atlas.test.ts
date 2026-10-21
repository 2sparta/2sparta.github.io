import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { historicalName } from "../src/lib/atlas/model.ts";
import {
  GERMANY_MIN_YEAR,
  GERMANY_YEARS,
  germanyPeriod,
  germanySnapshot,
  overlayGermany,
  validateGermanyData,
} from "../src/lib/atlas/germany.ts";

test("Germany runs from the Holy Roman Empire to the modern border", () => {
  const data = validateGermanyData(
    JSON.parse(readFileSync(new URL("../public/atlas/germany/frames.json", import.meta.url), "utf8")),
  );
  assert.deepEqual(
    data.frames.map((frame) => frame.year),
    [...GERMANY_YEARS],
  );
  assert.equal(germanySnapshot(961), undefined);
  assert.equal(germanySnapshot(962), 962);
  assert.equal(germanySnapshot(1648), 1648);
  assert.equal(germanySnapshot(1742), 1648);
  assert.equal(germanySnapshot(1763), 1763);
  assert.equal(germanySnapshot(1938), 1937);
  assert.equal(germanySnapshot(1990), 1990);
  assert.equal(germanySnapshot(1994), 1990);
  const namesAt = (year: number) =>
    data.frames.find((frame) => frame.year === year)!.collection.features.map((feature) => feature.properties.name);
  assert.ok(namesAt(962).includes("Kingdom of Italy"));
  assert.equal(
    data.frames
      .find((frame) => frame.year === 962)!
      .collection.features.find((feature) => feature.properties.name === "Bohemia")!.properties.control,
    "relative",
  );
  assert.ok(namesAt(1648).includes("Dutch Republic"));
  assert.ok(namesAt(1648).includes("Swiss Confederacy"));
  assert.equal(namesAt(1806).includes("Holy Roman Empire"), false);
  assert.ok(namesAt(1806).includes("Confederation of the Rhine"));
  assert.equal(
    data.frames
      .find((frame) => frame.year === 1806)!
      .collection.features.find((feature) => feature.properties.name === "Confederation of the Rhine")!.properties
      .control,
    "relative",
  );
  assert.ok(namesAt(1871).includes("Alsace-Lorraine"));
  assert.equal(namesAt(1871).includes("Austrian Empire"), false);
  assert.deepEqual(namesAt(1937), ["German Reich"]);
  assert.ok(namesAt(1949).includes("Federal Republic of Germany"));
  assert.ok(namesAt(1949).includes("German Democratic Republic"));
  assert.deepEqual(namesAt(1990), ["Germany"]);
  assert.equal(historicalName("Holy Roman Empire"), "Священна Римська імперія");
  assert.notEqual(historicalName("German Democratic Republic"), "German Democratic Republic");
  for (let year = GERMANY_MIN_YEAR; year <= 1994; year += 1) {
    const period = germanyPeriod(year);
    assert.ok(year >= period.from && year <= period.to);
    assert.equal(germanySnapshot(year)! <= year, true);
  }
  const overlaid = overlayGermany(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "hre",
          properties: { name: "Holy Roman Empire", subject: "Holy Roman Empire", precision: 1 },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        },
        {
          type: "Feature",
          id: "old-prussians",
          properties: { name: "Prussians", subject: "Prussians", precision: 1 },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        },
      ],
    },
    data.frames[0]!.collection,
  );
  const drawn = overlaid?.features.map((feature) => feature.properties.name) ?? [];
  assert.equal(drawn.includes("Holy Roman Empire"), false);
  assert.ok(drawn.includes("Prussians"));
  assert.ok(drawn.includes("Duchy of Saxony"));
});
