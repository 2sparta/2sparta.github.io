import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAtlasEdits,
  atlasWritePatch,
  newAtlasEdit,
  normalizeTerritoryGeometry,
  parseAtlasEdits,
  serializeAtlasEdits,
  validateAtlasEdits,
  editRing,
  openGeometry,
  addGeometryHole,
  addGeometryPart,
  removeGeometryRing,
} from "../src/lib/atlas/edits.ts";
import type { HistoricalFeature } from "../src/lib/atlas/model.ts";
const base: HistoricalFeature = {
  type: "Feature",
  id: "kyiv-1237",
  properties: {
    name: "Principality of Kyiv",
    subject: "Principality of Kyiv",
    region: "rus",
    sourceId: "rus-1237",
    sourceYear: 1237,
    precision: 2,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [28, 49],
        [32, 49],
        [32, 52],
        [28, 52],
        [28, 49],
      ],
    ],
  },
};
function edit() {
  return {
    ...newAtlasEdit(1240, base),
    name: "Київське князівство",
    subject: "Русь",
    from: 1240,
    to: 1260,
  };
}
test("Edits close rings, reject self-crossings, misplaced holes and invalid coordinates", () => {
  assert.equal(
    normalizeTerritoryGeometry({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      ],
    }).coordinates[0].length,
    4,
  );
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [1, 0],
            [0, 1],
          ],
        ],
      }),
    /INVALID_TOPOLOGY/,
  );
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "Polygon",
        coordinates: [
          [
            [181, 0],
            [1, 0],
            [0, 1],
          ],
        ],
      }),
    /INVALID_COORDINATES/,
  );
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          [
            [3, 3],
            [4, 3],
            [3, 4],
          ],
        ],
      }),
    /INVALID_TOPOLOGY/,
  );
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
        ],
      }),
    /THREE_POINTS_REQUIRED/,
  );
});
test("Multipart islands and holes survive vertex changes, serialisation and roundtrip", () => {
  let g = openGeometry(base.geometry as import("geojson").Polygon);
  g = addGeometryHole(g, 0);
  g = editRing(g, 0, 1, [
    [29, 50],
    [30, 50],
    [30, 51],
    [29, 51],
  ]);
  g = addGeometryPart(g);
  g = editRing(g, 1, 0, [
    [35, 50],
    [36, 50],
    [36, 51],
    [35, 51],
  ]);
  const data = validateAtlasEdits([{ ...edit(), geometry: g }]);
  assert.deepEqual(parseAtlasEdits(serializeAtlasEdits(data)), data);
  const actual = openGeometry(data[0].geometry);
  const before = structuredClone(actual);
  const next = editRing(actual, 1, 0, [
    [35, 50],
    [36.5, 50],
    [36, 51],
    [35, 51],
  ]);
  assert.deepEqual(actual, before);
  assert.deepEqual(
    (next as import("geojson").MultiPolygon).coordinates[0],
    (actual as import("geojson").MultiPolygon).coordinates[0],
  );
  assert.equal(removeGeometryRing(next, 0, 1).type, "MultiPolygon");
  assert.equal(removeGeometryRing(next, 1, 0).type, "Polygon");
});
test("Dated replacement and reset affect only the selected polity in their active period", () => {
  const other = {
    ...structuredClone(base),
    id: "other",
    properties: { ...base.properties, name: "Other" },
  };
  const collection = { type: "FeatureCollection" as const, features: [base, other] };
  const entries = validateAtlasEdits([edit()]);
  assert.equal(applyAtlasEdits(collection, entries, 1239), collection);
  assert.equal(applyAtlasEdits(collection, entries, 1261), collection);
  const active = applyAtlasEdits(collection, entries, 1240)!;
  assert.equal(active.features.length, 2);
  assert.deepEqual(
    active.features.find((f) => f.id === "other"),
    other,
  );
  assert.ok(active.features.find((f) => f.properties.custom));
  assert.equal(applyAtlasEdits(collection, [], 1240), collection);
  assert.deepEqual(collection.features, [base, other]);
});
test("Relative territories overlap core countries without removing them", () => {
  const dependency = validateAtlasEdits([
    {
      ...newAtlasEdit(1240, base, true),
      name: "Русь під ординською зверхністю",
      subject: "Золота Орда",
      from: 1240,
      to: 1362,
      relation: "Данницька залежність",
    },
  ]);
  const c = applyAtlasEdits({ type: "FeatureCollection", features: [base] }, dependency, 1240)!;
  assert.equal(c.features.length, 2);
  assert.deepEqual(c.features[0], base);
  assert.equal(c.features[1].properties.control, "relative");
  assert.equal(c.features[1].properties.subject, "Золота Орда");
  assert.equal(c.features[1].properties.validTo, 1362);
});
test("Hide overlays expire; conflicting replacements, malicious sources and oversized data fail", () => {
  const collection = { type: "FeatureCollection" as const, features: [base] };
  const hidden = validateAtlasEdits([{ ...edit(), operation: "hide" }]);
  assert.equal(applyAtlasEdits(collection, hidden, 1240)?.features.length, 0);
  assert.equal(applyAtlasEdits(collection, hidden, 1261), collection);
  assert.throws(
    () => validateAtlasEdits([edit(), { ...edit(), id: "second" }]),
    /OVERLAPPING_REPLACEMENTS/,
  );
  const duplicate = edit();
  assert.throws(() => validateAtlasEdits([duplicate, duplicate]), /DUPLICATE_EDIT/);
  assert.throws(
    () => validateAtlasEdits([{ ...edit(), sourceUrl: "javascript:alert(1)" }]),
    /INVALID_SOURCE_URL/,
  );
  assert.throws(() => validateAtlasEdits([{ ...edit(), to: 1239 }]), /INVALID_EDIT_DATES/);
  assert.throws(
    () => validateAtlasEdits([{ ...edit(), color: "url(https://example.com)" }]),
    /INVALID_ATLAS_EDIT/,
  );
  assert.throws(() => parseAtlasEdits("x".repeat(450001)), /INVALID_ATLAS_DATA/);
});
test("School-owned writes preserve unrelated fields and reject stale revisions and other users", () => {
  const school = { createdBy: "owner", atlasRevision: 4, name: "School", schedule: [1, 2] };
  assert.throws(() => atlasWritePatch(school, "teacher", 4, [edit()], 10), /ATLAS_OWNER_REQUIRED/);
  assert.throws(() => atlasWritePatch(school, "owner", 3, [edit()], 10), /CONFLICT/);
  const patch = atlasWritePatch(school, "owner", 4, [edit()], 10);
  assert.equal(patch.atlasRevision, 5);
  assert.equal(patch.atlasUpdatedBy, "owner");
  assert.equal(patch.atlasUpdatedAt, 10);
  assert.equal(parseAtlasEdits(patch.atlasEdits).length, 1);
  assert.equal("name" in patch, false);
  assert.equal(school.atlasRevision, 4);
  assert.deepEqual(school.schedule, [1, 2]);
});

test("Overlapping multipart pieces and collinear outlines cannot be published", () => {
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
        ],
      }),
    /INVALID_TOPOLOGY/,
  );
  assert.throws(
    () =>
      normalizeTerritoryGeometry({
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
            ],
          ],
          [
            [
              [1, 1],
              [3, 1],
              [3, 3],
              [1, 3],
            ],
          ],
        ],
      }),
    /INVALID_TOPOLOGY/,
  );
});

test("Moving a common border node updates both countries and preserves neighbour periods", async () => {
  const { borderMoves, saveSharedBorders } = await import("../src/lib/atlas/borders.ts");
  const original = newAtlasEdit(1240, base);
  original.to = 1260;
  const neighbor = {
    ...newAtlasEdit(1230, base, true),
    name: "Neighbour",
    subject: "Neighbour",
    to: 1270,
    geometry: structuredClone(original.geometry),
  };
  const changed = structuredClone(original);
  changed.geometry = editRing(changed.geometry, 0, 0, [
    [28.1, 49],
    [32, 49],
    [32, 52],
    [28, 52],
  ]);
  const features = applyAtlasEdits(
    { type: "FeatureCollection", features: [base] },
    [neighbor],
    1240,
  )!;
  const result = validateAtlasEdits(
    saveSharedBorders(
      [neighbor],
      changed,
      features,
      borderMoves(original.geometry, changed.geometry),
    ),
  );
  const editedNeighbor = result.find((e) => e.name === "Neighbour" && e.from === 1240)!;
  assert.equal(editedNeighbor.to, 1260);
  assert.deepEqual(editedNeighbor.geometry.coordinates[0][0], [28.1, 49]);
  assert.ok(result.some((e) => e.name === "Neighbour" && e.from === 1230 && e.to === 1239));
  assert.ok(result.some((e) => e.name === "Neighbour" && e.from === 1261 && e.to === 1270));
  // Inserting a point alone must not move/relabel every following neighbour vertex.
  assert.deepEqual(
    borderMoves(
      original.geometry,
      editRing(original.geometry, 0, 0, [
        [28, 49],
        [30, 49],
        [32, 49],
        [32, 52],
        [28, 52],
      ]),
    ),
    [],
  );
});
