import type { Feature, FeatureCollection, Geometry } from "geojson";

export const ATLAS_YEARS = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400] as const;
export type AtlasView = "rus" | "europe" | "world";
export type HistoricalProperties = { name: string; subject: string; precision: number };
export type HistoricalFeature = Feature<Geometry, HistoricalProperties>;
export type HistoricalCollection = FeatureCollection<Geometry, HistoricalProperties>;
export type AtlasSource = { id: string; title: string; url: string; note: string };
export type AtlasPlace = {
  id: string;
  name: string;
  type: "city" | "area" | "polity";
  from: number;
  to: number;
  lat: number;
  lng: number;
  dateLabel: string;
  description: string;
  sources: string[];
  europe?: boolean;
};
export type AtlasEvent = {
  year: number;
  title: string;
  description: string;
  sources: string[];
  approximate?: boolean;
  europe?: boolean;
};
export function clampAtlasYear(value: number) {
  return Math.max(500, Math.min(1400, Math.round(Number.isFinite(value) ? value : 1000)));
}
export function nearestSnapshot(year: number) {
  const target = clampAtlasYear(year);
  return ATLAS_YEARS.reduce(
    (best, next) => (Math.abs(next - target) < Math.abs(best - target) ? next : best),
    ATLAS_YEARS[0] as number,
  );
}
export function activePlaces(places: AtlasPlace[], year: number) {
  return places.filter((p) => year >= p.from && year <= p.to);
}
/** Stable between marker dates, so scrubbing a year does not redraw unchanged geographic layers. */
export function placeEpoch(places: AtlasPlace[], year: number) {
  return Math.max(
    500,
    ...places.flatMap((p) => [p.from <= year ? p.from : 500, p.to < year ? p.to + 1 : 500]),
  );
}
export function historicalName(name: string, uk = true) {
  const names: Record<string, string> = {
    "Kyivan Rus": "Київська Русь",
    "Kievan Rus": "Київська Русь",
    "Rus' Khaganate": "Руський каганат? (гіпотеза)",
    "Other Rus Principalities": "Інші князівства Русі (узагальнення)",
    "Principality of Galicia-Volhynia": "Галицько-Волинська держава",
    "Principality of Novgorod": "Новгородська земля",
    "Cuman Khanates": "Половецькі об’єднання",
    "Khazar Khaganate": "Хозарський каганат",
    Khazars: "Хозари",
    Pechenegs: "Печеніги",
    "Golden Horde": "Золота Орда",
    "Poland-Lithuania": "Польща і ВКЛ (узагальнена геометрія)",
    "Byzantine Empire": "Візантійська імперія",
    "Eastern Roman Empire": "Східна Римська імперія",
    "Roman Empire": "Римська імперія",
    "Frankish Kingdom": "Франкське королівство",
    Franks: "Франки",
    "Holy Roman Empire": "Священна Римська імперія",
    "Kingdom of Poland": "Польське королівство",
    Poland: "Польща",
    "Kingdom of Hungary": "Угорське королівство",
    Hungary: "Угорщина",
    Bulgaria: "Болгарія",
    "First Bulgarian Empire": "Перше Болгарське царство",
    "Second Bulgarian Empire": "Друге Болгарське царство",
    Lithuania: "Велике князівство Литовське",
    "Grand Duchy of Lithuania": "Велике князівство Литовське",
    "Avar Khaganate": "Аварський каганат",
    Sclaveni: "Склавини",
    Antes: "Анти",
    Unspecified: "Не уточнено в джерелі",
  };
  return uk ? (names[name] ?? name) : name;
}
export function featureNote(name: string, year: number) {
  if (name === "Rus' Khaganate")
    return "Назва та територія раннього руського політичного утворення дискусійні. Геометрія 800 р. — гіпотетична реконструкція; це не доведена держава з установленими кордонами.";
  if (name === "Poland-Lithuania" && year === 1400)
    return "Джерело об’єднує Польщу й ВКЛ в одну геометрію. У 1400 р. це були окремі держави під династичною унією; Річ Посполита постала 1569 р.";
  if (/Rus|Kievan|Galicia/.test(name))
    return "Геометрія оглядова: вона не розрізняє всі удільні князівства, залежність і зміну місцевого управління. Докладніші картки розташовані в регіональному шарі.";
  return "Джерело подає оглядову територію держави або культурного ареалу. Межі не є сучасними юридичними кордонами й можуть перекриватися.";
}
export function polityColor(name: string) {
  if (/Rus|Kievan|Galicia/.test(name)) return "#a65839";
  const colors = [
    "#749d74",
    "#c19f63",
    "#8397ba",
    "#b58b9c",
    "#9c9871",
    "#83a6a1",
    "#b7a279",
    "#ae977c",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
export function validateHistoricalCollection(raw: unknown): HistoricalCollection {
  const d = raw as HistoricalCollection;
  if (!d || d.type !== "FeatureCollection" || !Array.isArray(d.features) || !d.features.length)
    throw new Error("INVALID_ATLAS_DATA");
  for (const f of d.features) {
    if (
      f.type !== "Feature" ||
      typeof f.properties?.name !== "string" ||
      typeof f.properties.subject !== "string" ||
      !f.geometry ||
      !["Polygon", "MultiPolygon"].includes(f.geometry.type)
    )
      throw new Error("INVALID_ATLAS_DATA");
    const coords = (f.geometry as { coordinates: unknown }).coordinates;
    const valid = (x: unknown): boolean =>
      Array.isArray(x) &&
      x.length > 0 &&
      (typeof x[0] === "number"
        ? x.length >= 2 &&
          Number.isFinite(x[0]) &&
          Number.isFinite(x[1]) &&
          Math.abs(x[0]) <= 180.001 &&
          Math.abs(x[1] as number) <= 90.001
        : x.every(valid));
    if (!valid(coords)) throw new Error("INVALID_ATLAS_DATA");
  }
  return d;
}
