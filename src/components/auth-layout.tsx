import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandMark, ThemeLangPill } from "./theme-lang";
import { BookOpen, CalendarDays, Swords } from "lucide-react";
import { usePrefs } from "@/lib/prefs";
import { SoundToggle } from "./sound-controls";

export function AuthLayout({
  variant,
  children,
}: {
  variant: "cream" | "forest";
  children: ReactNode;
}) {
  const forest = variant === "forest";
  const uk = usePrefs((s) => s.lang === "uk");
  return (
    <div className={cn("auth-page", forest && "auth-page-register")}>
      <header className="auth-header">
        <BrandMark />
        <div className="flex items-center gap-2">
          <SoundToggle />
          <ThemeLangPill />
        </div>
      </header>
      <div className="auth-content">
        <section className="auth-story">
          <p className="auth-kicker">
            {uk ? "ВАША ШКОЛА. ВАШІ МОЖЛИВОСТІ." : "YOUR SCHOOL. YOUR POSSIBILITIES."}
          </p>
          <h1>
            {uk ? (
              <>
                Менше метушні.
                <br />
                Більше відкриттів.
              </>
            ) : (
              <>
                Less distraction.
                <br />
                More discovery.
              </>
            )}
          </h1>
          <p>
            {uk
              ? "Навчання, спілкування й улюблені заняття — в одному зручному просторі."
              : "Learning, community and the things you love — together in one welcoming space."}
          </p>
          <div className="auth-features">
            {[
              {
                icon: CalendarDays,
                uk: "Ваш день — перед очима",
                en: "Your day, at a glance",
                desc: "Розклад, уроки та домашні завдання",
                enDesc: "Schedule, lessons and homework",
              },
              {
                icon: BookOpen,
                uk: "Знання завжди поруч",
                en: "Knowledge within reach",
                desc: "Матеріали, мапи та корисні інструменти",
                enDesc: "Resources, maps and learning tools",
              },
              {
                icon: Swords,
                uk: "Місце для нових перемог",
                en: "Room for your next win",
                desc: "Шахи, гуртки та шкільна спільнота",
                enDesc: "Chess, clubs and your school community",
              },
            ].map(({ icon: Icon, ...item }) => (
              <div key={item.en}>
                <span>
                  <Icon size={21} />
                </span>
                <div>
                  <strong>{uk ? item.uk : item.en}</strong>
                  <small>{uk ? item.desc : item.enDesc}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-story-footer">
            <span />
            {uk ? "Крок за кроком — до більшого." : "Small steps. New possibilities."}
          </div>
        </section>
        <div className="auth-form-area">{children}</div>
      </div>
      <footer className="auth-page-footer">
        {uk
          ? "Класний простір · Навчатися разом легше"
          : "Class space · Learning is better together"}
      </footer>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="auth-card">{children}</div>;
}

export function Field({
  icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  return (
    <label className="relative mb-3 block">
      <span className="pointer-events-none absolute top-1/2 left-4 grid size-[18px] -translate-y-1/2 text-muted">
        {icon}
      </span>
      <input
        {...props}
        className="h-12 w-full rounded-xl border border-hairline bg-surface-2 pr-4 pl-11 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-forest-mid/35 focus:bg-surface focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-forest)_12%,transparent)]"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "mt-1.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest-mid font-display text-[15px] font-bold text-paper transition hover:bg-forest-hover disabled:opacity-60",
        className,
      )}
    >
      {children}
      <span aria-hidden className="text-base font-extrabold">
        →
      </span>
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "mt-1.5 inline-flex h-12 w-full items-center justify-center rounded-full border-[1.5px] border-forest/30 bg-transparent font-display text-[15px] font-bold text-ink-soft transition hover:bg-forest/6 hover:text-ink disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}
