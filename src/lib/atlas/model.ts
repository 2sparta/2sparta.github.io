import type { Feature, FeatureCollection, Geometry } from "geojson";

export const ATLAS_YEARS = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400] as const;
export const ATLAS_MIN_YEAR = 395;
export const ATLAS_MAX_YEAR = 1453;
export const BYZANTINE_YEARS = [
  395, 450, 476, 565, 592, 622, 630, 641, 668, 717, 775, 813, 842, 867, 927, 959, 969, 975, 1000,
  1025, 1045, 1059, 1081, 1118, 1143, 1155, 1180, 1203, 1205, 1230, 1254, 1262, 1328, 1340, 1354,
  1400, 1403, 1445, 1453,
] as const;
export type AtlasView = "rus" | "europe" | "world" | "byzantium" | "franks";
export type HistoricalProperties = {
  name: string;
  subject: string;
  precision: number;
  detailed?: boolean;
  sourceYear?: number;
  sourceId?: string;
  region?: "franks";
  color?: string;
};
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
  byzantine?: boolean;
  frankish?: boolean;
  capital?: boolean;
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
  return Math.max(
    ATLAS_MIN_YEAR,
    Math.min(ATLAS_MAX_YEAR, Math.round(Number.isFinite(value) ? value : 1000)),
  );
}
/** Other countries have no configured historical geometry outside the original range. */
export function overviewSnapshot(year: number) {
  return year >= 500 && year <= 1400 ? nearestSnapshot(year) : undefined;
}
/** Use the last documented Byzantine frame; never borrow future conquests or interpolate. */
export function byzantineSnapshot(year: number) {
  const target = clampAtlasYear(year);
  return [...BYZANTINE_YEARS].reverse().find((y) => y <= target)!;
}
export function isCoarseByzantine(name: string) {
  return /^(Byzantine Empire|Eastern Roman Empire|Trebizond|Empire of Nicaea|Nicaea|Despotate of Epirus|Principality of Theodoro)$/.test(
    name,
  );
}
export const FRANKISH_YEARS = [481, 511, 561, 614, 768, 814, 843, 870, 881, 888] as const;
export function frankishSnapshot(year: number) {
  if (year < 481 || year > 900) return undefined;
  return [...FRANKISH_YEARS].reverse().find((y) => y <= year);
}
export function isUnknownRegion(name: string) {
  return !name.trim() || /^unspecified$/i.test(name.trim());
}
export function isCoarseFrankish(name: string) {
  return /^(Franks|Frankish Kingdom|Carolingian Empire)$/.test(name);
}
export function combineHistoricalLayers(
  overview: HistoricalCollection | undefined,
  detailed: HistoricalCollection | undefined,
  frankish?: HistoricalCollection,
): HistoricalCollection | undefined {
  const clean = overview?.features.filter((f) => !isUnknownRegion(f.properties.name));
  if (!detailed && !frankish)
    return clean?.length === overview?.features.length
      ? overview
      : clean
        ? { type: "FeatureCollection", features: clean }
        : undefined;
  return {
    type: "FeatureCollection",
    features: [
      ...(clean ?? []).filter(
        (f) =>
          !(detailed && isCoarseByzantine(f.properties.name)) &&
          !(frankish && isCoarseFrankish(f.properties.name)),
      ),
      ...(detailed?.features ?? []),
      ...(frankish?.features ?? []),
    ],
  };
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
    ATLAS_MIN_YEAR,
    ...places.flatMap((p) => [
      p.from <= year ? p.from : ATLAS_MIN_YEAR,
      p.to < year ? p.to + 1 : ATLAS_MIN_YEAR,
    ]),
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
    "Empire of Nicaea": "Нікейська імперія",
    "Empire of Trebizond": "Трапезундська імперія",
    "Despotate of Epirus": "Епірська держава",
    "Empire of Thessalonica": "Фессалонікійська імперія",
    "Principality of Theodoro": "Князівство Феодоро",
    "Byzantine-Arab condominium": "Візантійсько-арабське співволодіння",
    "Roman Empire": "Римська імперія",
    "Frankish Kingdom": "Франкське королівство",
    Franks: "Франки",
    "Frankish realms": "Франкські володіння",
    "Carolingian Empire": "Каролінзька імперія",
    "Frankish dependent territories": "Залежні території франків",
    "Kingdom of Orleans": "Орлеанське королівство",
    "Kingdom of Paris": "Паризьке королівство",
    "Kingdom of Reims": "Реймське королівство",
    "Kingdom of Soissons": "Суассонське королівство",
    "West Francia": "Західна Франкія",
    "Middle Francia": "Середня Франкія",
    "East Francia": "Східна Франкія",
    "Kingdom of Italy": "Італійське королівство",
    "Charles III's realms": "Володіння Карла III — Італія й східні землі",
    "Papal States": "Папська держава",
    "Disputed Aquitaine": "Аквітанія — спірні володіння",
    "West Francia — Louis III": "Західна Франкія — Людовик III",
    "West Francia — Carloman II": "Західна Франкія — Карломан II",
    "Lower Burgundy": "Нижня Бургундія",
    "Upper Burgundy": "Верхня Бургундія",
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
  if (name === "Byzantine-Arab condominium") return "#f8e0e9";
  if (/Byzantine|Eastern Roman|Nicaea/.test(name)) return "#f3cbda";
  if (/Trebizond/.test(name)) return "#d2f3be";
  if (/Epirus|Thessalonica/.test(name)) return "#f3f28c";
  if (/Theodoro/.test(name)) return "#c5c1ff";
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
