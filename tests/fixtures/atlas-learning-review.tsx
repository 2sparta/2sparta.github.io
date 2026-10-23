// Isolated browser QA; never imported by the application. No account or database writes.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoricalAtlas } from "../../src/components/historical-atlas";
import { ArticleWidgetEditor } from "../../src/components/article-widget-editor";
import { ArticleContent } from "../../src/components/article-content";
import {
  articleWidgets,
  newArticleWidget,
  serializeArticleWidget,
} from "../../src/lib/materials/article-widgets";
import { usePrefs } from "../../src/lib/prefs";
import "../../src/styles.css";
const params = new URLSearchParams(location.search);
usePrefs.getState().setLang("uk");
usePrefs.getState().setTheme(params.get("theme") === "dark" ? "dark" : "light");
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});
// A read-only viewer without a school keeps real backend requests disabled.
client.setQueryData(["me"], { profile: { userId: "viewer", role: "student" } });
client.setQueryData(["atlas-manual", undefined, "viewer"], {
  entries: [],
  revision: 0,
  canEdit: false,
  schoolId: "",
});
function Review() {
  const [date, setDate] = useState({ year: 1772, month: 8, day: 5 }),
    [body, setBody] = useState(localStorage.getItem("atlas-learning-review-body") ?? ""),
    [editing, setEditing] = useState(!localStorage.getItem("atlas-learning-review-body"));
  return (
    <QueryClientProvider client={client}>
      <main style={{ maxWidth: 1280, margin: "24px auto", padding: 12, minWidth: 0 }}>
        {params.get("view") === "article" ? (
          <>
            <h1 className="mb-5 text-2xl font-bold">Історія у статті</h1>
            {editing ? (
              <ArticleWidgetEditor
                initial={articleWidgets(body)[0]?.widget ?? newArticleWidget("map", true)}
                editing={Boolean(body)}
                onCancel={() => setEditing(false)}
                onApply={(widget) => {
                  const next = `## Поділи Речі Посполитої\n\n${serializeArticleWidget(widget)}\n\nПояснення до інтерактивної мапи.`;
                  localStorage.setItem("atlas-learning-review-body", next);
                  setBody(next);
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <ArticleContent body={body} />
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-forest px-4 text-paper"
                  onClick={() => setEditing(true)}
                >
                  Редагувати фрагмент
                </button>
              </>
            )}
          </>
        ) : (
          <HistoricalAtlas
            {...date}
            view="world"
            onChange={(year, _view, next) =>
              setDate({ year, month: next?.month ?? 1, day: next?.day ?? 1 })
            }
          />
        )}
      </main>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Review />);
