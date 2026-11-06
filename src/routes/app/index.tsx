import { HomeFeed } from "@/components/home-feed";
import { useSchoolSettings } from "@/components/school-settings-context";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Atom,
  BookOpen,
  CalendarDays,
  Link2,
  Map as MapIcon,
  MessageCircle,
  NotebookPen,
  Star,
  Swords,
  Users,
} from "lucide-react";
import { getHome } from "@/lib/school/server";
import { formatLessonsLine, greetingWord, STRINGS } from "@/lib/i18n";
import { kyivClock, kyivWeekday } from "@/lib/school/ids";
import { describeLive } from "@/lib/school/live";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/")({ component: HomePage });

export function HomePage() {
  const { lang } = usePrefs();
  const { settings, isError: settingsError } = useSchoolSettings();
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
  const isParent = profile?.role === "parent";
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
    {
      to: "/app/schedule",
      title: t.tabSchedule,
      desc: isStudent ? t.tileSchedule : t.tileScheduleT,
      tone: "forest" as const,
      icon: CalendarDays,
      texture: "/img/tile-schedule.jpg",
      pos: "center",
    },
    {
      to: "/app/tasks",
      title: t.tabTasks,
      desc: isStudent ? t.tileTasks : t.tileTasksT,
      tone: "sage" as const,
      icon: BookOpen,
      texture: "/img/tile-green.jpg",
      pos: "center",
    },
    {
      to: "/app/homework",
      title: lang === "uk" ? "Домашні завдання" : "Homework",
      desc: lang === "uk" ? "Що потрібно зробити й до якого дня" : "What is due and when",
      tone: "sage" as const,
      icon: NotebookPen,
    },
    {
      to: "/app/grades",
      title: t.tabGrades,
      desc: isStudent ? t.tileGrades : t.tileGradesT,
      tone: "terra" as const,
      icon: Star,
      texture: "/img/tile-terra.jpg",
      pos: "left bottom",
    },
    ...(isParent
      ? []
      : [
          {
            to: "/app/selfgov",
            title: t.tabSelfGov,
            desc: t.tileSelfGov,
            tone: "cream" as const,
            icon: Users,
            texture: "/img/tile-selfgov.jpg",
            pos: "left bottom",
          },
          {
            to: "/app/chat",
            title: t.tabChat,
            desc: t.tileChat,
            tone: "deep" as const,
            icon: MessageCircle,
            texture: "/img/tile-chat.jpg",
            pos: "center",
          },
        ]),
  ].filter(
    (tile) =>
      (tile.to !== "/app/chat" || settings.chat) &&
      (tile.to !== "/app/selfgov" || settings.selfGovernment),
  );

  return (
    <div
      className={
        settings.feedMode !== "off" && !settingsError
          ? "grid items-start gap-6 min-[1250px]:grid-cols-[minmax(0,1fr)_300px]"
          : ""
      }
    >
      <div className="min-w-0">
        <section className="mb-2 flex items-start justify-between gap-4 pt-2">
          <div>
            <h1 className="font-display text-[clamp(26px,3vw,34px)] font-extrabold tracking-tight text-ink">
              {greet}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isParent
                ? `${t.parentHome}${profile?.childName ? ` · ${profile.childName}` : ""}`
                : subtitle}
            </p>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface/90 px-3.5 py-2 font-display text-xs font-extrabold text-ink-soft md:inline-flex">
            <CalendarDays className="size-3.5" />
            {dateLabel}
          </span>
        </section>

        {live && live.phase !== "none" && (
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-hairline bg-surface px-4 py-3">
            <div>
              <p className="text-xs font-bold tracking-wide text-forest-mid uppercase">
                {live.phase === "lesson"
                  ? t.liveLesson
                  : live.phase === "break"
                    ? t.liveBreak
                    : t.nextLesson}
              </p>
              <p className="font-display text-lg font-extrabold">
                {live.name}
                {live.room ? (
                  <span className="ml-2 text-sm font-bold text-muted">{live.room}</span>
                ) : null}
              </p>
              <p className="text-xs text-muted">
                {(live.phase === "lesson" ? t.minutesLeft : t.startsIn).replace(
                  "{n}",
                  String(live.minutes),
                )}
              </p>
            </div>
            {live.meetLink && (live.phase === "lesson" || live.minutes <= 5) && (
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
              {settings.points && (
                <Stat
                  icon={<Star className="size-4" />}
                  value={String(stats?.points ?? 0)}
                  label={t.statPoints}
                  onClick={() => void navigate({ to: "/app/students" })}
                />
              )}
              <Stat
                icon={<BookOpen className="size-4" />}
                value={String(stats?.subjects ?? 0)}
                label={t.statSubjects}
              />
              <Stat
                icon={<CalendarDays className="size-4" />}
                value={String(stats?.lessonsToday ?? 0)}
                label={t.statLessonsToday}
              />
              <Stat
                icon={<Link2 className="size-4" />}
                value={profile?.linked ? t.linkedYes : t.linkedNo}
                label={t.statLinked}
              />
            </>
          ) : (
            <>
              <Stat
                icon={<Users className="size-4" />}
                value={String(stats?.students ?? 0)}
                label={t.statStudents}
              />
              <Stat
                icon={<BookOpen className="size-4" />}
                value={String(stats?.subjects ?? 0)}
                label={t.statSubjects}
              />
              <Stat
                icon={<CalendarDays className="size-4" />}
                value={String(stats?.lessonsToday ?? 0)}
                label={t.statLessonsToday}
              />
              <Stat
                icon={<Link2 className="size-4" />}
                value={`${stats?.linked ?? 0}/${stats?.linkedTotal ?? 0}`}
                label={t.statLinked}
              />
            </>
          )}
        </section>

        <section
          className="home-quick-grid"
          aria-label={lang === "uk" ? "Швидкий доступ" : "Quick access"}
        >
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.to} to={tile.to} className="home-quick-card" data-sound="navigate">
                <span>
                  <Icon size={21} />
                </span>
                <span>
                  <strong>{tile.title}</strong>
                  <small>{tile.desc}</small>
                </span>
              </Link>
            );
          })}
        </section>
        <section className="home-tools">
          <h2>{lang === "uk" ? "Час для відкриттів" : "Make room for discovery"}</h2>
          <div>
            {[
              {
                tool: "chess" as const,
                icon: Swords,
                uk: "Шаховий клуб",
                en: "Chess club",
                desc: "Партія, дебют чи новий суперник",
                enDesc: "A game, an opening or a new opponent",
              },
              {
                tool: "atlas" as const,
                icon: MapIcon,
                uk: "Історична мапа",
                en: "Historical map",
                desc: "Мандруйте крізь століття",
                enDesc: "Travel through the centuries",
              },
              {
                tool: "periodic" as const,
                icon: Atom,
                uk: "Хімічні елементи",
                en: "Chemical elements",
                desc: "Досліджуйте періодичну таблицю",
                enDesc: "Explore the periodic table",
              },
            ].map(({ icon: Icon, ...item }) => (
              <Link
                key={item.tool}
                to="/app/materials"
                search={{ section: "useful", tool: item.tool }}
                className="home-tool"
                data-sound="navigate"
              >
                <Icon size={24} />
                <strong>{lang === "uk" ? item.uk : item.en}</strong>
                <small>{lang === "uk" ? item.desc : item.enDesc}</small>
              </Link>
            ))}
          </div>
        </section>

        <Link
          to="/app/materials"
          search={{ section: "overview" }}
          className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-5 text-ink transition hover:border-forest-mid/40"
        >
          <span>
            <span className="block font-display text-lg font-extrabold">
              {lang === "uk" ? "Додаткові матеріали" : "Learning resources"}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {lang === "uk"
                ? "Відео, статті та корисні посилання для навчання"
                : "Videos, articles and useful learning links"}
            </span>
          </span>
          <BookOpen className="size-6 shrink-0 text-forest-mid" />
        </Link>
        <p className="my-6 text-center text-xs leading-relaxed text-muted">{t.homeQuote}</p>
      </div>
      <HomeFeed uk={lang === "uk"} />
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  onClick,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex items-center gap-3 rounded-[18px] border border-hairline bg-surface px-[18px] py-4 text-left",
    onClick && "transition hover:-translate-y-0.5 hover:border-forest-mid/30",
  );
  const inner = (
    <>
      <span className="grid size-9 place-items-center rounded-xl bg-forest/10 text-forest-mid">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[22px] leading-tight font-extrabold text-ink tabular-nums">
          {value}
        </span>
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
