import { ELEMENTS } from "./data.ts";

export type PeriodicLayout = "compact" | "long";
export type TemperatureUnit = "C" | "F" | "K";
export const CATEGORIES = {
  alkali: { name: "Лужні метали", color: "#f7c4b8" },
  alkaline: { name: "Лужноземельні метали", color: "#f7db9c" },
  transition: { name: "Перехідні метали", color: "#f4d0a8" },
  postTransition: { name: "Постперехідні метали", color: "#c6d9ec" },
  metalloid: { name: "Металоїди", color: "#cde1b5" },
  nonmetal: { name: "Інші неметали", color: "#b8e3d3" },
  halogen: { name: "Галогени", color: "#b8e4e9" },
  noble: { name: "Благородні гази", color: "#d3ccf0" },
  lanthanide: { name: "Лантаноїди", color: "#ecd2e8" },
  actinide: { name: "Актиноїди", color: "#e7c2d0" },
  unknown: { name: "Категорія не визначена", color: "#dce0df" },
} as const;
export type Category = keyof typeof CATEGORIES;
export type NumericProperties<K extends string> = Record<K, number | null>;
export interface ElementData {
  number: number;
  symbol: string;
  name: string;
  englishName: string;
  aliases: string[];
  category: Category;
  mass: number;
  massRange: [number, number] | null;
  massUncertainty: string | null;
  isotopeMass: boolean;
  group: number;
  period: number;
  position: [number, number];
  widePosition: [number, number];
  shells: number[];
  configuration: string;
  melting: number | null;
  boiling: number | null;
  affinity: number | null;
  electronegativity: number | null;
  ionization: number[];
  radius: NumericProperties<"calculated" | "empirical" | "covalent" | "vanderwaals">;
  hardness: NumericProperties<"brinell" | "mohs" | "vickers">;
  modulus: NumericProperties<"bulk" | "shear" | "young">;
  density: NumericProperties<"stp" | "liquid">;
  conductivity: NumericProperties<"thermal" | "electric">;
  heat: NumericProperties<"specific" | "vaporization" | "fusion">;
  abundance: NumericProperties<"universe" | "solar" | "meteor" | "crust" | "ocean" | "human">;
  discovered: number | null;
}
export { ELEMENTS };
export function elementByNumber(number: number): ElementData {
  return ELEMENTS.find((e) => e.number === number) ?? ELEMENTS[0];
}
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Немає даних";
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 12,
    ...(value !== 0 && (Math.abs(value) < 0.00001 || Math.abs(value) >= 1e9)
      ? { notation: "scientific", maximumFractionDigits: 5 }
      : {}),
  }).format(value);
}
export function temperatureFromKelvin(value: number | null, unit: TemperatureUnit) {
  return value == null
    ? null
    : unit === "K"
      ? value
      : unit === "C"
        ? value - 273.15
        : (value - 273.15) * 1.8 + 32;
}
export function temperatureToKelvin(value: number, unit: TemperatureUnit) {
  return unit === "K" ? value : unit === "C" ? value + 273.15 : (value - 32) / 1.8 + 273.15;
}
export function temperatureValue(value: number | null, unit: TemperatureUnit) {
  const converted = temperatureFromKelvin(value, unit);
  return converted == null ? null : Math.round(converted * 100) / 100;
}
/** Approximate phase at atmospheric pressure. Do not invent liquid phases for subliming elements. */
export function stateAt(element: ElementData, kelvin: number): string {
  if (!Number.isFinite(kelvin) || kelvin < 0) return "Температура нижча за абсолютний нуль";
  if (element.number >= 104) return "Невідомий (властивості переважно прогнозовані)";
  if (element.number === 2) return kelvin >= 4.222 ? "Газ" : "Рідина (твердіє лише під тиском)";
  if (element.number === 6) return kelvin >= 4098 ? "Газ (сублімація)" : "Тверде тіло";
  if (element.number === 33) return kelvin >= 887 ? "Газ (сублімація)" : "Тверде тіло";
  if (element.melting == null) return "Немає даних";
  if (kelvin < element.melting) return "Тверде тіло";
  if (element.boiling == null) return "Немає даних для цієї температури";
  return kelvin >= element.boiling ? "Газ" : "Рідина";
}
export function matchesElement(element: ElementData, query: string) {
  const q = query.trim().toLocaleLowerCase("uk-UA");
  return (
    !q ||
    [
      element.name,
      element.englishName,
      element.symbol,
      String(element.number),
      ...element.aliases,
    ].some((text) => text.toLocaleLowerCase("uk-UA").includes(q))
  );
}
export function massLabel(element: ElementData, full = true) {
  if (element.massRange && full)
    return `${formatNumber(element.massRange[0])}–${formatNumber(element.massRange[1])}`;
  return element.isotopeMass ? `[${element.mass}]` : formatNumber(element.mass);
}
export function wikipediaUrl(element: ElementData) {
  return `https://uk.wikipedia.org/wiki/${encodeURIComponent(element.name)}`;
}
