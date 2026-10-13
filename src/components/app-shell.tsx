import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Library,
  FileText,
  Play,
  Link2,
  Compass,
  CalendarDays,
  ChevronDown,
  Coins,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Star,
  Users,
  Megaphone,
  GraduationCap,
  NotebookPen,
  Palette,
  X,
} from "lucide-react";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { signOutApp } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Profile } from "@/lib/school/types";
import { BrandMark, ThemeLangPill } from "./theme-lang";
import { NotificationsNav } from "./notifications-bell";
import { LearningToolsNav } from "./learning-tools-nav";

const TEACHER_NAV = [
  { to: "/app", icon: Home, key: "tabHome" as const },
  { to: "/app/students", icon: Users, key: "tabStudents" as const },
  { to: "/app/schedule", icon: CalendarDays, key: "tabSchedule" as const },
  { to: "/app/tasks", icon: BookOpen, key: "tabTasks" as const },
  { to: "/app/homework", icon: NotebookPen, key: "tabHomework" as const },
  { to: "/app/grades", icon: Star, key: "tabGrades" as const },
  { to: "/app/announcements", icon: Megaphone, key: "tabAnnouncements" as const },
  { to: "/app/clubs", icon: Palette, key: "tabClubs" as const },
  { to: "/app/selfgov", icon: Users, key: "tabSelfGov" as const },
  { to: "/app/teachers", icon: GraduationCap, key: "tabTeachers" as const, admin: true },
  { to: "/app/chat", icon: MessageCircle, key: "tabChat" as const },
];

const STUDENT_NAV = [
  { to: "/app", icon: Home, key: "tabHome" as const },
  { to: "/app/schedule", icon: CalendarDays, key: "tabSchedule" as const },
  { to: "/app/tasks", icon: BookOpen, key: "tabTasks" as const },
  { to: "/app/homework", icon: NotebookPen, key: "tabHomework" as const },
  { to: "/app/grades", icon: Star, key: "tabGrades" as const },
  { to: "/app/students", icon: Coins, key: "tabPoints" as const },
  { to: "/app/announcements", icon: Megaphone, key: "tabAnnouncements" as const },
  { to: "/app/clubs", icon: Palette, key: "tabClubs" as const },
  { to: "/app/selfgov", icon: Users, key: "tabSelfGov" as const },
  { to: "/app/chat", icon: MessageCircle, key: "tabChat" as const },
];

const PARENT_NAV = [
  { to: "/app", icon: Home, key: "tabHome" as const },
  { to: "/app/schedule", icon: CalendarDays, key: "tabSchedule" as const },
  { to: "/app/tasks", icon: BookOpen, key: "tabTasks" as const },
  { to: "/app/homework", icon: NotebookPen, key: "tabHomework" as const },
  { to: "/app/grades", icon: Star, key: "tabGrades" as const },
  { to: "/app/announcements", icon: Megaphone, key: "tabAnnouncements" as const },
];

export function AppShell({ profile }: { profile: Profile }) {
  const { lang, theme } = usePrefs();
  const t = STRINGS[lang];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [accountOpen]);
  const user = useCurrentUser();
  const gate = typeof window !== "undefined" && hasGateSessionMarker();
  const nav =
    profile.role === "student"
      ? STUDENT_NAV
      : profile.role === "parent"
        ? PARENT_NAV
        : TEACHER_NAV.filter((n) => !n.admin || profile.isAdmin);
  const materialsMode = pathname.replace(/\/+$/, "") === "/app/materials";
  const materialSection = useRouterState({
    select: (s) => (s.location.search as { section?: string }).section ?? "overview",
  });
  const materialTool = useRouterState({
    select: (s) => (s.location.search as { tool?: string }).tool ?? "atlas",
  });
  const usefulMode = materialsMode && materialSection === "useful";
  const links = materialsMode
    ? [
        { to: "/app", icon: Home, label: t.tabHome, section: undefined },
        {
          to: "/app/materials",
          icon: Library,
          label: lang === "uk" ? "Огляд матеріалів" : "Resources overview",
          section: "overview" as const,
        },
        {
          to: "/app/materials",
          icon: Play,
          label: lang === "uk" ? "Відео" : "Videos",
          section: "videos" as const,
        },
        {
          to: "/app/materials",
          icon: FileText,
          label: lang === "uk" ? "Статті" : "Articles",
          section: "articles" as const,
        },
        {
          to: "/app/materials",
          icon: Link2,
          label: lang === "uk" ? "Корисні посилання" : "Useful links",
          section: "links" as const,
        },
        {
          to: "/app/materials",
          icon: Compass,
          label: lang === "uk" ? "Корисне" : "Tools",
          section: "useful" as const,
        },
      ]
    : [
        ...nav.map((item) => ({ ...item, label: t[item.key], section: undefined })),
        {
          to: "/app/materials",
          icon: Library,
          label: lang === "uk" ? "Додаткові матеріали" : "Learning resources",
          section: "overview" as const,
        },
      ];
  const first = (profile.displayName || user?.displayName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh bg-canvas text-ink md:grid md:grid-cols-[248px_1fr]">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[25] bg-[rgba(12,28,22,0.4)] md:hidden"
          aria-label="Close"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-dvh w-[248px] flex-col bg-sidebar p-4 text-paper transition-transform duration-200 md:sticky md:top-0 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[105%] md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-1 pb-5">
          <BrandMark light />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-xl md:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {materialsMode && (
            <p className="px-3.5 py-2 text-xs font-bold text-paper/60">
              {lang === "uk" ? "Додаткові матеріали" : "Learning resources"}
            </p>
          )}
          {links.map((item) => {
            if (item.section === "useful")
              return (
                <LearningToolsNav
                  key="learning-tools"
                  active={materialSection === "useful"}
                  tool={materialTool}
                  uk={lang === "uk"}
                  onNavigate={() => setOpen(false)}
                />
              );
            const active = item.section
              ? materialsMode && materialSection === item.section
              : item.to === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}:${item.section ?? ""}`}
                to={item.to}
                search={item.section ? { section: item.section } : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 font-display text-sm font-bold transition-colors",
                  active
                    ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    : "text-paper/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {!materialsMode && <NotificationsNav />}
        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
          {!materialsMode && (
            <Link
              to="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 font-display text-sm font-bold text-paper/80 hover:bg-white/10 hover:text-white"
            >
              <Settings className="size-[18px]" />
              {t.settings}
            </Link>
          )}
          {!gate && (
            <button
              type="button"
              onClick={() => void signOutApp()}
              className="flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-left font-display text-sm font-bold text-paper/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-[18px]" />
              {t.logout}
            </button>
          )}
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-col overflow-hidden">
        <img
          src={theme === "dark" ? "/img/leaves-forest.jpg" : "/img/leaves-cream.jpg"}
          alt=""
          className="app-leaf"
        />
        <header
          className={cn(
            "relative z-10 flex items-center gap-3 pt-[18px] pb-2",
            usefulMode ? "px-[25px]" : "px-7 max-md:px-4",
          )}
        >
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-hairline bg-surface text-ink md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeLangPill />
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-hairline bg-surface/90 py-1 pr-2.5 pl-1"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
              >
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-avatar font-display text-sm font-extrabold text-forest">
                    {first}
                  </span>
                )}
                <span className="max-w-[140px] truncate font-display text-[13px] font-extrabold text-ink max-sm:hidden">
                  {profile.displayName || user?.displayName || ""}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted transition max-sm:hidden",
                    accountOpen && "rotate-180",
                  )}
                />
              </button>
              {accountOpen && (
                <div className="absolute top-[calc(100%+8px)] right-0 z-20 w-56 rounded-2xl border border-hairline bg-surface p-2 shadow-[var(--shadow-soft)]">
                  <p className="px-2 py-1.5 text-xs leading-snug text-muted">
                    {profile.displayName}
                    {profile.schoolName ? ` · ${profile.schoolName}` : ""}
                    {profile.className ? ` · ${profile.className}` : ""}
                  </p>
                  <Link
                    to="/app/settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-ink hover:bg-cream"
                  >
                    <Settings className="size-4" />
                    {t.settings}
                  </Link>
                  {!gate && (
                    <button
                      type="button"
                      onClick={() => void signOutApp()}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold text-ink hover:bg-cream"
                    >
                      <LogOut className="size-4" />
                      {t.logout}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          className={cn(
            "relative z-10 w-full pt-2 pb-10",
            usefulMode ? "px-[25px]" : "px-7 max-md:px-4",
          )}
        >
          <div className={cn("w-full", !usefulMode && "max-w-[1080px]")}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
