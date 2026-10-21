import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { historicalName } from "../src/lib/atlas/model.ts";
import { overlayGermany } from "../src/lib/atlas/germany.ts";
import {
  NAPOLEON_YEARS,
  napoleonPeriod,
  napoleonSnapshot,
  overlayNapoleon,
  validateNapoleonData,
} from "../src/lib/atlas/napoleon.ts";

test("Napoleonic frames replace the coarse German map from 1792 to 1815", () => {
  const data = validateNapoleonData(
    JSON.parse(readFileSync(new URL("../public/atlas/napoleon/frames.json", import.meta.url), "utf8")),
  );
  assert.deepEqual(
    data.frames.map((frame) => frame.year),
    [...NAPOLEON_YEARS],
  );
  assert.equal(napoleonSnapshot(1791), undefined);
  assert.equal(napoleonSnapshot(1792), 1792);
  assert.equal(napoleonSnapshot(1805), 1801);
  assert.equal(napoleonSnapshot(1812), 1812);
  assert.equal(napoleonSnapshot(1815), 1815);
  assert.equal(napoleonSnapshot(1816), undefined);
  const namesAt = (year: number) =>
    data.frames.find((frame) => frame.year === year)!.collection.features.map((feature) => feature.properties.name);
  assert.ok(namesAt(1792).includes("French Republic"));
  assert.ok(namesAt(1792).includes("Polish-Lithuanian Commonwealth"));
  assert.ok(namesAt(1792).includes("Republic of Venice"));
  assert.equal(namesAt(1797).includes("Republic of Venice"), false);
  assert.ok(namesAt(1797).includes("Cisalpine Republic"));
  assert.ok(namesAt(1806).includes("French Empire"));
  assert.equal(namesAt(1806).includes("Holy Roman Empire"), false);
  assert.ok(namesAt(1807).includes("Duchy of Warsaw"));
  assert.ok(namesAt(1807).includes("Kingdom of Westphalia"));
  assert.ok(namesAt(1810).includes("Illyrian Provinces"));
  const spain = data.frames
    .find((frame) => frame.year === 1812)!
    .collection.features.find((feature) => feature.properties.name === "Spain");
  assert.equal(spain?.properties.control, "relative");
  const march = data.frames
    .find((frame) => frame.year === 1812)!
    .collection.features.find((feature) => feature.properties.name === "Russian campaign");
  assert.equal(march?.properties.control, "relative");
  assert.equal(namesAt(1813).includes("Russian campaign"), false);
  assert.ok(namesAt(1814).includes("Kingdom of France"));
  assert.ok(namesAt(1815).includes("French Empire"));
  assert.ok(namesAt(1815).includes("Congress Poland"));
  assert.equal(historicalName("Duchy of Warsaw"), "Варшавське герцогство");
  assert.equal(historicalName("Russian campaign"), "Похід на Росію");
  for (let year = 1792; year <= 1815; year += 1) {
    const period = napoleonPeriod(year);
    assert.ok(year >= period.from && year <= period.to);
  }
  const germany = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        id: "coarse",
        properties: {
          name: "Confederation of the Rhine",
          subject: "Confederation of the Rhine",
          precision: 2,
          region: "germany" as const,
        },
        geometry: { type: "Polygon" as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ],
  };
  const layered = overlayNapoleon(overlayGermany(undefined, germany), data.frames.find((frame) => frame.year === 1812)!.collection);
  const drawn = layered?.features.map((feature) => feature.properties.name) ?? [];
  assert.equal(drawn.includes("Confederation of the Rhine"), false);
  assert.ok(drawn.includes("French Empire"));
  assert.ok(drawn.includes("Russian campaign"));
});
