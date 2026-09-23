import { createFileRoute } from "@tanstack/react-router";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle } from "@/components/ui/panel";

export const Route = createFileRoute("/app/settings")({ component: Page });

function Page() {
  const { lang, theme, setLang, setTheme } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const p = me.data?.profile;

  return (
    <div>
      <Panel>
        <PanelTitle>{t.settings}</PanelTitle>
        {p && (
          <Hint>
            {p.displayName} · {p.schoolName} {p.className ? `· ${p.className}` : ""}
          </Hint>
        )}
        <div className="mb-4">
          <p className="mb-2 font-display text-sm font-bold">{t.theme}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${theme === "light" ? "bg-forest text-paper" : "bg-paper-2"}`}
            >
              {t.themeLight}
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${theme === "dark" ? "bg-forest text-paper" : "bg-paper-2"}`}
            >
              {t.themeDark}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 font-display text-sm font-bold">{t.language}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLang("uk")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${lang === "uk" ? "bg-forest text-paper" : "bg-paper-2"}`}
            >
              UA
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${lang === "en" ? "bg-forest text-paper" : "bg-paper-2"}`}
            >
              EN
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
