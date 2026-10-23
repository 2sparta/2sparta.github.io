import { worldDate, worldDateKey } from "./world.ts";
import type { AtlasDate } from "./date.ts";
export const EMBED_LAYERS = [
  "borders",
  "cities",
  "rivers",
  "occupations",
  "cossacks",
  "colonies",
  "events",
] as const;
export type EmbedLayer = (typeof EMBED_LAYERS)[number];
export type AtlasMapWidget = {
  type: "map";
  title: string;
  date: AtlasDate;
  center: { lat: number; lng: number };
  zoom: number;
  layers: EmbedLayer[];
};
export const EMBED_LAYER_LABELS: Record<EmbedLayer, [string, string]> = {
  borders: ["Держави й кордони", "States and borders"],
  cities: ["Міста", "Cities"],
  rivers: ["Річки", "Rivers"],
  occupations: ["Окупації", "Occupations"],
  cossacks: ["Козацькі території", "Cossack territories"],
  colonies: ["Колонії", "Colonies"],
  events: ["Події", "Events"],
};
export function validateMapWidget(raw: Record<string, unknown>, title: string): AtlasMapWidget {
  const date = raw.date as AtlasDate | undefined,
    center = raw.center as AtlasMapWidget["center"] | undefined;
  if (
    !date ||
    ![date.year, date.month, date.day].every(Number.isInteger) ||
    worldDateKey(worldDate(date.year, date.month, date.day)) !== worldDateKey(date) ||
    !center ||
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    Math.abs(center.lat) > 85 ||
    Math.abs(center.lng) > 180 ||
    typeof raw.zoom !== "number" ||
    !Number.isFinite(raw.zoom) ||
    raw.zoom < 0 ||
    raw.zoom > 8 ||
    !Array.isArray(raw.layers) ||
    raw.layers.length > EMBED_LAYERS.length ||
    raw.layers.some((l) => !EMBED_LAYERS.includes(l)) ||
    new Set(raw.layers).size !== raw.layers.length
  )
    throw new Error("INVALID_WIDGET");
  return {
    type: "map",
    title,
    date: { year: date.year, month: date.month, day: date.day },
    center: { lat: center.lat, lng: center.lng },
    zoom: raw.zoom,
    layers: [...raw.layers] as EmbedLayer[],
  };
}
