import { useEffect, useReducer, useState } from "react";
import type { Position } from "geojson";
import { Download, Pencil, Plus, Undo2, Redo2, Trash2 } from "lucide-react";
import { PillButton, TextInput } from "./ui/panel";
import {
  ATLAS_MIN_YEAR,
  ATLAS_MAX_YEAR,
  historicalName,
  type HistoricalCollection,
  type HistoricalFeature,
} from "@/lib/atlas/model";
import {
  addGeometryHole,
  addGeometryPart,
  atlasEditError,
  editRing,
  geometryParts,
  newAtlasEdit,
  normalizeTerritoryGeometry,
  openGeometry,
  openRing,
  RELATIONS,
  removeGeometryRing,
  validateAtlasEdits,
  type AtlasEdit,
  type TerritoryGeometry,
} from "@/lib/atlas/edits";
import { ATLAS_SOURCES } from "@/lib/atlas/content";
export type AtlasCanvasEdit = {
  disabled?: boolean;
  geometry: TerritoryGeometry;
  color: string;
  control: AtlasEdit["control"];
  mode: "draw" | "edit";
  part: number;
  ring: number;
  vertex: number | null;
  onGeometry: (g: TerritoryGeometry) => void;
  onSelectVertex: (v: number) => void;
};
type Session = {
  draft: AtlasEdit | null;
  mode: "draw" | "edit";
  part: number;
  ring: number;
  vertex: number | null;
  past: TerritoryGeometry[];
  future: TerritoryGeometry[];
};
type Action =
  | { type: "start"; entry: AtlasEdit }
  | { type: "cancel" }
  | { type: "fields"; fields: Partial<AtlasEdit> }
  | { type: "geometry"; geometry: TerritoryGeometry }
  | { type: "undo" | "redo" }
  | { type: "mode"; mode: "draw" | "edit" }
  | { type: "select"; part?: number; ring?: number; vertex?: number | null };
const empty: Session = {
  draft: null,
  mode: "draw",
  part: 0,
  ring: 0,
  vertex: null,
  past: [],
  future: [],
};
function withGeometry(s: Session, g: TerritoryGeometry): Session {
  const ps = geometryParts(g);
  const part = Math.min(s.part, ps.length - 1);
  return {
    ...s,
    draft: { ...s.draft!, geometry: g },
    part,
    ring: Math.min(s.ring, ps[part].length - 1),
    vertex: null,
  };
}
function reduce(s: Session, a: Action): Session {
  if (a.type === "cancel") return empty;
  if (a.type === "start")
    return {
      ...empty,
      draft: { ...structuredClone(a.entry), geometry: openGeometry(a.entry.geometry) },
      mode: geometryParts(a.entry.geometry)[0][0].length ? "edit" : "draw",
    };
  if (!s.draft) return s;
  if (a.type === "fields") return { ...s, draft: { ...s.draft, ...a.fields } };
  if (a.type === "geometry")
    return {
      ...withGeometry(s, a.geometry),
      past: [...s.past.slice(-29), s.draft.geometry],
      future: [],
    };
  if (a.type === "undo") {
    const g = s.past.at(-1);
    return g
      ? {
          ...withGeometry(s, g),
          past: s.past.slice(0, -1),
          future: [s.draft.geometry, ...s.future],
        }
      : s;
  }
  if (a.type === "redo") {
    const g = s.future[0];
    return g
      ? { ...withGeometry(s, g), past: [...s.past, s.draft.geometry], future: s.future.slice(1) }
      : s;
  }
  if (a.type === "mode") return { ...s, mode: a.mode, vertex: null };
  if (a.type === "select")
    return {
      ...s,
      ...(a.part !== undefined ? { part: a.part, ring: 0, vertex: null } : {}),
      ...(a.ring !== undefined ? { ring: a.ring, vertex: null } : {}),
      ...(a.vertex !== undefined ? { vertex: a.vertex } : {}),
    };
  return s;
}
export function useAtlasEditor() {
  const [s, dispatch] = useReducer(reduce, empty);
  useEffect(() => {
    if (!s.draft) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [Boolean(s.draft)]);
  return {
    ...s,
    dispatch,
    start: (entry: AtlasEdit) => {
      if (s.draft && !window.confirm("Відкинути поточну незбережену чернетку?")) return;
      dispatch({ type: "start", entry });
    },
    canvas: s.draft
      ? {
          geometry: s.draft.geometry,
          color: s.draft.color,
          control: s.draft.control,
          mode: s.mode,
          part: s.part,
          ring: s.ring,
          vertex: s.vertex,
          onGeometry: (g: TerritoryGeometry) => dispatch({ type: "geometry", geometry: g }),
          onSelectVertex: (v: number) => dispatch({ type: "select", vertex: v }),
        }
      : undefined,
  };
}
export type AtlasEditorController = ReturnType<typeof useAtlasEditor>;
export function AtlasEditingPanel({
  editor,
  entries,
  base,
  year,
  uk,
  saving,
  canEdit,
  onSave,
  onRemove,
  onRefresh,
  error,
}: {
  editor: AtlasEditorController;
  entries: AtlasEdit[];
  base?: HistoricalCollection;
  year: number;
  uk: boolean;
  saving: boolean;
  canEdit: boolean;
  onSave: (entries: AtlasEdit[]) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onRefresh: () => void;
  error: string;
}) {
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState("");
  const [source, setSource] = useState("");
  const [lng, setLng] = useState("");
  const [lat, setLat] = useState("");
  const [json, setJson] = useState("");
  const [imported, setImported] = useState<AtlasEdit[] | null>(null);
  useEffect(() => {
    if (source && !base?.features.some((f) => String(f.id) === source)) setSource("");
  }, [base, source, year]);
  const draft = editor.draft;
  const parts = draft ? geometryParts(draft.geometry) : [];
  const points = draft ? openRing(parts[editor.part][editor.ring]) : [];
  useEffect(() => {
    setLocalError("");
    setJson("");
    if (draft) setOpen(true);
  }, [draft?.id]);
  useEffect(() => {
    const p = editor.vertex === null ? undefined : points[editor.vertex];
    setLng(p ? String(p[0]) : "");
    setLat(p ? String(p[1]) : "");
  }, [editor.vertex, editor.part, editor.ring, draft?.geometry]);
  const act = (fn: () => void) => {
    try {
      fn();
      setLocalError("");
    } catch (e) {
      setLocalError(atlasEditError(e, uk));
    }
  };
  const start = (feature?: HistoricalFeature, relative = false) => {
    const e = newAtlasEdit(year, feature, relative);
    if (feature) {
      e.name =
        (relative ? "Залежна територія: " : "") + historicalName(feature.properties.name, uk);
      e.subject = historicalName(feature.properties.subject, uk);
      e.sourceUrl =
        feature.properties.sourceUrl ||
        ATLAS_SOURCES.find((s) => s.id === feature.properties.sourceId)?.url ||
        "";
      if (e.sourceUrl.startsWith("/")) e.sourceUrl = "";
    }
    editor.start(e);
  };
  const fields = (fields: Partial<AtlasEdit>) => editor.dispatch({ type: "fields", fields });
  const save = async () => {
    if (!draft) return;
    try {
      const next = validateAtlasEdits([...entries.filter((e) => e.id !== draft.id), draft]);
      setLocalError("");
      if (await onSave(next)) editor.dispatch({ type: "cancel" });
    } catch (e) {
      setLocalError(atlasEditError(e, uk));
    }
  };
  const vertexChange = (append = false) =>
    act(() => {
      if (!draft) return;
      const p: Position = [Number(lng), Number(lat)];
      if (
        !lng.trim() ||
        !lat.trim() ||
        p.some((x) => !Number.isFinite(x)) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90
      )
        throw new Error("INVALID_COORDINATES");
      const ps = structuredClone(points);
      if (!append && editor.vertex !== null) ps[editor.vertex] = p;
      else ps.push(p);
      editor.dispatch({
        type: "geometry",
        geometry: editRing(draft.geometry, editor.part, editor.ring, ps),
      });
    });
  const exportAll = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, entries }, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "historical-atlas-manual.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!canEdit)
    return (
      <p className="mt-2 text-xs text-muted">
        {uk
          ? "Ручні території спільні для школи. Їх редагує власник школи."
          : "Manual territories are shared within the school and edited by its owner."}
      </p>
    );
  return (
    <div className="atlas-editor my-3 rounded-2xl border border-forest-mid/30 bg-forest-mid/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PillButton type="button" tone="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Pencil className="mr-2 size-4" />
          {uk ? "Редактор країн і територій" : "Country and territory editor"}
        </PillButton>
        <span className="text-xs text-muted">
          {entries.length}{" "}
          {uk ? "ручних шарів · спільний атлас школи" : "manual layers · school atlas"}
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            {uk
              ? "Малюйте контур натисканнями на мапі або скопіюйте наявну територію. Кожен шар має роки дії; вилучення ручної правки відновлює вихідний контур."
              : "Click the map to draw an outline or copy an existing territory. Each layer has active years; removing an edit restores the original outline."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <PillButton type="button" tone="ghost" disabled={saving} onClick={() => start()}>
              <Plus className="mr-1 size-4" />
              {uk ? "Нова країна" : "New country"}
            </PillButton>
            <PillButton
              type="button"
              tone="ghost"
              disabled={saving}
              onClick={() => start(undefined, true)}
            >
              {uk ? "Нова відносна територія" : "New relative territory"}
            </PillButton>
            <label className="min-w-40 flex-1 text-xs font-bold">
              {uk ? "Наявний контур цього року" : "Existing outline this year"}
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-surface px-2"
              >
                <option value="">{uk ? "Виберіть територію" : "Choose a territory"}</option>
                {base?.features
                  .filter((f) => !f.properties.custom)
                  .map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {historicalName(f.properties.name, uk)}
                    </option>
                  ))}
              </select>
            </label>
            <PillButton
              type="button"
              tone="ghost"
              disabled={!source || saving}
              onClick={() => {
                const f = base?.features.find((f) => String(f.id) === source);
                if (f) start(f);
              }}
            >
              {uk ? "Виправити контур" : "Edit outline"}
            </PillButton>
            <PillButton
              type="button"
              tone="ghost"
              disabled={!source || saving}
              onClick={() => {
                const f = base?.features.find((f) => String(f.id) === source);
                if (f) start(f, true);
              }}
            >
              {uk ? "Створити штрихований шар" : "Copy as hatched layer"}
            </PillButton>
          </div>
          {draft && (
            <fieldset
              id="atlas-editor-fields"
              disabled={saving}
              className="space-y-3 rounded-xl border border-hairline bg-surface p-3"
            >
              <legend className="px-2 font-bold">
                {uk ? "Чернетка території" : "Territory draft"}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-bold">
                  {uk ? "Назва території" : "Territory name"}
                  <TextInput
                    className="mt-1 w-full"
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) =>
                      fields({
                        name: e.target.value,
                        ...(draft.control === "direct" &&
                        (!draft.subject || draft.subject === draft.name)
                          ? { subject: e.target.value }
                          : {}),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Держава / сторона, що контролює" : "Controlling polity / party"}
                  <TextInput
                    className="mt-1 w-full"
                    maxLength={200}
                    value={draft.subject}
                    onChange={(e) => fields({ subject: e.target.value })}
                  />
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Від року (включно)" : "From year (inclusive)"}
                  <TextInput
                    className="mt-1 w-full"
                    type="number"
                    min={ATLAS_MIN_YEAR}
                    max={ATLAS_MAX_YEAR}
                    value={draft.from}
                    onChange={(e) => fields({ from: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs font-bold">
                  {uk ? "До року (включно)" : "Through year (inclusive)"}
                  <TextInput
                    className="mt-1 w-full"
                    type="number"
                    min={ATLAS_MIN_YEAR}
                    max={ATLAS_MAX_YEAR}
                    value={draft.to}
                    onChange={(e) => fields({ to: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-bold">
                  {uk ? "Тип контролю" : "Control type"}
                  <select
                    value={draft.control}
                    onChange={(e) =>
                      fields({
                        control: e.target.value as AtlasEdit["control"],
                        relation:
                          e.target.value === "relative"
                            ? draft.relation || "Неповний контроль"
                            : "",
                      })
                    }
                    className="mt-1 block min-h-11 rounded-xl border border-hairline bg-surface px-3"
                  >
                    <option value="direct">
                      {uk ? "Основна територія · суцільний колір" : "Core territory · solid fill"}
                    </option>
                    <option value="relative">
                      {uk ? "Відносна територія · штрихування" : "Relative territory · hatch"}
                    </option>
                  </select>
                </label>
                {draft.control === "relative" && (
                  <label className="text-xs font-bold">
                    {uk ? "Характер залежності" : "Relationship"}
                    <select
                      value={draft.relation}
                      onChange={(e) => fields({ relation: e.target.value })}
                      className="mt-1 block min-h-11 rounded-xl border border-hairline bg-surface px-3"
                    >
                      {RELATIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs font-bold">
                  {uk ? "Колір" : "Colour"}
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => fields({ color: e.target.value })}
                    className="mt-1 block h-11 w-16 rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Дія шару" : "Layer action"}
                  <select
                    value={draft.operation}
                    onChange={(e) =>
                      fields({ operation: e.target.value as AtlasEdit["operation"] })
                    }
                    className="mt-1 block min-h-11 rounded-xl border border-hairline bg-surface px-3"
                  >
                    <option value="add">
                      {uk ? "Додати поверх інших територій" : "Add above other territories"}
                    </option>
                    {draft.target && (
                      <>
                        <option value="replace">
                          {uk ? "Замінити вихідний контур" : "Replace source outline"}
                        </option>
                        <option value="hide">
                          {uk ? "Приховати вихідний контур" : "Hide source outline"}
                        </option>
                      </>
                    )}
                  </select>
                </label>
              </div>
              {draft.target && draft.operation !== "add" && (
                <p className="text-xs text-muted">
                  {uk ? "Вихідна територія" : "Source territory"}:{" "}
                  {historicalName(draft.target.name, uk)} · {draft.from}–{draft.to}.{" "}
                  {uk
                    ? "Правка діє тільки в цих роках."
                    : "The edit applies only within these years."}
                </p>
              )}
              {draft.control === "relative" && (
                <p className="text-xs text-muted">
                  {uk
                    ? "Штрихування позначає залежність чи неповний контроль і дозволяє бачити країну під ним. Для данницької залежності Русі вкажіть контролера «Золота Орда» та уточніть роки й джерело."
                    : "Hatching indicates dependency or incomplete control and preserves the country beneath it. For Rus tribute dependency, use Golden Horde as controller and document the years and source."}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold">
                  {uk ? "Частина / острів" : "Part / island"}
                  <select
                    value={editor.part}
                    onChange={(e) =>
                      editor.dispatch({ type: "select", part: Number(e.target.value) })
                    }
                    className="mt-1 block min-h-11 rounded-xl border border-hairline bg-surface px-3"
                  >
                    {parts.map((_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Контур" : "Ring"}
                  <select
                    value={editor.ring}
                    onChange={(e) =>
                      editor.dispatch({ type: "select", ring: Number(e.target.value) })
                    }
                    className="mt-1 block min-h-11 rounded-xl border border-hairline bg-surface px-3"
                  >
                    {parts[editor.part].map((_, i) => (
                      <option key={i} value={i}>
                        {i === 0
                          ? uk
                            ? "Зовнішня межа"
                            : "Outer outline"
                          : `${uk ? "Отвір" : "Hole"} ${i}`}
                      </option>
                    ))}
                  </select>
                </label>
                <PillButton
                  type="button"
                  tone={editor.mode === "draw" ? "primary" : "ghost"}
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
                      ? "Додавати точки на мапі"
                      : "Add map vertices"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={!points.length}
                  onClick={() =>
                    act(() => {
                      editor.dispatch({
                        type: "geometry",
                        geometry: addGeometryPart(draft.geometry),
                      });
                      editor.dispatch({ type: "select", part: parts.length });
                      editor.dispatch({ type: "mode", mode: "draw" });
                    })
                  }
                >
                  {uk ? "Додати острів / частину" : "Add island / part"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={parts[editor.part][0].length < 3}
                  onClick={() =>
                    act(() => {
                      const ring = parts[editor.part].length;
                      editor.dispatch({
                        type: "geometry",
                        geometry: addGeometryHole(draft.geometry, editor.part),
                      });
                      editor.dispatch({ type: "select", ring });
                      editor.dispatch({ type: "mode", mode: "draw" });
                    })
                  }
                >
                  {uk ? "Додати отвір / анклав" : "Add hole / enclave"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  onClick={() =>
                    act(() =>
                      editor.dispatch({
                        type: "geometry",
                        geometry: removeGeometryRing(draft.geometry, editor.part, editor.ring),
                      }),
                    )
                  }
                >
                  {uk ? "Видалити цей контур" : "Remove this ring"}
                </PillButton>
              </div>
              <p className="text-xs text-muted">
                {points.length}{" "}
                {uk
                  ? "точок у контурі. Сині точки можна перетягувати; «+» між ними вставляє нову точку. На великому контурі збільште потрібну ділянку мапи."
                  : "vertices. Drag blue handles; + between them inserts a vertex. Zoom in to edit a dense section."}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold">
                  {uk ? "Точка" : "Vertex"}
                  <select
                    className="mt-1 block min-h-11 max-w-44 rounded-xl border border-hairline bg-surface px-2"
                    value={editor.vertex ?? ""}
                    onChange={(e) =>
                      editor.dispatch({
                        type: "select",
                        vertex: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">{uk ? "Нова точка" : "New vertex"}</option>
                    {points.map((p, i) => (
                      <option key={i} value={i}>
                        {i + 1} · {p[0].toFixed(4)}, {p[1].toFixed(4)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Довгота" : "Longitude"}
                  <TextInput
                    type="number"
                    step="0.000001"
                    min={-180}
                    max={180}
                    className="mt-1 block w-32"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </label>
                <label className="text-xs font-bold">
                  {uk ? "Широта" : "Latitude"}
                  <TextInput
                    type="number"
                    step="0.000001"
                    min={-90}
                    max={90}
                    className="mt-1 block w-32"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                </label>
                <PillButton type="button" tone="ghost" onClick={() => vertexChange(false)}>
                  {editor.vertex === null
                    ? uk
                      ? "Додати точку"
                      : "Add vertex"
                    : uk
                      ? "Змінити координати"
                      : "Apply coordinates"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={editor.vertex === null}
                  onClick={() =>
                    act(() =>
                      editor.dispatch({
                        type: "geometry",
                        geometry: editRing(
                          draft.geometry,
                          editor.part,
                          editor.ring,
                          points.filter((_, i) => i !== editor.vertex),
                        ),
                      }),
                    )
                  }
                >
                  {uk ? "Видалити точку" : "Delete vertex"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={!editor.past.length}
                  onClick={() => editor.dispatch({ type: "undo" })}
                >
                  <Undo2 className="mr-1 size-4" />
                  {uk ? "Скасувати точку" : "Undo geometry"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  disabled={!editor.future.length}
                  onClick={() => editor.dispatch({ type: "redo" })}
                >
                  <Redo2 className="mr-1 size-4" />
                  {uk ? "Повторити" : "Redo"}
                </PillButton>
              </div>
              <label className="block text-xs font-bold">
                {uk ? "Опис і пояснення меж" : "Description and boundary notes"}
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-hairline bg-surface p-3 text-sm"
                  maxLength={4000}
                  value={draft.description}
                  onChange={(e) => fields({ description: e.target.value })}
                />
              </label>
              <label className="block text-xs font-bold">
                {uk ? "Посилання на джерело" : "Source link"}
                <TextInput
                  type="url"
                  className="mt-1 w-full"
                  maxLength={2000}
                  value={draft.sourceUrl}
                  onChange={(e) => fields({ sourceUrl: e.target.value })}
                />
              </label>
              <details className="text-xs">
                <summary className="min-h-9 cursor-pointer font-bold">
                  {uk
                    ? "GeoJSON: вставити або скопіювати контур"
                    : "GeoJSON: paste or copy geometry"}
                </summary>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-hairline bg-surface p-2 font-mono"
                  aria-label="GeoJSON"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder='{"type":"Polygon","coordinates":[…]}'
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <PillButton
                    type="button"
                    tone="ghost"
                    onClick={() => setJson(JSON.stringify(draft.geometry))}
                  >
                    {uk ? "Показати поточний контур" : "Show current geometry"}
                  </PillButton>
                  <PillButton
                    type="button"
                    tone="ghost"
                    onClick={() =>
                      act(() => {
                        if (json.length > 450000) throw new Error("ATLAS_EDIT_LIMIT");
                        const g = JSON.parse(json);
                        const geometry = normalizeTerritoryGeometry(
                          g.type === "Feature" ? g.geometry : g,
                        );
                        editor.dispatch({
                          type: "geometry",
                          geometry: openGeometry(geometry),
                        });
                      })
                    }
                  >
                    {uk ? "Застосувати GeoJSON" : "Apply GeoJSON"}
                  </PillButton>
                </div>
              </details>
              <div className="flex flex-wrap gap-2">
                <PillButton type="button" onClick={() => void save()}>
                  {saving
                    ? uk
                      ? "Збереження…"
                      : "Saving…"
                    : uk
                      ? "Зберегти у спільному атласі"
                      : "Save to shared atlas"}
                </PillButton>
                <PillButton
                  type="button"
                  tone="ghost"
                  onClick={() => editor.dispatch({ type: "cancel" })}
                >
                  {uk ? "Відкинути чернетку" : "Discard draft"}
                </PillButton>
              </div>
            </fieldset>
          )}
          {(error || localError) && (
            <div role="alert" className="rounded-xl bg-terracotta/10 p-3 text-sm text-terracotta">
              {localError || error}
              <PillButton type="button" tone="ghost" onClick={onRefresh}>
                {uk ? "Оновити збережені шари" : "Refresh saved layers"}
              </PillButton>
            </div>
          )}
          <details open={!draft && entries.length > 0}>
            <summary className="min-h-9 cursor-pointer text-xs font-bold">
              {uk ? "Збережені ручні території" : "Saved manual territories"} ({entries.length})
            </summary>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-2 text-xs"
                >
                  <span>
                    <strong>{e.name}</strong> · {e.from}–{e.to}
                    {e.control === "relative" ? " · ▨ " + e.relation : ""}
                    {e.operation === "hide" ? " · " + (uk ? "приховано" : "hidden") : ""}
                  </span>
                  <div className="flex gap-1">
                    <PillButton
                      type="button"
                      tone="ghost"
                      disabled={saving}
                      onClick={() => editor.start(e)}
                    >
                      {uk ? "Редагувати" : "Edit"}
                    </PillButton>
                    <PillButton
                      type="button"
                      tone="ghost"
                      disabled={saving}
                      onClick={() => {
                        if (
                          window.confirm(
                            uk
                              ? "Прибрати цю ручну правку зі спільного атласу? Вихідні карти збережуться."
                              : "Remove this manual edit from the shared atlas? Original maps are preserved.",
                          )
                        )
                          void onRemove(e.id);
                      }}
                    >
                      <Trash2 className="mr-1 size-3" />
                      {uk ? "Прибрати правку" : "Remove edit"}
                    </PillButton>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <PillButton type="button" tone="ghost" onClick={exportAll}>
              <Download className="mr-1 size-4" />
              {uk ? "Експортувати ручні шари" : "Export manual layers"}
            </PillButton>
            <label className="min-h-10 cursor-pointer rounded-full bg-surface px-4 py-2 text-xs font-bold">
              {uk ? "Імпортувати копію" : "Import backup"}
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                disabled={saving}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    if (f.size > 1000000) throw new Error("ATLAS_EDIT_LIMIT");
                    const x = JSON.parse(await f.text());
                    if (x.version !== 1) throw new Error("INVALID_ATLAS_DATA");
                    setImported(validateAtlasEdits(x.entries));
                    setLocalError("");
                  } catch (err) {
                    setLocalError(atlasEditError(err, uk));
                  }
                }}
              />
            </label>
          </div>
          {imported && (
            <div className="rounded-xl border border-hairline bg-surface p-3 text-sm">
              {imported.length}{" "}
              {uk
                ? "шарів у копії. Імпорт об’єднає їх зі збереженими шарами; записи з однаковими ідентифікаторами будуть замінені."
                : "layers in backup. Import merges saved layers and replaces matching IDs."}
              <div className="mt-2 flex gap-2">
                <PillButton
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      const ids = new Set(imported.map((x) => x.id));
                      const merged = validateAtlasEdits([
                        ...entries.filter((e) => !ids.has(e.id)),
                        ...imported,
                      ]);
                      if (await onSave(merged)) setImported(null);
                    } catch (err) {
                      setLocalError(atlasEditError(err, uk));
                    }
                  }}
                >
                  {uk ? "Об’єднати й зберегти" : "Merge and save"}
                </PillButton>
                <PillButton type="button" tone="ghost" onClick={() => setImported(null)}>
                  {uk ? "Скасувати імпорт" : "Cancel import"}
                </PillButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
