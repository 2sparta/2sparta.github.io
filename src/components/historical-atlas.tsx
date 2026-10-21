import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  MapPin,
  Search,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
import { ATLAS_EVENTS, ATLAS_PLACES, ATLAS_SOURCES } from "@/lib/atlas/content";
import { ANTIQUITY_EVENTS, ANTIQUITY_PLACES, formatAtlasYear } from "@/lib/atlas/antiquity";
import { GERMANY_EVENTS, GERMANY_PLACES } from "@/lib/atlas/germany";
import { NAPOLEON_EVENTS, NAPOLEON_PLACES } from "@/lib/atlas/napoleon";
import { ISLES_PLACES, islesEventsFor } from "@/lib/atlas/isles";
import { BYZANTINE_EVENTS, BYZANTINE_PLACES } from "@/lib/atlas/byzantine";
import { FRANKISH_EVENTS, FRANKISH_PLACES } from "@/lib/atlas/frankish";
import { RUS_EVENTS, RUS_PLACES } from "@/lib/atlas/rus";
import { MONGOL_EVENTS, mongolPlacesAt, campaignPlaces } from "@/lib/atlas/mongols";
import { FRANCE_EVENTS, FRANCE_PLACES } from "@/lib/atlas/france";
import {
  COMMONWEALTH_EVENTS,
  COMMONWEALTH_PLACES,
  cossackPlacesAt,
  occupationPlacesAt,
} from "@/lib/atlas/commonwealth";
import { SPAIN_EVENTS, SPAIN_PLACES, spanishCampaignPlaces } from "@/lib/atlas/spain";
import { ENGLAND_EVENTS, ENGLAND_PLACES } from "@/lib/atlas/england";
import {
  activePlaces,
  historicalName,
  polityColor,
  validateHistoricalCollection,
  type AtlasView,
  type AtlasPlace,
  type HistoricalFeature,
} from "@/lib/atlas/model";
import {
  applyWorldPatch,
  compareWorldDates,
  formatWorldDate,
  shiftWorldDay,
  uniqueWorldPlaces,
  validateWorldManifest,
  validateWorldPatch,
  worldDate,
  worldDateKey,
  worldFrameAt,
  WORLD_MIN_YEAR,
  WORLD_MAX_YEAR,
} from "@/lib/atlas/world";
import type { AtlasDate } from "@/lib/atlas/date";
import { useMeQuery } from "./session-gate";
import { AtlasEditingPanel, useAtlasEditor } from "./atlas-editing-panel";
import { loadSchoolAtlas, saveSchoolAtlas } from "@/lib/atlas/edits-api";
import {
  applyAtlasEdits,
  atlasEditError,
  newAtlasEdit,
  validateAtlasEdits,
  type AtlasEdit,
} from "@/lib/atlas/edits";
import { saveSharedBorders } from "@/lib/atlas/borders";
import { HistoricalMapCanvas } from "./historical-map-canvas";
import { Panel, PillButton, TextInput } from "./ui/panel";

async function jsonFile(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("ATLAS_DOWNLOAD");
  return response.json();
}
function Sources({ ids }: { ids: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-xs">
      {[...new Set(ids)]
        .map((id) => ATLAS_SOURCES.find((s) => s.id === id))
        .filter(Boolean)
        .map((source) => (
          <li key={source!.id}>
            <a
              href={source!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-forest-mid underline underline-offset-4"
            >
              {source!.title}
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </li>
        ))}
    </ul>
  );
}
const ALL_PLACES = [
  ...ATLAS_PLACES,
  ...BYZANTINE_PLACES,
  ...FRANKISH_PLACES,
  ...RUS_PLACES,
  ...FRANCE_PLACES,
  ...COMMONWEALTH_PLACES,
  ...SPAIN_PLACES,
  ...ENGLAND_PLACES,
  ...ISLES_PLACES,
  ...ANTIQUITY_PLACES,
  ...GERMANY_PLACES,
  ...NAPOLEON_PLACES,
];
const ALL_EVENTS = [
  ...ATLAS_EVENTS,
  ...BYZANTINE_EVENTS,
  ...FRANKISH_EVENTS,
  ...RUS_EVENTS,
  ...FRANCE_EVENTS,
  ...COMMONWEALTH_EVENTS,
  ...SPAIN_EVENTS,
  ...ENGLAND_EVENTS,
  ...islesEventsFor("isles"),
  ...ANTIQUITY_EVENTS,
  ...GERMANY_EVENTS,
  ...NAPOLEON_EVENTS,
  ...MONGOL_EVENTS,
];
const SOURCE_NAMES: Record<string, [string, string]> = {
  world: ["Світова основа", "World background"],
  mongols: ["Монгольські держави та Моголи", "Mongol realms and Mughals"],
  byzantium: ["Візантія", "Byzantium"],
  franks: ["Франкські держави", "Frankish realms"],
  rus: ["Русь", "Rus"],
  commonwealth: ["Польща, Литва та українські землі", "Poland, Lithuania and Ukrainian lands"],
  spain: ["Іспанія", "Spain"],
  front: ["Фронти в Іспанії", "Spanish fronts"],
};
/** Legacy view URLs open this same map; geography is navigated directly on the canvas. */
export function HistoricalAtlas({
  year,
  month = 1,
  day = 1,
  onChange: onNavigate,
}: {
  year: number;
  month?: number;
  day?: number;
  view?: AtlasView;
  onChange: (year: number, view: AtlasView, date?: Pick<AtlasDate, "month" | "day">) => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const date = worldDate(year, month, day),
    dateKey = worldDateKey(date);
  const editor = useAtlasEditor();
  const profile = useMeQuery().data?.profile;
  const qc = useQueryClient();
  const draftRevision = useRef<number | null>(null);
  const [manualError, setManualError] = useState("");
  const [yearText, setYearText] = useState(String(date.year));
  const [dayText, setDayText] = useState(String(date.day));
  const [borders, setBorders] = useState(true);
  const [cities, setCities] = useState(true);
  const [areas, setAreas] = useState(false);
  const [rivers, setRivers] = useState(true);
  const [lands, setLands] = useState(false);
  const [occupations, setOccupations] = useState(true);
  const [cossacks, setCossacks] = useState(true);
  const [reconquista, setReconquista] = useState(false);
  const [colonies, setColonies] = useState(true);
  const [fronts, setFronts] = useState(true);
  const [search, setSearch] = useState("");
  const [mapReset, setMapReset] = useState(0);
  const [selection, setSelection] = useState<
    { kind: "place"; id: string } | { kind: "polity"; id: string } | null
  >(null);
  const navigate = (next: AtlasDate) => {
    next = worldDate(next.year, next.month, next.day);
    if (editor.draft && worldDateKey(next) !== dateKey) {
      if (
        !window.confirm(
          uk
            ? "Відкинути незбережену правку перед зміною дати?"
            : "Discard the unsaved edit before changing the date?",
        )
      )
        return false;
      editor.dispatch({ type: "cancel" });
    }
    onNavigate(next.year, "world", { month: next.month, day: next.day });
    return true;
  };
  useEffect(() => {
    setYearText(String(date.year));
    setDayText(String(date.day));
    setSelection(null);
  }, [dateKey]);
  useEffect(() => {
    editor.dispatch({ type: "cancel" });
  }, [profile?.schoolId, profile?.userId]);
  const manifest = useQuery({
    queryKey: ["historical-atlas-world-manifest"],
    queryFn: async ({ signal }) =>
      validateWorldManifest(await jsonFile("/atlas/world/manifest.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined",
    retry: 1,
  });
  const frame = worldFrameAt(manifest.data, date);
  const baseRecord = manifest.data?.baseFiles.find((f) => f.year === frame?.baseYear);
  const base = useQuery({
    queryKey: ["historical-atlas-world-base", baseRecord?.year],
    queryFn: async ({ signal }) =>
      validateHistoricalCollection(await jsonFile(`/atlas/world/${baseRecord!.path}`, signal)),
    enabled: Boolean(baseRecord),
    staleTime: Infinity,
    retry: 1,
  });
  const patch = useQuery({
    queryKey: ["historical-atlas-world-patch", frame?.path],
    queryFn: async ({ signal }) => {
      const raw = validateWorldPatch(await jsonFile(`/atlas/world/${frame!.path}`, signal));
      if (raw.baseYear !== frame!.baseYear) throw new Error("INVALID_WORLD_PATCH");
      return raw;
    },
    enabled: Boolean(frame),
    staleTime: Infinity,
    retry: 1,
  });
  const composed = useMemo(() => {
    if (!base.data || !patch.data) return undefined;
    return applyWorldPatch(base.data, patch.data);
  }, [base.data, patch.data]);
  const filtered = useMemo(
    () =>
      composed && {
        ...composed,
        features: composed.features.filter((f) => {
          const p = f.properties;
          return (
            (p.layer !== "land" || (p.worldOverlay === "reconquista" ? reconquista : lands)) &&
            (p.layer !== "occupation" || occupations) &&
            (p.layer !== "cossack" || cossacks) &&
            (p.layer !== "colony" || colonies) &&
            (p.worldOverlay !== "front" || fronts)
          );
        }),
      },
    [composed, lands, occupations, cossacks, reconquista, colonies, fronts],
  );
  const manualKey = ["atlas-manual", profile?.schoolId, profile?.userId];
  const manual = useQuery({
    queryKey: manualKey,
    queryFn: loadSchoolAtlas,
    enabled: Boolean(profile?.schoolId),
    staleTime: 30_000,
    refetchInterval: editor.draft ? false : 60_000,
    refetchOnWindowFocus: !editor.draft,
  });
  const saveManual = useMutation({ mutationFn: saveSchoolAtlas });
  useEffect(() => {
    draftRevision.current = editor.draft ? (manual.data?.revision ?? null) : null;
  }, [editor.draft?.id, profile?.schoolId]);
  const historical = useMemo(
    () => applyAtlasEdits(filtered, manual.data?.entries ?? [], date.year),
    [filtered, manual.data?.entries, date.year],
  );
  const saveEntries = async (entries: AtlasEdit[]) => {
    if (!manual.data?.canEdit || manual.isError || saveManual.isPending || loading || failed)
      return false;
    try {
      const result = await saveManual.mutateAsync({
        schoolId: manual.data.schoolId,
        revision: editor.draft
          ? (draftRevision.current ?? manual.data.revision)
          : manual.data.revision,
        entries,
      });
      qc.setQueryData(manualKey, { ...manual.data, ...result });
      setManualError("");
      toast.success(uk ? "Території збережено для школи" : "School territories saved");
      return true;
    } catch (error) {
      const message = atlasEditError(error, uk);
      setManualError(message);
      toast.error(message);
      return false;
    }
  };
  const saveDraft = async () => {
    if (!editor.draft || !manual.data) return;
    try {
      const entries = validateAtlasEdits(
        saveSharedBorders(manual.data.entries, editor.draft, historical, editor.moves),
      );
      if (await saveEntries(entries)) editor.dispatch({ type: "cancel" });
    } catch (error) {
      const message = atlasEditError(error, uk);
      setManualError(message);
      toast.error(message);
    }
  };
  const physical = useQuery({
    queryKey: ["historical-atlas-physical"],
    queryFn: async ({ signal }) => {
      const [land, rivers] = await Promise.all([
        jsonFile("/atlas/land.geojson", signal),
        jsonFile("/atlas/rivers.geojson", signal),
      ]);
      return { land: land as FeatureCollection, rivers: rivers as FeatureCollection };
    },
    staleTime: Infinity,
    enabled: typeof window !== "undefined",
    retry: 1,
  });
  const available = useMemo(
    () =>
      uniqueWorldPlaces([
        ...activePlaces(ALL_PLACES, date.year),
        ...mongolPlacesAt(date.year),
        ...(date.year >= 1223 && date.year <= 1242 ? campaignPlaces(date.year, "") : []),
        ...(cossacks ? cossackPlacesAt(date.year) : []),
        ...(occupations ? occupationPlacesAt(date.year) : []),
        ...(date.year >= 395 ? spanishCampaignPlaces(date) : []),
      ]).filter((p) => colonies || !p.colonial),
    [date.year, dateKey, cossacks, occupations, colonies],
  );
  const drawn = useMemo(
    () =>
      available.filter((p) =>
        p.type === "city" ? cities : areas || p.cossack || p.occupation || p.campaign,
      ),
    [available, cities, areas],
  );
  const choosePlace = useCallback((p: AtlasPlace) => {
    if (p.type === "city") setCities(true);
    else setAreas(true);
    setSelection({ kind: "place", id: p.id });
  }, []);
  const choosePolity = useCallback(
    (f: HistoricalFeature) => {
      if (!editor.draft) setSelection({ kind: "polity", id: String(f.id) });
    },
    [Boolean(editor.draft)],
  );
  const selectedPlace =
    selection?.kind === "place" ? available.find((p) => p.id === selection.id) : undefined;
  const selectedPolity =
    selection?.kind === "polity"
      ? historical?.features.find((f) => String(f.id) === selection.id)
      : undefined;
  const term = search.trim().toLocaleLowerCase(uk ? "uk" : "en");
  const matchingPlaces = available.filter((p) =>
    `${p.name} ${p.description}`.toLocaleLowerCase(uk ? "uk" : "en").includes(term),
  );
  const matchingPolities =
    historical?.features.filter((f) =>
      `${historicalName(f.properties.name, uk)} ${f.properties.name} ${historicalName(f.properties.subject, uk)}`
        .toLocaleLowerCase(uk ? "uk" : "en")
        .includes(term),
    ) ?? [];
  const eventDate = (e: { year: number; month?: number; day?: number }) =>
    worldDate(e.year, e.month, e.day);
  const nearby = [
    ...new Map(
      ALL_EVENTS.map((e) => [`${e.year}-${e.month ?? 1}-${e.day ?? 1}-${e.title}`, e]),
    ).values(),
  ]
    .filter((e) => Math.abs(e.year - date.year) <= 150)
    .sort((a, b) => Math.abs(a.year - date.year) - Math.abs(b.year - date.year))
    .slice(0, 8)
    .sort((a, b) => compareWorldDates(eventDate(a), eventDate(b)));
  const frames = manifest.data?.frames ?? [];
  const previousFrame = [...frames].reverse().find((f) => compareWorldDates(f, date) < 0);
  const nextFrame = frames.find((f) => compareWorldDates(f, date) > 0);
  const quickDates = frames
    .filter((f) => Math.abs(f.year - date.year) <= 50)
    .sort((a, b) => Math.abs(a.year - date.year) - Math.abs(b.year - date.year))
    .slice(0, 8)
    .sort(compareWorldDates);
  const queries = [manifest, base, patch, physical];
  const failed = queries.some((q) => q.isError);
  const loading =
    manifest.isPending ||
    Boolean(frame && (base.isPending || patch.isPending)) ||
    physical.isPending;
  const sourceFront = frame?.sources.find((s) => s.name === "front");
  const states =
    historical?.features.filter((f) => f.properties.layer === "state" || !f.properties.layer) ?? [];
  const legend = [
    ...new Map(
      states
        .filter(
          (f) => f.properties.region === "commonwealth" && f.properties.name.includes("partition"),
        )
        .map((f) => [f.properties.subject, f]),
    ).values(),
  ];
  const checkboxes: [string, boolean, (v: boolean) => void][] = [
    [uk ? "Держави й кордони" : "States and borders", borders, setBorders],
    [uk ? "Міста" : "Cities", cities, setCities],
    [uk ? "Річки" : "Rivers", rivers, setRivers],
    [uk ? "Регіональні осередки" : "Regional references", areas, setAreas],
    [uk ? "Історичні українські землі" : "Historical Ukrainian lands", lands, setLands],
    [uk ? "Окупації · штрихування" : "Occupations · hatching", occupations, setOccupations],
    [
      uk ? "Козацька автономія та повстання" : "Cossack autonomy and uprisings",
      cossacks,
      setCossacks,
    ],
    [
      uk ? "Реконкіста · оглядові ареали" : "Reconquista · survey areas",
      reconquista,
      setReconquista,
    ],
    [uk ? "Колоніальні володіння" : "Colonial possessions", colonies, setColonies],
    [uk ? "Фронти громадянської війни" : "Civil War fronts", fronts, setFronts],
  ];
  const share = async () => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      section: "useful",
      tool: "atlas",
      view: "world",
      year: date.year,
      month: date.month,
      day: date.day,
    }))
      url.searchParams.set(key, String(value));
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success(uk ? "Посилання скопійовано" : "Link copied");
    } catch {
      toast.info(
        uk ? "Дата збережена в адресному рядку." : "The selected date is in the address bar.",
      );
    }
  };
  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-forest-mid">
              <Globe2 className="size-4" />
              {uk ? "Єдина історична мапа" : "One historical map"} · 500 {uk ? "до н. е." : "BCE"}
              –1994
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">
              {uk ? "Світ крізь час" : "The world through time"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              {uk
                ? "Оберіть дату й досліджуйте весь світ на одній мапі. Наближайте потрібну територію або знаходьте держави й міста через пошук."
                : "Choose a date and explore the world on one map. Zoom into a region or search for a state or city."}
            </p>
          </div>
          <PillButton type="button" tone="ghost" onClick={() => void share()}>
            <Share2 className="mr-2 size-4" />
            {uk ? "Поділитися" : "Share"}
          </PillButton>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block text-xs font-bold">
            {uk ? "Рік подій" : "Event year"}
            <TextInput
              type="number"
              min={WORLD_MIN_YEAR}
              max={WORLD_MAX_YEAR}
              value={yearText}
              onChange={(e) => setYearText(e.target.value)}
              onBlur={() => {
                const next = worldDate(
                  yearText.trim() ? Number(yearText) : date.year,
                  date.month,
                  date.day,
                );
                setYearText(String(navigate(next) ? next.year : date.year));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="mt-1 block w-28"
            />
          </label>
          <label className="block text-xs font-bold">
            {uk ? "Місяць подій" : "Event month"}
            <select
              aria-label={uk ? "Місяць подій" : "Event month"}
              value={date.month}
              onChange={(e) => navigate(worldDate(date.year, Number(e.target.value), date.day))}
              className="mt-1 block min-h-11 w-36 rounded-full border border-hairline bg-surface-2 px-3 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Intl.DateTimeFormat(uk ? "uk" : "en", {
                    month: "long",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2000, i, 1)))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold">
            {uk ? "День подій" : "Event day"}
            <TextInput
              type="number"
              min={1}
              max={31}
              value={dayText}
              onChange={(e) => setDayText(e.target.value)}
              onBlur={() => {
                const next = worldDate(
                  date.year,
                  date.month,
                  dayText.trim() ? Number(dayText) : date.day,
                );
                setDayText(String(navigate(next) ? next.day : date.day));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="mt-1 block w-20"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={uk ? "Попередній день" : "Previous day"}
              disabled={date.year === WORLD_MIN_YEAR && date.month === 1 && date.day === 1}
              onClick={() => navigate(shiftWorldDay(date, -1))}
              className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label={uk ? "Наступний день" : "Next day"}
              disabled={date.year === WORLD_MAX_YEAR && date.month === 12 && date.day === 31}
              onClick={() => navigate(shiftWorldDay(date, 1))}
              className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <strong className="ml-auto py-2 text-sm text-forest-mid" data-testid="atlas-event-date">
            {formatWorldDate(date, uk)}
          </strong>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">{uk ? "Шкала часу" : "Timeline"}</span>
          <input
            type="range"
            min={WORLD_MIN_YEAR}
            max={WORLD_MAX_YEAR}
            step={1}
            value={date.year}
            onChange={(e) =>
              navigate(
                worldDate(Number(e.target.value) || (date.year > 0 ? -1 : 1), date.month, date.day),
              )
            }
            className="block w-full accent-forest"
          />
        </label>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>500 {uk ? "до н. е." : "BCE"}</span>
          <span>500</span>
          <span>1000</span>
          <span>1500</span>
          <span>1994</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PillButton
            type="button"
            tone="ghost"
            disabled={!previousFrame}
            onClick={() => previousFrame && navigate(previousFrame)}
          >
            <ChevronLeft className="mr-1 size-3" />
            {uk ? "Попередній зріз" : "Previous snapshot"}
          </PillButton>
          <PillButton
            type="button"
            tone="ghost"
            disabled={!nextFrame}
            onClick={() => nextFrame && navigate(nextFrame)}
          >
            {uk ? "Наступний зріз" : "Next snapshot"}
            <ChevronRight className="ml-1 size-3" />
          </PillButton>
          <span className="ml-auto text-xs text-muted">
            {uk
              ? "Перетягуйте мапу · + / − або два пальці — масштаб"
              : "Drag to pan · + / − or pinch to zoom"}
          </span>
        </div>
        {quickDates.length > 1 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-forest-mid">
              {uk ? "Доступні зрізи поруч із вибраною датою" : "Snapshots near this date"}
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickDates.map((f) => (
                <button
                  type="button"
                  key={f.path}
                  onClick={() => navigate(f)}
                  className="min-h-9 rounded-full bg-surface-2 px-3"
                >
                  {formatWorldDate(f, uk)}
                </button>
              ))}
            </div>
          </details>
        )}
        <div
          className="my-4 rounded-2xl border border-hairline bg-surface-2/50 px-4 py-3 text-xs"
          data-testid="world-source-date"
        >
          <strong>
            {uk ? "Світова основа" : "World background"}:{" "}
            {frame ? formatAtlasYear(frame.baseYear, uk) : "…"}
          </strong>
          <span className="ml-2 text-muted">
            {uk
              ? "Показано останній доступний зріз до вибраної дати. Регіональні уточнення мають власні дати; кордони між зрізами не інтерполюються."
              : "The last available snapshot before the selected date. Regional refinements retain their own dates; borders are not interpolated."}
          </span>
          <details className="mt-2">
            <summary className="cursor-pointer text-forest-mid">
              {uk ? "Дати шарів і точність" : "Layer dates and accuracy"}
            </summary>
            <ul className="mt-2 space-y-2">
              {frame?.sources.map((s) => (
                <li key={`${s.name}-${s.year}`}>
                  <strong>
                    {SOURCE_NAMES[s.name]?.[uk ? 0 : 1] ?? s.name}:{" "}
                    {s.date ? s.date.split("-").reverse().join(".") : formatAtlasYear(s.year, uk)}
                  </strong>
                  {s.note && <p className="mt-1 text-muted">{s.note}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted">
              {uk
                ? "Світова основа — оглядові історичні контури, не точні щоденні кордони. Нейтральні ділянки позначають прогалини даних. Береги та річки — сучасні фізичні орієнтири."
                : "The world background contains historical overview contours, not exact daily borders. Neutral areas indicate data gaps. Coasts and rivers are modern physical references."}
            </p>
          </details>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
          {checkboxes.slice(0, 3).map(([label, checked, set]) => (
            <label key={label} className="flex min-h-9 items-center gap-2">
              <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
          <PillButton
            type="button"
            tone="ghost"
            className="ml-auto"
            onClick={() => setMapReset((n) => n + 1)}
          >
            <Globe2 className="mr-2 size-4" />
            {uk ? "Показати весь світ" : "Show the whole world"}
          </PillButton>
        </div>
        <details className="mb-4 rounded-xl border border-hairline px-4 py-2 text-xs">
          <summary className="cursor-pointer py-1 font-bold text-forest-mid">
            {uk ? "Додаткові історичні шари" : "Additional historical layers"}
          </summary>
          <div className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {checkboxes.slice(3).map(([label, checked, set]) => (
              <label key={label} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          {sourceFront && (
            <p className="mt-2" data-testid="spain-snapshot">
              {uk ? "Джерельний зріз фронту" : "Front source snapshot"}:{" "}
              {sourceFront.date?.slice(5, 7)}.{sourceFront.date?.slice(0, 4)} ·{" "}
              {uk ? "місячна точність" : "monthly precision"}
            </p>
          )}
          <p className="mt-2 text-muted">
            {uk
              ? "Міста з’являються під час наближення. Штрихування показує залежність, автономію або неповний контроль. Оглядові історичні землі не є державними кордонами."
              : "Cities appear as you zoom in. Hatching indicates dependency, autonomy or partial control. Historical reference areas are not state borders."}
          </p>
        </details>
        {loading && (
          <p role="status" className="mb-3 text-xs text-muted">
            {uk ? "Завантаження картографічних шарів…" : "Loading map layers…"}
          </p>
        )}
        {failed && (
          <div role="alert" className="mb-3 rounded-xl bg-terracotta/10 p-3 text-sm">
            {uk ? "Не вдалося завантажити частину мапи." : "Some map data could not be loaded."}
            <PillButton
              type="button"
              tone="ghost"
              onClick={() =>
                queries.forEach((q) => {
                  if (q.isError) void q.refetch();
                })
              }
            >
              {uk ? "Повторити" : "Retry"}
            </PillButton>
          </div>
        )}
        {manual.isError && (
          <div role="alert" className="mb-3 rounded-xl bg-terracotta/10 p-3 text-sm">
            {uk
              ? "Ручні території школи не завантажилися. Збереження правок тимчасово недоступне."
              : "School territories did not load. Saving is temporarily unavailable."}
            <PillButton type="button" tone="ghost" onClick={() => void manual.refetch()}>
              {uk ? "Повторити" : "Retry"}
            </PillButton>
          </div>
        )}
        {manual.data && date.year >= 395 && (
          <AtlasEditingPanel
            editor={editor}
            entries={manual.data.entries}
            base={historical}
            year={date.year}
            uk={uk}
            saving={saveManual.isPending || manual.isError || loading}
            canEdit={manual.data.canEdit && !failed && !loading}
            onSave={saveEntries}
            onRemove={async (id) => {
              const ok = await saveEntries(manual.data.entries.filter((e) => e.id !== id));
              if (ok && editor.draft?.id === id) editor.dispatch({ type: "cancel" });
              return ok;
            }}
            onRefresh={() => {
              void manual.refetch().then((result) => {
                if (result.data) draftRevision.current = result.data.revision;
              });
            }}
            error={manualError}
          />
        )}
        {editor.draft && (
          <div className="atlas-editor mb-2 flex flex-wrap gap-2 rounded-xl border border-hairline p-2">
            <PillButton
              type="button"
              tone="ghost"
              disabled={saveManual.isPending}
              onClick={() =>
                editor.dispatch({ type: "mode", mode: editor.mode === "draw" ? "edit" : "draw" })
              }
            >
              {editor.mode === "draw"
                ? uk
                  ? "Завершити малювання"
                  : "Finish drawing"
                : uk
                  ? "Додавати точки"
                  : "Add vertices"}
            </PillButton>
            <PillButton
              type="button"
              tone="ghost"
              disabled={!editor.past.length || saveManual.isPending}
              onClick={() => editor.dispatch({ type: "undo" })}
            >
              {uk ? "Скасувати точку" : "Undo geometry"}
            </PillButton>
            <PillButton
              type="button"
              disabled={saveManual.isPending || manual.isError || loading}
              onClick={() => void saveDraft()}
            >
              {uk ? "Зберегти територію" : "Save territory"}
            </PillButton>
            <PillButton
              type="button"
              tone="ghost"
              onClick={() => editor.dispatch({ type: "cancel" })}
            >
              {uk ? "Скасувати редагування" : "Cancel editing"}
            </PillButton>
            <p className="w-full px-2 text-xs text-muted">
              {uk
                ? "Ручні правки мають річні інтервали: редагування місячного фронту застосовується до всього вибраного року."
                : "Manual edits use annual intervals: a monthly front edit applies throughout the selected year."}
            </p>
          </div>
        )}
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <HistoricalMapCanvas
              historical={historical}
              land={physical.data?.land}
              rivers={physical.data?.rivers}
              places={drawn}
              view="world"
              resetKey={mapReset}
              uk={uk}
              borders={borders}
              riverLayer={rivers}
              selected={selectedPlace?.id ?? String(selectedPolity?.id ?? "")}
              onPlace={choosePlace}
              onPolity={choosePolity}
              edit={
                manual.data?.canEdit && editor.canvas
                  ? {
                      ...editor.canvas,
                      disabled: saveManual.isPending || manual.isError || loading,
                    }
                  : undefined
              }
            />
            {legend.length > 0 && (
              <div
                className="mt-3 flex flex-wrap gap-3 text-xs"
                aria-label={uk ? "Легенда поділів Речі Посполитої" : "Partitions legend"}
              >
                {legend.map((f) => (
                  <span key={f.properties.subject} className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-sm"
                      style={{
                        backgroundColor: f.properties.color ?? polityColor(f.properties.subject),
                      }}
                    />
                    {historicalName(f.properties.subject, uk)}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              <span className="atlas-hatch-swatch" aria-hidden="true" />{" "}
              {uk
                ? "Штрихування — форми контролю · Суцільна заливка — політичні контури · Натисніть на територію, щоб дізнатися більше."
                : "Hatching: forms of control · Solid fill: political contours · Select a territory for details."}
            </p>
          </div>
          <aside className="min-w-0 space-y-4">
            <label className="relative block">
              <span className="sr-only">
                {uk ? "Пошук держави або міста" : "Search states or cities"}
              </span>
              <Search className="absolute top-3.5 left-3 size-4 text-muted" />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={uk ? "Держава або місто…" : "State or city…"}
                className="w-full pl-9"
              />
            </label>
            {term && (
              <div
                className="max-h-52 space-y-1 overflow-y-auto"
                aria-label={uk ? "Результати пошуку" : "Search results"}
              >
                {matchingPolities.slice(0, 10).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="block min-h-9 w-full rounded-xl bg-surface-2 px-3 text-left text-xs"
                    onClick={() => {
                      setBorders(true);
                      choosePolity(f);
                    }}
                  >
                    <Globe2 className="mr-1 inline size-3" />
                    {historicalName(f.properties.name, uk)}
                  </button>
                ))}
                {matchingPlaces.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="block min-h-9 w-full rounded-xl bg-surface-2 px-3 text-left text-xs"
                    onClick={() => choosePlace(p)}
                  >
                    <MapPin className="mr-1 inline size-3" />
                    {p.name}
                  </button>
                ))}
                {!matchingPlaces.length && !matchingPolities.length && (
                  <p className="text-xs text-muted">
                    {uk ? "Для цієї дати нічого не знайдено." : "No results for this date."}
                  </p>
                )}
              </div>
            )}
            <label className="block text-xs font-bold">
              {uk ? `Територія на мапі ${date.year}` : `Territory on the map ${date.year}`}
              <select
                aria-label={
                  uk ? `Територія на мапі ${date.year}` : `Territory on the map ${date.year}`
                }
                value={selectedPolity?.id ?? ""}
                disabled={!historical || !borders}
                onChange={(e) => {
                  const f = historical?.features.find((f) => String(f.id) === e.target.value);
                  if (f) choosePolity(f);
                  else setSelection(null);
                }}
                className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
              >
                <option value="">{uk ? "Виберіть територію" : "Select territory"}</option>
                {historical?.features
                  .slice()
                  .sort((a, b) =>
                    historicalName(a.properties.name, uk).localeCompare(
                      historicalName(b.properties.name, uk),
                    ),
                  )
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {historicalName(f.properties.name, uk)}
                    </option>
                  ))}
              </select>
            </label>
            {selectedPlace ? (
              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-bold text-forest-mid">
                  {uk ? "Місто або історичний осередок" : "City or historical reference"}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold">{selectedPlace.name}</h3>
                <p className="mt-2 text-xs font-semibold">{selectedPlace.dateLabel}</p>
                <p className="mt-2 text-sm leading-6">{selectedPlace.description}</p>
                <Sources ids={selectedPlace.sources} />
              </div>
            ) : selectedPolity ? (
              <div className="rounded-2xl border border-forest-mid/30 p-4">
                <p className="text-xs font-bold text-forest-mid">
                  {uk ? "Територія" : "Territory"}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold">
                  {historicalName(selectedPolity.properties.name, uk)}
                </h3>
                <p className="mt-2 text-xs font-semibold">
                  {uk ? "Джерельний зріз" : "Source snapshot"}:{" "}
                  {formatAtlasYear(selectedPolity.properties.sourceYear ?? frame!.baseYear, uk)}
                </p>
                <p className="mt-2 text-xs">
                  {uk ? "Контролер" : "Controller"}:{" "}
                  {historicalName(selectedPolity.properties.subject, uk)}
                  {selectedPolity.properties.relation && ` · ${selectedPolity.properties.relation}`}
                </p>
                {selectedPolity.properties.description && (
                  <p className="mt-2 text-sm leading-6">{selectedPolity.properties.description}</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {uk
                    ? "Оглядовий контур за датованим джерелом. Дата події та точність геометрії можуть відрізнятися."
                    : "Overview contour from a dated source. The event date and geometry precision may differ."}
                </p>
                {selectedPolity.properties.sourceUrl && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs text-forest-mid underline"
                    href={selectedPolity.properties.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {uk ? "Картографічне джерело" : "Cartographic source"}
                    <ExternalLink className="size-3" />
                  </a>
                )}
                {manual.data?.canEdit && date.year >= 395 && !loading && (
                  <PillButton
                    type="button"
                    tone="ghost"
                    className="mt-3"
                    onClick={() => {
                      const saved = manual.data.entries.find(
                        (e) => `manual-${e.id}` === selectedPolity.id,
                      );
                      editor.start(saved ?? newAtlasEdit(date.year, selectedPolity));
                      setBorders(true);
                      setSelection(null);
                    }}
                  >
                    {uk ? "Редагувати країну й кордони" : "Edit country and borders"}
                  </PillButton>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-2 p-4 text-xs leading-5 text-muted">
                {uk
                  ? "Натисніть на територію або знайдіть її через пошук. Мапа зберігає масштаб під час зміни дати."
                  : "Select a territory or find it using search. The map keeps its zoom when you change the date."}
              </div>
            )}
            <div className="rounded-2xl border border-hairline p-4 text-xs">
              <strong className="text-forest-mid">{uk ? "На мапі" : "On the map"}</strong>
              <p className="mt-1">
                {states.length} {uk ? "територій та ареалів" : "territories and regions"}
              </p>
              <p className="mt-2 leading-5 text-muted">
                {uk
                  ? "Прогалини джерел залишаються нейтральними. Це навчальний атлас зі зрізами різної точності."
                  : "Source gaps remain neutral. This is a learning atlas with snapshots of varying precision."}
              </p>
            </div>
          </aside>
        </div>
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-bold text-forest-mid">
            {uk
              ? "Міста та історичні осередки цієї дати"
              : "Cities and historical references for this date"}
          </summary>
          <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePlace(p)}
                className="flex min-h-10 items-center gap-1 rounded-xl bg-surface-2 px-3 text-left text-xs"
              >
                <MapPin className="size-3 shrink-0" />
                {p.name}
              </button>
            ))}
          </div>
        </details>
      </Panel>
      <Panel className="mt-4">
        <h3 className="font-display font-extrabold">
          {uk ? "Події поруч із вибраною датою" : "Events near the selected date"}
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {nearby.map((e) => (
            <button
              type="button"
              key={`${e.year}-${e.title}`}
              onClick={() => navigate(eventDate(e))}
              className="rounded-2xl border border-hairline bg-surface-2/50 p-4 text-left"
            >
              <strong className="text-xs text-forest-mid">
                {e.month || e.day ? formatWorldDate(eventDate(e), uk) : formatAtlasYear(e.year, uk)}
              </strong>
              <h4 className="mt-1 text-sm font-bold">{e.title}</h4>
              <p className="mt-1 text-xs leading-5 text-muted">
                {e.description
                  .split(/(?<=[.!?])\s+/)
                  .filter(
                    (sentence) =>
                      !/зріз|шар|схем|на мап|на карт|snapshot|layer|schematic/i.test(sentence),
                  )
                  .join(" ")}
              </p>
            </button>
          ))}
          {!nearby.length && (
            <p className="text-sm text-muted">
              {uk ? "Для цього проміжку подій ще немає." : "No curated events in this period yet."}
            </p>
          )}
        </div>
      </Panel>
      <Panel className="mt-4">
        <details>
          <summary className="cursor-pointer font-display font-bold">
            {uk ? "Джерела й методика" : "Sources and method"}
          </summary>
          <p className="mt-3 text-sm leading-6">
            {uk
              ? "Єдина світова основа Historical Basemaps охоплює 500 рік до н. е. — 1994 рік. Джерельні полігони нормалізовано, а регіональні уточнення геометрично вирізають перекриття сусідніх територій. Прямокутні регіональні схеми не використовуються. Оглядові зрізи не дають щоденної точності."
              : "The unified Historical Basemaps background spans 500 BCE–1994. Source polygons are normalized; regional refinements geometrically remove overlaps with neighbouring territories. Rectangular regional schematics are not used. Overview snapshots do not provide daily precision."}
          </p>
          <a
            href="/atlas/world/NOTICE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-forest-mid underline"
          >
            {uk
              ? "Походження даних, ліцензії та межі точності"
              : "Data provenance, licenses and accuracy"}
          </a>
          <Sources ids={["basemaps", "natural-earth", "lucius", "france-basemaps"]} />
        </details>
      </Panel>
    </>
  );
}
