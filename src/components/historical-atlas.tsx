import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  MapPin,
  Search,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
import { ATLAS_EVENTS, ATLAS_PERIODS, ATLAS_PLACES, ATLAS_SOURCES } from "@/lib/atlas/content";
import {
  BYZANTINE_EVENTS,
  BYZANTINE_PERIODS,
  BYZANTINE_PLACES,
  type ByzantineData,
  type ByzantineFrame,
} from "@/lib/atlas/byzantine";
import {
  activePlaces,
  ATLAS_YEARS,
  ATLAS_MIN_YEAR,
  ATLAS_MAX_YEAR,
  BYZANTINE_YEARS,
  byzantineSnapshot,
  overviewSnapshot,
  combineHistoricalLayers,
  clampAtlasYear,
  featureNote,
  historicalName,
  placeEpoch,
  validateHistoricalCollection,
  type AtlasPlace,
  type AtlasView,
  type HistoricalFeature,
} from "@/lib/atlas/model";
import {
  FRANKISH_EVENTS,
  FRANKISH_PERIODS,
  FRANKISH_PLACES,
  type FrankishData,
  type FrankishFrame,
} from "@/lib/atlas/frankish";
import { FRANKISH_YEARS, frankishSnapshot } from "@/lib/atlas/model";
import { RUS_YEARS, rusSnapshot } from "@/lib/atlas/model";
import {
  RUS_EVENTS,
  RUS_PERIODS,
  RUS_PLACES,
  validateRusData,
  type RusFrame,
} from "@/lib/atlas/rus";
import {
  MONGOL_YEARS,
  MONGOL_CAMPAIGN,
  MONGOL_EVENTS,
  validateMongolData,
  mongolFrameAt,
  mongolCollectionAt,
  mongolPlacesAt,
  mongolPeriod,
  campaignPlaces,
  markInvadedRus,
  type MongolFrame,
} from "@/lib/atlas/mongols";
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
import { HistoricalMapCanvas } from "./historical-map-canvas";
import { Panel, PillButton, TextInput } from "./ui/panel";

async function jsonFile(path: string, signal: AbortSignal) {
  const r = await fetch(path, { signal });
  if (!r.ok) throw new Error("ATLAS_DOWNLOAD");
  return r.json();
}
function Sources({ ids }: { ids: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-xs">
      {[...new Set(ids)]
        .map((id) => ATLAS_SOURCES.find((s) => s.id === id))
        .filter((s) => Boolean(s))
        .map((s) => (
          <li key={s!.id}>
            <a
              href={s!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-forest-mid underline underline-offset-4"
            >
              {s!.title}
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </li>
        ))}
    </ul>
  );
}
function SourceMapPreview({
  frame,
  uk,
  owner,
}: {
  owner?: string;
  frame: ByzantineFrame | FrankishFrame | RusFrame | MongolFrame;
  uk: boolean;
}) {
  const localOriginal = "originalPath" in frame;
  const rus = "note" in frame;
  const frankish = localOriginal && !rus;
  const imageUrl = localOriginal ? `/${frame.originalPath}` : frame.sourceUrl;
  const author = localOriginal ? `${frame.author} · ${frame.license}` : "©Lucius";
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          setScale(1);
          setFailed(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <PillButton type="button" tone="ghost">
          {owner
            ? `${uk ? "Карта-джерело" : "Source map"} · ${owner}`
            : rus
              ? uk
                ? "Переглянути оригінал Русі"
                : "View Rus original"
              : frankish
                ? uk
                  ? "Переглянути оригінал франків"
                  : "View Frankish original"
                : uk
                  ? "Переглянути оригінал"
                  : "View original"}
        </PillButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/75" />
        <Dialog.Content
          aria-describedby="atlas-source-description"
          className="fixed left-1/2 top-1/2 z-[101] flex h-[90dvh] w-[96vw] max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface p-3 shadow-2xl outline-none sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Dialog.Title className="font-display text-lg font-extrabold">
              {uk ? "Авторська мапа" : "Source map"} · {rus ? frame.sourceYear : frame.year} ·{" "}
              {author}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={uk ? "Закрити оригінал" : "Close original"}
                className="grid size-11 place-items-center rounded-full bg-surface-2"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          <p id="atlas-source-description" className="mt-1 text-xs text-muted">
            {uk
              ? localOriginal
                ? "Оригінальна карта з легендою. Збільшуйте й прокручуйте для перевірки князівств, анклавів і кольорових областей; локальна копія джерела."
                : "Оригінальна проєкція та повна роздільність автора. Збільшуйте й прокручуйте, щоб читати міста, феми та легенду. Зображення завантажується із сайту автора."
              : localOriginal
                ? "Original map with legend, preserved locally. Zoom and scroll to check principalities, enclaves and color areas."
                : "Original projection and full source resolution. Zoom and scroll to read settlements, themes and the legend; loaded from the author's site."}
          </p>
          <div className="my-3 flex flex-wrap items-center gap-2">
            <PillButton
              type="button"
              tone="ghost"
              disabled={scale <= 1}
              onClick={() => setScale(Math.max(1, scale - 1))}
            >
              −
            </PillButton>
            <span className="text-xs font-bold">{scale * 100}%</span>
            <PillButton
              type="button"
              tone="ghost"
              disabled={scale >= 10}
              onClick={() => setScale(Math.min(10, scale + 1))}
            >
              +
            </PillButton>
            <PillButton type="button" tone="ghost" onClick={() => setScale(1)}>
              {uk ? "Вмістити" : "Fit"}
            </PillButton>
            <a
              href={frame.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs underline"
            >
              {uk ? "Відкрити джерело" : "Open source"}
            </a>
          </div>
          <div
            tabIndex={0}
            aria-label={uk ? "Перегляд мапи з прокручуванням" : "Scrollable source map"}
            className="min-h-0 flex-1 overflow-auto rounded-xl border border-hairline bg-white"
          >
            {failed ? (
              <p role="alert" className="p-5 text-sm">
                {uk
                  ? localOriginal
                    ? "Оригінальну карту не завантажено. Векторні кордони доступні в атласі; джерело можна відкрити за посиланням."
                    : "Сайт автора не надав зображення. Геоприв’язаний шар та векторні кордони доступні в атласі."
                  : "Source image unavailable; vector boundaries remain available. Open the linked original source."}
              </p>
            ) : (
              <img
                src={imageUrl}
                alt={`${rus ? (uk ? "Мапа Русі" : "Rus map") : frankish ? (uk ? "Франкська держава" : "Frankish realms") : uk ? "Мапа Візантії" : "Byzantine map"} ${rus ? frame.sourceYear : frame.year}, ${author}`}
                onError={() => setFailed(true)}
                style={{ width: `${scale * 100}%`, maxWidth: "none", height: "auto" }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function HistoricalAtlas({
  year,
  view,
  onChange,
}: {
  year: number;
  view: AtlasView;
  onChange: (year: number, view: AtlasView) => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const profile = useMeQuery().data?.profile;
  const qc = useQueryClient();
  const editor = useAtlasEditor();
  const draftRevision = useRef<number | null>(null);
  const [manualError, setManualError] = useState("");
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
  const saveEntries = async (entries: AtlasEdit[]) => {
    if (!manual.data?.canEdit || manual.isError || saveManual.isPending) return false;
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
    } catch (e) {
      const message = atlasEditError(e, uk);
      setManualError(message);
      toast.error(message);
      return false;
    }
  };
  useEffect(() => {
    editor.dispatch({ type: "cancel" });
  }, [profile?.schoolId, profile?.userId]);
  const saveDraft = async () => {
    if (!editor.draft || !manual.data) return;
    try {
      const entries = validateAtlasEdits([
        ...manual.data.entries.filter((e) => e.id !== editor.draft!.id),
        editor.draft,
      ]);
      if (await saveEntries(entries)) editor.dispatch({ type: "cancel" });
    } catch (e) {
      const message = atlasEditError(e, uk);
      setManualError(message);
      toast.error(message);
    }
  };
  const snapshot = overviewSnapshot(year);
  const byzYear = byzantineSnapshot(year);
  const frYear = frankishSnapshot(year);
  const rusYear = rusSnapshot(year);
  const [mongolDetail, setMongolDetail] = useState(true);
  const [campaignStep, setCampaignStep] = useState("");
  const newView = ["mongols", "hordes", "mughals"].includes(view);
  const invasion =
    year >= 1223 && year <= 1242 && (view === "rus" || view === "mongols" || view === "hordes");
  const [rusDetail, setRusDetail] = useState(true);
  const [frankishDetail, setFrankishDetail] = useState(true);
  const [detailed, setDetailed] = useState(true);
  const [originalLayer, setOriginalLayer] = useState(false);
  const [yearText, setYearText] = useState(String(year));
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState(true);
  const [areas, setAreas] = useState(true);
  const [borders, setBorders] = useState(true);
  const [rivers, setRivers] = useState(true);
  const [selection, setSelection] = useState<
    { kind: "place"; id: string } | { kind: "polity"; feature: HistoricalFeature } | null
  >(null);
  useEffect(() => {
    setYearText(String(year));
    setCampaignStep("");
  }, [year]);
  useEffect(
    () => setSelection(null),
    [snapshot, byzYear, detailed, frYear, frankishDetail, rusYear, rusDetail],
  );
  const data = useQuery({
    queryKey: ["historical-atlas", snapshot],
    queryFn: async ({ signal }) =>
      validateHistoricalCollection(await jsonFile(`/atlas/world-${snapshot}.geojson`, signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && snapshot !== undefined,
    retry: 1,
  });
  const byzantine = useQuery({
    queryKey: ["historical-atlas-byzantine"],
    queryFn: async ({ signal }) => {
      const raw = (await jsonFile("/atlas/byzantium/frames.json", signal)) as ByzantineData;
      if (!raw || !Array.isArray(raw.frames) || raw.frames.length !== BYZANTINE_YEARS.length)
        throw new Error("INVALID_BYZANTINE_DATA");
      for (const frame of raw.frames) validateHistoricalCollection(frame.collection);
      return raw;
    },
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && detailed && year <= 1453,
    retry: 1,
  });
  const frankish = useQuery({
    queryKey: ["historical-atlas-franks"],
    queryFn: async ({ signal }) => {
      const raw = (await jsonFile("/atlas/franks/frames.json", signal)) as FrankishData;
      if (!raw || !Array.isArray(raw.frames) || raw.frames.length !== FRANKISH_YEARS.length)
        throw new Error("INVALID_FRANKISH_DATA");
      for (const frame of raw.frames) validateHistoricalCollection(frame.collection);
      return raw;
    },
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && frankishDetail && frYear !== undefined,
    retry: 1,
  });
  const frFrame = frankish.data?.frames.find((f) => f.year === frYear);
  const rus = useQuery({
    queryKey: ["historical-atlas-rus"],
    queryFn: async ({ signal }) =>
      validateRusData(await jsonFile("/atlas/rus/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && rusDetail && rusYear !== undefined,
    retry: 1,
  });
  const rusFrame = rus.data?.frames.find((f) => f.year === rusYear);
  const byzFrame =
    year <= 1453 ? byzantine.data?.frames.find((f) => f.year === byzYear) : undefined;
  const mongols = useQuery({
    queryKey: ["historical-atlas-mongols"],
    queryFn: async ({ signal }) =>
      validateMongolData(await jsonFile("/atlas/mongols/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && mongolDetail && year >= 1206,
    retry: 1,
  });
  const mongolFrame = mongolFrameAt(
    mongols.data,
    year,
    view === "mughals" ? "mughals" : view === "hordes" ? "hordes" : undefined,
  );
  const mongolCollection = useMemo(
    () => (mongolDetail ? mongolCollectionAt(mongols.data, year) : undefined),
    [mongolDetail, mongols.data, year],
  );
  const campaignMarkers = useMemo(
    () => (invasion && mongolDetail ? campaignPlaces(year, campaignStep) : []),
    [invasion, mongolDetail, year, campaignStep],
  );
  useEffect(() => setSelection(null), [year, campaignStep, mongolDetail]);
  const sourceHistorical = useMemo(
    () =>
      combineHistoricalLayers(
        snapshot !== undefined ? data.data : undefined,
        detailed ? byzFrame?.collection : undefined,
        frankishDetail && frYear !== undefined ? frFrame?.collection : undefined,
        rusDetail && rusYear !== undefined
          ? invasion && mongolDetail
            ? markInvadedRus(rusFrame?.collection, year, campaignStep)
            : rusFrame?.collection
          : undefined,
        mongolCollection,
      ),
    [
      snapshot,
      data.data,
      detailed,
      byzFrame,
      frankishDetail,
      frYear,
      frFrame,
      rusDetail,
      rusYear,
      rusFrame,
      invasion,
      mongolDetail,
      year,
      campaignStep,
      mongolCollection,
    ],
  );
  const historical = useMemo(
    () => applyAtlasEdits(sourceHistorical, manual.data?.entries ?? [], year),
    [sourceHistorical, manual.data?.entries, year],
  );
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
  const allPlaces = useMemo(
    () => [...ATLAS_PLACES, ...BYZANTINE_PLACES, ...FRANKISH_PLACES, ...RUS_PLACES],
    [],
  );
  const markerEpoch = placeEpoch(allPlaces, year);
  const available = useMemo(
    () =>
      [
        ...activePlaces(allPlaces, markerEpoch),
        ...(mongolDetail ? mongolPlacesAt(year) : []),
        ...campaignMarkers,
      ].filter((p) =>
        newView
          ? p.mongol
          : view === "franks"
            ? p.frankish
            : view === "byzantium"
              ? p.byzantine
              : view !== "rus" || !p.europe,
      ),
    [markerEpoch, view, year, mongolDetail, campaignMarkers, newView],
  );
  const drawn = useMemo(
    () => available.filter((p) => (p.type === "city" ? cities : areas)),
    [available, cities, areas],
  );
  const choosePlace = useCallback((place: AtlasPlace) => {
    if (place.type === "city") setCities(true);
    else setAreas(true);
    setSelection({ kind: "place", id: place.id });
  }, []);
  const choosePolity = useCallback(
    (feature: HistoricalFeature) => {
      if (!editor.draft) setSelection({ kind: "polity", feature });
    },
    [Boolean(editor.draft)],
  );
  const selectedPlace =
    selection?.kind === "place" ? available.find((p) => p.id === selection.id) : undefined;
  const selectedPolity =
    selection?.kind === "polity" && historical?.features.some((f) => f.id === selection.feature.id)
      ? historical.features.find((f) => f.id === selection.feature.id)
      : undefined;
  const period = newView
    ? mongolPeriod(year, view)
    : ((view === "rus"
        ? RUS_PERIODS
        : view === "franks"
          ? FRANKISH_PERIODS
          : view === "byzantium"
            ? BYZANTINE_PERIODS
            : ATLAS_PERIODS
      ).find((p) => year >= p.from && year <= p.to) ?? {
        from: 1454,
        to: ATLAS_MAX_YEAR,
        title: "Пізніші століття",
        description:
          "Для цього регіону пізніші територіальні шари ще не налаштовано. Історія ханств і Великих Моголів доступна в окремих масштабах.",
        sources: ["mongol-met"],
      });
  const matches = available.filter((p) =>
    `${p.name} ${p.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const nearby = (
    newView
      ? MONGOL_EVENTS
      : view === "rus"
        ? [
            ...RUS_EVENTS,
            ...(invasion ? MONGOL_EVENTS.filter((e) => e.sources.includes("mongol-invasion")) : []),
          ]
        : view === "franks"
          ? FRANKISH_EVENTS
          : view === "byzantium"
            ? [
                ...BYZANTINE_EVENTS,
                ...ATLAS_EVENTS.filter((e) => e.sources.includes("met-byzantium")),
              ]
            : [...ATLAS_EVENTS, ...BYZANTINE_EVENTS, ...FRANKISH_EVENTS]
  )
    .filter((e) => view !== "rus" || !e.europe)
    .filter((e) => Math.abs(e.year - year) <= 150)
    .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || a.year - b.year)
    .slice(0, 6)
    .sort((a, b) => a.year - b.year);
  const commitYear = () => {
    const next = clampAtlasYear(yearText.trim() ? Number(yearText) : year);
    setYearText(String(next));
    onChange(next, view);
  };
  const warnings: string[] = [];
  if (snapshot === undefined)
    warnings.push(
      "Кордони інших країн для цього проміжку ще не налаштовані. Нейтральний суходіл не означає відсутності держав або населення.",
    );
  if (detailed && year >= 1204 && year < 1205)
    warnings.push(
      "1204 — перехідний рік після захоплення Константинополя. Найближчі авторські зрізи: 1203 (до події) та 1205 (держави-наступниці); проміжні кордони не вигадуються.",
    );
  if (detailed && year >= 1261 && year < 1262)
    warnings.push(
      "Константинополь повернуто 1261 року; перший доступний авторський зріз після цієї події — 1262. До нього показаний попередній зріз, а не реконструйовані річні кордони.",
    );
  if (detailed && year <= 1453 && byzYear === 1453)
    warnings.push(
      "Мапа 1453 року показує володіння до захоплення Константинополя 29 травня. Вона не відображає стан після падіння столиці.",
    );
  if (snapshot === 800)
    warnings.push(
      "«Руський каганат» у цьому зрізі — гіпотетична реконструкція, не встановлена територія держави.",
    );
  if (snapshot === 1200 && !(rusDetail && rusYear !== undefined && rusFrame))
    warnings.push(
      "Частину руських князівств джерело об’єднує в одну геометрію. Регіональні картки розрізняють основні осередки.",
    );
  if (snapshot === 1279 || snapshot === 1300)
    warnings.push(
      "Галицько-Волинська держава не названа окремо у геометрії джерела. Це прогалина мапи, а не свідчення її зникнення.",
    );
  if (snapshot === 1400)
    warnings.push(
      "Полігон Poland-Lithuania узагальнює дві держави під династичною унією. Це не Річ Посполита, що постала 1569 р.",
    );
  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "useful");
    url.searchParams.set("year", String(year));
    url.searchParams.set("view", view);
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success(uk ? "Посилання скопійовано" : "Link copied");
    } catch {
      toast.info(
        uk
          ? "Копіювання недоступне. Рік і масштаб збережені в адресному рядку."
          : "Copy unavailable. The address bar retains your year and view.",
      );
    }
  };
  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-forest-mid">
              395–1858 · {uk ? "навчальний атлас" : "learning atlas"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">
              {uk ? "Світ і держави крізь час" : "World and states through time"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              {uk
                ? "Детальні карти Русі, Візантії, Франків, Монгольської імперії та Моголів: датовані території, князівства, анклави й оригінали з легендами. Для інших країн збережені оглядові шари; до IX ст. показані попередні спільноти, а не встановлені кордони Русі."
                : "Detailed source maps of Rus, Byzantium and the Franks: dated territories, principalities, enclaves and original legends. Other countries retain their overview layers."}
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
              min={ATLAS_MIN_YEAR}
              max={ATLAS_MAX_YEAR}
              step={1}
              value={yearText}
              onChange={(e) => setYearText(e.target.value)}
              onBlur={commitYear}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitYear();
              }}
              className="mt-1 block w-28"
            />
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              aria-label={uk ? "На 10 років назад" : "Back 10 years"}
              disabled={year <= ATLAS_MIN_YEAR}
              onClick={() => onChange(clampAtlasYear(year - 10), view)}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="range"
              aria-label={uk ? "Часова шкала 395–1858" : "Timeline 395–1858"}
              min={ATLAS_MIN_YEAR}
              max={ATLAS_MAX_YEAR}
              step={1}
              value={year}
              onChange={(e) => onChange(Number(e.target.value), view)}
              className="min-w-20 flex-1 accent-forest-mid"
            />
            <button
              type="button"
              aria-label={uk ? "На 10 років уперед" : "Forward 10 years"}
              disabled={year >= ATLAS_MAX_YEAR}
              onClick={() => onChange(clampAtlasYear(year + 10), view)}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label={uk ? "Картографічні зрізи" : "Map snapshots"}
        >
          {ATLAS_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onChange(y, view)}
              aria-pressed={year === y}
              className={`min-h-9 rounded-full px-3 text-xs font-bold ${year === y ? "bg-forest text-paper" : "bg-surface-2 text-ink"}`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-forest-mid/25 bg-forest-mid/5 p-3 text-sm">
          <strong>
            {uk ? "Рік подій" : "Events"}: {year} · {uk ? "Світ" : "World"}: {snapshot ?? "—"}
            {detailed && year <= 1453 && ` · ${uk ? "Візантія" : "Byzantium"}: ${byzYear}`}
            {frankishDetail && frYear !== undefined && ` · ${uk ? "Франки" : "Franks"}: ${frYear}`}
            {rusDetail &&
              rusFrame &&
              rusYear !== undefined &&
              ` · ${uk ? "Русь" : "Rus"}: ${rusFrame.sourceYear}${rusYear === 1240 ? (uk ? " (до навали)" : " (before invasion)") : ""}`}
          </strong>
          <p className="mt-1 text-xs text-muted">
            {snapshot === undefined
              ? uk
                ? "Для інших країн цей період ще не налаштовано."
                : "Other countries are not configured for this period."
              : year === snapshot
                ? uk
                  ? "Оглядовий картографічний зріз цього року; межі приблизні."
                  : "Overview snapshot for this year; boundaries are approximate."
                : uk
                  ? `Світ: найближчий оглядовий зріз (${snapshot}). Візантія: останній доступний авторський зріз не пізніше обраного року. Кордони не інтерполюються.`
                  : `Nearest available snapshot (${snapshot}). Borders are not interpolated; regional notes use event year ${year}.`}
          </p>
          {warnings.map((note) => (
            <p key={note} className="mt-2 text-xs text-terracotta">
              {note}
            </p>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-600/30 bg-amber-100/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold">
                {uk ? "Монголи, орди та Великі Моголи" : "Mongols, khanates and Mughals"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                1206–1858 ·{" "}
                {uk
                  ? "датовані карти, навала на Русь, історія наступників"
                  : "source maps, Rus invasion, successor histories"}
              </p>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={mongolDetail}
                onChange={(e) => setMongolDetail(e.target.checked)}
              />
              {uk ? "Монгольські шари й події навали" : "Mongol layers and invasion"}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["mongols", 1206, uk ? "Монгольська імперія" : "Mongol Empire"],
                ["hordes", 1300, uk ? "Орди й ханства" : "Khanates"],
                ["mughals", 1526, uk ? "Великі Моголи · Індія" : "Mughals · India"],
              ] as const
            ).map(([v, y, label]) => (
              <PillButton
                key={v}
                type="button"
                tone="ghost"
                aria-pressed={view === v}
                onClick={() => onChange(y, v)}
              >
                {label}
              </PillButton>
            ))}
          </div>
          <label className="mt-3 block text-xs font-bold">
            {uk ? "Датована карта (рік джерела)" : "Dated source map"}
            <select
              className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
              value={mongolFrame?.year ?? ""}
              onChange={(e) => {
                const y = Number(e.target.value);
                onChange(y, y >= 1526 && y !== 1600 ? "mughals" : y >= 1300 ? "hordes" : "mongols");
              }}
            >
              <option value="" disabled>
                {uk
                  ? "Немає територіального зрізу для цього року"
                  : "No territorial frame for this year"}
              </option>
              {MONGOL_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                  {[1500, 1600, 1700].includes(y) ? " · оглядова геометрія" : ""}
                </option>
              ))}
            </select>
          </label>
          {mongolFrame && <p className="mt-2 text-xs leading-5 text-muted">{mongolFrame.note}</p>}
          {mongolFrame?.originalPath && (
            <div className="mt-2">
              <SourceMapPreview
                frame={mongolFrame}
                uk={uk}
                owner={uk ? "Монголи / Моголи" : "Mongols / Mughals"}
              />
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-muted">
            {uk
              ? "Між датами показано документований зріз лише в межах указаного періоду. Пунктирні полігони приблизні; після розпаду старі межі прибираються. Якщо точної пізнішої карти немає, показані осередки й історичні події. Великі Моголи — окрема тимуридська держава в Індії. Схему всіх пізніх ханств перевіряйте в джерелі нижче: вона поєднує різні дати XV–XVI ст."
              : "Source boundaries are approximate and expire after major territorial changes. Where no later polygon is documented, centres and events remain. India’s Mughals are a separate Timurid state."}
          </p>
          <a
            className="mt-2 inline-block text-xs underline"
            href="/atlas/mongols/originals/successors.webp"
            target="_blank"
            rel="noopener noreferrer"
          >
            {uk
              ? "Схема наступників Орди й Північної Юань · Elvonudinium · CC BY-SA 4.0"
              : "Successor scheme · Elvonudinium · CC BY-SA 4.0"}
          </a>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              1206, 1219, 1223, 1236, 1237, 1238, 1239, 1240, 1241, 1242, 1258, 1260, 1271, 1279,
              1300, 1335, 1347, 1359, 1368, 1370, 1395, 1441, 1465, 1475, 1480, 1502, 1514, 1526,
              1540, 1552, 1556, 1598, 1605, 1635, 1680, 1707, 1739, 1783, 1803, 1857, 1858,
            ].map((y) => (
              <button
                type="button"
                key={y}
                aria-pressed={year === y}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${year === y ? "bg-forest text-paper" : "bg-surface"}`}
                onClick={() =>
                  onChange(
                    y,
                    y >= 1526 && ![1552, 1598, 1635, 1680, 1783].includes(y)
                      ? "mughals"
                      : y >= 1300
                        ? "hordes"
                        : "mongols",
                  )
                }
              >
                {y}
              </button>
            ))}
          </div>
          {invasion && mongolDetail && (
            <div className="mt-4 rounded-xl border border-terracotta/30 bg-surface p-3">
              <h4 className="font-bold">
                {uk ? "Навала на Русь · етапи захоплень" : "Invasion of Rus · campaign stages"}
              </h4>
              <label className="mt-2 block text-xs font-bold">
                {uk ? "Етап у вибраному році" : "Stage in selected year"}
                <select
                  className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
                  value={campaignStep}
                  onChange={(e) => setCampaignStep(e.target.value)}
                >
                  <option value="">
                    {uk ? "Усі засвідчені події цього року" : "All documented events in this year"}
                  </option>
                  {MONGOL_CAMPAIGN.filter((x) => x.year === year).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-muted">
                {uk
                  ? "Червоні позначки — захоплені й розорені міста; помаранчеві — битви. Червоний пунктир князівства означає розорення його головного осередку, а не знищення всіх поселень чи точний кордон окупації. Натисніть позначку для подробиць."
                  : "Red: sacked settlements; orange: battles. A red principality outline marks its principal centre being sacked, not a surveyed occupation boundary or the disappearance of every settlement."}
              </p>
              <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {campaignMarkers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="min-h-10 rounded-xl bg-surface-2 px-3 text-left text-xs font-bold"
                    onClick={() => choosePlace(p)}
                  >
                    {p.dateLabel}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mongolDetail && year >= 1206 && mongols.isPending && (
            <p role="status" className="mt-2 text-xs">
              {uk ? "Завантаження монгольських карт…" : "Loading Mongol maps…"}
            </p>
          )}
          {mongols.isError && mongolDetail && (
            <div role="alert" className="mt-2 text-sm">
              {uk ? "Монгольські карти не завантажилися." : "Mongol maps failed to load."}
              <PillButton type="button" tone="ghost" onClick={() => void mongols.refetch()}>
                {uk ? "Повторити" : "Retry"}
              </PillButton>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-2xl border border-[#bb8a9b]/40 bg-[#f3cbda]/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold">
                {uk ? "Детальна Візантія" : "Detailed Byzantium"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {uk
                  ? "39 авторських зрізів · острови, анклави та держави-наступниці"
                  : "39 source snapshots · islands, enclaves and successor states"}
              </p>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={detailed}
                onChange={(e) => {
                  setDetailed(e.target.checked);
                  if (!e.target.checked) setOriginalLayer(false);
                }}
              />
              {uk ? "Детальні кордони Візантії" : "Detailed Byzantine borders"}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Попередній зріз Візантії" : "Previous Byzantine snapshot"}
              disabled={byzYear === BYZANTINE_YEARS[0]}
              onClick={() => onChange(BYZANTINE_YEARS[BYZANTINE_YEARS.indexOf(byzYear) - 1], view)}
            >
              <ChevronLeft className="size-4" />
            </PillButton>
            <label className="min-w-40 flex-1 text-xs font-bold">
              {uk ? "Авторський зріз Візантії" : "Byzantine source snapshot"}
              <select
                className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
                value={byzYear}
                onChange={(e) => onChange(Number(e.target.value), view)}
              >
                {BYZANTINE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y === 1453 ? (uk ? " · до 29 травня" : " · before 29 May") : ""}
                  </option>
                ))}
              </select>
            </label>
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Наступний зріз Візантії" : "Next Byzantine snapshot"}
              disabled={byzYear === BYZANTINE_YEARS.at(-1)}
              onClick={() => onChange(BYZANTINE_YEARS[BYZANTINE_YEARS.indexOf(byzYear) + 1], view)}
            >
              <ChevronRight className="size-4" />
            </PillButton>
            {byzFrame && <SourceMapPreview key={byzFrame.year} frame={byzFrame} uk={uk} />}
          </div>
          <label className="mt-3 flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={originalLayer}
              disabled={!detailed || !borders || !byzFrame}
              onChange={(e) => setOriginalLayer(e.target.checked)}
            />
            {uk
              ? "Авторський шар: міста, феми й підписи"
              : "Source layer: towns, themes and labels"}
          </label>
          <p className="mt-1 text-xs leading-5 text-muted">
            {uk
              ? `Показано останній відомий авторський зріз ${byzYear}, що не пізніше обраного року. Контури перенесені через градусну сітку. Авторський шар відтворює весь регіон джерела й закриває в ньому оглядову мапу; феми й підписи збережені як зображення, а не окремі інтерактивні одиниці.`
              : `Last documented source frame at or before the event year: ${byzYear}. Source raster covers the overview within its region; themes and labels are preserved as imagery, not individually selectable units.`}
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-[#8caa86]/40 bg-[#def0d0]/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold">
                {uk ? "Детальна Франкська держава" : "Detailed Frankish realms"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {uk
                  ? "481–900 · 10 картографічних зрізів · поділи, анклави й держави-наступниці"
                  : "481–900 · 10 source snapshots · partitions, enclaves and successor kingdoms"}
              </p>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={frankishDetail}
                onChange={(e) => setFrankishDetail(e.target.checked)}
              />
              {uk ? "Детальні кордони франків" : "Detailed Frankish borders"}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Попередній зріз франків" : "Previous Frankish snapshot"}
              disabled={frYear === undefined || frYear === FRANKISH_YEARS[0]}
              onClick={() =>
                frYear !== undefined &&
                onChange(FRANKISH_YEARS[FRANKISH_YEARS.indexOf(frYear) - 1], view)
              }
            >
              <ChevronLeft className="size-4" />
            </PillButton>
            <label className="min-w-40 flex-1 text-xs font-bold">
              {uk ? "Картографічний зріз франків" : "Frankish source snapshot"}
              <select
                className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
                value={frYear ?? ""}
                onChange={(e) => onChange(Number(e.target.value), view)}
              >
                <option value="" disabled>
                  {uk ? "Поза періодом 481–900" : "Outside 481–900"}
                </option>
                {FRANKISH_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Наступний зріз франків" : "Next Frankish snapshot"}
              disabled={frYear === undefined || frYear === FRANKISH_YEARS.at(-1)}
              onClick={() =>
                frYear !== undefined &&
                onChange(FRANKISH_YEARS[FRANKISH_YEARS.indexOf(frYear) + 1], view)
              }
            >
              <ChevronRight className="size-4" />
            </PillButton>
            {frFrame && frYear !== undefined && (
              <SourceMapPreview key={`fr-${frYear}`} frame={frFrame} uk={uk} />
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            {frYear === undefined
              ? uk
                ? "Детальні франкські території показуються лише в 481–900 роках."
                : "Detailed Frankish territory is shown only in 481–900."
              : uk
                ? `Показано карту ${frYear} року. Між датами зберігається останній доступний зріз, без вигаданих річних кордонів. 481 — традиційний початок правління Хлодвіга; імператорська коронація — 800. Зрізи 511 і 768 відображають сукупні володіння, без внутрішнього спадкового поділу. Для 888–900 використано карту 888 року. Карти IX століття прив’язані за береговими орієнтирами, тому локальне суміщення менш певне, ніж за градусною сіткою Візантії.`
                : `Showing source map ${frYear}, the last available frame at or before the chosen year. 481 is Clovis’s traditional accession; imperial coronation: 800. Maps 511 and 768 show combined territory, not internal partitions. Years 888–900 use the 888 map.`}
          </p>
          {frankish.isError && frankishDetail && frYear !== undefined && (
            <div role="alert" className="mt-2 text-sm">
              <p>
                {uk ? "Не вдалося завантажити франкські карти." : "Frankish maps failed to load."}
              </p>
              <PillButton type="button" tone="ghost" onClick={() => void frankish.refetch()}>
                {uk ? "Спробувати ще раз" : "Retry"}
              </PillButton>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold">
                {uk ? "Детальна Русь" : "Detailed Rus"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {uk
                  ? "882–1240 · 6 картографічних зрізів + завершення 1240 · князівства й залежні території"
                  : "882–1240 · 6 source frames + the 1240 endpoint · principalities and dependent territories"}
              </p>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={rusDetail}
                onChange={(e) => setRusDetail(e.target.checked)}
              />
              {uk ? "Детальні кордони Русі" : "Detailed Rus borders"}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Попередній зріз Русі" : "Previous Rus snapshot"}
              disabled={rusYear === undefined || rusYear === RUS_YEARS[0]}
              onClick={() =>
                rusYear !== undefined && onChange(RUS_YEARS[RUS_YEARS.indexOf(rusYear) - 1], view)
              }
            >
              <ChevronLeft className="size-4" />
            </PillButton>
            <label className="min-w-40 flex-1 text-xs font-bold">
              {uk ? "Картографічний зріз Русі" : "Rus source snapshot"}
              <select
                className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
                value={rusYear ?? ""}
                onChange={(e) => onChange(Number(e.target.value), view)}
              >
                <option value="" disabled>
                  {uk ? "Поза періодом 882–1240" : "Outside 882–1240"}
                </option>
                {RUS_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y === 1132
                      ? uk
                        ? " · схема 1054–1132"
                        : " · period map 1054–1132"
                      : y === 1240
                        ? uk
                          ? " · падіння Києва; карта 1237"
                          : " · fall of Kyiv; 1237 map"
                        : ""}
                  </option>
                ))}
              </select>
            </label>
            <PillButton
              type="button"
              tone="ghost"
              aria-label={uk ? "Наступний зріз Русі" : "Next Rus snapshot"}
              disabled={rusYear === undefined || rusYear === RUS_YEARS.at(-1)}
              onClick={() =>
                rusYear !== undefined && onChange(RUS_YEARS[RUS_YEARS.indexOf(rusYear) + 1], view)
              }
            >
              <ChevronRight className="size-4" />
            </PillButton>
            {rusYear !== undefined && rusFrame && (
              <SourceMapPreview key={`rus-${rusYear}`} frame={rusFrame} uk={uk} />
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            {uk
              ? "Русь засвідчена до 882 року; 882 — літописна дата утвердження Олега в Києві. Між картами показано останній доступний зріз, а не вигадані щорічні межі. 1240 завершує києвоцентричний період: князівства й Галицько-Волинська держава продовжили існування. Геоприв’язка приблизна; дрібні уділи, штрихування залежності й різночасові лінії перевіряйте в оригіналах."
              : "Rus is attested before 882; 882 is the chronicle date of Oleh’s accession in Kyiv. Between maps the last available frame is retained. 1240 ends the Kyiv-centred period, while principalities and Galicia-Volhynia continued. Registration is approximate; consult originals for appanages, dependencies and lines from different dates."}
          </p>
          {rusDetail && rusYear !== undefined && rusFrame && (
            <p className="mt-2 text-xs leading-5 text-terracotta">
              {uk
                ? rusFrame.note
                : `Source date: ${rusFrame.sourceYear}. ${rusYear === 1240 ? "The 1237 pre-invasion map is retained for the 1240 endpoint; this is not a post-conquest map." : "A period reconstruction; see the original legend. Internal appanages may be grouped."}`}
            </p>
          )}
          <div
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label={uk ? "Ключові роки Русі" : "Key Rus dates"}
          >
            {[
              860, 882, 912, 945, 965, 972, 980, 988, 1015, 1019, 1036, 1054, 1097, 1113, 1125,
              1132, 1136, 1169, 1194, 1199, 1223, 1237, 1239, 1240,
            ].map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={year === y}
                onClick={() => onChange(y, "rus")}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${year === y ? "bg-terracotta text-white" : "bg-surface text-ink"}`}
              >
                {y}
              </button>
            ))}
          </div>
          {rus.isError && rusDetail && rusYear !== undefined && (
            <div role="alert" className="mt-2 text-sm">
              <p>{uk ? "Не вдалося завантажити карти Русі." : "Rus maps failed to load."}</p>
              <PillButton type="button" tone="ghost" onClick={() => void rus.refetch()}>
                {uk ? "Спробувати ще раз" : "Retry"}
              </PillButton>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["rus", uk ? "Русь-Україна" : "Rus’-Ukraine"],
              ["byzantium", uk ? "Візантія" : "Byzantium"],
              ["franks", uk ? "Франкська держава" : "Frankish realms"],
              ["europe", uk ? "Європа" : "Europe"],
              ["world", uk ? "Світ" : "World"],
              ["mongols", uk ? "Монгольська імперія" : "Mongol Empire"],
              ["hordes", uk ? "Орди й ханства" : "Hordes and khanates"],
              ["mughals", uk ? "Великі Моголи · Індія" : "Mughals · India"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => onChange(year, key)}
              className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${view === key ? "bg-forest text-paper" : "bg-surface-2 text-ink"}`}
            >
              <Globe2 className="size-4" />
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted">
            {uk
              ? "Перетягуйте мапу; + / − або два пальці — масштаб"
              : "Drag to pan; + / − or pinch to zoom"}
          </span>
        </div>
        <div className="my-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {[
            [uk ? "Держави й ареали" : "Polities and areas", borders, setBorders],
            [uk ? "Міста" : "Towns", cities, setCities],
            [uk ? "Регіональні осередки" : "Regional references", areas, setAreas],
            [uk ? "Річки" : "Rivers", rivers, setRivers],
          ].map(([label, value, set]) => (
            <label key={String(label)} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={(e) => (set as (value: boolean) => void)(e.target.checked)}
              />
              {label as string}
            </label>
          ))}
        </div>
        {(data.isError || physical.isError || (detailed && byzantine.isError)) && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-terracotta/10 p-3 text-sm"
          >
            {uk
              ? "Частину картографічних даних не завантажено."
              : "Some map data could not be loaded."}
            <PillButton
              type="button"
              tone="ghost"
              onClick={() => {
                if (snapshot !== undefined) void data.refetch();
                void physical.refetch();
                if (detailed) void byzantine.refetch();
              }}
            >
              {uk ? "Повторити" : "Retry"}
            </PillButton>
          </div>
        )}
        {((snapshot !== undefined && data.isPending) ||
          physical.isPending ||
          (detailed && year <= 1453 && byzantine.isPending) ||
          (frankishDetail && frYear !== undefined && frankish.isPending) ||
          (rusDetail && rusYear !== undefined && rus.isPending)) && (
          <p role="status" className="mb-2 text-xs text-muted">
            {uk ? "Завантаження картографічних шарів…" : "Loading atlas…"}
          </p>
        )}
        {profile?.schoolId && manual.isPending && (
          <p role="status" className="mb-2 text-xs text-muted">
            {uk ? "Завантаження ручних територій школи…" : "Loading school territories…"}
          </p>
        )}
        {manual.isError && (
          <div role="alert" className="mb-3 rounded-xl bg-terracotta/10 p-3 text-sm">
            {uk
              ? "Ручні шари школи не завантажилися. Вихідна карта доступна; збереження правок вимкнене до завантаження."
              : "School layers failed to load. Source maps remain available; saving is disabled until the layers load."}
            <PillButton type="button" tone="ghost" onClick={() => void manual.refetch()}>
              {uk ? "Повторити" : "Retry"}
            </PillButton>
          </div>
        )}
        {manual.data && (
          <AtlasEditingPanel
            editor={editor}
            entries={manual.data.entries}
            base={sourceHistorical}
            year={year}
            uk={uk}
            saving={saveManual.isPending || manual.isError}
            canEdit={manual.data.canEdit}
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
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {editor.draft && manual.data?.canEdit && (
              <div className="atlas-editor mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-forest-mid/30 bg-surface p-2">
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={saveManual.isPending}
                  onClick={() =>
                    editor.dispatch({
                      type: "mode",
                      mode: editor.mode === "draw" ? "edit" : "draw",
                    })
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
                  disabled={saveManual.isPending || !editor.past.length}
                  onClick={() => editor.dispatch({ type: "undo" })}
                >
                  {uk ? "Скасувати точку" : "Undo geometry"}
                </PillButton>
                <PillButton
                  type="button"
                  disabled={saveManual.isPending || manual.isError}
                  onClick={() => void saveDraft()}
                >
                  {saveManual.isPending
                    ? uk
                      ? "Збереження…"
                      : "Saving…"
                    : uk
                      ? "Зберегти територію"
                      : "Save territory"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  onClick={() =>
                    document
                      .getElementById("atlas-editor-fields")
                      ?.scrollIntoView({ block: "start", behavior: "smooth" })
                  }
                >
                  {uk ? "Назва, роки та джерело" : "Name, dates and source"}
                </PillButton>
              </div>
            )}
            <HistoricalMapCanvas
              historical={historical}
              edit={
                manual.data?.canEdit && editor.canvas
                  ? { ...editor.canvas, disabled: saveManual.isPending || manual.isError }
                  : undefined
              }
              land={physical.data?.land}
              rivers={physical.data?.rivers}
              places={drawn}
              view={view}
              uk={uk}
              borders={borders}
              riverLayer={rivers}
              selected={selectedPlace?.id ?? (selectedPolity?.id as string | undefined)}
              onPlace={choosePlace}
              onPolity={choosePolity}
              sourceRaster={
                originalLayer && detailed && borders && year <= 1453 ? byzFrame?.raster : undefined
              }
            />
            <p className="mt-2 text-xs text-muted">
              <span className="atlas-hatch-swatch" aria-hidden="true" />{" "}
              {uk
                ? "Штрихування — відносна територія: залежність, сфера впливу або неповний контроль. Суцільний колір — основна територія."
                : "Hatching: dependency, influence or partial control. Solid fill: core territory."}
            </p>
            {editor.draft && (
              <p role="status" className="mt-2 rounded-xl bg-forest-mid/10 p-3 text-xs">
                {editor.mode === "draw"
                  ? uk
                    ? "Малювання: натискайте на мапу, щоб додавати точки. Для переміщення мапи тягніть порожню ділянку."
                    : "Drawing: click the map to add vertices. Drag empty space to pan."
                  : uk
                    ? "Редагування: перетягуйте сині точки або вставляйте нові через «+». Чернетка ще не збережена."
                    : "Editing: drag blue handles or insert vertices with +. The draft is not saved yet."}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              {uk
                ? "■ Константинополь · ● Місто / поселення · ◌ Орієнтир регіону · Пунктир: оглядова межа. Фізична основа сучасна; деталізований шар відтворює берегові контури джерела."
                : "● Settlement · ◌ Regional reference, not a boundary · Dashed borders: approximate. Coastlines and rivers are modern physical references."}
            </p>
          </div>
          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-hairline bg-surface-2/40 p-4">
              <p className="text-xs font-bold text-forest-mid">
                {year} · {period.from}–{period.to}
              </p>
              <h3 className="mt-1 font-display font-extrabold">{period.title}</h3>
              <p className="mt-2 text-xs leading-5">{period.description}</p>
              <Sources ids={period.sources} />
            </div>
            {selectedPlace ? (
              <div className="rounded-2xl border border-forest-mid/30 p-4">
                <p className="text-xs font-bold text-forest-mid">
                  {selectedPlace.type === "city" ? "Місто / поселення" : "Регіональний осередок"}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold">{selectedPlace.name}</h3>
                <p className="mt-2 text-xs font-semibold">{selectedPlace.dateLabel}</p>
                <p className="mt-2 text-sm leading-6">{selectedPlace.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {uk
                    ? "Координата — орієнтир міста або регіону; вона не задає точний археологічний центр чи кордон."
                    : "Coordinates mark a reference location, not a surveyed archaeological site or territorial boundary."}
                </p>
                <Sources ids={selectedPlace.sources} />
              </div>
            ) : selectedPolity ? (
              <div className="rounded-2xl border border-forest-mid/30 p-4">
                <p className="text-xs font-bold text-forest-mid">
                  {uk ? "Дані зрізу" : "Snapshot data"}{" "}
                  {selectedPolity.properties.custom
                    ? `${selectedPolity.properties.validFrom}–${selectedPolity.properties.validTo}`
                    : (selectedPolity.properties.sourceYear ?? snapshot)}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold">
                  {historicalName(selectedPolity.properties.name, uk)}
                </h3>
                <p className="mt-2 text-xs text-muted">
                  {selectedPolity.properties.name} ·{" "}
                  {selectedPolity.properties.custom
                    ? uk
                      ? "Ручний шар школи"
                      : "School manual layer"
                    : selectedPolity.properties.region === "mongols"
                      ? uk
                        ? "Контур джерела; приблизні межі"
                        : "Source contour; approximate boundaries"
                      : selectedPolity.properties.detailed
                        ? uk
                          ? selectedPolity.properties.region === "rus"
                            ? "Контур карти Русі"
                            : selectedPolity.properties.region === "franks"
                              ? "Контур з векторної карти"
                              : "Контур з авторського растра"
                          : "Digitized source contour"
                        : `${uk ? "Рівень точності джерела" : "Source precision"}: ${selectedPolity.properties.precision}/3`}
                </p>
                <p className="mt-2 text-sm leading-6">
                  {selectedPolity.properties.custom
                    ? selectedPolity.properties.description ||
                      (uk ? "Опис ще не додано." : "No description provided.")
                    : selectedPolity.properties.region === "mongols"
                      ? uk
                        ? `Карта-джерело ${selectedPolity.properties.sourceYear}; показано приблизний історичний контур. Пряме управління і васальна залежність у джерелі можуть поєднуватися. ${selectedPolity.properties.validTo ? `Цей полігон застосований не пізніше ${selectedPolity.properties.validTo} року; це дата обмеження реконструкції, не завжди дата зникнення держави.` : ""}`
                        : "Dated source contour; direct rule and vassal dependency may be combined. Expiry limits the reconstruction, and is not necessarily the end of the state."
                      : selectedPolity.properties.detailed
                        ? uk
                          ? selectedPolity.properties.region === "rus"
                            ? `${rusFrame?.note ?? "Картографічна реконструкція Русі."} Колір збережено за джерелом; картки об’єднаних земель не означають єдиного князівства. Дрібні уділи доступні в оригіналі.`
                            : selectedPolity.properties.region === "franks"
                              ? "Політична область перенесена безпосередньо з SVG джерела зі збереженням вигинів і анклавів. Контури суміщено за містами або береговими орієнтирами; це картографічна реконструкція, а не точні щорічні кордони. Перевіряйте кольори й залежні території за легендою оригіналу."
                              : "Оцифрована кольорова область карти Lucius. Острови й берегові вигини збережені з мінімальним спрощенням; можливі артефакти дрібних підписів і вузьких територій. Звіряйте спірні місця з оригіналом. Детальніші лінії адміністративного поділу доступні в авторському шарі."
                          : selectedPolity.properties.region === "rus"
                            ? "Rus source contour with original colours. Registration is approximate. Some period maps group appanages; see the original legend. The 1240 endpoint uses the 1237 pre-invasion map."
                            : selectedPolity.properties.region === "franks"
                              ? "Political area transferred directly from source SVG, preserving bends and enclaves. Registration uses towns or coastal landmarks; check the original legend and snapshot date."
                              : "Digitized Lucius color area; small labels and narrow territories may leave raster artifacts. Check the original; administrative lines are available in the source layer."
                        : featureNote(selectedPolity.properties.name, snapshot!)}
                </p>
                {selectedPolity.properties.custom && (
                  <div className="mt-2 space-y-2 text-xs">
                    <p>
                      {uk ? "Контролер" : "Controller"}:{" "}
                      {historicalName(selectedPolity.properties.subject, uk)} ·{" "}
                      {selectedPolity.properties.control === "relative"
                        ? selectedPolity.properties.relation
                        : uk
                          ? "основна територія"
                          : "core territory"}
                    </p>
                    {selectedPolity.properties.sourceUrl && (
                      <a
                        className="inline-block text-forest-mid underline"
                        href={selectedPolity.properties.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {uk ? "Джерело ручної правки" : "Manual edit source"}
                      </a>
                    )}
                  </div>
                )}
                {manual.data?.canEdit && (
                  <div className="atlas-editor mt-3 flex flex-wrap gap-2">
                    <PillButton
                      type="button"
                      tone="ghost"
                      onClick={() => {
                        const saved = manual.data.entries.find(
                          (e) => `manual-${e.id}` === selectedPolity.id,
                        );
                        const draft = saved ?? newAtlasEdit(year, selectedPolity);
                        if (!saved) {
                          draft.name = historicalName(draft.name, uk);
                          draft.subject = historicalName(draft.subject, uk);
                        }
                        editor.start(draft);
                        setBorders(true);
                        setOriginalLayer(false);
                        setSelection(null);
                      }}
                    >
                      {uk ? "Редагувати країну й кордони" : "Edit country and borders"}
                    </PillButton>
                    <PillButton
                      type="button"
                      tone="ghost"
                      onClick={() => {
                        const draft = newAtlasEdit(year, selectedPolity, true);
                        draft.name =
                          (uk ? "Залежна територія: " : "Dependent territory: ") +
                          historicalName(selectedPolity.properties.name, uk);
                        draft.subject = historicalName(draft.subject, uk);
                        editor.start(draft);
                        setBorders(true);
                        setOriginalLayer(false);
                        setSelection(null);
                      }}
                    >
                      {uk ? "Додати штриховану залежність" : "Add hatched dependency"}
                    </PillButton>
                  </div>
                )}
                {selectedPolity.properties.invaded && (
                  <p className="mt-2 rounded-xl bg-terracotta/10 p-3 text-xs text-terracotta">
                    {uk
                      ? "Головний князівський осередок уже захоплено й розорено на цьому етапі. Передмонгольський контур показано для орієнтації; він не визначає окупаційну межу. Місцева державність і династія могли продовжити існування."
                      : "The principal centre was captured and sacked by this stage. The pre-invasion outline is a reference, not an occupation boundary; local statehood and dynasty could survive."}
                  </p>
                )}
                <Sources
                  ids={[
                    selectedPolity.properties.sourceId ??
                      (selectedPolity.properties.detailed ? "lucius" : "basemaps"),
                  ]}
                />
              </div>
            ) : (
              <p className="rounded-xl bg-cream p-3 text-xs text-muted">
                {uk
                  ? "Натисніть на територію або позначку, щоб відкрити її картку. Нижче є пошук та вибір з клавіатури."
                  : "Select a territory or marker for details. Search and keyboard selection are available below."}
              </p>
            )}
          </aside>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="relative block">
              <span className="sr-only">
                {uk ? "Пошук міста або осередку" : "Search settlements or references"}
              </span>
              <Search className="absolute top-3.5 left-3 size-4 text-muted" />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  uk ? "Місто, князівство, спільнота…" : "Town, principality, community…"
                }
                className="w-full pl-9"
              />
            </label>
            <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePlace(p)}
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-surface-2 px-3 text-left text-xs font-bold"
                >
                  <MapPin className="size-3 shrink-0" />
                  {p.name}
                </button>
              ))}
              {!matches.length && (
                <p className="p-2 text-xs text-muted">
                  {uk
                    ? "Немає позначок для цього року й пошуку. Перша згадка не є датою заснування."
                    : "No references for this year and search. First record is not a foundation date."}
                </p>
              )}
            </div>
          </div>
          <label className="block text-xs font-bold">
            {uk ? `Територія на мапі ${year}` : `Territory on overview map ${snapshot}`}
            <select
              aria-label={
                uk ? `Територія на мапі ${year}` : `Territory on overview map ${snapshot}`
              }
              className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
              value={selectedPolity?.id ?? ""}
              disabled={!historical || !borders}
              onChange={(e) => {
                const f = historical?.features.find((f) => f.id === e.target.value);
                if (f) choosePolity(f);
              }}
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
            <p className="mt-2 text-xs font-normal text-muted">
              {uk
                ? "Деталізовані контури Візантії та франків поєднані з оглядовими геометріями світу. Інші країни не деталізовано."
                : "Detailed Byzantine and Frankish contours are combined with world overview geometry; other countries retain their overview detail."}
            </p>
          </label>
        </div>
      </Panel>
      <Panel>
        <h2 className="font-display text-xl font-extrabold">
          {uk ? "Поруч на часовій шкалі" : "Nearby on the timeline"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {uk
            ? "Події до й після обраного року. Натисніть рік, щоб перейти до нього; ≈ означає умовне або дискусійне датування."
            : "Events before and after the selected year. Select a date to visit it; ≈ marks approximate or disputed dating."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {nearby.map((e) => (
            <article key={`${e.year}:${e.title}`} className="rounded-xl border border-hairline p-3">
              <button
                type="button"
                onClick={() => onChange(e.year, view)}
                className="min-h-9 rounded-full bg-forest/10 px-3 text-sm font-extrabold text-forest-mid"
              >
                {e.approximate ? "≈ " : ""}
                {e.year}
              </button>
              <h3 className="mt-2 text-sm font-extrabold">{e.title}</h3>
              <p className="mt-2 text-xs leading-5">{e.description}</p>
              <Sources ids={e.sources} />
            </article>
          ))}
        </div>
      </Panel>
      <Panel>
        <details>
          <summary className="cursor-pointer font-display text-lg font-extrabold">
            {uk ? "Джерела й методика" : "Sources and method"} ({ATLAS_SOURCES.length})
          </summary>
          <div className="mt-4 space-y-4 text-sm">
            <p>
              {uk
                ? "Це навчальний атлас: 11 оглядових зрізів світу, 39 детальних карт Візантії, 10 зрізів франків і 6 картографічних зрізів Русі з завершенням 1240. Детальні шари використовують останню доступну карту не пізніше обраного року; світ — найближчий оглядовий зріз. Річні кордони не інтерполюються. Культурний ареал, данина, князівські права та пряме управління могли перекриватися."
                : "This educational reconstruction has 11 overview maps, 39 Byzantine, 10 Frankish and 6 Rus source frames with a 1240 endpoint. It does not provide independently verified borders for every year; cultural areas, tribute, dynastic rights and direct rule can overlap."}
            </p>
            <p>
              {uk
                ? "Візантію перенесено з наданих PNG: перетини градусної сітки → підбір конічної проєкції → контроль берегів і річок → виділення кольорових областей → векторні контури. Оригінальні підписи й феми окремо перепроєктовано в локальний растровий шар. Похибка суміщення сітки не означає історичну точність кордонів; дрібні острови та вузькі анклави можуть втрачатися під час виділення кольору."
                : "Uploaded PNG graticule → fitted conic projection → coastline/river registration → color segmentation → vector contours. Original annotations are also reprojected into a local raster layer. Registration residual is not historical border accuracy; small islands and narrow enclaves may be missed."}
            </p>
            <p>
              {uk
                ? "Франки: оригінальні SVG Sémhur, Romain0 і Trasamundo → міста та берегові контрольні точки → геоприв’язка → пряме семплювання кривих Безьє → полігони. Церковні провінції 561 року не видаються за держави; залежні області 814 й спірну Аквітанію 843 показано окремо. Точність суміщення не є доказом історичної точності. Невизначені області оглядової бази вилучено: вони лишаються нейтральним суходолом."
                : "Frankish original SVGs → city/coastal controls → geographic registration → direct Bézier sampling → polygons. Church provinces are not polities; dependent territories and disputed Aquitaine are distinct. Unspecified overview regions are omitted, leaving neutral land."}{" "}
              <a
                href="/atlas/franks/NOTICE.md"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uk ? "Походження й ліцензії" : "Provenance and licenses"}
              </a>
            </p>
            <p>
              {uk
                ? "Русь: пряме перенесення політичних SVG і контурів кольорових областей растрів; геоприв’язка за містами, з контрольними точками поза підбором. Північні зони впливу, етнічні ареали й пізніші анклави не видано за одночасні державні кордони. 1240 — завершення з картою 1237 до навали."
                : "Rus: direct SVG and raster-colour contours registered against city markers, with held-out control points. Influence zones, ethnic ranges and retrospective enclaves are not treated as contemporary state borders. The 1240 endpoint retains the 1237 pre-invasion map."}{" "}
              <a
                href="/atlas/rus/NOTICE.md"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uk ? "Походження й ліцензії Русі" : "Rus provenance and licenses"}
              </a>
            </p>
            <p>
              {uk
                ? "Маркери міст фільтруються за документованими етапами; перша письмова згадка не дорівнює заснуванню. Числові межі показу племінних ареалів є оглядовою періодизацією. Природні русла й береги з часом змінювалися. Для академічної роботи звіряйте конкретне твердження з указаним джерелом."
                : "First written mentions are not founding dates. Tribal marker ranges are broad periodization. Rivers and coasts changed over time. Check each claim against its linked scholarly source."}
            </p>
            <p className="text-xs text-muted">
              {uk
                ? "Оновлено 13.10.2026. Франки: Sémhur, Trasamundo (CC BY-SA 3.0), Romain0 (public domain), векторний перенос; походження та контрольні точки наведені в окремому описі. Оглядові карти: Historical Basemaps, GPL-3.0 (спрощення 0,02°); фізична основа: Natural Earth, public domain. Візантія: надані користувачем карти ©Lucius, конічна геоприв’язка, контури спрощено на 1,25 пікселя оригіналу. Друкарські позначення приглушено лише в копії для розпізнавання заливки; авторський шар зберігає їх. Ці величини не визначають історичну точність."
                : "Prepared 2026-10-12. Overview: Historical Basemaps GPL-3.0, simplification 0.02°. Physical reference: Natural Earth, public domain. Byzantium: user-supplied ©Lucius PNGs, conic georeferencing, 1.25 source-pixel contour simplification; typography suppressed only in classification, preserved in displayed raster. These tolerances do not define historical accuracy."}{" "}
              <a
                className="underline"
                href="/atlas/NOTICE.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uk ? "Походження даних" : "Data provenance"}
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href="/atlas/historical-basemaps-LICENSE.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                GPL-3.0
              </a>
            </p>
            <ul className="grid gap-3 md:grid-cols-2">
              {ATLAS_SOURCES.map((s) => (
                <li key={s.id} className="rounded-xl bg-surface-2 p-3">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-forest-mid underline underline-offset-4"
                  >
                    {s.title}
                  </a>
                  <p className="mt-1 text-xs text-muted">{s.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </Panel>
    </>
  );
}
