import { lazy, Suspense } from "react";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ArticleHeading, ArticleWidget } from "@/lib/materials/article-widgets";
import { usePrefs } from "@/lib/prefs";

const EmbeddedHistoricalMap = lazy(() =>
  import("./embedded-historical-map").then((m) => ({ default: m.EmbeddedHistoricalMap })),
);

export function ArticleWidgetView({
  widget: w,
  headings,
  prefix,
}: {
  widget: ArticleWidget;
  headings: ArticleHeading[];
  prefix: string;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  if (w.type === "map")
    return (
      <Suspense fallback={<p role="status">{uk ? "Завантажуємо мапу…" : "Loading map…"}</p>}>
        <EmbeddedHistoricalMap widget={w} />
      </Suspense>
    );
  const box = "my-6 overflow-hidden rounded-2xl border border-hairline bg-surface-2/40";
  const title = (
    <h3 className="border-b border-hairline bg-cream/70 px-4 py-3 font-display text-lg font-extrabold">
      {w.title}
    </h3>
  );
  if (w.type === "toc")
    return (
      <details open className={box}>
        <summary className="cursor-pointer px-4 py-3 font-display font-extrabold">
          {w.title}
        </summary>
        {headings.length ? (
          <nav aria-label={w.title} className="border-t border-hairline p-3">
            <ol className="space-y-1">
              {headings.map((h) => (
                <li key={h.id} style={{ paddingInlineStart: (h.level - 1) * 16 }}>
                  <a
                    href={`#${prefix}-${h.id}`}
                    className="block rounded-lg px-2 py-1.5 text-sm text-forest-mid hover:bg-surface hover:underline"
                  >
                    <span className="mr-2 text-muted">{h.number}</span>
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted">
            {uk ? "Додайте заголовки, щоб сформувати зміст." : "Add headings to populate contents."}
          </p>
        )}
      </details>
    );
  if (w.type === "conflict")
    return (
      <section className={box} aria-label={w.title}>
        {title}
        <div className="space-y-3 p-4">
          {w.summary && <p className="whitespace-pre-wrap text-sm">{w.summary}</p>}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              [uk ? "Дата / період" : "Date / period", w.date],
              [uk ? "Місце" : "Location", w.location],
              [uk ? "Результат" : "Result", w.result],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="font-bold text-muted">{label}</dt>
                  <dd className="whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {uk ? "Порівняння сторін конфлікту" : "Conflict side comparison"}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="border border-hairline p-3 text-left">
                  {uk ? "Сторони" : "Sides"}
                </th>
                {w.sides.map((s, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="min-w-36 border border-hairline bg-forest/10 p-3 text-left"
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["participants", uk ? "Учасники" : "Participants"],
                  ["leaders", uk ? "Керівники / командувачі" : "Leaders / commanders"],
                  ["forces", uk ? "Сили / ресурси" : "Forces / resources"],
                  ["losses", uk ? "Втрати" : "Losses"],
                ] as const
              )
                .filter(([key]) => w.sides.some((s) => s[key]))
                .map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row" className="border border-hairline p-3 text-left font-semibold">
                      {label}
                    </th>
                    {w.sides.map((s, i) => (
                      <td
                        key={i}
                        className="border border-hairline p-3 align-top whitespace-pre-wrap"
                      >
                        {s[key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  if (w.type === "infobox")
    return (
      <aside className={box} aria-label={w.title}>
        {title}
        <dl className="divide-y divide-hairline">
          {w.rows.map((r, i) => (
            <div
              key={i}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            >
              <dt className="font-bold text-muted">{r.label}</dt>
              <dd className="whitespace-pre-wrap">{r.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    );
  if (w.type === "timeline")
    return (
      <section className={box} aria-label={w.title}>
        {title}
        <ol className="m-4 ml-6 space-y-5 border-l-2 border-forest-mid/30 pl-5">
          {w.entries.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1 -left-[27px] size-3 rounded-full bg-forest-mid" />
              <p className="text-sm font-extrabold text-forest-mid">{e.date}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{e.text}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  const Icon = w.tone === "warning" ? TriangleAlert : w.tone === "tip" ? Lightbulb : Info;
  return (
    <aside
      aria-label={w.title}
      className={`my-6 rounded-2xl border p-4 ${w.tone === "warning" ? "border-terracotta/40 bg-terracotta/10" : w.tone === "tip" ? "border-forest-mid/40 bg-forest-mid/10" : "border-hairline bg-surface-2"}`}
    >
      <h3 className="flex items-center gap-2 font-display font-extrabold">
        <Icon className="size-5 shrink-0" />
        {w.title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{w.text}</p>
    </aside>
  );
}
