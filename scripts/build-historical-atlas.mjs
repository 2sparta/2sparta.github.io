// Reproducible, pinned data preparation. This is not run by the application build.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const PIN = "da7a4b735ecef70aebdc9c73e409d8a2500d50f3";
const ROOT = `https://raw.githubusercontent.com/aourednik/historical-basemaps/${PIN}`;
const YEARS = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400];
const out = new URL("../public/atlas/", import.meta.url);
await mkdir(out, { recursive: true });
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
const round = (p) => p.slice(0, 2).map((n) => Math.round(n * 10000) / 10000);
// Douglas–Peucker in source longitude/latitude, 0.02 degrees. No boundary interpolation.
function line(points, epsilon = 0.02) {
  if (points.length < 4) return points.map(round);
  const result = [points[0]];
  function segment(a, b) {
    const [x, y] = points[a],
      [xx, yy] = points[b];
    const dx = xx - x,
      dy = yy - y,
      length = dx * dx + dy * dy;
    let best = epsilon * epsilon,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const t = length
        ? Math.max(0, Math.min(1, ((points[i][0] - x) * dx + (points[i][1] - y) * dy) / length))
        : 0;
      const distance = (points[i][0] - x - t * dx) ** 2 + (points[i][1] - y - t * dy) ** 2;
      if (distance > best) {
        best = distance;
        index = i;
      }
    }
    if (index >= 0) {
      segment(a, index);
      result.push(points[index]);
      segment(index, b);
    }
  }
  segment(0, points.length - 1);
  result.push(points.at(-1));
  return (result.length >= 4 ? result : points).map(round);
}
function geometry(g) {
  if (g.type === "Polygon") return { type: g.type, coordinates: g.coordinates.map((r) => line(r)) };
  if (g.type === "MultiPolygon")
    return { type: g.type, coordinates: g.coordinates.map((p) => p.map((r) => line(r))) };
  if (g.type === "LineString") return { type: g.type, coordinates: line(g.coordinates) };
  if (g.type === "MultiLineString")
    return { type: g.type, coordinates: g.coordinates.map((r) => line(r)) };
  throw new Error(`Unsupported geometry: ${g.type}`);
}
const manifest = {
  generatedAt: "2026-10-12",
  historicalCommit: PIN,
  toleranceDegrees: 0.02,
  files: [],
};
for (let i = 0; i < YEARS.length; i += 3) {
  await Promise.all(
    YEARS.slice(i, i + 3).map(async (year) => {
      const raw = await download(`${ROOT}/geojson/world_${year}.geojson`);
      const data = JSON.parse(raw);
      const collection = {
        type: "FeatureCollection",
        features: data.features.map((f, index) => ({
          type: "Feature",
          id: `${year}-${index}`,
          properties: {
            name: String(f.properties.NAME || "Unspecified"),
            subject: String(f.properties.SUBJECTO || f.properties.NAME || "Unspecified"),
            precision: Number(f.properties.BORDERPRECISION) || 1,
          },
          geometry: geometry(f.geometry),
        })),
      };
      const text = JSON.stringify(collection);
      const path = `world-${year}.geojson`;
      await writeFile(new URL(path, out), text + "\n");
      manifest.files.push({
        year,
        path,
        sourceSha256: createHash("sha256").update(raw).digest("hex"),
        sha256: createHash("sha256")
          .update(text + "\n")
          .digest("hex"),
        features: collection.features.length,
        bytes: Buffer.byteLength(text) + 1,
      });
      console.log(year, collection.features.length, Buffer.byteLength(text));
    }),
  );
}
await writeFile(new URL("historical-basemaps-LICENSE.txt", out), await download(`${ROOT}/LICENSE`));
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const land = JSON.parse(await download(`${NE}/ne_50m_land.geojson`));
await writeFile(
  new URL("land.geojson", out),
  JSON.stringify({
    type: "FeatureCollection",
    features: land.features.map((f) => ({
      type: "Feature",
      properties: {},
      geometry: geometry(f.geometry),
    })),
  }) + "\n",
);
const rivers = JSON.parse(await download(`${NE}/ne_50m_rivers_lake_centerlines.geojson`));
const names = [
  "Dnieper",
  "Dnipro",
  "Dnepre",
  "Dniester",
  "Don",
  "Donets",
  "Volga",
  "Danube",
  "Donau",
  "Prut",
  "Southern Bug",
  "Desna",
  "Vistula",
  "Neman",
];
const selected = rivers.features.filter((f) => names.includes(f.properties.name));
await writeFile(
  new URL("rivers.geojson", out),
  JSON.stringify({
    type: "FeatureCollection",
    features: selected.map((f) => ({
      type: "Feature",
      properties: { name: f.properties.name },
      geometry: geometry(f.geometry),
    })),
  }) + "\n",
);
manifest.files.sort((a, b) => a.year - b.year);
manifest.naturalEarthVersion = "5.1.2";
manifest.rivers = selected.map((f) => f.properties.name);
await writeFile(new URL("manifest.json", out), JSON.stringify(manifest, null, 2) + "\n");
