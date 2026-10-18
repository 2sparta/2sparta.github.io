import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FileText,
  Link2,
  Play,
  Plus,
  Search,
  Compass,
} from "lucide-react";
import { listMaterials, removeMaterial } from "@/lib/materials/api";
import {
  readingMinutes,
  safeWebUrl,
  videoEmbedUrl,
  type Material,
  type MaterialKind,
} from "@/lib/materials/model";
import { useMeQuery } from "@/components/session-gate";
import { usePrefs } from "@/lib/prefs";
import { ArticleContent } from "@/components/article-content";
import { useSchoolSettings } from "@/components/school-settings-context";
import { ContentInteractions } from "@/components/content-interactions";
import { MaterialEditor } from "@/components/material-editor";
import { HistoricalAtlas } from "@/components/historical-atlas";
import { type AtlasView } from "@/lib/atlas/model";
import { validateAtlasSearchDate } from "@/lib/atlas/date";
import { LEARNING_TOOLS, validateToolSearch, type LearningTool } from "@/lib/learning-tools";
import type { PeriodicLayout } from "@/lib/periodic/model";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";

export type MaterialSection = "overview" | "videos" | "articles" | "links" | "useful";
const PeriodicTable = lazy(() =>
  import("@/components/periodic-table").then((module) => ({ default: module.PeriodicTable })),
);
export const Route = createFileRoute("/app/materials")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    section: MaterialSection;
    id?: string;
    year?: number;
    month?: number;
    day?: number;
    view?: AtlasView;
    tool?: LearningTool;
    element?: number;
    layout?: PeriodicLayout;
  } => ({
    section: ["overview", "videos", "articles", "links", "useful"].includes(String(search.section))
      ? (search.section as MaterialSection)
      : "overview",
    ...(typeof search.id === "string" ? { id: search.id } : {}),
    ...validateToolSearch(search),
    ...validateAtlasSearchDate(search),
    ...([
      "rus",
      "europe",
      "world",
      "byzantium",
      "franks",
      "mongols",
      "hordes",
      "mughals",
      "france",
      "poland",
      "lithuania",
      "commonwealth",
      "cossacks",
      "spain",
      "spanish-empire",
    ].includes(String(search.view))
      ? { view: search.view as AtlasView }
      : {}),
  }),
  component: Page,
});
function Page() {
  const {
    section,
    id,
    year,
    month,
    day,
    view,
    tool = "atlas",
    element,
    layout,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const uk = usePrefs((s) => s.lang) === "uk";
  if (section === "useful")
    return (
      <div>
        <div className="mb-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-forest-mid">
            {uk ? "Додаткові матеріали" : "Learning resources"}
          </p>
          <h1 className="font-display text-3xl font-extrabold">{uk ? "Корисне" : "Tools"}</h1>
          <p className="mt-2 text-sm text-muted">
            {uk
              ? "Інтерактивні інструменти для історії та природничих наук."
              : "Interactive tools for history and science."}
          </p>
          <nav
            aria-label={uk ? "Інструменти" : "Learning tools"}
            className="mt-4 flex flex-wrap gap-2"
          >
            {LEARNING_TOOLS.map((item) => (
              <Link
                key={item.id}
                to="/app/materials"
                search={
                  item.id === "atlas"
                    ? { section: "useful", tool: item.id, year, month, day, view }
                    : { section: "useful", tool: item.id, element, layout }
                }
                aria-current={tool === item.id ? "page" : undefined}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${tool === item.id ? "border-forest-mid bg-forest-mid text-canvas" : "border-hairline bg-surface"}`}
              >
                {uk ? item.uk : item.en}
              </Link>
            ))}
          </nav>
        </div>
        {tool === "periodic" ? (
          <Suspense fallback={<Panel>Завантаження періодичної таблиці…</Panel>}>
            <PeriodicTable
              number={element ?? 4}
              layout={layout ?? "compact"}
              onChange={(element, layout) =>
                void navigate({
                  search: { section: "useful", tool: "periodic", element, layout },
                  replace: true,
                  resetScroll: false,
                })
              }
            />
          </Suspense>
        ) : (
          <HistoricalAtlas
            year={year ?? 1000}
            month={month ?? 1}
            day={day ?? 1}
            view={view ?? "rus"}
            onChange={(year, view, date) =>
              void navigate({
                search: {
                  section: "useful",
                  tool: "atlas",
                  year,
                  month: date?.month ?? 1,
                  day: date?.day ?? 1,
                  view,
                },
                replace: true,
                resetScroll: false,
              })
            }
          />
        )}
      </div>
    );
  // Reset filters and editors when switching material tabs.
  return <MaterialsPage key={`${section}:${id ?? ""}`} section={section} id={id} />;
}
function MaterialsPage({ section, id }: { section: MaterialSection; id?: string }) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const profile = useMeQuery().data?.profile;
  const { settings } = useSchoolSettings();
  const qc = useQueryClient();
  const materials = useQuery({
    queryKey: ["materials", profile?.schoolId, profile?.userId],
    queryFn: listMaterials,
    enabled: Boolean(profile?.schoolId),
  });
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [scope, setScope] = useState("published");
  const [editor, setEditor] = useState<Material | "new" | null>(null);
  const kind: MaterialKind =
    section === "videos" ? "video" : section === "links" ? "link" : "article";
  const title =
    section === "overview"
      ? uk
        ? "Додаткові матеріали"
        : "Learning resources"
      : section === "articles"
        ? uk
          ? "Статті"
          : "Articles"
        : section === "videos"
          ? uk
            ? "Відео"
            : "Videos"
          : uk
            ? "Корисні посилання"
            : "Useful links";
  const all = materials.data ?? [];
  const canCreate =
    profile?.role === "teacher" ||
    (profile?.role === "student" && settings.studentArticles && kind === "article");
  const topics = [...new Set(all.filter((m) => m.kind === kind).map((m) => m.topic))].sort((a, b) =>
    a.localeCompare(b, "uk"),
  );
  const results = all.filter(
    (m) =>
      (section === "overview" ? m.status === "published" : m.kind === kind) &&
      (scope === "all" ||
        (scope === "mine"
          ? m.authorId === profile?.userId
          : scope === "draft"
            ? m.status === "draft"
            : m.status === "published")) &&
      (!topic || m.topic === topic) &&
      `${m.title} ${m.topic} ${m.summary} ${m.authorName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["materials"] });
    setEditor(null);
  };
  const drop = useMutation({ mutationFn: removeMaterial, onSuccess: refresh });
  const current = all.find((m) => m.id === id);
  if (editor)
    return (
      <MaterialEditor
        kind={editor === "new" ? kind : editor.kind}
        existing={editor === "new" ? undefined : editor}
        onSaved={async () => {
          setScope("all");
          await refresh();
        }}
        onClose={() => setEditor(null)}
      />
    );
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold tracking-wide text-forest-mid uppercase">
            {uk ? "Бібліотека школи" : "School library"}
          </p>
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {uk
              ? "Навчайтеся, діліться знаннями та зберігайте корисні ресурси в одному місці."
              : "Learn, share knowledge and keep useful resources in one place."}
          </p>
        </div>
        {section !== "overview" && canCreate && !id && (
          <PillButton type="button" onClick={() => setEditor("new")}>
            <Plus className="mr-2 size-4" />
            {kind === "article"
              ? uk
                ? "Створити статтю"
                : "Create article"
              : uk
                ? "Додати матеріал"
                : "Add resource"}
          </PillButton>
        )}
      </div>
      {materials.isPending && (
        <Panel>
          <p role="status">{uk ? "Завантаження матеріалів…" : "Loading resources…"}</p>
        </Panel>
      )}
      {materials.isError && (
        <Panel>
          <p role="alert" className="mb-3 text-sm text-terracotta">
            {uk
              ? "Не вдалося завантажити матеріали. Перевірте з’єднання та права доступу."
              : "Could not load resources. Check your connection and access."}
          </p>
          <PillButton type="button" tone="ghost" onClick={() => void materials.refetch()}>
            {uk ? "Повторити" : "Retry"}
          </PillButton>
        </Panel>
      )}
      {id && !materials.isPending && !materials.isError && (
        <>
          <Link
            to="/app/materials"
            search={{ section }}
            className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-forest-mid"
          >
            <ArrowLeft className="size-4" />
            {uk ? "До списку" : "Back to list"}
          </Link>
          {current ? (
            <Panel>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-forest-mid">
                  {current.topic} ·{" "}
                  {current.status === "draft"
                    ? uk
                      ? "Чернетка"
                      : "Draft"
                    : `${readingMinutes(current.body)} ${uk ? "хв читання" : "min read"}`}
                </p>
                {(profile?.role === "teacher" ||
                  (settings.studentArticles && current.authorId === profile?.userId)) && (
                  <PillButton type="button" tone="ghost" onClick={() => setEditor(current)}>
                    {uk ? "Редагувати" : "Edit"}
                  </PillButton>
                )}
              </div>
              <article className="mx-auto max-w-3xl">
                <h2 className="font-display text-3xl font-extrabold break-words">
                  {current.title}
                </h2>
                <p className="mt-2 text-xs text-muted">
                  {current.authorName} ·{" "}
                  {new Date(current.updatedAt).toLocaleDateString(uk ? "uk-UA" : "en-GB")}
                </p>
                {current.summary && (
                  <p className="my-6 border-b border-hairline pb-6 text-lg text-ink-soft">
                    {current.summary}
                  </p>
                )}
                <ArticleContent body={current.body} idPrefix={`article-${current.id}`} />
                {current.kind === "article" && current.status === "published" && (
                  <ContentInteractions target="article" id={current.id} uk={uk} />
                )}
              </article>
            </Panel>
          ) : (
            <Panel>
              <p>
                {uk
                  ? "Матеріал недоступний або видалений."
                  : "This resource is unavailable or deleted."}
              </p>
            </Panel>
          )}
        </>
      )}
      {!id && (
        <>
          {section === "overview" && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  section: "videos" as const,
                  kind: "video",
                  icon: Play,
                  title: uk ? "Відео" : "Videos",
                  description: uk
                    ? "Пояснення, лекції та демонстрації"
                    : "Explanations, talks and demos",
                },
                {
                  section: "articles" as const,
                  kind: "article",
                  icon: FileText,
                  title: uk ? "Статті" : "Articles",
                  description: uk
                    ? "Власні тексти та навчальні нотатки"
                    : "Articles and learning notes",
                },
                {
                  section: "links" as const,
                  kind: "link",
                  icon: Link2,
                  title: uk ? "Корисні посилання" : "Useful links",
                  description: uk ? "Добірки ресурсів для навчання" : "Curated learning resources",
                },
                {
                  section: "useful" as const,
                  kind: "tool",
                  icon: Compass,
                  title: uk ? "Корисне" : "Tools",
                  description: uk
                    ? "Історична мапа та періодична таблиця"
                    : "Historical map and periodic table",
                },
              ].map((tab) => (
                <Link
                  key={tab.section}
                  to="/app/materials"
                  search={{ section: tab.section }}
                  className="rounded-2xl border border-hairline bg-surface p-5 transition hover:border-forest-mid/40"
                >
                  <tab.icon className="mb-4 size-6 text-forest-mid" />
                  <h2 className="font-display text-lg font-extrabold">{tab.title}</h2>
                  <p className="mt-1 text-sm text-muted">{tab.description}</p>
                  <p className="mt-4 text-xs font-bold text-forest-mid">
                    {tab.kind === "tool" ? (
                      uk ? (
                        "Відкрити мапу"
                      ) : (
                        "Open map"
                      )
                    ) : (
                      <>
                        {all.filter((m) => m.kind === tab.kind && m.status === "published").length}{" "}
                        {uk ? "матеріалів" : "resources"}
                      </>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{uk ? "Пошук матеріалів" : "Search resources"}</span>
                <Search className="absolute top-3.5 left-3 size-4 text-muted" />
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    uk ? "Пошук за назвою, темою чи автором" : "Search title, topic or author"
                  }
                  className="w-full pl-9"
                />
              </label>
              {section !== "overview" && (
                <>
                  <Select
                    aria-label={uk ? "Тема" : "Topic"}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    <option value="">{uk ? "Усі теми" : "All topics"}</option>
                    {topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={uk ? "Статус матеріалів" : "Resource status"}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="published">{uk ? "Опубліковані" : "Published"}</option>
                    <option value="mine">{uk ? "Мої матеріали" : "My resources"}</option>
                    <option value="draft">{uk ? "Чернетки" : "Drafts"}</option>
                    <option value="all">{uk ? "Усі доступні" : "All accessible"}</option>
                  </Select>
                </>
              )}
            </div>
          </Panel>
          {!materials.isPending && !materials.isError && !results.length && (
            <Panel>
              <BookOpen className="mb-3 size-8 text-forest-mid" />
              <PanelTitle>
                {search || topic
                  ? uk
                    ? "Нічого не знайдено"
                    : "No matches"
                  : uk
                    ? "Тут з’являться матеріали"
                    : "Resources will appear here"}
              </PanelTitle>
              <Hint>
                {search || topic
                  ? uk
                    ? "Змініть пошук або тему."
                    : "Change your search or topic."
                  : uk
                    ? "Додайте перший матеріал або відкрийте розділ статей, щоб поділитися знаннями."
                    : "Add the first resource or open Articles to share your knowledge."}
              </Hint>
            </Panel>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {results.map((m) => {
              const embed = m.kind === "video" ? videoEmbedUrl(m.url) : null;
              const manage = profile?.role === "teacher" || m.authorId === profile?.userId;
              const url = safeWebUrl(m.url);
              return (
                <Panel key={m.id} className="mb-0 flex flex-col">
                  <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold text-forest-mid">
                    <span className="rounded-full bg-forest/10 px-2 py-1">{m.topic}</span>
                    {m.status === "draft" && (
                      <span className="rounded-full bg-cream px-2 py-1">
                        {uk ? "Чернетка" : "Draft"}
                      </span>
                    )}
                    {section === "overview" && (
                      <span className="px-2 py-1">
                        {m.kind === "article"
                          ? uk
                            ? "Стаття"
                            : "Article"
                          : m.kind === "video"
                            ? uk
                              ? "Відео"
                              : "Video"
                            : uk
                              ? "Посилання"
                              : "Link"}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-xl font-extrabold break-words">{m.title}</h2>
                  <p className="mt-2 text-sm text-muted">{m.summary}</p>
                  {embed && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-bold text-forest-mid">
                        {uk ? "Переглянути відео" : "Watch video"}
                      </summary>
                      <iframe
                        className="mt-3 aspect-video w-full rounded-xl border-0"
                        src={embed}
                        title={m.title}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </details>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {m.kind === "article" ? (
                      <Link
                        to="/app/materials"
                        search={{ section: "articles", id: m.id }}
                        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-forest-mid"
                      >
                        {uk ? "Читати статтю" : "Read article"}
                        <ArrowUpRight className="size-4" />
                      </Link>
                    ) : (
                      url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-forest-mid"
                        >
                          {uk ? "Відкрити ресурс" : "Open resource"}
                          <ArrowUpRight className="size-4" />
                        </a>
                      )
                    )}
                    {manage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditor(m)}
                          className="min-h-10 px-2 text-xs font-bold"
                        >
                          {uk ? "Редагувати" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={drop.isPending}
                          onClick={() => {
                            if (
                              window.confirm(uk ? `Видалити «${m.title}»?` : `Delete “${m.title}”?`)
                            )
                              drop.mutate({ id: m.id, revision: m.revision });
                          }}
                          className="min-h-10 px-2 text-xs font-bold text-terracotta"
                        >
                          {uk ? "Видалити" : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                  <p className="mt-auto pt-3 text-xs text-muted">
                    {m.authorName} ·{" "}
                    {new Date(m.updatedAt).toLocaleDateString(uk ? "uk-UA" : "en-GB")}
                    {m.kind === "article" &&
                      ` · ${readingMinutes(m.body)} ${uk ? "хв читання" : "min read"}`}
                  </p>
                </Panel>
              );
            })}
          </div>
          {drop.isError && (
            <p role="alert" className="mt-4 text-sm text-terracotta">
              {drop.error.message === "CONFLICT"
                ? uk
                  ? "Матеріал змінився. Оновіть список перед видаленням."
                  : "Resource changed. Refresh before deleting."
                : uk
                  ? "Не вдалося видалити матеріал."
                  : "Could not delete resource."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
