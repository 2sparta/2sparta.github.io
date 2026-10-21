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
import { ATLAS_EVENTS, ATLAS_PERIODS, ATLAS_PLACES, ATLAS_SOURCES } from "@/lib/atlas/content";
import {
  ANTIQUITY_EVENTS,
  ANTIQUITY_MIN_YEAR,
  ANTIQUITY_PLACES,
  ANTIQUITY_YEARS,
  antiquityPeriod,
  antiquitySnapshot,
  clampSharedYear,
  formatAtlasYear,
  overlayAntiquity,
  validateAntiquityData,
} from "@/lib/atlas/antiquity";
import {
  GERMANY_EVENTS,
  GERMANY_MIN_YEAR,
  GERMANY_PLACES,
  GERMANY_YEARS,
  germanyPeriod,
  germanySnapshot,
  overlayGermany,
  validateGermanyData,
} from "@/lib/atlas/germany";
import {
  NAPOLEON_EVENTS,
  NAPOLEON_MAX_YEAR,
  NAPOLEON_MIN_YEAR,
  NAPOLEON_PLACES,
  NAPOLEON_YEARS,
  napoleonPeriod,
  napoleonSnapshot,
  overlayNapoleon,
  validateNapoleonData,
} from "@/lib/atlas/napoleon";
import {
  ISLES_MAX_YEAR,
  ISLES_PLACES,
  clampIslesYear,
  isBritishView,
  islesEventsFor,
  islesPeriod,
  islesSnapshot,
  overlayBritishIsles,
  overseasSnapshot,
  validateIslesData,
  validateOverseasData,
} from "@/lib/atlas/isles";
import {
  BYZANTINE_EVENTS,
  BYZANTINE_PERIODS,
  BYZANTINE_PLACES,
  type ByzantineData,
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
} from "@/lib/atlas/frankish";
import { FRANKISH_YEARS, frankishSnapshot } from "@/lib/atlas/model";
import { RUS_YEARS, rusSnapshot } from "@/lib/atlas/model";
import { RUS_EVENTS, RUS_PERIODS, RUS_PLACES, validateRusData } from "@/lib/atlas/rus";
import {
  MONGOL_EVENTS,
  validateMongolData,
  mongolFrameAt,
  mongolCollectionAt,
  mongolPlacesAt,
  mongolPeriod,
  campaignPlaces,
  markInvadedRus,
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
import { saveSharedBorders } from "@/lib/atlas/borders";
import {
  addFranceLayer,
  franceSnapshot,
  validateFranceData,
  FRANCE_EVENTS,
  FRANCE_PERIODS,
  FRANCE_PLACES,
} from "@/lib/atlas/france";
import {
  addCommonwealthLayer,
  commonwealthSnapshot,
  COMMONWEALTH_TRANSITIONS,
  commonwealthFrameAt,
  validateCommonwealthData,
  COMMONWEALTH_EVENTS,
  COMMONWEALTH_PERIODS,
  COMMONWEALTH_PLACES,
  cossackPlacesAt,
  occupationPlacesAt,
  isCommonwealthView,
} from "@/lib/atlas/commonwealth";
import { HistoricalMapCanvas } from "./historical-map-canvas";
import { Panel, PillButton, TextInput } from "./ui/panel";
import {
  addSpainLayer,
  isSpainView,
  spainFrameAt,
  validateSpainData,
  SPAIN_EVENTS,
  SPAIN_PERIODS,
  SPAIN_PLACES,
  spanishCampaignPlaces,
} from "@/lib/atlas/spain";
import {
  ENGLAND_EVENTS,
  ENGLAND_PERIODS,
  ENGLAND_PLACES,
  ENGLAND_YEARS,
  clampEnglandYear,
  englandDate,
  englandDateKey,
  englandSnapshot,
  formatEnglandDate,
  shiftEnglandDay,
  validateEnglandData,
} from "@/lib/atlas/england";
import {
  normalizeAtlasDate,
  atlasDateKey,
  atlasDateOrdinal,
  atlasDateFromOrdinal,
  ATLAS_LAST_DAY,
  daysInAtlasMonth,
  shiftAtlasDay,
  formatAtlasDate,
  parseAtlasDate,
  type AtlasDate,
} from "@/lib/atlas/date";

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
export function HistoricalAtlas({
  year,
  month = 1,
  day = 1,
  view,
  onChange: onNavigate,
}: {
  year: number;
  month?: number;
  day?: number;
  view: AtlasView;
  onChange: (year: number, view: AtlasView, date?: Pick<AtlasDate, "month" | "day">) => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const englandView = view === "england";
  const wideTimeline =
    view === "europe" || view === "world" || view === "antiquity" || view === "germany" || view === "napoleon";
  const date = englandView
    ? englandDate(year, month, day)
    : wideTimeline
      ? { year: clampSharedYear(year), month: 1, day: 1 }
      : normalizeAtlasDate(year, month, day);
  const dateKey = englandView
    ? englandDateKey(date)
    : wideTimeline
      ? `wide:${date.year}`
      : atlasDateKey(date);
  const onChange = (
    nextYear: number,
    nextView: AtlasView,
    parts = { month: date.month, day: date.day },
  ) => {
    const wide =
      nextView === "europe" ||
      nextView === "world" ||
      nextView === "antiquity" ||
      nextView === "germany" ||
      nextView === "napoleon";
    const next = wide
      ? { year: clampSharedYear(nextYear), month: 1, day: 1 }
      : nextView === "england"
        ? englandDate(nextYear, parts.month, parts.day)
        : normalizeAtlasDate(nextYear, parts.month, parts.day);
    const nextKey = wide
      ? `wide:${next.year}`
      : nextView === "england"
        ? englandDateKey(next)
        : atlasDateKey(next);
    if (editor.draft && (nextKey !== dateKey || nextView !== view)) {
      if (
        !window.confirm(
          uk
            ? "Відкинути незбережену правку перед зміною дати чи регіону?"
            : "Discard the unsaved edit before changing date or region?",
        )
      )
        return;
      editor.dispatch({ type: "cancel" });
    }
    onNavigate(next.year, nextView, { month: next.month, day: next.day });
  };
  const spanishView = isSpainView(view);
  const [reconquista, setReconquista] = useState(true);
  const [colonies, setColonies] = useState(true);
  const [civilFronts, setCivilFronts] = useState(true);
  const spain = useQuery({
    queryKey: ["historical-atlas-spain"],
    queryFn: async ({ signal }) =>
      validateSpainData(await jsonFile("/atlas/spain/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && year >= 700,
    retry: 1,
  });
  const spainFrame = useMemo(
    () => spainFrameAt(spain.data, date, { reconquista, colonies, fronts: civilFronts }),
    [spain.data, dateKey, reconquista, colonies, civilFronts],
  );
  const [dayText, setDayText] = useState(String(date.day));
  useEffect(() => setDayText(String(date.day)), [dateKey]);
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
      const entries = validateAtlasEdits(
        saveSharedBorders(manual.data.entries, editor.draft, historical, editor.moves),
      );
      if (await saveEntries(entries)) editor.dispatch({ type: "cancel" });
    } catch (e) {
      const message = atlasEditError(e, uk);
      setManualError(message);
      toast.error(message);
    }
  };
  const [ukrainianLands, setUkrainianLands] = useState(true);
  const [occupations, setOccupations] = useState(true);
  const [cossackHistory, setCossackHistory] = useState(true);
  const regionalView = isCommonwealthView(view);
  const easternHistory = regionalView || (view === "rus" && year > 1240);
  const commonwealthYear = commonwealthSnapshot({ year, month, day });
  const commonwealth = useQuery({
    queryKey: ["historical-atlas-commonwealth"],
    queryFn: async ({ signal }) =>
      validateCommonwealthData(await jsonFile("/atlas/commonwealth/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && commonwealthYear !== undefined,
    retry: 1,
  });
  const commonwealthFrame = useMemo(
    () =>
      commonwealthFrameAt(
        commonwealth.data,
        { year, month, day },
        {
          lands: ukrainianLands,
          occupations,
          cossacks: cossackHistory,
        },
      ),
    [commonwealth.data, year, month, day, ukrainianLands, occupations, cossackHistory],
  );
  const franceYear = franceSnapshot(year);
  const france = useQuery({
    queryKey: ["historical-atlas-france"],
    queryFn: async ({ signal }) =>
      validateFranceData(await jsonFile("/atlas/france/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && franceYear !== undefined,
    retry: 1,
  });
  const franceFrame =
    year >= 1940 && year <= 1944
      ? undefined
      : france.data?.frames.find((f) => f.year === franceYear);
  const englandYear = englandSnapshot(englandView ? date.year : year);
  const england = useQuery({
    queryKey: ["historical-atlas-england"],
    queryFn: async ({ signal }) =>
      validateEnglandData(await jsonFile("/atlas/england/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && englandView,
    retry: 1,
  });
  const englandFrame = england.data?.frames.find((f) => f.year === englandYear);
  const snapshot = overviewSnapshot(year);
  const byzYear = year >= ATLAS_MIN_YEAR && year <= 1453 ? byzantineSnapshot(year) : undefined;
  const frYear = frankishSnapshot(year);
  const rusYear = rusSnapshot(year);
  const mongolDetail = true;
  const campaignStep = "";
  const newView = ["mongols", "hordes", "mughals"].includes(view);
  const britishView = isBritishView(view) && view !== "england";
  const sharedMap =
    view === "europe" || view === "world" || view === "antiquity" || view === "germany" || view === "napoleon";
  const showBritish = britishView || sharedMap;
  const yearMin = sharedMap ? ANTIQUITY_MIN_YEAR : ATLAS_MIN_YEAR;
  const yearMax = showBritish ? ISLES_MAX_YEAR : ATLAS_MAX_YEAR;
  const clampViewYear = (value: number, nextView: AtlasView) =>
    nextView === "europe" ||
    nextView === "world" ||
    nextView === "antiquity" ||
    nextView === "germany" ||
    nextView === "napoleon"
      ? clampSharedYear(value)
      : isBritishView(nextView)
        ? clampIslesYear(value)
        : clampAtlasYear(value);
  const invasion =
    year >= 1223 && year <= 1242 && (view === "rus" || view === "mongols" || view === "hordes");
  const rusDetail = true;
  const frankishDetail = true;
  const detailed = true;
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
    enabled: typeof window !== "undefined" && detailed && year >= ATLAS_MIN_YEAR && year <= 1453,
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
    year >= ATLAS_MIN_YEAR && year <= 1453
      ? byzantine.data?.frames.find((f) => f.year === byzYear)
      : undefined;
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
  useEffect(() => setSelection(null), [dateKey, campaignStep, mongolDetail]);
  const regionalHistorical = useMemo(
    () =>
      addCommonwealthLayer(
        addFranceLayer(
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
          franceFrame?.collection,
        ),
        commonwealthFrame?.collection,
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
      franceFrame,
      commonwealthFrame,
    ],
  );
  const sourceHistorical = useMemo(
    () => addSpainLayer(regionalHistorical, spainFrame?.collection),
    [regionalHistorical, spainFrame],
  );
  const isles = useQuery({
    queryKey: ["historical-atlas-isles"],
    queryFn: async ({ signal }) =>
      validateIslesData(await jsonFile("/atlas/isles/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && showBritish,
    retry: 1,
  });
  const overseas = useQuery({
    queryKey: ["historical-atlas-overseas"],
    queryFn: async ({ signal }) =>
      validateOverseasData(await jsonFile("/atlas/isles/overseas.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && showBritish,
    retry: 1,
  });
  const isleYear = showBritish ? islesSnapshot(year) : undefined;
  const overseasYear = showBritish ? overseasSnapshot(year) : undefined;
  const isleFrame =
    showBritish && isleYear ? isles.data?.isles.find((frame) => frame.year === isleYear) : undefined;
  const overseasFrame =
    showBritish && overseasYear
      ? overseas.data?.frames.find((frame) => frame.year === overseasYear)
      : undefined;
  const antiquityYear = sharedMap ? antiquitySnapshot(year) : undefined;
  const antiquity = useQuery({
    queryKey: ["historical-atlas-antiquity"],
    queryFn: async ({ signal }) =>
      validateAntiquityData(await jsonFile("/atlas/antiquity/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && sharedMap,
    retry: 1,
  });
  const antiquityFrame =
    antiquityYear !== undefined
      ? antiquity.data?.frames.find((frame) => frame.year === antiquityYear)
      : undefined;
  const germanyYear = sharedMap ? germanySnapshot(year) : undefined;
  const germany = useQuery({
    queryKey: ["historical-atlas-germany"],
    queryFn: async ({ signal }) =>
      validateGermanyData(await jsonFile("/atlas/germany/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && sharedMap,
    retry: 1,
  });
  const germanyFrame =
    germanyYear !== undefined
      ? germany.data?.frames.find((frame) => frame.year === germanyYear)
      : undefined;
  const napoleonYear = sharedMap ? napoleonSnapshot(year) : undefined;
  const napoleon = useQuery({
    queryKey: ["historical-atlas-napoleon"],
    queryFn: async ({ signal }) =>
      validateNapoleonData(await jsonFile("/atlas/napoleon/frames.json", signal)),
    staleTime: Infinity,
    enabled: typeof window !== "undefined" && sharedMap,
    retry: 1,
  });
  const napoleonFrame =
    napoleonYear !== undefined
      ? napoleon.data?.frames.find((frame) => frame.year === napoleonYear)
      : undefined;
  const layered = useMemo(() => {
    const withBritain =
      showBritish && isles.data
        ? overlayBritishIsles(
            sourceHistorical,
            isleFrame?.collection,
            overseas.data ? overseasFrame?.collection : undefined,
          )
        : sourceHistorical;
    const withAntiquity = antiquityFrame
      ? overlayAntiquity(withBritain, antiquityFrame.collection)
      : withBritain;
    const withGermany =
      germanyFrame && !napoleonFrame ? overlayGermany(withAntiquity, germanyFrame.collection) : withAntiquity;
    return napoleonFrame ? overlayNapoleon(withGermany, napoleonFrame.collection) : withGermany;
  }, [
    showBritish,
    isles.data,
    sourceHistorical,
    isleFrame,
    overseas.data,
    overseasFrame,
    antiquityFrame,
    germanyFrame,
    napoleonFrame,
  ]);
  const historical = useMemo(
    () => applyAtlasEdits(layered, manual.data?.entries ?? [], year),
    [layered, manual.data?.entries, year],
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
    () => [
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
    ],
    [],
  );
  const markerEpoch = year < ATLAS_MIN_YEAR ? year : placeEpoch(allPlaces, year);
  const available = useMemo(
    () =>
      [
        ...activePlaces(allPlaces, markerEpoch),
        ...(mongolDetail ? mongolPlacesAt(year) : []),
        ...campaignMarkers,
        ...(cossackHistory ? cossackPlacesAt(year) : []),
        ...(occupations ? occupationPlacesAt(year) : []),
        ...spanishCampaignPlaces(date),
      ].filter((p) =>
        britishView
          ? Boolean(
              p.isles &&
                (view === "isles" ||
                  (view === "ireland" && p.irish) ||
                  (view === "scotland" && p.scottish) ||
                  (view === "wales" && p.welsh)),
            )
          : spanishView
          ? p.spanish && (colonies || !p.colonial)
          : englandView
            ? p.english
            : view === "cossacks"
            ? p.ruthenian
            : view === "commonwealth"
              ? p.commonwealth
              : view === "poland"
                ? p.polish || p.ruthenian
                : view === "lithuania"
                  ? p.lithuanian
                  : view === "france"
                    ? p.french
                    : newView
                      ? p.mongol
                      : view === "franks"
                        ? p.frankish
                        : view === "byzantium"
                          ? p.byzantine
                          : view !== "rus" || (!p.europe && !p.spanish) || p.ruthenian,
      ),
    [
      markerEpoch,
      view,
      year,
      mongolDetail,
      campaignMarkers,
      newView,
      cossackHistory,
      occupations,
      dateKey,
      spanishView,
      englandView,
      britishView,
      colonies,
    ],
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
  const mapHistorical = englandView ? englandFrame?.collection : historical;
  const selectedPlace =
    selection?.kind === "place" ? available.find((p) => p.id === selection.id) : undefined;
  const selectedPolity =
    selection?.kind === "polity" &&
    mapHistorical?.features.some((f) => f.id === selection.feature.id)
      ? mapHistorical.features.find((f) => f.id === selection.feature.id)
      : undefined;
  const period = view === "napoleon"
    ? napoleonPeriod(year)
    : view === "germany"
      ? germanyPeriod(year)
      : britishView && isBritishView(view)
        ? islesPeriod(view, year)
        : sharedMap && year < ATLAS_MIN_YEAR
          ? antiquityPeriod(year)
          : spanishView
            ? SPAIN_PERIODS.find((p) => year >= p.from && year <= p.to)!
            : englandView
              ? ENGLAND_PERIODS.find((p) => date.year >= p.from && date.year <= p.to)!
              : newView
                ? mongolPeriod(year, view)
                : ((easternHistory
                    ? COMMONWEALTH_PERIODS
                    : view === "france"
                      ? FRANCE_PERIODS
                      : view === "rus"
                        ? RUS_PERIODS
                        : view === "franks"
                          ? FRANKISH_PERIODS
                          : view === "byzantium"
                            ? BYZANTINE_PERIODS
                            : ATLAS_PERIODS
                  ).find((p) => year >= p.from && year <= p.to) ?? {
                    from: 1454,
                    to: showBritish ? ISLES_MAX_YEAR : ATLAS_MAX_YEAR,
                    title:
                      showBritish && year > 1400
                        ? uk
                          ? "Острови й заморські володіння"
                          : "Isles and overseas possessions"
                        : uk
                          ? "Пізніші століття"
                          : "Later centuries",
                    description:
                      showBritish && year > 1400
                        ? uk
                          ? "Оглядові країни після 1400 року ще не всі налаштовані. На тій самій мапі лишаються Британські острови, Німеччина, наполеонівські зрізи й пізніша колоніальна схема."
                          : "Some countries after 1400 are not configured. The same map still shows the British Isles, Germany, the Napoleonic frames and a later colonial schematic."
                        : uk
                          ? "Для цього регіону пізніші територіальні шари ще не налаштовано. Історія ханств і Великих Моголів доступна в окремих масштабах."
                          : "Later territorial layers are not configured for this region. The khanates and Mughals have their own scales.",
                    sources: showBritish && year > 1400 ? ["isles-eh", "isles-empire"] : ["mongol-met"],
                  });
  const matches = available.filter((p) =>
    `${p.name} ${p.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const nearby = (
    view === "napoleon"
      ? NAPOLEON_EVENTS
      : view === "germany"
        ? GERMANY_EVENTS
        : britishView && isBritishView(view)
          ? islesEventsFor(view)
          : sharedMap && year < ATLAS_MIN_YEAR
            ? ANTIQUITY_EVENTS
            : spanishView
              ? SPAIN_EVENTS
              : englandView
                ? ENGLAND_EVENTS
                : easternHistory
                  ? COMMONWEALTH_EVENTS
                  : view === "france"
                    ? FRANCE_EVENTS
                    : newView
                      ? MONGOL_EVENTS
                      : view === "rus"
                        ? [
                            ...RUS_EVENTS,
                            ...(invasion
                              ? MONGOL_EVENTS.filter((e) => e.sources.includes("mongol-invasion"))
                              : []),
                          ]
                        : view === "franks"
                          ? FRANKISH_EVENTS
                          : view === "byzantium"
                            ? [
                                ...BYZANTINE_EVENTS,
                                ...ATLAS_EVENTS.filter((e) => e.sources.includes("met-byzantium")),
                              ]
                            : [
                                ...ATLAS_EVENTS,
                                ...BYZANTINE_EVENTS,
                                ...FRANKISH_EVENTS,
                                ...FRANCE_EVENTS,
                                ...COMMONWEALTH_EVENTS,
                                ...SPAIN_EVENTS,
                                ...(showBritish ? islesEventsFor("isles") : []),
                                ...GERMANY_EVENTS,
                                ...NAPOLEON_EVENTS,
                              ]
  )
    .filter((e) => view !== "rus" || !e.europe || e.ruthenian)
    .filter((e) => Math.abs(e.year - year) <= 150)
    .sort((a, b) =>
      englandView || wideTimeline
        ? Math.abs(a.year - date.year) - Math.abs(b.year - date.year)
        : Math.abs(
            atlasDateOrdinal(normalizeAtlasDate(a.year, a.month, a.day)) - atlasDateOrdinal(date),
          ) -
          Math.abs(
            atlasDateOrdinal(normalizeAtlasDate(b.year, b.month, b.day)) - atlasDateOrdinal(date),
          ),
    )
    .slice(0, 6)
    .sort((a, b) =>
      englandView || wideTimeline
        ? a.year - b.year
        : atlasDateKey(normalizeAtlasDate(a.year, a.month, a.day)).localeCompare(
            atlasDateKey(normalizeAtlasDate(b.year, b.month, b.day)),
          ),
    );
  const commitDay = () => {
    if (wideTimeline) return;
    const next = englandView
      ? englandDate(year, date.month, dayText.trim() ? Number(dayText) : date.day)
      : normalizeAtlasDate(year, date.month, dayText.trim() ? Number(dayText) : date.day);
    setDayText(String(next.day));
    onChange(year, view, next);
  };
  const warQuickDates = [
    "1931-04-14",
    "1936-07-17",
    "1936-07-31",
    "1936-09-30",
    "1937-10-31",
    "1938-11-30",
    "1939-02-28",
    "1939-04-01",
  ];
  const quickDates = wideTimeline
    ? [
        ...new Set([
          ...ANTIQUITY_YEARS,
          ...GERMANY_YEARS,
          ...NAPOLEON_YEARS,
          ...ATLAS_YEARS,
          395,
          1453,
          1603,
          1707,
          1801,
          1858,
          1922,
          1994,
        ]),
      ]
        .sort((a, b) => a - b)
        .map((y) => ({ year: y, month: 1, day: 1 }))
    : spanishView && year >= 1936 && year <= 1939
      ? warQuickDates.map((key) => parseAtlasDate(key)!)
      : (spanishView
          ? [711, 750, 1050, 1090, 1220, 1492, 1530, 1650, 1783, 1825, 1899, 1936, 1939, 1976]
          : englandView
            ? [...ENGLAND_YEARS]
          : regionalView
            ? view === "cossacks"
              ? [1591, 1594, 1625, 1630, 1635, 1637, 1638, 1648, 1649, 1651, 1655, 1667]
              : [1000, 1279, 1387, 1530, 1569, 1618, 1655, 1667, 1772, 1793, 1795, 1938, 1994]
            : ATLAS_YEARS
        ).map((y) =>
          spanishView && [1492, 1899, 1936, 1939, 1976].includes(y)
            ? parseAtlasDate(
                (
                  {
                    1492: "1492-01-02",
                    1899: "1899-04-11",
                    1936: "1936-07-31",
                    1939: "1939-02-28",
                    1976: "1976-02-26",
                  } as Record<number, string>
                )[y],
              )!
            : regionalView && COMMONWEALTH_TRANSITIONS[y]
              ? parseAtlasDate(COMMONWEALTH_TRANSITIONS[y])!
              : englandView
                ? englandDate(y)
                : normalizeAtlasDate(y),
        );
  const commitYear = () => {
    const next = englandView
      ? clampEnglandYear(yearText.trim() ? Number(yearText) : year)
      : clampViewYear(yearText.trim() ? Number(yearText) : year, view);
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
  if (germanyFrame && !napoleonFrame)
    warnings.push(
      germanyYear === 1937
        ? "Німецькі межі схематичні. Зріз 1937 року не включає аншлюс, Судети й окупації 1938–1945."
        : "Німецькі межі схематичні й тримаються до наступного зрізу, без щорочної перемальовки.",
    );
  if (sharedMap && year < ATLAS_MIN_YEAR)
    warnings.push(
      "Античні межі схематичні. Берег зрізано за сучасним суходолом. Зріз не змінюється щороку: Карфаген зникає 146 року до н. е., Британія з’являється на зрізі 117 року.",
    );
  if (napoleonFrame)
    warnings.push(
      napoleonYear === 1812
        ? "Наполеонівські межі схематичні. Штрих до Москви — похід 1812 року, не анексія Росії."
        : "Наполеонівські межі схематичні й тримаються до наступного зрізу. Штрих означає неповну владу, а не звичайну провінцію.",
    );
  if (showBritish && year >= ATLAS_MIN_YEAR)
    warnings.push(
      "Британські острови й заморські володіння намальовані на тій самій мапі. Внутрішні межі схематичні; берег зрізано за сучасним суходолом Natural Earth.",
    );
  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "useful");
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(date.month));
    url.searchParams.set("day", String(date.day));
    url.searchParams.set("view", view);
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success(uk ? "Посилання скопійовано" : "Link copied");
    } catch {
      toast.info(
        uk
          ? "Копіювання недоступне. Дата й масштаб збережені в адресному рядку."
          : "Copy unavailable. The address bar retains your date and view.",
      );
    }
  };
  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-forest-mid">
              {wideTimeline
                ? `${formatAtlasYear(yearMin, uk)}–${yearMax}`
                : englandView
                  ? "43–1994"
                  : "395–1994"} · {uk ? "навчальний атлас" : "learning atlas"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">
              {uk ? "Світ і держави крізь час" : "World and states through time"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              {uk
                ? "Історичний атлас із датованими територіями, містами й джерелами. Англія: від Римської Британії до сучасного поділу островів. Іспанія: завоювання, Реконкіста, колоніальні володіння та громадянська війна. До 395 року на спільній мапі є Рим, Карфаген і Персія, з 962 — Німеччина, а в 1792–1815 — наполеонівські війни. Кнопки лише наближають камеру."
                : "Detailed source maps of Rus, Byzantium, the Franks, France, Spain and England. Before 395 the shared map shows Rome, Carthage and Persia, from 962 Germany, and in 1792–1815 the Napoleonic Wars. The buttons only move the camera."}
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
              min={englandView ? 43 : yearMin}
              max={englandView ? 1994 : yearMax}
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
          <label className="block text-xs font-bold">
            {uk ? "Місяць подій" : "Event month"}
            <select
              aria-label={uk ? "Місяць подій" : "Event month"}
              disabled={wideTimeline}
              value={date.month}
              onChange={(e) =>
                onChange(year, view, { month: Number(e.target.value), day: date.day })
              }
              className="mt-1 block min-h-11 w-36 rounded-full border border-hairline bg-surface-2 px-3 text-sm"
            >
              {(uk
                ? [
                    "Січень",
                    "Лютий",
                    "Березень",
                    "Квітень",
                    "Травень",
                    "Червень",
                    "Липень",
                    "Серпень",
                    "Вересень",
                    "Жовтень",
                    "Листопад",
                    "Грудень",
                  ]
                : [
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ]
              ).map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold">
            {uk ? "День подій" : "Event day"}
            <TextInput
              type="number"
              min={1}
              max={daysInAtlasMonth(year, date.month)}
              step={1}
              disabled={wideTimeline}
              value={dayText}
              onChange={(e) => setDayText(e.target.value)}
              onBlur={commitDay}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDay();
              }}
              className="mt-1 block w-20"
            />
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={
                wideTimeline
                  ? uk
                    ? "Попередній рік"
                    : "Previous year"
                  : uk
                    ? "Попередній день"
                    : "Previous day"
              }
              disabled={
                wideTimeline
                  ? year <= yearMin
                  : englandView
                    ? date.year === 43 && date.month === 1 && date.day === 1
                    : atlasDateOrdinal(date) === 0
              }
              onClick={() => {
                if (wideTimeline) {
                  onChange(clampSharedYear(year - 1), view);
                  return;
                }
                const d = englandView ? shiftEnglandDay(date, -1) : shiftAtlasDay(date, -1);
                onChange(d.year, view, d);
              }}
              className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label={
                wideTimeline
                  ? uk
                    ? "Наступний рік"
                    : "Next year"
                  : uk
                    ? "Наступний день"
                    : "Next day"
              }
              disabled={
                wideTimeline
                  ? year >= yearMax
                  : englandView
                    ? date.year === 1994 && date.month === 12 && date.day === 31
                    : atlasDateOrdinal(date) === ATLAS_LAST_DAY
              }
              onClick={() => {
                if (wideTimeline) {
                  onChange(clampSharedYear(year + 1), view);
                  return;
                }
                const d = englandView ? shiftEnglandDay(date, 1) : shiftAtlasDay(date, 1);
                onChange(d.year, view, d);
              }}
              className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex w-full min-w-0 basis-full items-center gap-2 lg:w-auto lg:flex-1 lg:basis-0">
            <button
              type="button"
              aria-label={uk ? "На 10 років назад" : "Back 10 years"}
              disabled={year <= (englandView ? 43 : yearMin)}
              onClick={() =>
                onChange(
                  englandView ? clampEnglandYear(year - 10) : clampViewYear(year - 10, view),
                  view,
                )
              }
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="range"
              aria-label={
                wideTimeline
                  ? uk
                    ? `Часова шкала ${formatAtlasYear(yearMin, uk)}–${yearMax}`
                    : `Timeline ${formatAtlasYear(yearMin, false)}–${yearMax}`
                  : englandView
                    ? uk
                      ? "Часова шкала 43–1994"
                      : "Timeline 43–1994"
                    : uk
                      ? "Часова шкала 395–1994"
                      : "Timeline 395–1994"
              }
              min={wideTimeline ? yearMin : englandView ? 43 : 0}
              max={wideTimeline ? yearMax : englandView ? 1994 : ATLAS_LAST_DAY}
              step={1}
              value={wideTimeline || englandView ? date.year : atlasDateOrdinal(date)}
              aria-valuetext={
                wideTimeline
                  ? formatAtlasYear(date.year, uk)
                  : englandView
                    ? formatEnglandDate(date)
                    : formatAtlasDate(date)
              }
              onChange={(e) => {
                if (wideTimeline) {
                  onChange(clampSharedYear(Number(e.target.value)), view);
                  return;
                }
                if (englandView) {
                  onChange(clampEnglandYear(Number(e.target.value)), view, {
                    month: date.month,
                    day: date.day,
                  });
                  return;
                }
                const d = atlasDateFromOrdinal(Number(e.target.value));
                onChange(d.year, view, d);
              }}
              className="min-w-20 flex-1 accent-forest-mid"
            />
            <button
              type="button"
              aria-label={uk ? "На 10 років уперед" : "Forward 10 years"}
              disabled={year >= (englandView ? 1994 : yearMax)}
              onClick={() =>
                onChange(
                  englandView ? clampEnglandYear(year + 10) : clampViewYear(year + 10, view),
                  view,
                )
              }
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
          {quickDates.map((d) => (
            <button
              key={englandView ? englandDateKey(d) : wideTimeline ? `wide:${d.year}` : atlasDateKey(d)}
              type="button"
              onClick={() => onChange(d.year, view, d)}
              aria-pressed={dateKey === (englandView ? englandDateKey(d) : wideTimeline ? `wide:${d.year}` : atlasDateKey(d))}
              className={`min-h-9 rounded-full px-3 text-xs font-bold ${dateKey === (englandView ? englandDateKey(d) : wideTimeline ? `wide:${d.year}` : atlasDateKey(d)) ? "bg-forest text-paper" : "bg-surface-2 text-ink"}`}
            >
              {wideTimeline
                ? formatAtlasYear(d.year, uk)
                : englandView
                  ? String(d.year)
                  : formatAtlasDate(
                      d,
                      (spanishView && year >= 1936 && year <= 1939) ||
                        (regionalView && COMMONWEALTH_TRANSITIONS[d.year])
                        ? "day"
                        : "year",
                    )}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-forest-mid/25 bg-forest-mid/5 p-3 text-sm">
          <strong>
            {uk ? "Дата подій" : "Event date"}:{" "}
            <span data-testid="atlas-event-date">
              {wideTimeline
                ? formatAtlasYear(year, uk)
                : englandView
                  ? formatEnglandDate(date)
                  : formatAtlasDate(date)}
            </span>{" "}
            ·{" "}
            {spanishView || regionalView || englandView
              ? uk
                ? "Зріз регіону"
                : "Regional snapshot"
              : uk
                ? "Світ"
                : "World"}
            :{" "}
            {spanishView
              ? spainFrame
                ? formatAtlasDate(parseAtlasDate(spainFrame.date)!, spainFrame.precision)
                : "—"
              : englandView
                ? (englandFrame?.year ?? "—")
                : regionalView
                  ? commonwealthFrame?.date
                    ? commonwealthFrame.date.split("-").reverse().join(".")
                    : (commonwealthFrame?.year ?? "—")
                  : (snapshot ?? "—")}
            {!(spanishView || englandView) &&
              detailed &&
              year <= 1453 &&
              ` · ${uk ? "Візантія" : "Byzantium"}: ${byzYear}`}
            {!(spanishView || englandView) &&
              frankishDetail &&
              frYear !== undefined &&
              ` · ${uk ? "Франки" : "Franks"}: ${frYear}`}
            {!(spanishView || englandView) &&
              rusDetail &&
              rusFrame &&
              rusYear !== undefined &&
              ` · ${uk ? "Русь" : "Rus"}: ${rusFrame.sourceYear}${rusYear === 1240 ? (uk ? " (до навали)" : " (before invasion)") : ""}`}
            {antiquityYear !== undefined && ` · ${uk ? "Античність" : "Antiquity"}: ${formatAtlasYear(antiquityYear, uk)}`}
            {germanyYear !== undefined && !napoleonYear && ` · ${uk ? "Німеччина" : "Germany"}: ${germanyYear}`}
            {napoleonYear !== undefined && ` · ${uk ? "Наполеон" : "Napoleon"}: ${napoleonYear}`}
            {showBritish && isleYear !== undefined && ` · ${uk ? "Острови" : "Isles"}: ${isleYear}`}
            {showBritish &&
              (overseasYear !== undefined
                ? ` · ${uk ? "Володіння" : "Possessions"}: ${overseasYear}`
                : year >= 1558 && year < 1655
                  ? uk
                    ? " · Кале втрачено, колоній ще немає"
                    : " · Calais lost; colonies not yet drawn"
                  : "")}
          </strong>
          <p className="mt-1 text-xs text-muted">
            {englandView
              ? uk
                ? "Берег збігається з суходолом атласу. Внутрішні межі схематичні: між зрізами кордони не інтерполюються. Штрихування — залежність або неповний контроль."
                : "The coastline matches the atlas land mask. Internal borders are schematic and are not interpolated between snapshots. Hatching marks dependency or incomplete control."
              : spanishView
              ? uk
                ? "Дата подій може бути точною до дня; політичні та воєнні карти мають власну річну або місячну точність. Проміжні щоденні фронти не вигадуються."
                : "Events may have exact dates; political and military maps retain their own annual or monthly precision. Daily fronts are not interpolated."
              : regionalView
                ? uk
                  ? "Державні межі, історичні землі й форми контролю мають окремі шари. Перевіряйте дату та джерело в картці території."
                  : "State borders, historical lands and forms of control are separate layers. Check each territory’s source and date."
                : snapshot === undefined
                  ? antiquityFrame
                    ? uk
                      ? "Показано античний зріз на тій самій мапі. Інші країни цього часу ще не налаштовані, тож суходіл поза шаром лишається нейтральним."
                      : "An antiquity frame is drawn on the same map. Other countries of this date are not configured, so land outside the layer stays neutral."
                    : uk
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
          {antiquityFrame && <p className="mt-1 text-xs text-muted">{antiquityFrame.note}</p>}
          {germanyFrame && !napoleonFrame && (
            <p className="mt-1 text-xs text-muted">{germanyFrame.note}</p>
          )}
          {napoleonFrame && <p className="mt-1 text-xs text-muted">{napoleonFrame.note}</p>}
          {showBritish && isleFrame && <p className="mt-1 text-xs text-muted">{isleFrame.note}</p>}
          {showBritish && overseasFrame && (
            <p className="mt-1 text-xs text-muted">{overseasFrame.note}</p>
          )}
          {warnings
            .filter(
              (note) =>
                !(regionalView || spanishView || englandView) ||
                !note.startsWith("Кордони інших країн"),
            )
            .map((note) => (
              <p key={note} className="mt-2 text-xs text-terracotta">
                {note}
              </p>
            ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["rus", uk ? "Русь-Україна" : "Rus’-Ukraine"],
              ["byzantium", uk ? "Візантія" : "Byzantium"],
              ["france", uk ? "Франція" : "France"],
              ["england", uk ? "Англія" : "England"],
              ["spain", uk ? "Іспанія" : "Spain"],
              ["spanish-empire", uk ? "Іспанська імперія" : "Spanish Empire"],
              ["poland", uk ? "Польща" : "Poland"],
              ["lithuania", uk ? "Литва" : "Lithuania"],
              ["commonwealth", uk ? "Річ Посполита" : "Commonwealth"],
              ["cossacks", uk ? "Українські землі · козацтво" : "Ukrainian lands · Cossacks"],
              ["franks", uk ? "Франкська держава" : "Frankish realms"],
              ["antiquity", uk ? "Античність" : "Antiquity"],
              ["germany", uk ? "Німеччина" : "Germany"],
              ["napoleon", uk ? "Наполеон" : "Napoleon"],
              ["europe", uk ? "Європа" : "Europe"],
              ["world", uk ? "Світ" : "World"],
              ["scotland", uk ? "Шотландія" : "Scotland"],
              ["wales", uk ? "Вельс" : "Wales"],
              ["ireland", uk ? "Ірландія" : "Ireland"],
              ["isles", uk ? "Британські острови" : "British Isles"],
              ["mongols", uk ? "Монгольська імперія" : "Mongol Empire"],
              ["hordes", uk ? "Орди й ханства" : "Hordes and khanates"],
              ["mughals", uk ? "Великі Моголи · Індія" : "Mughals · India"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() =>
                onChange(
                  key === "england"
                    ? year
                    : key === "antiquity" && year >= ATLAS_MIN_YEAR
                      ? 117
                      : key === "germany" && year < GERMANY_MIN_YEAR
                        ? GERMANY_MIN_YEAR
                        : key === "napoleon" &&
                            (year < NAPOLEON_MIN_YEAR || year > NAPOLEON_MAX_YEAR)
                          ? 1812
                          : clampViewYear(year, key),
                  key,
                )
              }
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
        {view === "france" && franceYear !== undefined && (
          <p className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
            {year >= 1940 && year <= 1944
              ? uk
                ? "1940–1944: окупаційні зони не реконструйовано; довоєнну геометрію приховано."
                : "1940–1944: occupation zones are not reconstructed; prewar geometry is hidden."
              : uk
                ? `Франція: джерельний зріз ${franceYear} р. Показано останню доступну карту, без щорічної інтерполяції; європейські володіння без колоній. Королівський домен і васалітет у середньовічних зрізах можуть поєднуватися.`
                : `France: source snapshot ${franceYear}. Last available map, without annual interpolation; European possessions without colonies. Medieval snapshots may combine crown lands and fiefs.`}
          </p>
        )}
        {spanishView && (
          <section
            className="mt-3 rounded-xl border border-hairline bg-surface-2 p-3 text-xs leading-5"
            aria-label={uk ? "Шари історії Іспанії" : "Spanish history layers"}
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
              <label className="flex min-h-9 items-center gap-2">
                <input
                  type="checkbox"
                  checked={reconquista}
                  onChange={(e) => setReconquista(e.target.checked)}
                />
                {uk ? "Реконкіста · оглядові ареали" : "Reconquista · survey areas"}
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input
                  type="checkbox"
                  checked={colonies}
                  onChange={(e) => setColonies(e.target.checked)}
                />
                {uk ? "Колоніальні володіння" : "Colonial possessions"}
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input
                  type="checkbox"
                  checked={civilFronts}
                  onChange={(e) => setCivilFronts(e.target.checked)}
                />
                {uk ? "Фронти громадянської війни" : "Civil War fronts"}
              </label>
            </div>
            <p className="mt-2" data-testid="spain-snapshot">
              {spainFrame
                ? `${uk ? "Джерельний зріз" : "Source snapshot"}: ${formatAtlasDate(parseAtlasDate(spainFrame.date)!, spainFrame.precision)} · ${uk ? "точність" : "precision"}: ${{ year: uk ? "рік" : "year", month: uk ? "місяць" : "month", day: uk ? "день" : "day" }[spainFrame.precision]}.`
                : uk
                  ? "Для цієї дати придатного контуру ще немає."
                  : "No suitable contour for this date."}
            </p>
            {spainFrame?.reconquistaDate && (
              <p className="mt-1 text-muted">
                {uk ? "Політичний контур" : "Political contour"}:{" "}
                {spainFrame.politicalDate?.slice(0, 4)} ·{" "}
                {uk ? "Ареали Реконкісти" : "Reconquista areas"}:{" "}
                {spainFrame.reconquistaDate.slice(0, 4)}
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer font-bold">
                {uk ? "Легенда, джерела й точність" : "Legend, sources and accuracy"}
              </summary>
              <p className="mt-2">{spainFrame?.note}</p>
              <p className="mt-2">
                {uk
                  ? "Реконкіста: золотий — християнські володіння кількох держав, зелений — мусульманські. Громадянська війна: охра — заколотницькі / франкістські війська, рожевий — республіканці. Колонії й залежності мають штрихування. Річні та місячні карти зберігають точність джерела; введення дня не створює точного щоденного фронту. Історичні дати подано за джерелами без перерахунку юліанського й григоріанського календарів."
                  : "Reconquista: gold Christian realms, green Muslim realms. Civil War: ochre rebel/Franco forces, pink Republicans. Colonies and dependencies are hatched. Annual/monthly maps retain source precision; exact date selection does not invent a daily front. Historical dates follow source calendars without Julian/Gregorian conversion."}
              </p>
              <a
                href="/atlas/spain/NOTICE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-forest-mid underline"
              >
                {uk ? "Методика, автори й ліцензії" : "Methods, authors and licenses"}
              </a>
            </details>
          </section>
        )}
        {(regionalView || (view === "rus" && year > 1240)) && (
          <section
            className="mb-3 space-y-3 rounded-xl border border-hairline bg-surface-2 p-3"
            aria-label={
              uk
                ? "Шари Польщі, Литви й українських земель"
                : "Poland, Lithuania and Ukrainian layers"
            }
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold">
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={ukrainianLands}
                  onChange={(e) => setUkrainianLands(e.target.checked)}
                />
                {uk ? "Історичні українські землі" : "Ukrainian historical lands"}
              </label>
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={cossackHistory}
                  onChange={(e) => setCossackHistory(e.target.checked)}
                />
                {uk ? "Козацька автономія та повстання" : "Cossack autonomy and uprisings"}
              </label>
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={occupations}
                  onChange={(e) => setOccupations(e.target.checked)}
                />
                {uk ? "Окупації · штрихування" : "Occupations · hatching"}
              </label>
            </div>
            <p className="text-xs leading-5" data-testid="commonwealth-snapshot">
              {commonwealthFrame
                ? `${uk ? "Політичний зріз" : "Political snapshot"}: ${commonwealthFrame.date ? commonwealthFrame.date.split("-").reverse().join(".") : commonwealthFrame.year}.`
                : uk
                  ? "Для обраного року немає придатного політичного зрізу цього регіону. Довоєнні та попередні державні кордони не підставляються в роки, які вони не описують."
                  : "No suitable political snapshot for this year. Earlier borders are not used for unrepresented periods."}
            </p>
            <details className="text-xs leading-5 text-muted">
              <summary className="min-h-9 cursor-pointer font-bold">
                {uk ? "Легенда й точність" : "Legend and accuracy"}
              </summary>
              {commonwealthFrame && <p className="mb-2">{commonwealthFrame.note}</p>}
              <p>
                {uk
                  ? "Кольорові українські землі — оглядові історичні ареали, не точні адміністративні чи етнічні межі. Синій штрих — шведська окупація; фіолетовий — московське військове зайняття; бірюзовий — козацька автономія; коричневий — османське Поділля. Позначки повстань — осередки подій, а не державні кордони."
                  : "Ukrainian lands are approximate historical areas, not exact administrative or ethnic borders. Blue hatching: Swedish occupation; purple: Muscovite wartime occupation; teal: Cossack autonomy; brown: Ottoman Podolia. Uprising markers indicate events, not state borders."}
              </p>
            </details>
          </section>
        )}
        {(spain.isError ||
          commonwealth.isError ||
          france.isError ||
          data.isError ||
          physical.isError ||
          (detailed && byzantine.isError) ||
          (frankishDetail && frankish.isError) ||
          (rusDetail && rus.isError) ||
          (mongolDetail && mongols.isError) ||
          (showBritish && (isles.isError || overseas.isError)) ||
          (sharedMap && (antiquity.isError || germany.isError || napoleon.isError))) && (
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
                if (franceYear !== undefined) void france.refetch();
                if (commonwealthYear !== undefined) void commonwealth.refetch();
                if (year >= 700) void spain.refetch();
                if (detailed) void byzantine.refetch();
                if (frankishDetail) void frankish.refetch();
                if (rusDetail) void rus.refetch();
                if (mongolDetail) void mongols.refetch();
                if (showBritish) {
                  void isles.refetch();
                  void overseas.refetch();
                }
                if (sharedMap) {
                  void antiquity.refetch();
                  void germany.refetch();
                  void napoleon.refetch();
                }
              }}
            >
              {uk ? "Повторити" : "Retry"}
            </PillButton>
          </div>
        )}
        {((year >= 700 && spain.isPending) ||
          (commonwealthYear !== undefined && commonwealth.isPending) ||
          (franceYear !== undefined && france.isPending) ||
          (snapshot !== undefined && data.isPending) ||
          physical.isPending ||
          (detailed && year <= 1453 && byzantine.isPending) ||
          (frankishDetail && frYear !== undefined && frankish.isPending) ||
          (rusDetail && rusYear !== undefined && rus.isPending) ||
          (showBritish && (isles.isPending || overseas.isPending)) ||
          (sharedMap && (antiquity.isPending || germany.isPending || napoleon.isPending))) && (
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
            base={historical}
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
        {spanishView && manual.data?.canEdit && (
          <p className="mb-3 text-xs text-muted">
            {uk
              ? "Ручні правки спільного атласу мають річні інтервали: зміна місячного фронту застосовуватиметься до всього вибраного року."
              : "Shared atlas edits use annual intervals: editing a monthly front applies throughout the selected year."}
          </p>
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
              historical={mapHistorical}
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
            {spanishView && (
              <div className="mt-2 space-y-1 text-xs text-muted">
                {year < 1492 && reconquista && (
                  <p>
                    <span style={{ color: "#b17a22" }}>■</span>{" "}
                    {uk ? "Християнські володіння" : "Christian realms"} ·{" "}
                    <span style={{ color: "#68a086" }}>■</span>{" "}
                    {uk ? "Мусульманські володіння" : "Muslim realms"}
                  </p>
                )}
                {year >= 1936 && year <= 1939 && civilFronts && (
                  <p>
                    <span style={{ color: "#c49c53" }}>■</span>{" "}
                    {uk ? "Заколотники / війська Франко" : "Rebel / Franco forces"} ·{" "}
                    <span style={{ color: "#bc7694" }}>■</span>{" "}
                    {uk ? "Республіканці" : "Republicans"}
                  </p>
                )}
                <p>
                  ▨{" "}
                  {uk
                    ? "Колонії та залежності — нерівномірний контроль або імперські претензії."
                    : "Colonies and dependencies: uneven control or imperial claims."}
                </p>
                <a
                  href="/atlas/spain/NOTICE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Kaidor, Rowanwindwhistler, FDRMRZUSA {uk ? "та співавтори" : "and contributors"} ·
                  CC BY-SA 4.0 · Historical Basemaps GPL-3.0
                </a>
              </div>
            )}
            {regionalView &&
              commonwealthFrame &&
              commonwealthFrame.year >= 1771 &&
              commonwealthFrame.year <= 1795 && (
                <div
                  className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft"
                  aria-label={uk ? "Легенда поділів Речі Посполитої" : "Partitions legend"}
                >
                  {[
                    ...new Map(
                      commonwealthFrame.collection.features
                        .filter((f) => f.properties.layer === "state")
                        .map((f) => [f.properties.subject, f]),
                    ).values(),
                  ].map((f) => (
                    <span key={f.properties.subject} className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block size-4 shrink-0 rounded-sm border border-ink/20"
                        style={{ backgroundColor: f.properties.color }}
                      />
                      {historicalName(f.properties.subject, uk)}
                    </span>
                  ))}
                </div>
              )}
            {!(spanishView || englandView) && commonwealthFrame && (
              <div
                className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft"
                aria-label={uk ? "Легенда штрихованих шарів" : "Hatched layer legend"}
              >
                {commonwealthFrame.collection.features
                  .filter((f) => f.properties.control === "relative")
                  .map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block size-4 shrink-0 border"
                        style={{
                          borderColor: f.properties.color,
                          backgroundImage: `repeating-linear-gradient(135deg,${f.properties.color} 0 2px,transparent 2px 6px)`,
                        }}
                      />
                      {historicalName(f.properties.name, uk)}
                    </span>
                  ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              <span className="atlas-hatch-swatch" aria-hidden="true" />{" "}
              {uk
                ? "Штрихування — окупація, автономія, залежність або неповний контроль. Суцільний колір — державний контур чи історичний ареал."
                : "Hatching: occupation, autonomy, dependency or partial control. Solid fill: a state contour or historical area."}
            </p>
            {!(spanishView || englandView) &&
              commonwealthFrame &&
              commonwealthFrame.collection.features.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  <a
                    href="/atlas/commonwealth/NOTICE.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {uk
                      ? "Польща, Литва й Річ Посполита: Mathiasrex, Halibutt, Grandiose, NordNordWest, Sneecs, Rowanwindwhistler · CC BY / CC BY-SA · джерела й перетворення"
                      : "Poland, Lithuania and Commonwealth: Mathiasrex, Halibutt, Grandiose, NordNordWest, Sneecs, Rowanwindwhistler · CC BY / CC BY-SA · sources and adaptations"}
                  </a>
                </p>
              )}
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
                ? "■ Столичний осередок · ● Місто / поселення · ◌ Орієнтир регіону · Пунктир: оглядова межа. Фізична основа сучасна; деталізований шар відтворює берегові контури джерела."
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
                  {selectedPolity.properties.region === "spain"
                    ? selectedPolity.properties.layer === "front" && spainFrame
                      ? formatAtlasDate(parseAtlasDate(spainFrame.date)!, spainFrame.precision)
                      : selectedPolity.properties.sourceYear
                    : selectedPolity.properties.region === "antiquity" ||
                        selectedPolity.properties.region === "isles" ||
                        selectedPolity.properties.region === "germany" ||
                        selectedPolity.properties.region === "napoleon"
                      ? formatAtlasYear(selectedPolity.properties.sourceYear ?? year, uk)
                      : selectedPolity.properties.custom
                        ? `${selectedPolity.properties.validFrom}–${selectedPolity.properties.validTo}`
                        : (selectedPolity.properties.sourceYear ?? snapshot)}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold">
                  {historicalName(selectedPolity.properties.name, uk)}
                </h3>
                <p className="mt-2 text-xs text-muted">
                  {selectedPolity.properties.name} ·{" "}
                  {selectedPolity.properties.region === "england"
                    ? uk
                      ? "Навчальний контур, берег за суходолом атласу"
                      : "School contour clipped to the atlas coastline"
                    : selectedPolity.properties.region === "spain"
                      ? uk
                        ? "Датований джерельний контур"
                        : "Dated source contour"
                      : selectedPolity.properties.region === "antiquity" ||
                          selectedPolity.properties.region === "isles" ||
                          selectedPolity.properties.region === "germany" ||
                          selectedPolity.properties.region === "napoleon"
                        ? uk
                          ? "Навчальна схема на спільній мапі. Берег за Natural Earth, внутрішні межі приблизні."
                          : "School schematic on the shared map. Coast follows Natural Earth; internal borders are approximate."
                        : selectedPolity.properties.custom
                      ? uk
                        ? "Ручний шар школи"
                        : "School manual layer"
                      : selectedPolity.properties.region === "france"
                        ? uk
                          ? selectedPolity.properties.description
                          : "Dated overview of France in Europe. Source year is shown; medieval crown lands and fiefs may be combined. Overseas colonies are excluded."
                        : selectedPolity.properties.region === "mongols"
                          ? uk
                            ? "Контур джерела; приблизні межі"
                            : "Source contour; approximate boundaries"
                          : selectedPolity.properties.detailed
                            ? uk
                              ? selectedPolity.properties.region === "commonwealth"
                                ? selectedPolity.properties.layer === "land"
                                  ? "Оглядовий історичний ареал"
                                  : "Датований джерельний контур"
                                : selectedPolity.properties.region === "rus"
                                  ? "Контур карти Русі"
                                  : selectedPolity.properties.region === "franks"
                                    ? "Контур з векторної карти"
                                    : "Контур з авторського растра"
                              : "Digitized source contour"
                            : `${uk ? "Рівень точності джерела" : "Source precision"}: ${selectedPolity.properties.precision}/3`}
                </p>
                <p className="mt-2 text-sm leading-6">
                  {selectedPolity.properties.region === "england"
                    ? selectedPolity.properties.description
                    : selectedPolity.properties.region === "spain"
                    ? selectedPolity.properties.description ||
                      selectedPolity.properties.relation ||
                      spainFrame?.note ||
                      (uk ? "Датований оглядовий контур" : "Dated survey contour")
                    : selectedPolity.properties.region === "antiquity" ||
                        selectedPolity.properties.region === "isles" ||
                        selectedPolity.properties.region === "germany" ||
                        selectedPolity.properties.region === "napoleon"
                      ? selectedPolity.properties.description
                      : selectedPolity.properties.custom
                        ? selectedPolity.properties.description ||
                          (uk ? "Опис ще не додано." : "No description provided.")
                        : selectedPolity.properties.region === "france"
                        ? uk
                          ? selectedPolity.properties.description
                          : "Dated overview of France in Europe. Source year is shown; medieval crown lands and fiefs may be combined. Overseas colonies are excluded."
                        : selectedPolity.properties.region === "mongols"
                          ? uk
                            ? `Карта-джерело ${selectedPolity.properties.sourceYear}; показано приблизний історичний контур. Пряме управління і васальна залежність у джерелі можуть поєднуватися. ${selectedPolity.properties.validTo ? `Цей полігон застосований не пізніше ${selectedPolity.properties.validTo} року; це дата обмеження реконструкції, не завжди дата зникнення держави.` : ""}`
                            : "Dated source contour; direct rule and vassal dependency may be combined. Expiry limits the reconstruction, and is not necessarily the end of the state."
                          : selectedPolity.properties.detailed
                            ? uk
                              ? selectedPolity.properties.region === "commonwealth"
                                ? selectedPolity.properties.description ||
                                  "Датований джерельний контур; внутрішні історичні ареали оглядові. Перевіряйте дату, форму підпорядкування та методику джерела."
                                : selectedPolity.properties.region === "rus"
                                  ? `${rusFrame?.note ?? "Картографічна реконструкція Русі."} Колір збережено за джерелом; картки об’єднаних земель не означають єдиного князівства. Дрібні уділи доступні в оригіналі.`
                                  : selectedPolity.properties.region === "franks"
                                    ? "Політична область перенесена безпосередньо з SVG джерела зі збереженням вигинів і анклавів. Контури суміщено за містами або береговими орієнтирами; це картографічна реконструкція, а не точні щорічні кордони. Перевіряйте кольори й залежні території за легендою оригіналу."
                                    : "Оцифрована кольорова область карти Lucius. Острови й берегові вигини збережені з мінімальним спрощенням; можливі артефакти дрібних підписів і вузьких територій. Звіряйте спірні місця з оригіналом. Детальніші лінії адміністративного поділу доступні в авторському шарі."
                              : selectedPolity.properties.region === "commonwealth"
                                ? "Dated source contour; internal historical areas are approximate. Check its date, status and source method."
                                : selectedPolity.properties.region === "rus"
                                  ? "Rus source contour with original colours. Registration is approximate. Some period maps group appanages; see the original legend. The 1240 endpoint uses the 1237 pre-invasion map."
                                  : selectedPolity.properties.region === "franks"
                                    ? "Political area transferred directly from source SVG, preserving bends and enclaves. Registration uses towns or coastal landmarks; check the original legend and snapshot date."
                                    : "Digitized Lucius color area; small labels and narrow territories may leave raster artifacts. Check the original; administrative lines are available in the source layer."
                            : featureNote(
                                selectedPolity.properties.name,
                                selectedPolity.properties.sourceYear ?? snapshot!,
                              )}
                </p>
                {(selectedPolity.properties.custom ||
                  selectedPolity.properties.region === "commonwealth" ||
                  selectedPolity.properties.region === "spain" ||
                  selectedPolity.properties.region === "england") && (
                  <div className="mt-2 space-y-2 text-xs">
                    <p>
                      {uk ? "Контролер" : "Controller"}:{" "}
                      {historicalName(selectedPolity.properties.subject, uk)} ·{" "}
                      {selectedPolity.properties.control === "relative"
                        ? selectedPolity.properties.relation
                        : selectedPolity.properties.layer === "front"
                          ? uk
                            ? "військовий контроль за джерельним зрізом"
                            : "military control in the source snapshot"
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
                        {selectedPolity.properties.custom
                          ? uk
                            ? "Джерело ручної правки"
                            : "Manual edit source"
                          : uk
                            ? "Картографічне джерело"
                            : "Cartographic source"}
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
                ? "Спільна мапа поєднує датовані державні контури, оглядові історичні ареали та шари контролю. На ній же — Рим до 395 року, Німеччина з 962 і наполеонівські війни 1792–1815. Джерело й точність кожної території наведено в її картці."
                : "This shared map combines dated state contours, approximate historical areas and forms of control, including Rome before 395, Germany from 962 and the Napoleonic Wars of 1792–1815. Each territory’s card shows its source and accuracy."}
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
            ? "Події до й після обраної дати. Натисніть дату, щоб перейти до неї; ≈ означає умовне або дискусійне датування."
            : "Events before and after the selected year. Select a date to visit it; ≈ marks approximate or disputed dating."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {nearby.map((e) => (
            <article key={`${e.year}:${e.title}`} className="rounded-xl border border-hairline p-3">
              <button
                type="button"
                onClick={() => onChange(e.year, view, { month: e.month ?? 1, day: e.day ?? 1 })}
                className="min-h-9 rounded-full bg-forest/10 px-3 text-sm font-extrabold text-forest-mid"
              >
                {e.approximate ? "≈ " : ""}
                {e.year < ATLAS_MIN_YEAR
                  ? formatAtlasYear(e.year, uk)
                  : formatAtlasDate(
                      normalizeAtlasDate(e.year, e.month, e.day),
                      e.day ? "day" : e.month ? "month" : "year",
                    )}
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
            <p>
              {uk
                ? "Британські острови, англійські володіння у Франції до 1558 року і колоніальна імперія накладені на Європу та світ, а не винесені в окремий шар. Зріз — останній не пізніше обраного року; між втратою Кале і 1655 роком заморських полігонів немає. Штрихування означає неповний контроль, зокрема Гасконь як ф’єф і Землю Руперта. Домініони після Вестмінстерського статуту на зрізі 1947 року вже не зафарбовані."
                : "The British Isles, English possessions in France until 1558 and the colonial empire are drawn on Europe and the world, not as a separate atlas. Each frame is the latest one not after the chosen year. There is no overseas polygon between the loss of Calais and 1655. Hatching means incomplete control, including Gascony as a fief and Rupert’s Land. Dominions are no longer filled on the 1947 frame."}{" "}
              <a
                href="/atlas/isles/NOTICE.md"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uk ? "Як зібрано острови й імперію" : "How the isles and empire were drawn"}
              </a>
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
