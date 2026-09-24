import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/prefs";

export function ThemeLangPill({ inverted = false }: { inverted?: boolean }) {
  const { lang, theme, setLang, toggleTheme } = usePrefs();
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border p-1 shadow-[0_2px_10px_rgba(26,61,50,0.06)]",
        inverted
          ? "border-white/15 bg-[color-mix(in_srgb,#0e2a22_55%,transparent)]"
          : "border-ink/8 bg-surface/90",
      )}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
        className={cn(
          "grid size-9 place-items-center rounded-full transition-colors duration-150",
          inverted ? "text-cream hover:bg-white/10" : "text-ink hover:bg-forest/10",
        )}
      >
        {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => setLang("uk")}
        className={cn(
          "min-w-10 rounded-full px-3 py-2 font-display text-xs font-extrabold tracking-wide",
          lang === "uk"
            ? inverted
              ? "bg-paper text-forest"
              : "bg-forest text-paper"
            : inverted
              ? "text-cream/80"
              : "text-muted",
        )}
      >
        UA
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={cn(
          "min-w-10 rounded-full px-3 py-2 font-display text-xs font-extrabold tracking-wide",
          lang === "en"
            ? inverted
              ? "bg-paper text-forest"
              : "bg-forest text-paper"
            : inverted
              ? "text-cream/80"
              : "text-muted",
        )}
      >
        EN
      </button>
    </div>
  );
}

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "grid size-[34px] place-items-center rounded-xl",
          light ? "bg-paper text-forest" : "bg-forest text-paper",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
          <path
            d="M4 19V7a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M15 5v4a1 1 0 0 0 1 1h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          "font-display text-[18px] font-extrabold tracking-tight",
          light ? "text-paper" : "text-ink",
        )}
      >
        Класний простір
      </span>
    </div>
  );
}
