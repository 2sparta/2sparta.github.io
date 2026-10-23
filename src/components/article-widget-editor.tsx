import { lazy, Suspense, useState } from "react";
import { AtlasDateFields } from "./atlas-learning-panel";
import { EMBED_LAYERS, EMBED_LAYER_LABELS } from "@/lib/atlas/embed";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import {
  newArticleWidget,
  validateArticleWidget,
  emptyConflictSide,
  WIDGET_LABELS,
  WIDGET_TYPES,
  type ArticleWidget,
  type WidgetType,
} from "@/lib/materials/article-widgets";
import { usePrefs } from "@/lib/prefs";
import { PillButton, TextInput } from "./ui/panel";

const EmbeddedHistoricalMap = lazy(() =>
  import("./embedded-historical-map").then((m) => ({ default: m.EmbeddedHistoricalMap })),
);

export function ArticleWidgetEditor({
  initial,
  editing,
  onApply,
  onCancel,
}: {
  initial: ArticleWidget;
  editing: boolean;
  onApply: (widget: ArticleWidget) => void;
  onCancel: () => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const labels = WIDGET_LABELS[uk ? "uk" : "en"];
  const [w, set] = useState(initial);
  const [dateValid, setDateValid] = useState(true);
  let valid = w.type !== "map" || dateValid;
  try {
    validateArticleWidget(w);
  } catch {
    valid = false;
  }
  const field = (
    label: string,
    value: string,
    update: (value: string) => void,
    multiline = false,
    maxLength = 2000,
  ) => (
    <label key={label} className="block text-xs font-bold text-ink">
      {label}
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          maxLength={maxLength}
          onChange={(e) => update(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-hairline bg-surface p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-forest-mid/30"
        />
      ) : (
        <TextInput
          value={value}
          maxLength={maxLength}
          onChange={(e) => update(e.target.value)}
          className="mt-1 w-full font-normal"
        />
      )}
    </label>
  );
  const remove = (label: string, disabled: boolean, action: () => void) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={action}
      className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-terracotta disabled:opacity-30"
    >
      <X className="size-4" />
    </button>
  );
  return (
    <section
      aria-label={uk ? "Налаштування віджета" : "Widget settings"}
      className="space-y-4 border-b border-hairline bg-cream/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display font-extrabold">
          {editing
            ? uk
              ? "Редагувати віджет"
              : "Edit widget"
            : uk
              ? "Вставити віджет"
              : "Insert widget"}
        </h3>
        <button
          type="button"
          aria-label={uk ? "Закрити налаштування віджета" : "Close widget settings"}
          onClick={onCancel}
          className="grid size-10 place-items-center rounded-full bg-surface"
        >
          <X className="size-4" />
        </button>
      </div>
      <label className="block text-xs font-bold">
        {uk ? "Тип віджета" : "Widget type"}
        <select
          value={w.type}
          onChange={(e) => set(newArticleWidget(e.target.value as WidgetType, uk))}
          className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
        >
          {WIDGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {labels[type]}
            </option>
          ))}
        </select>
      </label>
      {field(
        uk ? "Назва віджета *" : "Widget title *",
        w.title,
        (title) => set({ ...w, title }),
        false,
        160,
      )}
      {w.type === "toc" && (
        <p className="text-sm text-muted">
          {uk
            ? "Зміст автоматично оновлюється за всіма п’ятьма рівнями заголовків статті. Натискання на пункт відкриває відповідний розділ."
            : "Contents updates from all five heading levels. Each item links to its section."}
        </p>
      )}
      {w.type === "map" && (
        <>
          <AtlasDateFields
            onValidityChange={setDateValid}
            date={w.date}
            onChange={(date) => set({ ...w, date })}
            label={uk ? "Дата фрагмента" : "Fragment date"}
          />
          <div className="grid grid-cols-3 gap-3">
            {(["lat", "lng", "zoom"] as const).map((key, i) => (
              <label key={key} className="min-w-0 text-xs font-bold">
                {(uk ? ["Широта", "Довгота", "Масштаб"] : ["Latitude", "Longitude", "Zoom"])[i]}
                <input
                  type="number"
                  step={key === "zoom" ? 0.25 : "any"}
                  value={key === "zoom" ? w.zoom : w.center[key]}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    set(
                      key === "zoom"
                        ? { ...w, zoom: value }
                        : { ...w, center: { ...w.center, [key]: value } },
                    );
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
                />
              </label>
            ))}
          </div>
          <fieldset>
            <legend className="text-xs font-bold">
              {uk ? "Шари фрагмента" : "Fragment layers"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {EMBED_LAYERS.map((layer) => (
                <label key={layer} className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={w.layers.includes(layer)}
                    onChange={(e) =>
                      set({
                        ...w,
                        layers: e.target.checked
                          ? [...w.layers, layer]
                          : w.layers.filter((l) => l !== layer),
                      })
                    }
                  />
                  {EMBED_LAYER_LABELS[layer][uk ? 0 : 1]}
                </label>
              ))}
            </div>
          </fieldset>
          {valid && (
            <Suspense
              fallback={
                <p role="status">{uk ? "Завантажуємо перегляд мапи…" : "Loading map preview…"}</p>
              }
            >
              <EmbeddedHistoricalMap widget={w} onCapture={(view) => set({ ...w, ...view })} />
            </Suspense>
          )}
        </>
      )}
      {w.type === "conflict" && (
        <>
          {field(
            uk ? "Опис конфлікту" : "Conflict summary",
            w.summary,
            (summary) => set({ ...w, summary }),
            true,
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              uk ? "Дата / період" : "Date / period",
              w.date,
              (date) => set({ ...w, date }),
              false,
              300,
            )}
            {field(
              uk ? "Місце" : "Location",
              w.location,
              (location) => set({ ...w, location }),
              false,
              300,
            )}
          </div>
          {field(uk ? "Результат" : "Result", w.result, (result) => set({ ...w, result }), true)}
          <div className="grid gap-3 sm:grid-cols-2">
            {w.sides.map((side, index) => (
              <fieldset
                key={index}
                className="min-w-0 space-y-3 rounded-xl border border-hairline bg-surface/60 p-3"
              >
                <legend className="px-1 text-sm font-bold">
                  {uk ? "Сторона" : "Side"} {index + 1}
                </legend>
                <div className="flex justify-end">
                  {remove(
                    `${uk ? "Видалити сторону" : "Remove side"} ${index + 1}`,
                    w.sides.length <= 2,
                    () => set({ ...w, sides: w.sides.filter((_, i) => i !== index) }),
                  )}
                </div>
                {(
                  [
                    ["name", uk ? "Назва сторони *" : "Side name *"],
                    ["participants", uk ? "Учасники" : "Participants"],
                    ["leaders", uk ? "Керівники / командувачі" : "Leaders / commanders"],
                    ["forces", uk ? "Сили / ресурси" : "Forces / resources"],
                    ["losses", uk ? "Втрати" : "Losses"],
                  ] as const
                ).map(([key, label]) =>
                  field(
                    label,
                    side[key],
                    (value) =>
                      set({
                        ...w,
                        sides: w.sides.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
                      }),
                    key !== "name",
                    key === "name" ? 160 : ["forces", "losses"].includes(key) ? 1000 : 2000,
                  ),
                )}
              </fieldset>
            ))}
          </div>
          <PillButton
            type="button"
            tone="ghost"
            disabled={w.sides.length >= 4}
            onClick={() => set({ ...w, sides: [...w.sides, emptyConflictSide()] })}
          >
            <Plus className="mr-2 size-4" />
            {uk ? "Додати сторону" : "Add side"}
          </PillButton>
        </>
      )}
      {w.type === "infobox" && (
        <>
          {w.rows.map((row, index) => (
            <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
              {field(
                `${uk ? "Характеристика" : "Property"} ${index + 1} *`,
                row.label,
                (label) =>
                  set({ ...w, rows: w.rows.map((r, i) => (i === index ? { ...r, label } : r)) }),
                false,
                160,
              )}
              {field(
                `${uk ? "Значення" : "Value"} ${index + 1} *`,
                row.value,
                (value) =>
                  set({ ...w, rows: w.rows.map((r, i) => (i === index ? { ...r, value } : r)) }),
                true,
              )}
              {remove(
                `${uk ? "Видалити характеристику" : "Remove property"} ${index + 1}`,
                w.rows.length <= 1,
                () => set({ ...w, rows: w.rows.filter((_, i) => i !== index) }),
              )}
            </div>
          ))}
          <PillButton
            type="button"
            tone="ghost"
            disabled={w.rows.length >= 12}
            onClick={() => set({ ...w, rows: [...w.rows, { label: "", value: "" }] })}
          >
            <Plus className="mr-2 size-4" />
            {uk ? "Додати характеристику" : "Add property"}
          </PillButton>
        </>
      )}
      {w.type === "timeline" && (
        <>
          {w.entries.map((entry, index) => (
            <div
              key={index}
              className="space-y-2 rounded-xl border border-hairline bg-surface/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">
                  {uk ? "Подія" : "Event"} {index + 1}
                </span>
                <div className="flex gap-1">
                  {([-1, 1] as const).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      disabled={index + delta < 0 || index + delta >= w.entries.length}
                      aria-label={`${delta < 0 ? (uk ? "Перемістити подію вище" : "Move event up") : uk ? "Перемістити подію нижче" : "Move event down"} ${index + 1}`}
                      onClick={() => {
                        const entries = [...w.entries];
                        [entries[index], entries[index + delta]] = [
                          entries[index + delta],
                          entries[index],
                        ];
                        set({ ...w, entries });
                      }}
                      className="grid size-10 place-items-center rounded-lg bg-surface-2 disabled:opacity-30"
                    >
                      {delta < 0 ? (
                        <ArrowUp className="size-4" />
                      ) : (
                        <ArrowDown className="size-4" />
                      )}
                    </button>
                  ))}
                  {remove(
                    `${uk ? "Видалити подію" : "Remove event"} ${index + 1}`,
                    w.entries.length <= 1,
                    () => set({ ...w, entries: w.entries.filter((_, i) => i !== index) }),
                  )}
                </div>
              </div>
              {field(
                `${uk ? "Дата події" : "Event date"} ${index + 1} *`,
                entry.date,
                (date) =>
                  set({
                    ...w,
                    entries: w.entries.map((e, i) => (i === index ? { ...e, date } : e)),
                  }),
                false,
                160,
              )}
              {field(
                `${uk ? "Опис події" : "Event description"} ${index + 1} *`,
                entry.text,
                (text) =>
                  set({
                    ...w,
                    entries: w.entries.map((e, i) => (i === index ? { ...e, text } : e)),
                  }),
                true,
              )}
            </div>
          ))}
          <PillButton
            type="button"
            tone="ghost"
            disabled={w.entries.length >= 20}
            onClick={() => set({ ...w, entries: [...w.entries, { date: "", text: "" }] })}
          >
            <Plus className="mr-2 size-4" />
            {uk ? "Додати подію" : "Add event"}
          </PillButton>
        </>
      )}
      {w.type === "callout" && (
        <>
          <label className="block text-xs font-bold">
            {uk ? "Вигляд примітки" : "Callout style"}
            <select
              value={w.tone}
              onChange={(e) => set({ ...w, tone: e.target.value as "note" | "tip" | "warning" })}
              className="mt-1 block min-h-11 w-full rounded-xl bg-surface px-3 text-sm"
            >
              <option value="note">{uk ? "Примітка" : "Note"}</option>
              <option value="tip">{uk ? "Порада" : "Tip"}</option>
              <option value="warning">{uk ? "Увага" : "Warning"}</option>
            </select>
          </label>
          {field(
            uk ? "Текст примітки *" : "Callout text *",
            w.text,
            (text) => set({ ...w, text }),
            true,
            4000,
          )}
        </>
      )}
      {!valid && (
        <p role="status" className="text-xs text-muted">
          {uk
            ? w.type === "map"
              ? "Перевірте дату, широту (−85…85), довготу (−180…180) і масштаб (0…8)."
              : "Заповніть усі поля з *. У конфлікті потрібні назви щонайменше двох сторін."
            : w.type === "map"
              ? "Check the date, latitude (−85…85), longitude (−180…180) and zoom (0…8)."
              : "Fill every * field. A conflict needs at least two named sides."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <PillButton
          type="button"
          disabled={!valid}
          onClick={() => onApply(validateArticleWidget(w))}
        >
          {editing
            ? uk
              ? "Оновити віджет"
              : "Update widget"
            : uk
              ? "Вставити у статтю"
              : "Insert into article"}
        </PillButton>
        <PillButton type="button" tone="ghost" onClick={onCancel}>
          {uk ? "Скасувати" : "Cancel"}
        </PillButton>
      </div>
    </section>
  );
}
