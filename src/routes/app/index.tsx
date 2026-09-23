import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookOpen, CalendarDays, Link2, MessageCircle, Star, Users } from "lucide-react";
import { getHome } from "@/lib/school/server";
import { formatLessonsLine, greetingWord, STRINGS } from "@/lib/i18n";
import { kyivClock, kyivWeekday } from "@/lib/school/ids";
import { describeLive } from "@/lib/school/live";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/")({ component: HomePage });

function HomePage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const home = useQuery({ queryKey: ["home"], queryFn: () => getHome() });
  const navigate = useNavigate();
  const profile = me.data?.profile;
  const stats = home.data?.stats;
  const name = (profile?.displayName || "").split(" ")[0] || "";
  const hour = new Date().getHours();
  const greet = `${greetingWord(lang, hour)}${name ? `, ${name}` : ""}!`;
  const informal = profile?.role === "student";
  const n = stats?.lessonsToday ?? 0;
  const subtitle = formatLessonsLine(lang, n, informal);
  const dateLabel = new Date().toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const isStudent = profile?.role === "student";
  const [clock, setClock] = useState(kyivClock());
  useEffect(() => {
    const id = window.setInterval(() => setClock(kyivClock()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const live = describeLive(home.data?.today ?? [], kyivWeekday(), clock);

  if (home.isPending || me.isPending) {
    return <p className="pt-8 font-display text-lg font-bold text-muted">{t.loading}</p>;
  }

  const tiles = [
    { to: "/app/schedule", title: t.tabSchedule, desc: isStudent ? t.tileSchedule : t.tileScheduleT, tone: "forest" as const, icon: CalendarDays },
    { to: "/app/tasks", title: t.tabTasks, desc: isStudent ? t.tileTasks : t.tileTasksT, tone: "sage" as const, icon: BookOpen },
    { to: "/app/grades", title: t.tabGrades, desc: isStudent ? t.tileGrades : t.tileGradesT, tone: "terra" as const, icon: Star },
    { to: "/app/selfgov", title: t.tabSelfGov, desc: t.tileSelfGov, tone: "cream" as const, icon: Users },
    { to: "/app/chat", title: t.tabChat, desc: t.tileChat, tone: "deep" as const, icon: MessageCircle },
  ];

  return (
    <div>
      <section className="mb-2 flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-[clamp(26px,3vw,34px)] font-extrabold tracking-tight text-ink">{greet}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-hairline bg-white/70 px-3.5 py-2 font-display text-xs font-extrabold text-ink-soft md:inline-flex">
          <CalendarDays className="size-3.5" />
          {dateLabel}
        </span>
      </section>

      {live && live.phase !== "none" && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-hairline bg-white/80 px-4 py-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-forest-mid uppercase">
              {live.phase === "lesson" ? t.liveLesson : live.phase === "break" ? t.liveBreak : t.nextLesson}
            </p>
            <p className="font-display text-lg font-extrabold">
              {live.name}
              {live.room ? <span className="ml-2 text-sm font-bold text-muted">{live.room}</span> : null}
            </p>
            <p className="text-xs text-muted">{t.minutesLeft.replace("{n}", String(live.minutes))}</p>
          </div>
          {live.meetLink && (
            <a
              href={live.meetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-full bg-forest-mid px-5 font-display text-sm font-bold text-paper"
            >
              {t.joinMeeting}
            </a>
          )}
        </section>
      )}

      <section className="mb-4 grid grid-cols-4 gap-3 max-[1080px]:grid-cols-2 max-[520px]:grid-cols-2">
        {isStudent ? (
          <>
            <Stat
              icon={<Star className="size-4" />}
              value={String(stats?.points ?? 0)}
              label={t.statPoints}
              onClick={() => void navigate({ to: "/app/students" })}
            />
            <Stat icon={<BookOpen className="size-4" />} value={String(stats?.subjects ?? 0)} label={t.statSubjects} />
            <Stat icon={<CalendarDays className="size-4" />} value={String(stats?.lessonsToday ?? 0)} label={t.statLessonsToday} />
            <Stat icon={<Link2 className="size-4" />} value={profile?.linked ? t.linkedYes : t.linkedNo} label={t.statLinked} />
          </>
        ) : (
          <>
            <Stat icon={<Users className="size-4" />} value={String(stats?.students ?? 0)} label={t.statStudents} />
            <Stat icon={<BookOpen className="size-4" />} value={String(stats?.subjects ?? 0)} label={t.statSubjects} />
            <Stat icon={<CalendarDays className="size-4" />} value={String(stats?.lessonsToday ?? 0)} label={t.statLessonsToday} />
            <Stat
              icon={<Link2 className="size-4" />}
              value={`${stats?.linked ?? 0}/${stats?.linkedTotal ?? 0}`}
              label={t.statLinked}
            />
          </>
        )}
      </section>

      <section className="mb-5 grid grid-cols-5 gap-3 max-[1080px]:grid-cols-3 max-[860px]:grid-cols-2 max-[520px]:grid-cols-1">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.to}
              type="button"
              onClick={() => void navigate({ to: tile.to })}
              className={cn(
                "flex min-h-[168px] flex-col gap-2 rounded-[22px] px-[18px] pt-[22px] pb-[18px] text-left shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-[3px] hover:shadow-[0_14px_28px_rgba(26,61,50,0.16)]",
                tile.tone === "forest" && "bg-tile-forest text-paper",
                tile.tone === "sage" && "bg-tile-sage text-paper",
                tile.tone === "terra" && "bg-tile-terra text-paper",
                tile.tone === "cream" && "bg-tile-cream text-ink",
                tile.tone === "deep" && "bg-tile-deep text-paper",
              )}
            >
              <span
                className={cn(
                  "mb-1.5 grid size-11 place-items-center rounded-full border-[1.5px] border-current/40",
                  tile.tone === "cream" && "border-ink/25",
                )}
              >
                <Icon className="size-[22px]" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">{tile.title}</span>
              <span className="text-xs leading-snug font-medium opacity-90">{tile.desc}</span>
            </button>
          );
        })}
      </section>

      <figure className="relative isolate mb-6 min-h-[88px] overflow-hidden rounded-[18px]">
        <img src="/img/mountains.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <figcaption className="relative z-[1] flex min-h-[88px] items-center justify-center gap-2 bg-[linear-gradient(90deg,rgba(12,28,22,0.28),rgba(12,28,22,0.18))] px-5 py-4 text-center font-display text-sm font-extrabold text-paper [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
          <span aria-hidden className="opacity-80">
            ◆
          </span>
          {t.homeQuote}
        </figcaption>
      </figure>
    </div>
  );
}

function Stat({ icon, value, label, onClick }: { icon: ReactNode; value: string; label: string; onClick?: () => void }) {
  const className = cn(
    "flex items-center gap-3 rounded-[18px] border border-hairline bg-white/80 px-[18px] py-4 text-left",
    onClick && "transition hover:-translate-y-0.5 hover:border-forest-mid/30",
  );
  const inner = (
    <>
      <span className="grid size-9 place-items-center rounded-xl bg-forest/10 text-forest-mid">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-[22px] leading-tight font-extrabold text-ink tabular-nums">{value}</span>
        <span className="block text-xs font-bold text-muted">{label}</span>
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}
