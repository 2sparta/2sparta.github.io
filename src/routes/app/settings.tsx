import { SchoolSettingsEditor } from "@/components/school-settings-editor";
import { createFileRoute } from "@tanstack/react-router";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle } from "@/components/ui/panel";
import { SoundToggle } from "@/components/sound-controls";
import { playSound, unlockAudio, useSoundPrefs } from "@/lib/sounds";

export const Route = createFileRoute("/app/settings")({ component: Page });

function Page() {
  const { lang, theme, setLang, setTheme } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const p = me.data?.profile;
  const sound = useSoundPrefs();

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
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <PanelTitle>{lang === "uk" ? "Звуки" : "Sounds"}</PanelTitle>
            <Hint>
              {lang === "uk"
                ? "Короткі сигнали навігації, сповіщень і шахових ходів. Без фонової музики."
                : "Short sounds for navigation, notifications and chess moves. No background music."}
            </Hint>
          </div>
          <SoundToggle />
        </div>
        <label className="flex max-w-sm items-center gap-4 text-sm font-medium">
          <span>{lang === "uk" ? "Гучність" : "Volume"}</span>
          <input
            className="min-w-0 flex-1 accent-forest-mid"
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(sound.volume * 100)}
            disabled={!sound.enabled}
            aria-valuetext={`${Math.round(sound.volume * 100)}%`}
            onChange={(e) => sound.setVolume(Number(e.target.value) / 100)}
            onPointerUp={() => {
              unlockAudio();
              playSound("success");
            }}
            onKeyUp={() => {
              unlockAudio();
              playSound("success");
            }}
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted">
            {Math.round(sound.volume * 100)}%
          </span>
        </label>
      </Panel>
      {p?.role === "teacher" && <SchoolSettingsEditor uk={lang === "uk"} />}
    </div>
  );
}
