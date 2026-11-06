import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { signOutApp } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { appNavigation, navItemActive, searchableNavigation } from "@/lib/navigation";
import type { Profile } from "@/lib/school/types";
import { BrandMark, ThemeLangPill } from "./theme-lang";
import { NotificationsNav } from "./notifications-bell";
import { useSchoolSettings } from "./school-settings-context";
import { AppNavigation, MobileNavigation } from "./app-navigation";
import { SoundToggle } from "./sound-controls";

export function AppShell({ profile }: { profile: Profile }) {
  const { lang } = usePrefs();
  const uk = lang === "uk";
  const { settings } = useSchoolSettings();
  const t = STRINGS[lang];
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  const section = (search as { section?: string }).section ?? "overview";
  const tool = (search as { tool?: string }).tool ?? "atlas";
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const accountRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const user = useCurrentUser();
  const gate = typeof window !== "undefined" && hasGateSessionMarker();
  const items = appNavigation(profile, settings);
  const pages = searchableNavigation(items);
  const current = pages.find((item) => navItemActive(item, pathname, section, tool));
  const group = items.find((item) => item.children?.some((child) => child.id === current?.id));
  const first = (profile.displayName || user?.displayName || "?").trim().charAt(0).toUpperCase();
  const usefulMode = pathname === "/app/materials" && section === "useful";

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
    searchRef.current?.close();
  }, [pathname, search]);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (searchRef.current?.open) searchRef.current.close();
        else {
          setOpen(false);
          setQuery("");
          searchRef.current?.showModal();
        }
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    if (!open) return;
    menuTrigger.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = sidebarRef.current;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !panel) return;
      const buttons = [
        ...panel.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input"),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", keys);
      window.removeEventListener("resize", resize);
      menuTrigger.current?.focus();
    };
  }, [open]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="app-skip-link">
        {uk ? "Перейти до вмісту" : "Skip to content"}
      </a>
      {open && (
        <button
          type="button"
          className="app-drawer-backdrop"
          aria-label={uk ? "Закрити меню" : "Close menu"}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={`app-sidebar ${open ? "is-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={uk ? "Меню сайту" : "Site menu"}
      >
        <div className="app-sidebar-brand">
          <BrandMark light />
          <button
            type="button"
            className="app-drawer-close"
            aria-label={uk ? "Закрити меню" : "Close menu"}
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="app-school-label">
          <span className="app-school-dot" />
          <span>
            {profile.schoolName || (uk ? "Мій шкільний простір" : "My school space")}
            {profile.className ? ` · ${profile.className}` : ""}
          </span>
        </div>
        <button
          type="button"
          className="app-nav-search"
          onClick={() => {
            setOpen(false);
            setQuery("");
            searchRef.current?.showModal();
          }}
        >
          <Search size={17} />
          <span>{uk ? "Знайти розділ" : "Find a page"}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <p className="app-nav-caption">{uk ? "МІЙ ПРОСТІР" : "MY SPACE"}</p>
        <AppNavigation
          items={items}
          pathname={pathname}
          section={section}
          tool={tool}
          uk={uk}
          onNavigate={() => setOpen(false)}
        />
        <div className="app-sidebar-footer">
          <NotificationsNav />
          <Link
            to="/app/settings"
            className={`app-nav-item ${pathname === "/app/settings" ? "is-active" : ""}`}
            aria-current={pathname === "/app/settings" ? "page" : undefined}
            data-sound="navigate"
            onClick={() => setOpen(false)}
          >
            <Settings size={19} />
            <span>{t.settings}</span>
          </Link>
          <div className="app-sidebar-user">
            <span className="app-user-avatar">{first}</span>
            <div>
              <strong>{profile.displayName}</strong>
              <small>
                {profile.role === "teacher"
                  ? uk
                    ? "Учитель"
                    : "Teacher"
                  : profile.role === "parent"
                    ? uk
                      ? "Батьки"
                      : "Parent"
                    : uk
                      ? "Учень"
                      : "Student"}
              </small>
            </div>
            {!gate && (
              <button
                type="button"
                aria-label={t.logout}
                title={t.logout}
                onClick={() => void signOutApp()}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <button
            type="button"
            className="app-menu-button"
            aria-label={uk ? "Відкрити меню" : "Open menu"}
            aria-expanded={open}
            aria-controls="app-sidebar"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="app-breadcrumb">
            {group && (
              <>
                <span>{uk ? group.uk : group.en}</span>
                <ChevronRight size={13} />
              </>
            )}
            <strong>{current ? (uk ? current.uk : current.en) : t.tabHome}</strong>
          </div>
          <div className="app-topbar-actions">
            <SoundToggle />
            <ThemeLangPill />
            <div className="app-account" ref={accountRef}>
              <button
                type="button"
                className="app-account-trigger"
                aria-label={uk ? "Мій обліковий запис" : "My account"}
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen(!accountOpen)}
              >
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" />
                ) : (
                  <span className="app-user-avatar">{first}</span>
                )}
                <ChevronDown size={13} />
              </button>
              {accountOpen && (
                <div className="app-account-menu">
                  <strong>{profile.displayName}</strong>
                  <small>{profile.schoolName}</small>
                  <Link to="/app/settings" onClick={() => setAccountOpen(false)}>
                    <Settings size={16} />
                    {t.settings}
                  </Link>
                  {!gate && (
                    <button type="button" onClick={() => void signOutApp()}>
                      <LogOut size={16} />
                      {t.logout}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`app-main ${usefulMode ? "app-main-tool" : ""}`}
        >
          <Outlet />
        </main>
      </div>
      <MobileNavigation
        pathname={pathname}
        section={section}
        tool={tool}
        uk={uk}
        open={open}
        onMenu={() => setOpen(!open)}
      />
      <dialog
        ref={searchRef}
        className="app-search-dialog"
        aria-label={uk ? "Пошук розділів" : "Find a page"}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="app-search-field">
          <Search size={20} />
          <input
            aria-label={uk ? "Назва розділу" : "Page name"}
            placeholder={uk ? "Куди хочете перейти?" : "Where would you like to go?"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => searchRef.current?.close()}
            aria-label={uk ? "Закрити пошук" : "Close search"}
          >
            <X size={18} />
          </button>
        </div>
        <div className="app-search-results">
          {pages
            .filter((p) =>
              `${p.uk} ${p.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
            )
            .map((page) => (
              <Link
                key={page.id}
                to={page.to}
                search={page.search}
                data-sound="navigate"
                onClick={() => searchRef.current?.close()}
              >
                {uk ? page.uk : page.en}
                <ChevronRight size={16} />
              </Link>
            ))}
          {!pages.some((p) =>
            `${p.uk} ${p.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
          ) && (
            <p>
              {uk
                ? "Нічого не знайдено. Спробуйте іншу назву."
                : "No pages found. Try another name."}
            </p>
          )}
        </div>
        <footer>
          {uk ? "Пошук розділів сайту" : "Search site pages"}
          <kbd>Esc</kbd>
        </footer>
      </dialog>
    </div>
  );
}
