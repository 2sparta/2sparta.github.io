import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  historicalName,
  polityColor,
  type AtlasPlace,
  type AtlasView,
  type HistoricalCollection,
  type HistoricalFeature,
} from "@/lib/atlas/model";

export const ATLAS_BOUNDS: Record<AtlasView, Leaflet.LatLngBoundsExpression> = {
  rus: [
    [43, 21],
    [62, 51],
  ],
  europe: [
    [33, -13],
    [65, 55],
  ],
  world: [
    [-57, -170],
    [78, 180],
  ],
};
export function HistoricalMapCanvas({
  historical,
  land,
  rivers,
  places,
  view,
  uk,
  borders,
  riverLayer,
  selected,
  onPlace,
  onPolity,
}: {
  historical?: HistoricalCollection;
  land?: FeatureCollection;
  rivers?: FeatureCollection;
  places: AtlasPlace[];
  view: AtlasView;
  uk: boolean;
  borders: boolean;
  riverLayer: boolean;
  selected?: string;
  onPlace: (place: AtlasPlace) => void;
  onPolity: (feature: HistoricalFeature) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<{ L: typeof Leaflet; map: Leaflet.Map } | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(4);
  useEffect(() => {
    let stopped = false;
    let instance: Leaflet.Map | undefined;
    void import("leaflet")
      .then((L) => {
        if (stopped || !container.current) return;
        instance = L.map(container.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          minZoom: 1,
          maxZoom: 8,
          zoomSnap: 0.25,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
        });
        instance.fitBounds(ATLAS_BOUNDS.rus);
        instance.attributionControl.setPrefix(false);
        instance.attributionControl.addAttribution(
          '<a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener noreferrer">Historical Basemaps (GPL-3.0)</a> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>',
        );
        L.control.scale({ imperial: false }).addTo(instance);
        setRuntime({ L, map: instance });
      })
      .catch(() => {
        if (!stopped) setError(true);
      });
    return () => {
      stopped = true;
      instance?.remove();
    };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const update = () => setZoom(runtime.map.getZoom());
    runtime.map.on("zoomend", update);
    update();
    return () => {
      runtime.map.off("zoomend", update);
    };
  }, [runtime]);
  useEffect(() => {
    if (!runtime) return;
    const control = runtime.L.control
      .zoom({
        zoomInTitle: uk ? "Збільшити" : "Zoom in",
        zoomOutTitle: uk ? "Зменшити" : "Zoom out",
      })
      .addTo(runtime.map);
    return () => {
      control.remove();
    };
  }, [runtime, uk]);
  useEffect(() => {
    if (!runtime) return;
    runtime.map.fitBounds(ATLAS_BOUNDS[view], { padding: [12, 12], animate: false });
  }, [runtime, view]);
  useEffect(() => {
    if (!runtime || !container.current) return;
    const resize = () => runtime.map.invalidateSize({ animate: false });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    observer?.observe(container.current);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [runtime]);
  useEffect(() => {
    if (!runtime) return;
    const { L, map } = runtime;
    const layers = L.layerGroup().addTo(map);
    if (land)
      L.geoJSON(land, {
        interactive: false,
        style: { color: "#c8bca0", weight: 0.7, fillColor: "#efe8d7", fillOpacity: 1 },
      }).addTo(layers);
    if (borders && historical)
      L.geoJSON(historical, {
        style: (feature) => {
          const p = feature!.properties;
          return {
            color: feature!.id === selected ? "#163f33" : "#62574a",
            weight: feature!.id === selected ? 2.5 : 0.8,
            fillColor: polityColor(p.subject),
            fillOpacity: feature!.id === selected ? 0.65 : 0.38,
            dashArray: p.precision === 1 ? "4 3" : undefined,
          };
        },
        onEachFeature: (feature, layer) => {
          const label = document.createElement("span");
          label.textContent = historicalName(feature.properties.name, uk);
          layer.bindTooltip(label, { sticky: true });
          layer.on("click", () => onPolity(feature as HistoricalFeature));
        },
      }).addTo(layers);
    if (riverLayer && rivers)
      L.geoJSON(rivers, {
        style: { color: "#477f9a", weight: 1.2, opacity: 0.8 },
        onEachFeature: (feature, layer) => {
          const label = document.createElement("span");
          const name = feature.properties?.name ?? "";
          const names: Record<string, string> = {
            Dnipro: "Дніпро",
            Dnepre: "Дніпро",
            Dniester: "Дністер",
            Don: "Дон",
            Volga: "Волга",
            Vistula: "Вісла",
            Danube: "Дунай",
            Donau: "Дунай",
          };
          label.textContent = uk ? (names[name] ?? name) : name;
          layer.bindTooltip(label);
        },
      }).addTo(layers);
    for (const place of places) {
      const isCity = place.type === "city";
      const active = place.id === selected;
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: active ? 9 : isCity ? 4.5 : 7,
        color: active ? "#122f27" : isCity ? "#59452d" : "#984b33",
        weight: active ? 3 : 1.5,
        fillColor: isCity ? "#e7c477" : "#c87c54",
        fillOpacity: isCity ? 1 : 0.3,
        dashArray: isCity ? undefined : "3 3",
      });
      const label = document.createElement("span");
      label.textContent = place.name;
      marker.bindTooltip(label, {
        permanent:
          active ||
          (isCity &&
            view === "rus" &&
            (zoom >= 6 || ["kyiv-city", "halych-city"].includes(place.id))),
        direction: "top",
        offset: [0, -5],
        className: "atlas-label",
      });
      marker.on("click", () => onPlace(place));
      marker.addTo(layers);
    }
    return () => {
      layers.remove();
    };
  }, [
    runtime,
    historical,
    land,
    rivers,
    places,
    view,
    uk,
    borders,
    riverLayer,
    selected,
    zoom,
    onPlace,
    onPolity,
  ]);
  useEffect(() => {
    if (!runtime || !selected) return;
    const place = places.find((p) => p.id === selected);
    if (place) runtime.map.panTo([place.lat, place.lng], { animate: false });
    else if (historical) {
      const f = historical.features.find((f) => f.id === selected);
      if (f)
        runtime.map.fitBounds(runtime.L.geoJSON(f).getBounds(), {
          maxZoom: 5,
          padding: [24, 24],
          animate: false,
        });
    }
  }, [runtime, selected, places, historical]);
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-hairline">
      <div
        ref={container}
        className="atlas-map h-[min(65dvh,620px)] min-h-[360px] w-full bg-[#cddde0]"
        role="region"
        aria-label={
          uk
            ? "Інтерактивна історична мапа. Стрілки — переміщення, плюс і мінус — масштаб."
            : "Historical map. Arrow keys pan; plus and minus zoom."
        }
      />
      {!runtime && !error && (
        <p role="status" className="absolute inset-0 grid place-items-center bg-surface/90 text-sm">
          {uk ? "Відкриваємо мапу…" : "Opening map…"}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="absolute inset-0 grid place-items-center bg-surface/90 p-6 text-sm"
        >
          {uk
            ? "Не вдалося відкрити мапу. Історичні картки й джерела доступні нижче."
            : "Could not open map. Historical notes and sources remain available below."}
        </p>
      )}
    </div>
  );
}
