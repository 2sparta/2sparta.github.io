import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RotateCcw } from "lucide-react";
import type { AtlasMapWidget, EmbedLayer } from "@/lib/atlas/embed";
import { EMBED_LAYER_LABELS } from "@/lib/atlas/embed";
import { formatWorldDate, uniqueWorldPlaces } from "@/lib/atlas/world";
import { eventsInPeriod, type MapEvent } from "@/lib/atlas/learning";
import { activePlaces } from "@/lib/atlas/model";
import { ALL_PLACES } from "@/lib/atlas/places";
import { loadSchoolAtlas } from "@/lib/atlas/edits-api";
import { applyAtlasEdits } from "@/lib/atlas/edits";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "./session-gate";
import { useWorldSnapshot, useAtlasPhysical } from "./atlas-data";
import { HistoricalMapCanvas } from "./historical-map-canvas";
import { MapEventCard } from "./atlas-learning-panel";
export type MapCapture = { center: { lat: number; lng: number }; zoom: number };
export function EmbeddedHistoricalMap({
  widget: w,
  onCapture,
}: {
  widget: AtlasMapWidget;
  onCapture?: (view: MapCapture) => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk",
    snapshot = useWorldSnapshot(w.date),
    physical = useAtlasPhysical(),
    profile = useMeQuery().data?.profile;
  const manual = useQuery({
    queryKey: ["atlas-manual", profile?.schoolId, profile?.userId],
    queryFn: loadSchoolAtlas,
    enabled: Boolean(profile?.schoolId),
    staleTime: 30_000,
  });
  const edited = useMemo(
    () => applyAtlasEdits(snapshot.collection, manual.data?.entries ?? [], w.date.year),
    [snapshot.collection, manual.data?.entries, w.date.year],
  );
  const [localLayers, setLocalLayers] = useState<EmbedLayer[] | null>(null),
    [reset, setReset] = useState(0),
    [event, setEvent] = useState<MapEvent>();
  useEffect(() => {
    setLocalLayers(null);
    setEvent(undefined);
  }, [w.layers, w.date.year, w.date.month, w.date.day]);
  const layers = localLayers ?? w.layers,
    has = (layer: EmbedLayer) => layers.includes(layer);
  const viewport = useMemo(
    () => ({ ...w.center, zoom: w.zoom, key: reset }),
    [w.center.lat, w.center.lng, w.zoom, reset],
  );
  const current = useRef<MapCapture>({ center: w.center, zoom: w.zoom });
  const rememberView = useCallback((v: { lat: number; lng: number; zoom: number }) => {
    current.current = {
      center: {
        lat: Math.round(Math.max(-85, Math.min(85, v.lat)) * 1e5) / 1e5,
        lng: Math.round(Math.max(-180, Math.min(180, v.lng)) * 1e5) / 1e5,
      },
      zoom: v.zoom,
    };
  }, []);
  const historical = useMemo(
    () =>
      edited && {
        ...edited,
        features: edited.features.filter(
          (f) =>
            f.properties.layer !== "land" &&
            (f.properties.layer !== "occupation" || layers.includes("occupations")) &&
            (f.properties.layer !== "cossack" || layers.includes("cossacks")) &&
            (f.properties.layer !== "colony" || layers.includes("colonies")) &&
            f.properties.worldOverlay !== "front",
        ),
      },
    [edited, layers],
  );
  const places = useMemo(
    () => uniqueWorldPlaces(activePlaces(ALL_PLACES, w.date.year)).filter((p) => p.type === "city"),
    [w.date.year],
  );
  const events = useMemo(() => eventsInPeriod(w.date.year - 10, w.date.year + 10), [w.date.year]),
    noSelection = useCallback(() => {}, []);
  const url = `/app/materials?section=useful&tool=atlas&view=world&year=${w.date.year}&month=${w.date.month}&day=${w.date.day}`;
  return (
    <section
      aria-label={w.title}
      className="my-4 min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <h3 className="font-display font-extrabold">{w.title}</h3>
          <p className="text-xs text-forest-mid">{formatWorldDate(w.date, uk)}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-forest-mid"
        >
          {uk ? "Відкрити атлас" : "Open atlas"}
          <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="space-y-3 p-3">
        {snapshot.error || physical.isError ? (
          <p role="alert" className="text-sm text-terracotta">
            {uk ? "Не вдалося завантажити мапу." : "Map could not be loaded."}{" "}
            <button
              type="button"
              onClick={() => {
                snapshot.retry();
                void physical.refetch();
              }}
              className="underline"
            >
              {uk ? "Повторити" : "Retry"}
            </button>
          </p>
        ) : snapshot.loading || physical.isPending ? (
          <p role="status" className="text-sm text-muted">
            {uk ? "Завантажуємо фрагмент мапи…" : "Loading map fragment…"}
          </p>
        ) : null}
        {manual.isError && (
          <p role="status" className="text-xs text-terracotta">
            {uk ? "Не вдалося оновити шкільні правки." : "School edits could not be refreshed."}
          </p>
        )}
        <HistoricalMapCanvas
          historical={historical}
          land={physical.data?.land}
          rivers={physical.data?.rivers}
          places={has("cities") ? places : []}
          view="world"
          uk={uk}
          borders={has("borders")}
          riverLayer={has("rivers")}
          onPlace={noSelection}
          onPolity={noSelection}
          viewport={viewport}
          onViewport={rememberView}
          compact
          events={has("events") ? events : []}
          selectedEvent={event?.id}
          onEvent={setEvent}
        />
        <div className="flex flex-wrap items-center gap-3">
          {w.layers.map((layer) => (
            <label key={layer} className="flex min-h-9 items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={has(layer)}
                onChange={(e) =>
                  setLocalLayers(
                    e.target.checked ? [...layers, layer] : layers.filter((l) => l !== layer),
                  )
                }
              />
              {EMBED_LAYER_LABELS[layer][uk ? 0 : 1]}
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              setLocalLayers(null);
              setEvent(undefined);
              setReset((n) => n + 1);
            }}
            className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs"
          >
            <RotateCcw className="size-3" />
            {uk ? "Початковий вигляд" : "Reset view"}
          </button>
        </div>
        {onCapture && (
          <button
            type="button"
            onClick={() => onCapture(current.current)}
            className="min-h-11 rounded-full bg-forest px-4 text-sm font-bold text-paper"
          >
            {uk ? "Зберегти цей ракурс у віджеті" : "Save this view in the widget"}
          </button>
        )}
        <p className="text-xs text-muted">
          {uk
            ? "Останні доступні контури до заданої дати; географія узагальнена. Події: ±10 років. Зміна вигляду читачем не редагує статтю."
            : "Last available contours before this date; generalized geography. Events: ±10 years. Reader view changes do not edit the article."}{" "}
          {snapshot.frame && `${uk ? "Зріз" : "Snapshot"}: ${formatWorldDate(snapshot.frame, uk)}.`}
        </p>
        {event && <MapEventCard event={event} onClose={() => setEvent(undefined)} />}
      </div>
    </section>
  );
}
