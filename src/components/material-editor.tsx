import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImagePlus,
  Eye,
  Pencil,
  Save,
  Send,
  PanelsTopLeft,
} from "lucide-react";
import { saveMaterial } from "@/lib/materials/api";
import type { Material, MaterialInput, MaterialKind } from "@/lib/materials/model";
import { useMeQuery } from "@/components/session-gate";
import { usePrefs } from "@/lib/prefs";
import { ArticleContent } from "./article-content";
import { ArticleWidgetEditor } from "./article-widget-editor";
import {
  applyArticleHeading,
  articleEditorProjection,
  articleWidgets,
  newArticleWidget,
  serializeArticleWidget,
  WIDGET_LABELS,
  type ArticleWidget,
} from "@/lib/materials/article-widgets";
import { useImageUpload } from "./use-image-upload";
import { STRINGS } from "@/lib/i18n";
import { safeWebUrl } from "@/lib/materials/model";
import { toast } from "sonner";
import { Panel, PanelTitle, PillButton, TextInput } from "./ui/panel";

const initial = (kind: MaterialKind, existing?: Material): MaterialInput => ({
  kind,
  title: existing?.title ?? "",
  topic: existing?.topic ?? "",
  summary: existing?.summary ?? "",
  body: existing?.body ?? "",
  url: existing?.url ?? "",
  status: existing?.status ?? "draft",
});
export function MaterialEditor({
  kind,
  existing,
  onSaved,
  onClose,
}: {
  kind: MaterialKind;
  existing?: Material;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const profile = useMeQuery().data?.profile;
  const storageKey = `material-draft:${profile?.schoolId}:${profile?.userId}:${existing?.id ?? kind}`;
  const [form, setForm] = useState(() => initial(kind, existing));
  const [recovered, setRecovered] = useState<{ form: MaterialInput; revision?: number } | null>(
    null,
  );
  const [revision, setRevision] = useState(existing?.revision);
  const [preview, setPreview] = useState(false);
  const [backup, setBackup] = useState("");
  const [saved, setSaved] = useState(false);
  const [widgetTarget, setWidgetTarget] = useState<{
    start: number;
    end: number;
    initial: ArticleWidget;
    editing: boolean;
  } | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const imagePosition = useRef({ start: 0, end: 0 });
  const latestForm = useRef(form);
  latestForm.current = form;
  const projection = articleEditorProjection(form.body, uk);
  const dirty =
    !saved &&
    (JSON.stringify(form) !== JSON.stringify(initial(kind, existing)) || Boolean(widgetTarget));
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm(
        uk
          ? "Залишити редактор? Незбережені зміни не опубліковано."
          : "Leave editor? Unsaved changes have not been published.",
      ),
    enableBeforeUnload: dirty,
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const value = JSON.parse(raw);
        if (
          value.form?.kind === kind &&
          typeof value.form.title === "string" &&
          ["body", "topic", "summary", "url"].every(
            (field) => typeof value.form[field] === "string",
          )
        )
          setRecovered(value);
      }
    } catch {
      /* Storage can be disabled. */
    }
  }, [storageKey, kind]);
  useEffect(() => {
    if (!dirty || recovered || saved || widgetTarget) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ form, revision }));
        setBackup(uk ? "Локальну копію чернетки збережено" : "Local draft backup saved");
      } catch {
        setBackup(
          uk
            ? "Локальна копія недоступна. Збережіть чернетку кнопкою нижче."
            : "Local backup unavailable. Save a draft below.",
        );
      }
    }, 600);
    return () => clearTimeout(id);
  }, [form, dirty, recovered, revision, saved, storageKey, uk, widgetTarget]);
  const mutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
      saveMaterial({ id: existing?.id, revision, material: { ...form, status } }),
    onSuccess: async () => {
      setSaved(true);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* no backup */
      }
      await onSaved();
    },
  });
  const update = (key: keyof MaterialInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    mutation.reset();
  };
  const insert = (before: string, after = "", fallback = uk ? "текст" : "text") => {
    const el = body.current;
    if (!el) return;
    if (projection.intersectsWidget(el.selectionStart, el.selectionEnd)) {
      toast.info(
        uk
          ? "Редагуйте віджет у списку під текстом."
          : "Edit the widget in the list below the text.",
      );
      return;
    }
    const a = projection.toSource(el.selectionStart);
    const b = projection.toSource(el.selectionEnd, true);
    const text = form.body.slice(a, b) || fallback;
    const nextBody = form.body.slice(0, a) + before + text + after + form.body.slice(b);
    if (nextBody.length > 50_000) {
      toast.error(uk ? "Стаття перевищує 50 000 символів." : "Article exceeds 50,000 characters.");
      return;
    }
    update("body", nextBody);
    requestAnimationFrame(() => {
      el.focus();
      const next = articleEditorProjection(nextBody, uk);
      el.setSelectionRange(
        next.toVisible(a + before.length),
        next.toVisible(a + before.length + text.length),
      );
    });
  };
  const images = useImageUpload({
    max: 20,
    getCount: () => (latestForm.current.body.match(/^!\[/gm) ?? []).length,
    disabled: mutation.isPending || Boolean(recovered) || Boolean(widgetTarget),
    onUploaded: (url, file) => {
      const safe = safeWebUrl(url);
      if (!safe) throw new Error("INVALID_IMAGE_URL");
      const alt = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[\[\]\\\r\n]/g, "")
        .slice(0, 160);
      const markdown = `\n\n![${alt}](${safe.replace(/\(/g, "%28").replace(/\)/g, "%29")})\n\n`;
      const { start, end } = imagePosition.current;
      const nextBody =
        latestForm.current.body.slice(0, start) + markdown + latestForm.current.body.slice(end);
      if (nextBody.length > 50_000) {
        toast.error(
          uk
            ? "Фото не додано: стаття перевищує 50 000 символів."
            : "Photo not inserted: article exceeds 50,000 characters.",
        );
        return;
      }
      imagePosition.current = { start: start + markdown.length, end: start + markdown.length };
      latestForm.current = { ...latestForm.current, body: nextBody };
      setForm(latestForm.current);
      mutation.reset();
      requestAnimationFrame(() => {
        const caret = articleEditorProjection(latestForm.current.body, uk).toVisible(
          imagePosition.current.start,
        );
        body.current?.setSelectionRange(caret, caret);
      });
    },
  });
  const rememberImagePosition = () => {
    if (!images.isBusy())
      imagePosition.current = {
        start: body.current
          ? projection.toSource(body.current.selectionStart, true)
          : form.body.length,
        end: body.current ? projection.toSource(body.current.selectionEnd, true) : form.body.length,
      };
  };
  const heading = (level: number) => {
    const el = body.current;
    if (!el) return;
    const name = uk
      ? level === 1
        ? "Заголовок"
        : `Підзаголовок ${level - 1}`
      : level === 1
        ? "Heading"
        : `Subheading ${level - 1}`;
    if (projection.intersectsWidget(el.selectionStart, el.selectionEnd)) {
      toast.info(
        uk
          ? "Редагуйте віджет у списку під текстом."
          : "Edit the widget in the list below the text.",
      );
      return;
    }
    const next = applyArticleHeading(
      form.body,
      projection.toSource(el.selectionStart),
      projection.toSource(el.selectionEnd, true),
      level,
      name,
    );
    if (next.body.length > 50_000) {
      toast.error(uk ? "Стаття перевищує 50 000 символів." : "Article exceeds 50,000 characters.");
      return;
    }
    update("body", next.body);
    requestAnimationFrame(() => {
      el.focus();
      const display = articleEditorProjection(next.body, uk);
      el.setSelectionRange(display.toVisible(next.start), display.toVisible(next.end));
    });
  };
  const applyWidget = (widget: ArticleWidget) => {
    if (!widgetTarget) return;
    const block = serializeArticleWidget(widget);
    const inserted = widgetTarget.editing ? block : `\n\n${block}\n\n`;
    const next =
      form.body.slice(0, widgetTarget.start) + inserted + form.body.slice(widgetTarget.end);
    if (next.length > 50_000) {
      toast.error(
        uk
          ? "Віджет не додано: стаття перевищує 50 000 символів."
          : "Widget not inserted: article exceeds 50,000 characters.",
      );
      return;
    }
    update("body", next);
    const caret = widgetTarget.start + inserted.length;
    setWidgetTarget(null);
    requestAnimationFrame(() => {
      body.current?.focus();
      const visibleCaret = articleEditorProjection(next, uk).toVisible(caret);
      body.current?.setSelectionRange(visibleCaret, visibleCaret);
    });
  };
  const currentWidgets = articleWidgets(form.body);
  const close = () => {
    if (dirty) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ form, revision }));
      } catch {
        /* Storage unavailable. */
      }
    }
    if (
      !dirty ||
      window.confirm(
        uk
          ? "Закрити редактор? Незбережений текст залишиться лише в локальній копії."
          : "Close editor? Unsaved text remains only in the local backup.",
      )
    )
      onClose();
  };
  const error = mutation.error?.message;
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>
          {existing
            ? uk
              ? "Редагування матеріалу"
              : "Edit material"
            : kind === "article"
              ? uk
                ? "Нова стаття"
                : "New article"
              : kind === "video"
                ? uk
                  ? "Нове відео"
                  : "New video"
                : uk
                  ? "Нове посилання"
                  : "New link"}
        </PanelTitle>
        <PillButton
          type="button"
          tone="ghost"
          disabled={mutation.isPending || images.busy || Boolean(widgetTarget)}
          onClick={close}
        >
          {uk ? "Закрити" : "Close"}
        </PillButton>
      </div>
      {recovered && (
        <div className="mb-4 rounded-xl bg-cream p-3 text-sm">
          <p>
            {uk
              ? "Є незбережена локальна чернетка. Відновити її?"
              : "An unsaved local draft is available."}
          </p>
          <div className="mt-2 flex gap-2">
            <PillButton
              type="button"
              onClick={() => {
                setForm(recovered.form);
                setRevision(recovered.revision);
                setRecovered(null);
              }}
            >
              {uk ? "Відновити" : "Restore"}
            </PillButton>
            <PillButton
              type="button"
              tone="ghost"
              onClick={() => {
                try {
                  localStorage.removeItem(storageKey);
                } catch {
                  /* unavailable */
                }
                setRecovered(null);
              }}
            >
              {uk ? "Відкинути копію" : "Discard backup"}
            </PillButton>
          </div>
        </div>
      )}
      <fieldset disabled={mutation.isPending || Boolean(recovered)} className="space-y-4">
        <label className="block text-sm font-bold">
          {uk ? "Заголовок" : "Title"}
          <TextInput
            maxLength={160}
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1 w-full"
            placeholder={uk ? "Назва матеріалу" : "Material title"}
          />
        </label>
        <label className="block text-sm font-bold">
          {uk ? "Тема" : "Topic"}
          <TextInput
            maxLength={80}
            value={form.topic}
            onChange={(e) => update("topic", e.target.value)}
            className="mt-1 w-full"
            placeholder={
              uk
                ? "Наприклад: історія, програмування, самоврядування"
                : "For example: history, programming, student council"
            }
          />
        </label>
        <label className="block text-sm font-bold">
          {uk ? "Короткий опис" : "Summary"}
          <textarea
            maxLength={500}
            rows={2}
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            className="mt-1 block w-full rounded-xl border border-hairline bg-surface-2 p-3 text-sm outline-none focus:ring-2 focus:ring-forest-mid/30"
          />
        </label>
        {kind !== "article" && (
          <label className="block text-sm font-bold">
            {uk ? "Посилання" : "URL"}
            <TextInput
              type="url"
              maxLength={2000}
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder={kind === "video" ? "https://www.youtube.com/watch?v=…" : "https://…"}
              className="mt-1 w-full"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              {uk
                ? "Відео YouTube та Vimeo можна переглянути на сайті. Інші посилання відкриваються в новій вкладці."
                : "YouTube and Vimeo play on this site. Other URLs open in a new tab."}
            </span>
          </label>
        )}
        {kind === "article" && (
          <div className="overflow-hidden rounded-2xl border border-hairline">
            <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-surface-2 p-2">
              {!preview && (
                <select
                  aria-label={uk ? "Рівень заголовка" : "Heading level"}
                  value=""
                  disabled={images.busy || Boolean(widgetTarget)}
                  onChange={(e) => heading(Number(e.target.value))}
                  className="min-h-10 max-w-full rounded-lg bg-surface px-2 text-sm font-bold"
                >
                  <option value="" disabled>
                    {uk ? "Стиль тексту" : "Text style"}
                  </option>
                  <option value="0">{uk ? "Звичайний текст" : "Paragraph"}</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level === 1
                        ? uk
                          ? "Заголовок"
                          : "Heading"
                        : `${uk ? "Підзаголовок" : "Subheading"} ${level - 1}`}
                    </option>
                  ))}
                </select>
              )}
              {!preview &&
                [
                  { icon: Bold, label: uk ? "Жирний" : "Bold", before: "**", after: "**" },
                  { icon: Italic, label: uk ? "Курсив" : "Italic", before: "*", after: "*" },
                  { icon: List, label: uk ? "Список" : "List", before: "\n- ", after: "\n" },
                  {
                    icon: ListOrdered,
                    label: uk ? "Нумерований список" : "Numbered list",
                    before: "\n1. ",
                    after: "\n",
                  },
                  { icon: Quote, label: uk ? "Цитата" : "Quote", before: "\n> ", after: "\n" },
                  {
                    icon: Link2,
                    label: uk ? "Посилання" : "Link",
                    before: "[",
                    after: "](https://example.com)",
                  },
                ].map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    aria-label={tool.label}
                    title={tool.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(tool.before, tool.after)}
                    disabled={images.busy || Boolean(widgetTarget)}
                    className="grid size-10 place-items-center rounded-lg text-ink hover:bg-surface"
                  >
                    <tool.icon className="size-4" />
                  </button>
                ))}
              {!preview && (
                <button
                  type="button"
                  aria-label={uk ? "Додати фото" : "Add photo"}
                  title={
                    uk ? "Додати фото або вставити з буфера" : "Add photo or paste from clipboard"
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    rememberImagePosition();
                    photoInput.current?.click();
                  }}
                  disabled={images.busy || Boolean(widgetTarget)}
                  className="grid size-10 place-items-center rounded-lg text-ink hover:bg-surface disabled:opacity-40"
                >
                  <ImagePlus className="size-4" />
                </button>
              )}
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  images.add(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              {!preview && (
                <button
                  type="button"
                  disabled={images.busy || Boolean(widgetTarget)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const el = body.current;
                    const cursor = el
                      ? projection.toSource(el.selectionEnd, true)
                      : form.body.length;
                    const lineEnd = form.body.indexOf("\n", cursor);
                    const position = lineEnd < 0 ? form.body.length : lineEnd;
                    if (currentWidgets.some((w) => position >= w.start && position <= w.end)) {
                      toast.info(
                        uk
                          ? "Редагуйте цей віджет у списку нижче."
                          : "Edit this widget in the list below.",
                      );
                      return;
                    }
                    setWidgetTarget({
                      start: position,
                      end: position,
                      initial: newArticleWidget("toc", uk),
                      editing: false,
                    });
                  }}
                  className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-bold disabled:opacity-40"
                >
                  <PanelsTopLeft className="size-4" />
                  {uk ? "Вставити віджет" : "Insert widget"}
                </button>
              )}
              <button
                type="button"
                aria-pressed={preview}
                disabled={images.busy || Boolean(widgetTarget)}
                onClick={() => setPreview((v) => !v)}
                className="ml-auto flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-bold"
              >
                {preview ? <Pencil className="size-4" /> : <Eye className="size-4" />}
                {preview ? (uk ? "Редактор" : "Editor") : uk ? "Перегляд" : "Preview"}
              </button>
            </div>
            {widgetTarget && (
              <ArticleWidgetEditor
                key={`${widgetTarget.start}:${widgetTarget.editing}`}
                initial={widgetTarget.initial}
                editing={widgetTarget.editing}
                onApply={applyWidget}
                onCancel={() => setWidgetTarget(null)}
              />
            )}
            {preview ? (
              <div className="min-h-80 p-5">
                <h2 className="font-display text-2xl font-extrabold">{form.title}</h2>
                <ArticleContent body={form.body} />
                {!form.body && (
                  <p className="text-sm text-muted">
                    {uk ? "Текст статті з’явиться тут" : "Article preview appears here"}
                  </p>
                )}
              </div>
            ) : (
              <textarea
                ref={body}
                aria-label={uk ? "Текст статті" : "Article body"}
                rows={16}
                maxLength={50_000}
                value={projection.text}
                readOnly={images.busy || Boolean(widgetTarget)}
                aria-busy={images.busy}
                onPaste={(e) => {
                  rememberImagePosition();
                  images.onPaste(e);
                }}
                onChange={(e) => {
                  try {
                    const expanded = projection.expand(e.target.value);
                    if (expanded.length > 50_000) {
                      toast.error(
                        uk
                          ? "Стаття перевищує 50 000 символів."
                          : "Article exceeds 50,000 characters.",
                      );
                      return;
                    }
                    update("body", expanded);
                  } catch {
                    toast.info(
                      uk
                        ? "Змінюйте або видаляйте віджети через список під текстом."
                        : "Change or remove widgets using the list below the text.",
                    );
                  }
                }}
                placeholder={
                  uk
                    ? "Напишіть статтю. Використовуйте панель для форматування."
                    : "Write your article. Use the toolbar to format it."
                }
                className="block w-full resize-y bg-surface p-5 text-base leading-7 outline-none"
              />
            )}
            {!preview && currentWidgets.length > 0 && (
              <div className="space-y-2 border-t border-hairline p-3">
                <p className="text-xs font-bold text-muted">
                  {uk ? "Віджети статті" : "Article widgets"}
                </p>
                <p className="text-xs text-muted">
                  {uk
                    ? "У тексті віджети позначені блоками ⟦…⟧. Налаштуйте або видаліть їх кнопками нижче."
                    : "Widgets appear as ⟦…⟧ blocks in the text. Configure or remove them below."}
                </p>
                {currentWidgets.map((block) => (
                  <div
                    key={block.start}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
                  >
                    <span className="text-xs">
                      <strong>{block.widget.title}</strong> ·{" "}
                      {WIDGET_LABELS[uk ? "uk" : "en"][block.widget.type]}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={images.busy || Boolean(widgetTarget)}
                        aria-label={`${uk ? "Редагувати віджет" : "Edit widget"}: ${block.widget.title}`}
                        onClick={() =>
                          setWidgetTarget({
                            start: block.start,
                            end: block.end,
                            initial: block.widget,
                            editing: true,
                          })
                        }
                        className="min-h-10 rounded-lg px-2 text-xs font-bold text-forest-mid disabled:opacity-40"
                      >
                        {uk ? "Редагувати" : "Edit"}
                      </button>
                      <button
                        type="button"
                        disabled={images.busy || Boolean(widgetTarget)}
                        aria-label={`${uk ? "Видалити віджет" : "Delete widget"}: ${block.widget.title}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              uk
                                ? "Видалити цей віджет зі статті?"
                                : "Remove this widget from the article?",
                            )
                          )
                            update(
                              "body",
                              form.body.slice(0, block.start) + form.body.slice(block.end),
                            );
                        }}
                        className="min-h-10 rounded-lg px-2 text-xs font-bold text-terracotta disabled:opacity-40"
                      >
                        {uk ? "Видалити" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p role="status" className="border-t border-hairline px-5 py-2 text-xs text-muted">
              {images.busy
                ? STRINGS[uk ? "uk" : "en"].driveUploading
                : STRINGS[uk ? "uk" : "en"].drivePasteHint}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <PillButton
            type="button"
            tone="ghost"
            disabled={
              images.busy || Boolean(widgetTarget) || !form.title.trim() || !form.topic.trim()
            }
            onClick={() => {
              if (
                existing?.status !== "published" ||
                window.confirm(
                  uk
                    ? "Матеріал зникне з опублікованих і залишиться чернеткою. Продовжити?"
                    : "This resource will be unpublished and saved as a draft. Continue?",
                )
              )
                mutation.mutate("draft");
            }}
          >
            <Save className="mr-2 size-4" />
            {uk ? "Зберегти чернетку" : "Save draft"}
          </PillButton>
          <PillButton
            type="button"
            disabled={
              images.busy ||
              Boolean(widgetTarget) ||
              !form.title.trim() ||
              !form.topic.trim() ||
              (kind === "article" && !form.body.trim())
            }
            onClick={() => mutation.mutate("published")}
          >
            <Send className="mr-2 size-4" />
            {existing?.status === "published"
              ? uk
                ? "Оновити публікацію"
                : "Update publication"
              : uk
                ? "Опублікувати"
                : "Publish"}
          </PillButton>
        </div>
        <p role="status" className="text-xs text-muted">
          {mutation.isPending
            ? uk
              ? "Збереження…"
              : "Saving…"
            : backup ||
              (uk
                ? "Чернетка доступна автору та вчителям. Публікація — усім учасникам школи."
                : "Drafts are visible to their author and teachers. Published materials are visible to all school members.")}
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-terracotta">
          {error === "CONFLICT"
            ? uk
              ? "Матеріал змінився в іншому вікні. Ваш текст залишився в редакторі. Оновіть матеріал перед повторним збереженням."
              : "This material changed in another window. Your text is preserved. Reload it before saving again."
            : error === "INVALID_URL"
              ? uk
                ? "Вкажіть повне посилання, що починається з https:// або http://."
                : "Enter a complete https:// or http:// URL."
              : uk
                ? "Не вдалося зберегти матеріал. Перевірте поля й спробуйте ще раз."
                : "Could not save. Check the fields and retry."}
        </p>
      )}
    </Panel>
  );
}
