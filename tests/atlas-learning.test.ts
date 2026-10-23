import { comparisonSnapshot } from "../src/lib/atlas/comparison-snapshot.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareTerritories } from "../src/lib/atlas/comparison.ts";
import {
  MAP_EVENTS,
  EVENT_SOURCES,
  LEARNING_ROUTES,
  routeEvents,
  eventsInPeriod,
  eventsBetweenDates,
  formatMapEventDate,
} from "../src/lib/atlas/learning.ts";
import {
  validateWorldManifest,
  worldFrameAt,
  applyWorldPatch,
  validateWorldPatch,
  compareWorldDates,
} from "../src/lib/atlas/world.ts";
import {
  validateHistoricalCollection,
  type HistoricalCollection,
  type HistoricalFeature,
} from "../src/lib/atlas/model.ts";
import {
  newArticleWidget,
  serializeArticleWidget,
  articleWidgets,
  articleEditorProjection,
  validateArticleWidget,
} from "../src/lib/materials/article-widgets.ts";
const polygon = (
  owner: string,
  x1: number,
  x2: number,
  layer: HistoricalFeature["properties"]["layer"] = "state",
): HistoricalFeature => ({
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [x1, 0],
        [x2, 0],
        [x2, 2],
        [x1, 2],
        [x1, 0],
      ],
    ],
  },
  properties: { name: owner, subject: owner, precision: 2, layer },
});
const collection = (...features: HistoricalFeature[]): HistoricalCollection => ({
  type: "FeatureCollection",
  features,
});
const data = (path: string) =>
  JSON.parse(readFileSync(new URL(`../public/atlas/world/${path}`, import.meta.url), "utf8"));
function snapshot(year: number, month: number, day: number) {
  const manifest = validateWorldManifest(data("manifest.json")),
    frame = worldFrameAt(manifest, { year, month, day })!;
  return applyWorldPatch(
    validateHistoricalCollection(
      data(manifest.baseFiles.find((b) => b.year === frame.baseYear)!.path),
    ),
    validateWorldPatch(data(frame.path)),
  );
}
test("comparison intersects known territory, ignores gaps, overlays and owner aliases, and reverses direction", () => {
  const before = collection(polygon("A", 0, 2)),
    after = collection(polygon("B", 1, 3), polygon("Occupation", 0, 2, "occupation"));
  const changed = compareTerritories(before, after);
  assert.equal(changed.skipped, 0);
  assert.equal(changed.collection.features.length, 1);
  assert.deepEqual(changed.collection.features[0].properties, { from: "A", to: "B" });
  const xs = changed.collection.features[0].geometry.coordinates.flat(2).map((p) => p[0]);
  assert.equal(Math.min(...xs), 1);
  assert.equal(Math.max(...xs), 2);
  assert.deepEqual(compareTerritories(after, before).collection.features[0].properties, {
    from: "B",
    to: "A",
  });
  assert.equal(
    compareTerritories(before, collection(polygon("A", 0, 1))).collection.features.length,
    0,
  );
  assert.equal(
    compareTerritories(
      collection(polygon("Russia", 0, 2)),
      collection(polygon("Russian Empire", 0, 2)),
    ).collection.features.length,
    0,
  );
  assert.equal(
    compareTerritories(collection(polygon("A", 0, 2, "land")), after).collection.features.length,
    0,
  );
});
test("comparison preserves holes rather than filling an unchanged enclave", () => {
  const outer = polygon("A", 0, 4);
  if (outer.geometry.type !== "Polygon") throw new Error();
  outer.geometry.coordinates.push([
    [1, 0.5],
    [1, 1.5],
    [2, 1.5],
    [2, 0.5],
    [1, 0.5],
  ]);
  const out = compareTerritories(collection(outer), collection(polygon("B", 0, 4)));
  assert.equal(out.skipped, 0);
  assert.equal(out.collection.features[0].geometry.coordinates[0].length, 2);
});
test("real 1772→1795 data contains Commonwealth transfers to all three partition powers", () => {
  const before = snapshot(1772, 8, 5),
    after = snapshot(1795, 10, 24),
    result = compareTerritories(before, after);
  assert.equal(result.skipped, 0);
  const dated = compareTerritories(
    comparisonSnapshot(before, 1772, 1715)!,
    comparisonSnapshot(after, 1795, 1783)!,
  );
  assert.equal(dated.skipped, 0);
  assert.ok(dated.collection.features.length > 0);
  assert.ok(
    dated.collection.features.every((f) => f.properties.from === "Polish-Lithuanian Commonwealth"),
    "Older fallback basemaps must not create out-of-period conquests",
  );
  const transfers = dated.collection.features.filter(
    (f) => f.properties.from === "Polish-Lithuanian Commonwealth",
  );
  assert.deepEqual([...new Set(transfers.map((f) => f.properties.to))].sort(), [
    "Austrian Empire",
    "Prussia",
    "Russian Empire",
  ]);
  assert.ok(result.collection.features.length > 0);
  assert.equal(compareTerritories(before, structuredClone(before)).collection.features.length, 0);
  console.log(`Dated comparison: ${dated.collection.features.length} changed areas`);
});
test("routes contain ordered geolocated events with consequences and resolvable sources", () => {
  assert.equal(new Set(MAP_EVENTS.map((e) => e.id)).size, MAP_EVENTS.length);
  for (const event of MAP_EVENTS) {
    assert.ok(Math.abs(event.lat) <= 85 && Math.abs(event.lng) <= 180);
    assert.ok(event.description && event.consequences && event.locationNote);
    for (const id of event.sources)
      assert.match(EVENT_SOURCES[id as keyof typeof EVENT_SOURCES].url, /^https:\/\//);
  }
  for (const route of LEARNING_ROUTES) {
    const events = routeEvents(route.id);
    assert.equal(events.length, route.events.length);
    events.forEach((e, i) => {
      assert.ok(e);
      if (i) assert.ok(compareWorldDates(events[i - 1].date, e.date) < 0);
    });
  }
  assert.deepEqual(eventsInPeriod(1795, 1772), eventsInPeriod(1772, 1795));
  assert.equal(eventsInPeriod(1772, 1795).length, 4);
  assert.match(
    formatMapEventDate(MAP_EVENTS.find((e) => e.id === "sulyma-1635")!),
    /день не уточнено/,
  );
  assert.match(
    formatMapEventDate(MAP_EVENTS.find((e) => e.id === "partition-1772")!),
    /05.08.1772/,
  );
});
test("map widgets retain date, viewport and layers through article storage and editor projection", () => {
  const widget = newArticleWidget("map", true),
    body = `## Карта\n\n${serializeArticleWidget(widget)}\n\nПояснення`;
  assert.deepEqual(articleWidgets(body)[0].widget, widget);
  const projection = articleEditorProjection(body);
  assert.ok(!projection.text.includes('"center"'));
  assert.equal(projection.expand(projection.text), body);
});
test("map widgets reject impossible dates, unsafe layers and invalid viewports", () => {
  const w = newArticleWidget("map", true);
  if (w.type !== "map") throw new Error();
  for (const changes of [
    { date: { year: 0, month: 1, day: 1 } },
    { date: { year: 1795, month: 2, day: 29 } },
    { date: { year: 1795, month: 2, day: 0 } },
    { date: { year: 1995, month: 1, day: 1 } },
    { center: { lat: 90, lng: 25 } },
    { center: { lat: 52, lng: Infinity } },
    { zoom: NaN },
    { zoom: 9 },
    { layers: ["events", "events"] },
    { layers: ["<script>"] },
    { layers: ["https://example.com"] },
  ])
    assert.throws(() => validateArticleWidget({ ...w, ...changes }), /INVALID_WIDGET/);
  assert.equal(
    validateArticleWidget({ ...w, layers: [], date: { year: -1, month: 12, day: 31 } }).type,
    "map",
  );
});
test("unchanged overlapping basemaps cannot create fictitious transfers", () => {
  const before = collection(polygon("A", 0, 2), polygon("B", 1, 3));
  assert.equal(compareTerritories(before, before).collection.features.length, 0);
  assert.deepEqual(
    compareTerritories(
      before,
      collection(polygon("C", 0, 2), polygon("B", 1, 3)),
    ).collection.features.map((f) => f.properties),
    [{ from: "A", to: "C" }],
  );
});
test("comparison events respect exact dates, reversed intervals and year-only uncertainty", () => {
  const a = { year: 1795, month: 10, day: 23 },
    b = { ...a, day: 24 };
  assert.equal(eventsBetweenDates(a, a).length, 0);
  assert.deepEqual(
    eventsBetweenDates(a, b).map((e) => e.id),
    ["partition-1795"],
  );
  assert.deepEqual(eventsBetweenDates(b, a), eventsBetweenDates(a, b));
  assert.ok(
    eventsBetweenDates({ year: 1635, month: 12, day: 1 }, { year: 1635, month: 12, day: 31 }).some(
      (e) => e.id === "sulyma-1635",
    ),
  );
});

test("dated comparisons retain exact-year basemaps and regional/manual details but omit older world fallback outlines", () => {
  const baseline = polygon("A", 0, 2);
  baseline.properties.sourceId = "basemaps";
  const regional = polygon("B", 2, 3);
  regional.properties.sourceId = "pllt-partitions";
  const manual = polygon("C", 3, 4);
  manual.properties.custom = true;
  manual.properties.sourceId = "basemaps";
  const input = collection(baseline, regional, manual);
  assert.equal(comparisonSnapshot(input, 1772, 1772), input);
  assert.deepEqual(comparisonSnapshot(input, 1772, 1715)?.features, [regional, manual]);
});
