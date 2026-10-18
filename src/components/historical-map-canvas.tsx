import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Position } from "geojson";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { ensureAtlasHatch } from "@/lib/atlas/hatching";
import {
  editRing,
  geometryParts,
  matchesAtlasTarget,
  openRing,
  type TerritoryGeometry,
} from "@/lib/atlas/edits";
import type { AtlasCanvasEdit } from "./atlas-editing-panel";
import type { ByzantineFrame } from "@/lib/atlas/byzantine";
import {
  historicalName,
  polityColor,
  type AtlasPlace,
  type AtlasView,
  type HistoricalCollection,
  type HistoricalFeature,
} from "@/lib/atlas/model";

export const ATLAS_BOUNDS: Record<AtlasView, Leaflet.LatLngBoundsExpression> = {
  mongols: [
    [10, 15],
    [65, 140],
  ],
  hordes: [
    [35, 20],
    [62, 105],
  ],
  mughals: [
    [5, 60],
    [38, 97],
  ],
  france: [
    [40, -6],
    [52, 11],
  ],
  franks: [
    [39, -7],
    [55, 19],
  ],
  byzantium: [
    [27, 9],
    [47, 47],
  ],
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
  sourceRaster,
  edit,
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
  sourceRaster?: ByzantineFrame["raster"];
  edit?: AtlasCanvasEdit;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editRef = useRef(edit);
  const snapRef = useRef<(p: Position) => Position>((p) => p);
  editRef.current = edit;
  const hatchPrefix = useRef(`atlas-hatch-${Math.random().toString(36).slice(2)}`);
  const [editViewport, setEditViewport] = useState(0);
  const [runtime, setRuntime] = useState<{ L: typeof Leaflet; map: Leaflet.Map } | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(4);
  const [rasterStatus, setRasterStatus] = useState<"loading" | "ready" | "error" | null>(null);
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
        instance.attributionControl.addAttribution(
          '<a href="https://lucius-note.net/byzantium/" target="_blank" rel="noopener noreferrer">Візантія: ©Lucius</a>',
        );
        instance.attributionControl.addAttribution(
          '<a href="/atlas/franks/NOTICE.md" target="_blank" rel="noopener noreferrer">Франки: Sémhur, Trasamundo (CC BY-SA 3.0), Romain0 (PD)</a>',
        );
        instance.attributionControl.addAttribution(
          '<a href="/atlas/rus/NOTICE.md" target="_blank" rel="noopener noreferrer">Русь: Unochepassava94, Koryakov Yuri, Das Steinerne Herz, Redx360, Hellerick, Mnohohrishnyi · CC BY-SA / CC0</a>',
        );
        instance.attributionControl.addAttribution(
          '<a href="/atlas/mongols/NOTICE.md" target="_blank" rel="noopener noreferrer">Монголи / Моголи: Cattette, Gabagool, Elvonudinium, Avantiputra7, Joppen · CC BY / BY-SA</a>',
        );
        instance.createPane("atlas-original").style.zIndex = "410";
        instance.getPane("atlas-original")!.style.pointerEvents = "none";
        instance.createPane("atlas-markers").style.zIndex = "430";
        instance.createPane("atlas-custom").style.zIndex = "420";
        instance.createPane("atlas-edit").style.zIndex = "450";
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
    if (!runtime || !sourceRaster) {
      setRasterStatus(null);
      return;
    }
    setRasterStatus("loading");
    const layer = runtime.L.imageOverlay(`/${sourceRaster.path}`, sourceRaster.bounds, {
      pane: "atlas-original",
      interactive: false,
      opacity: 1,
      alt: uk ? "Геоприв’язаний авторський шар Візантії" : "Georeferenced Byzantine source map",
    });
    layer.on("load", () => setRasterStatus("ready"));
    layer.on("error", () => setRasterStatus("error"));
    layer.addTo(runtime.map);
    // Remove first: Leaflet's internal remove listener detaches map move/zoom handlers.
    return () => {
      layer.remove();
      layer.off();
    };
  }, [runtime, sourceRaster, uk]);
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
    let customRenderer: Leaflet.SVG | undefined;
    if (land)
      L.geoJSON(land, {
        interactive: false,
        style: { color: "var(--atlas-coast)", weight: 0.65, fillColor: "var(--atlas-land)", fillOpacity: 1 },
      }).addTo(layers);
    if (borders && historical)
      L.geoJSON(
        {
          ...historical,
          features: historical.features.filter(
            (f) => !f.properties.custom && f.properties.control !== "relative",
          ),
        } as HistoricalCollection,
        {
          style: (feature) => {
            const p = feature!.properties;
            return {
              color: p.invaded
                ? "#c52d27"
                : feature!.id === selected
                  ? "#8e173b"
                  : p.region === "franks"
                    ? "#606f85"
                    : p.detailed
                      ? "#a56177"
                      : "#9aa5b0",
              weight: p.invaded ? 2.3 : feature!.id === selected ? 2.5 : p.detailed ? 0.9 : 0.65,
              fillColor: p.color ?? polityColor(p.subject),
              fillOpacity: feature!.id === selected ? 0.9 : p.detailed ? 1 : 0.23,
              dashArray: p.invaded ? "6 3" : p.precision === 1 ? "4 3" : undefined,
            };
          },
          onEachFeature: (feature, layer) => {
            const label = document.createElement("span");
            label.textContent =
              historicalName(feature.properties.name, uk) +
              (feature.properties.invaded
                ? uk
                  ? " · головний осередок розорено"
                  : " · main centre sacked"
                : "");
            layer.bindTooltip(label, { sticky: true });
            layer.on("click", () => onPolity(feature as HistoricalFeature));
          },
        },
      ).addTo(layers);
    if (borders && historical) {
      const custom = historical.features
        .filter((f) => f.properties.custom || f.properties.control === "relative")
        .sort(
          (a, b) =>
            Number(a.properties.control === "relative") -
            Number(b.properties.control === "relative"),
        );
      if (custom.length) {
        customRenderer = L.svg({ pane: "atlas-custom" });
        L.geoJSON({ type: "FeatureCollection", features: custom } as HistoricalCollection, {
          style: (feature) => {
            const p = feature!.properties;
            const color = p.color ?? polityColor(p.subject);
            return {
              renderer: customRenderer,
              pane: "atlas-custom",
              color: feature!.id === selected ? "#122f27" : color,
              weight: feature!.id === selected ? 2.8 : 1.7,
              dashArray: p.control === "relative" ? "5 3" : undefined,
              fillColor:
                p.control === "relative"
                  ? `url(#${hatchPrefix.current}-${color.replace("#", "")})`
                  : color,
              fillOpacity: p.control === "relative" ? 1 : 0.7,
            };
          },
          onEachFeature: (feature, layer) => {
            const label = document.createElement("span");
            label.textContent =
              historicalName(feature.properties.name, uk) +
              (feature.properties.control === "relative"
                ? ` · ${feature.properties.relation ?? (uk ? "неповний контроль" : "partial control")}`
                : "");
            layer.bindTooltip(label, { sticky: true });
            layer.on("click", () => onPolity(feature as HistoricalFeature));
          },
        }).addTo(layers);
        const svg = map.getPane("atlas-custom")?.querySelector("svg");
        if (svg)
          for (const f of custom.filter((f) => f.properties.control === "relative")) {
            const color = f.properties.color ?? polityColor(f.properties.subject);
            ensureAtlasHatch(svg, `${hatchPrefix.current}-${color.replace("#", "")}`, color);
          }
      }
    }
    if (riverLayer && rivers)
      L.geoJSON(rivers, {
        style: { color: "var(--atlas-river)", weight: 1.05, opacity: 0.8 },
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
    if (!sourceRaster && (view === "byzantium" || view === "europe")) {
      for (const [lat, lng, name] of [
        [42, 34, uk ? "Чорне море" : "Black Sea"],
        [37, 24.5, uk ? "Егейське море" : "Aegean Sea"],
        [33, 18, uk ? "Середземне море" : "Mediterranean Sea"],
        [42.5, 15.5, uk ? "Адріатичне море" : "Adriatic Sea"],
      ] as const) {
        const label = document.createElement("span");
        label.textContent = name;
        L.marker([lat, lng], {
          interactive: false,
          keyboard: false,
          pane: "atlas-markers",
          icon: L.divIcon({
            className: "atlas-sea-label",
            html: label,
            iconSize: [140, 20],
            iconAnchor: [70, 10],
          }),
        }).addTo(layers);
      }
    }
    for (const place of places) {
      const isCity = place.type === "city";
      const active = place.id === selected;
      const marker = place.capital
        ? L.marker([place.lat, place.lng], {
            pane: "atlas-markers",
            interactive: !edit,
            icon: L.divIcon({
              className: "atlas-capital",
              html: "",
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            }),
          })
        : L.circleMarker([place.lat, place.lng], {
            pane: "atlas-markers",
            interactive: !edit,
            radius: active ? 9 : isCity ? 4.5 : 7,
            color: active
              ? "#122f27"
              : place.campaign === "sack"
                ? "#c52d27"
                : place.campaign === "battle"
                  ? "#b96a11"
                  : isCity
                    ? "#222222"
                    : "#984b33",
            weight: active ? 3 : 1.5,
            fillColor:
              place.campaign === "sack"
                ? "#c52d27"
                : place.campaign === "battle"
                  ? "#d89535"
                  : place.byzantine
                    ? "#e33130"
                    : isCity
                      ? "#222222"
                      : "#c87c54",
            fillOpacity: isCity ? 1 : 0.3,
            dashArray: isCity ? undefined : "3 3",
          });
      const label = document.createElement("span");
      label.textContent = place.name;
      marker.bindTooltip(label, {
        permanent:
          active ||
          (Boolean(place.campaign) && zoom >= 4.5) ||
          place.capital ||
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
      customRenderer?.remove();
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
    sourceRaster,
    Boolean(edit),
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
  useEffect(() => {
    snapRef.current = (p) => p;
    if (!runtime || !edit?.snap || !historical) return;
    const { L, map } = runtime;
    const group = L.layerGroup().addTo(map);
    const grid = new Map<string, { point: Position; x: number; y: number }[]>();
    const bounds = map.getBounds().pad(0.1);
    let shown = 0;
    const seen = new Set<string>();
    for (const f of historical.features) {
      if (
        !["Polygon", "MultiPolygon"].includes(f.geometry.type) ||
        String(f.id) === `manual-${edit.id}` ||
        (edit.target && matchesAtlasTarget(f, edit.target))
      )
        continue;
      for (const part of geometryParts(f.geometry as TerritoryGeometry))
        for (const ring of part)
          for (const p of openRing(ring)) {
            if (!bounds.contains([p[1], p[0]])) continue;
            const key = p.join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            const screen = map.latLngToContainerPoint([p[1], p[0]]);
            const cell = `${Math.floor(screen.x / 12)},${Math.floor(screen.y / 12)}`;
            const bucket = grid.get(cell) ?? [];
            bucket.push({ point: p, x: screen.x, y: screen.y });
            grid.set(cell, bucket);
            if (shown++ < 1500)
              L.circleMarker([p[1], p[0]], {
                pane: "atlas-edit",
                radius: 3,
                interactive: false,
                color: "#bd6715",
                weight: 1,
                fillColor: "#f8b64d",
                fillOpacity: 0.8,
              }).addTo(group);
          }
    }
    snapRef.current = (p) => {
      const screen = map.latLngToContainerPoint([p[1], p[0]]);
      const cx = Math.floor(screen.x / 12),
        cy = Math.floor(screen.y / 12);
      let best = p,
        distance = 12 * 12;
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let y = cy - 1; y <= cy + 1; y++)
          for (const candidate of grid.get(`${x},${y}`) ?? []) {
            const d = (screen.x - candidate.x) ** 2 + (screen.y - candidate.y) ** 2;
            if (d <= distance) {
              best = candidate.point;
              distance = d;
            }
          }
      return [...best];
    };
    return () => {
      group.remove();
      snapRef.current = (p) => p;
    };
  }, [runtime, historical, edit?.id, edit?.snap, editViewport]);
  useEffect(() => {
    if (!runtime) return;
    const { L, map } = runtime;
    const add = (event: Leaflet.LeafletMouseEvent) => {
      const current = editRef.current;
      if (!current || current.disabled || current.mode !== "draw") return;
      const p = map.wrapLatLng(event.latlng);
      const points = openRing(geometryParts(current.geometry)[current.part][current.ring]);
      current.onGeometry(
        editRing(current.geometry, current.part, current.ring, [
          ...points,
          snapRef.current([p.lng, p.lat]),
        ]),
      );
    };
    const moved = () => setEditViewport((v) => v + 1);
    map.on("click", add);
    map.on("moveend zoomend", moved);
    return () => {
      map.off("click", add);
      map.off("moveend zoomend", moved);
    };
  }, [runtime]);
  useEffect(() => {
    if (!runtime || !edit) return;
    const { L, map } = runtime;
    const group = L.layerGroup().addTo(map);
    const renderer = L.svg({ pane: "atlas-edit" });
    const latlngs = (g: TerritoryGeometry): Leaflet.LatLngExpression[][][] =>
      geometryParts(g)
        .filter((p) => p[0].length >= 3)
        .map((p) =>
          p
            .filter((r) => r.length >= 3)
            .map((r) => r.map((c) => [c[1], c[0]] as Leaflet.LatLngExpression)),
        );
    const preview = L.polygon(latlngs(edit.geometry), {
      renderer,
      pane: "atlas-edit",
      interactive: false,
      color: "#0d654b",
      weight: 2,
      fillColor: edit.control === "relative" ? `url(#${hatchPrefix.current}-draft)` : edit.color,
      fillOpacity: edit.control === "relative" ? 1 : 0.25,
      dashArray: "6 3",
    }).addTo(group);
    const svg = map.getPane("atlas-edit")?.querySelector("svg");
    if (svg && edit.control === "relative")
      ensureAtlasHatch(svg, `${hatchPrefix.current}-draft`, edit.color);
    const points = openRing(geometryParts(edit.geometry)[edit.part][edit.ring]);
    const line = L.polyline(
      points.map((p) => [p[1], p[0]]),
      { renderer, pane: "atlas-edit", interactive: false, color: "#177cbe", weight: 2 },
    ).addTo(group);
    const bounds = map.getBounds().pad(0.05);
    const visible = points
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => bounds.contains([p[1], p[0]]));
    const center = map.getCenter();
    visible.sort(
      (a, b) =>
        L.latLng(a.p[1], a.p[0]).distanceTo(center) - L.latLng(b.p[1], b.p[0]).distanceTo(center),
    );
    const handles = visible.slice(0, 500);
    if (edit.vertex !== null && !handles.some((x) => x.i === edit.vertex) && points[edit.vertex])
      handles.push({ p: points[edit.vertex], i: edit.vertex });
    for (const { p, i } of handles) {
      const marker = L.marker([p[1], p[0]], {
        pane: "atlas-edit",
        draggable: !edit.disabled,
        autoPan: true,
        icon: L.divIcon({
          className: "atlas-edit-vertex",
          html: String(i + 1),
          iconSize: edit.vertex === i ? [26, 26] : [20, 20],
          iconAnchor: edit.vertex === i ? [13, 13] : [10, 10],
        }),
      }).addTo(group);
      marker.bindTooltip(`${uk ? "Точка" : "Vertex"} ${i + 1}`);
      marker.on("click", (e: Leaflet.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e.originalEvent);
        editRef.current?.onSelectVertex(i);
      });
      marker.on("drag", () => {
        const ps = structuredClone(points);
        const loc = map.wrapLatLng(marker.getLatLng());
        ps[i] = snapRef.current([loc.lng, loc.lat]);
        preview.setLatLngs(latlngs(editRing(edit.geometry, edit.part, edit.ring, ps)));
        line.setLatLngs(ps.map((p) => [p[1], p[0]]));
      });
      marker.on("dragend", () => {
        const current = editRef.current;
        if (!current || current.disabled) return;
        const ps = openRing(geometryParts(current.geometry)[current.part][current.ring]);
        const loc = map.wrapLatLng(marker.getLatLng());
        ps[i] = snapRef.current([loc.lng, loc.lat]);
        marker.setLatLng([ps[i][1], ps[i][0]]);
        current.onGeometry(editRing(current.geometry, current.part, current.ring, ps));
      });
      if (points.length > 1) {
        const next = points[(i + 1) % points.length];
        const middle: Leaflet.LatLngExpression = [(p[1] + next[1]) / 2, (p[0] + next[0]) / 2];
        const add = L.marker(middle, {
          pane: "atlas-edit",
          icon: L.divIcon({
            className: "atlas-edit-midpoint",
            html: "+",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(group);
        add.bindTooltip(uk ? "Вставити точку" : "Insert vertex");
        add.on("click", (e: Leaflet.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          const current = editRef.current;
          if (!current || current.disabled) return;
          const ps = openRing(geometryParts(current.geometry)[current.part][current.ring]);
          ps.splice(i + 1, 0, [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2]);
          current.onGeometry(editRing(current.geometry, current.part, current.ring, ps));
        });
      }
    }
    return () => {
      group.remove();
      renderer.remove();
    };
  }, [
    runtime,
    edit?.geometry,
    edit?.part,
    edit?.ring,
    edit?.vertex,
    edit?.control,
    edit?.color,
    edit?.disabled,
    editViewport,
    uk,
  ]);
  useEffect(() => {
    if (!runtime) return;
    const node = runtime.map.getContainer();
    node.classList.toggle("atlas-drawing", edit?.mode === "draw" && !edit.disabled);
    if (edit?.mode === "draw") runtime.map.doubleClickZoom.disable();
    else runtime.map.doubleClickZoom.enable();
    return () => node.classList.remove("atlas-drawing");
  }, [runtime, edit?.mode, edit?.disabled]);
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
      {sourceRaster && rasterStatus !== "ready" && (
        <p
          role={rasterStatus === "error" ? "alert" : "status"}
          className="absolute left-3 right-3 top-3 z-[500] rounded-xl bg-white/95 p-2 text-xs text-[#292929]"
        >
          {rasterStatus === "error"
            ? uk
              ? "Авторський шар не завантажено. Векторні контури доступні; вимкніть і ввімкніть шар, щоб повторити."
              : "Source layer unavailable; vector contours remain. Toggle the layer to retry."
            : uk
              ? "Завантаження авторських деталей…"
              : "Loading source details…"}
        </p>
      )}
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
