import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getGradingSettings, setGradingSettings } from "@/lib/school/server";
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

  const qc = useQueryClient();
  const grading = useQuery({
    queryKey: ["grading-settings", p?.schoolId, p?.userId],
    queryFn: getGradingSettings,
    enabled: p?.role === "teacher",
  });
  const save = useMutation({
    mutationFn: (allowSelfAssessment: boolean) =>
      setGradingSettings({ data: { allowSelfAssessment } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["grading-settings"] });
    },
    onError: () =>
      toast.error(lang === "uk" ? "Не вдалося зберегти налаштування" : "Could not save settings"),
  });

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
              className={`rounded-full px-4 py-2 text-sm font-bold ${theme === "light" ? "bg-forest text-paper" : "bg-surface-2"}`}
            >
              {t.themeLight}
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${theme === "dark" ? "bg-forest text-paper" : "bg-surface-2"}`}
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
              className={`rounded-full px-4 py-2 text-sm font-bold ${lang === "uk" ? "bg-forest text-paper" : "bg-surface-2"}`}
            >
              UA
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${lang === "en" ? "bg-forest text-paper" : "bg-surface-2"}`}
            >
              EN
            </button>
          </div>
        </div>
        {p?.role === "teacher" && (
          <div className="mt-6 border-t border-hairline pt-4">
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={grading.data?.allowSelfAssessment ?? false}
                disabled={grading.isPending || grading.isError || save.isPending}
                onChange={(e) => save.mutate(e.target.checked)}
              />
              {lang === "uk"
                ? "Дозволити учням виставляти собі оцінки за урок"
                : "Allow students to assess their own lessons"}
            </label>
            <Hint>
              {lang === "uk"
                ? "Спільне налаштування школи. Оцінки 1–12 очікують перевірки вчителем; домашні та підсумкові оцінки виставляє вчитель."
                : "School-wide setting. Marks (1–12) await teacher review; homework and final grades are set by teachers."}
            </Hint>
            {grading.isError && (
              <p role="alert">
                {lang === "uk" ? "Не вдалося завантажити налаштування" : "Could not load settings"}
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
