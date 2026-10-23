import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ExternalLink, Route, X } from "lucide-react";
import type { AtlasDate } from "@/lib/atlas/date";
import {
  worldDate,
  worldDateKey,
  formatWorldDate,
  WORLD_MIN_YEAR,
  WORLD_MAX_YEAR,
} from "@/lib/atlas/world";
import {
  EVENT_SOURCES,
  LEARNING_ROUTES,
  MAP_EVENTS,
  eventsInPeriod,
  eventsBetweenDates,
  formatMapEventDate,
  routeEvents,
  type MapEvent,
} from "@/lib/atlas/learning";
import { usePrefs } from "@/lib/prefs";
import { PillButton } from "./ui/panel";
export function useAtlasLearning(date: AtlasDate, navigate: (date: AtlasDate) => boolean) {
  const [comparing, setComparing] = useState(false);
  const [compareDate, setCompareDate] = useState(() =>
    worldDate(date.year < 1772 ? date.year + 10 : 1795, 10, 24),
  );
  const [showEvents, setShowEvents] = useState(true),
    [radius, setRadius] = useState(10),
    [routeId, setRouteId] = useState(""),
    [eventId, setEventId] = useState("");
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number; key: number }>();
  const selectedEvent = MAP_EVENTS.find((e) => e.id === eventId),
    route = useMemo(() => routeEvents(routeId), [routeId]),
    step = route.findIndex((e) => e.id === eventId);
  const events = routeId
    ? route
    : comparing
      ? eventsBetweenDates(date, compareDate)
      : eventsInPeriod(date.year - radius, date.year + radius);
  const chooseEvent = (event: MapEvent) => {
    if (!navigate(event.date)) return false;
    setEventId(event.id);
    setShowEvents(true);
    setFocus((old) => ({ lat: event.lat, lng: event.lng, zoom: 6, key: (old?.key ?? 0) + 1 }));
    return true;
  };
  const chooseRoute = (id: string) => {
    const first = routeEvents(id)[0];
    if (first && !chooseEvent(first)) return;
    setRouteId(id);
    if (id) setComparing(false);
    else setEventId("");
  };
  useEffect(() => {
    if (selectedEvent && worldDateKey(selectedEvent.date) !== worldDateKey(date)) setEventId("");
  }, [worldDateKey(date)]);
  return {
    comparing,
    setComparing,
    compareDate,
    setCompareDate,
    showEvents,
    setShowEvents,
    radius,
    setRadius,
    routeId,
    chooseRoute,
    route,
    step,
    events,
    selectedEvent,
    chooseEvent,
    closeEvent: () => setEventId(""),
    focus,
    partitions: () => {
      if (!navigate(worldDate(1772, 8, 5))) return;
      setCompareDate(worldDate(1795, 10, 24));
      setComparing(true);
      setRouteId("");
      setEventId("");
      setFocus((old) => ({ lat: 52, lng: 25, zoom: 4.5, key: (old?.key ?? 0) + 1 }));
    },
  };
}
export type AtlasLearning = ReturnType<typeof useAtlasLearning>;
export function AtlasDateFields({
  date,
  onChange,
  label,
  onValidityChange,
}: {
  date: AtlasDate;
  onChange: (date: AtlasDate) => void;
  label: string;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [draft, setDraft] = useState({
      year: String(date.year),
      month: String(date.month),
      day: String(date.day),
    }),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft({ year: String(date.year), month: String(date.month), day: String(date.day) });
    setInvalid(false);
    onValidityChange?.(true);
  }, [date.year, date.month, date.day]);
  const uk = usePrefs((s) => s.lang) === "uk";
  const parse = (candidate: typeof draft) => {
    const values = Object.fromEntries(
      Object.entries(candidate).map(([k, v]) => [k, Number(v.trim() || NaN)]),
    ) as AtlasDate;
    const normalized = worldDate(values.year, values.month, values.day);
    return {
      values,
      valid:
        Object.values(values).every(Number.isInteger) &&
        worldDateKey(values) === worldDateKey(normalized),
    };
  };
  const commit = () => {
    const { values, valid } = parse(draft);
    setInvalid(!valid);
    onValidityChange?.(valid);
    if (valid) onChange(values);
  };
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-bold">{label}</legend>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        {(["year", "month", "day"] as const).map((key, i) => (
          <label key={key} className="min-w-0 text-xs text-muted">
            {(uk ? ["Рік", "Місяць", "День"] : ["Year", "Month", "Day"])[i]}
            <input
              type="number"
              aria-label={`${label}: ${(uk ? ["рік", "місяць", "день"] : ["year", "month", "day"])[i]}`}
              aria-invalid={invalid}
              value={draft[key]}
              onChange={(e) => {
                const next = { ...draft, [key]: e.target.value };
                setDraft(next);
                const { valid } = parse(next);
                setInvalid(!valid);
                onValidityChange?.(valid);
              }}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              className="mt-1 min-h-10 w-full rounded-xl border border-hairline bg-surface px-2 text-sm text-ink"
            />
          </label>
        ))}
      </div>
      {invalid && (
        <p role="alert" className="mt-1 text-xs text-terracotta">
          {uk
            ? `Коректна дата: ${WORLD_MIN_YEAR}…${WORLD_MAX_YEAR}, без нульового року.`
            : `Enter a valid date in ${WORLD_MIN_YEAR}…${WORLD_MAX_YEAR}; no year zero.`}
        </p>
      )}
    </fieldset>
  );
}
export function AtlasLearningPanel({ model: m, date }: { model: AtlasLearning; date: AtlasDate }) {
  const uk = usePrefs((s) => s.lang) === "uk";
  return (
    <section
      aria-label={uk ? "Дослідження мапи" : "Map exploration"}
      className="my-4 grid gap-4 rounded-2xl border border-hairline bg-surface-2/45 p-4 lg:grid-cols-2"
    >
      <div className="min-w-0 space-y-3">
        <label className="flex min-h-10 items-center gap-2 font-display font-bold">
          <input
            type="checkbox"
            checked={m.comparing}
            onChange={(e) => m.setComparing(e.target.checked)}
          />
          <ArrowLeftRight className="size-4" />
          {uk ? "Порівняти дві дати" : "Compare two dates"}
        </label>
        <button
          type="button"
          onClick={m.partitions}
          className="min-h-10 rounded-full border border-forest-mid/25 bg-surface px-3 text-xs font-bold text-forest-mid"
        >
          {uk ? "Приклад: 1772 → 1795" : "Example: 1772 → 1795"}
        </button>
        {m.comparing && (
          <>
            <p className="text-xs text-muted">
              {uk ? "Перша дата — над мапою" : "First date — above the map"}:{" "}
              <strong>{formatWorldDate(date, uk)}</strong>
            </p>
            <AtlasDateFields
              label={uk ? "Друга дата" : "Second date"}
              date={m.compareDate}
              onChange={m.setCompareDate}
            />
            <p className="text-xs text-muted">
              {uk
                ? "Кольорові ділянки показують перехід від першої належності до другої. Натисніть на ділянку, щоб побачити обидві держави."
                : "Colored areas show ownership changes from the first date to the second. Select one to see both states."}
            </p>
          </>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <label className="block text-xs font-bold">
          <span className="mb-1 flex items-center gap-2">
            <Route className="size-4" />
            {uk ? "Навчальний маршрут" : "Learning route"}
          </span>
          <select
            aria-label={uk ? "Навчальний маршрут" : "Learning route"}
            value={m.routeId}
            onChange={(e) => m.chooseRoute(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
          >
            <option value="">{uk ? "Самостійне дослідження" : "Explore freely"}</option>
            {LEARNING_ROUTES.map((r) => (
              <option key={r.id} value={r.id}>
                {uk ? r.title : r.titleEn}
              </option>
            ))}
          </select>
        </label>
        {m.routeId && (
          <div className="rounded-xl bg-surface p-3">
            <p className="text-xs font-bold" aria-live="polite">
              {uk ? "Крок" : "Step"} {m.step < 0 ? "—" : m.step + 1} / {m.route.length}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {m.selectedEvent?.title ?? (uk ? "Поверніться до маршруту" : "Resume the route")}
            </p>
            <div className="mt-3 flex gap-2">
              <PillButton
                type="button"
                tone="ghost"
                disabled={m.step <= 0}
                onClick={() => m.chooseEvent(m.route[m.step - 1])}
              >
                <ChevronLeft className="mr-1 size-4" />
                {uk ? "Назад" : "Back"}
              </PillButton>
              <PillButton
                type="button"
                disabled={m.step === m.route.length - 1}
                onClick={() => m.chooseEvent(m.route[m.step + 1])}
              >
                {m.step === m.route.length - 1
                  ? uk
                    ? "Маршрут завершено"
                    : "Route complete"
                  : uk
                    ? "Далі"
                    : "Next"}
                <ChevronRight className="ml-1 size-4" />
              </PillButton>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={m.showEvents}
              onChange={(e) => m.setShowEvents(e.target.checked)}
            />
            {uk ? "Події на мапі" : "Events on map"}
          </label>
          {!m.routeId && !m.comparing && (
            <label className="text-xs">
              {uk ? "Період" : "Period"}
              <select
                aria-label={uk ? "Період подій" : "Event period"}
                value={m.radius}
                onChange={(e) => m.setRadius(Number(e.target.value))}
                className="ml-2 min-h-10 rounded-xl bg-surface px-2"
              >
                {[0, 5, 10, 25, 100].map((n) => (
                  <option key={n} value={n}>
                    {n ? `±${n} ${uk ? "років" : "years"}` : uk ? "Цей рік" : "This year"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="text-xs text-muted">
          {uk
            ? `Подій у періоді: ${m.events.length}. Добірка охоплює три навчальні теми.`
            : `Events in period: ${m.events.length}. Curated coverage: three teaching themes.`}
        </p>
      </div>
    </section>
  );
}
export function MapEventCard({ event, onClose }: { event: MapEvent; onClose?: () => void }) {
  const uk = usePrefs((s) => s.lang) === "uk";
  return (
    <section
      aria-label={uk ? "Опис події" : "Event details"}
      className="rounded-2xl border border-forest-mid/25 bg-surface-2/60 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-forest-mid">{formatMapEventDate(event, uk)}</p>
        {onClose && (
          <button
            type="button"
            aria-label={uk ? "Закрити подію" : "Close event"}
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-surface"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <h3 className="mt-2 font-display font-extrabold">{event.title}</h3>
      <p className="mt-1 text-xs font-bold text-muted">{event.place}</p>
      <p className="mt-3 text-sm leading-6">{event.description}</p>
      <h4 className="mt-3 text-xs font-bold">{uk ? "Наслідки" : "Consequences"}</h4>
      <p className="mt-1 text-sm leading-6">{event.consequences}</p>
      <p className="mt-3 text-xs text-muted">{event.locationNote}</p>
      <ul className="mt-3 space-y-2 text-xs">
        {event.sources.map((id) => {
          const source = EVENT_SOURCES[id as keyof typeof EVENT_SOURCES];
          return (
            source && (
              <li key={id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-forest-mid underline underline-offset-4"
                >
                  {source.title}
                  <ExternalLink className="ml-1 inline size-3" />
                </a>
              </li>
            )
          );
        })}
      </ul>
    </section>
  );
}
