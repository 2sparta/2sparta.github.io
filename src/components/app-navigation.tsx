import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Home,
  Library,
  Menu,
  Swords,
  Users,
} from "lucide-react";
import { navItemActive, type NavItem } from "@/lib/navigation";

const icons = {
  home: Home,
  learning: BookOpen,
  resources: Library,
  chess: Swords,
  community: Users,
};

function NavGroup({
  item,
  pathname,
  section,
  tool,
  uk,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  section: string;
  tool: string;
  uk: boolean;
  onNavigate: () => void;
}) {
  const active = navItemActive(item, pathname, section, tool);
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active, pathname, section, tool]);
  const Icon = icons[item.id as keyof typeof icons];
  return (
    <div className="app-nav-group">
      {item.children ? (
        <button
          type="button"
          className={`app-nav-item ${active ? "is-active" : ""}`}
          aria-expanded={expanded}
          aria-controls={`nav-${item.id}`}
          data-sound="navigate"
          onClick={() => setExpanded(!expanded)}
        >
          <Icon size={19} />
          <span>{uk ? item.uk : item.en}</span>
          <ChevronDown size={15} className={expanded ? "rotate-180" : ""} />
        </button>
      ) : (
        <Link
          to={item.to}
          search={item.search}
          activeOptions={{ exact: true, includeSearch: true }}
          className={`app-nav-item ${active ? "is-active" : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          data-sound="navigate"
        >
          <Icon size={19} />
          <span>{uk ? item.uk : item.en}</span>
          {item.id === "chess" && <span className="app-nav-tag">{uk ? "Грати" : "Play"}</span>}
        </Link>
      )}
      {item.children && expanded && (
        <div id={`nav-${item.id}`} className="app-subnav">
          {item.children.map((child) => (
            <Link
              key={child.id}
              to={child.to}
              search={child.search}
              activeOptions={{ exact: true, includeSearch: true }}
              className={`app-subnav-item ${navItemActive(child, pathname, section, tool) ? "is-active" : ""}`}
              aria-current={navItemActive(child, pathname, section, tool) ? "page" : undefined}
              onClick={onNavigate}
              data-sound="navigate"
            >
              {uk ? child.uk : child.en}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppNavigation(props: {
  items: NavItem[];
  pathname: string;
  section: string;
  tool: string;
  uk: boolean;
  onNavigate: () => void;
}) {
  return (
    <nav className="app-navigation" aria-label={props.uk ? "Основна навігація" : "Main navigation"}>
      {props.items.map((item) => (
        <NavGroup key={item.id} {...props} item={item} />
      ))}
    </nav>
  );
}

export function MobileNavigation({
  pathname,
  section,
  tool,
  uk,
  onMenu,
  open,
}: {
  pathname: string;
  section: string;
  tool: string;
  uk: boolean;
  onMenu: () => void;
  open: boolean;
}) {
  const items = [
    { id: "home", to: "/app", uk: "Огляд", en: "Home", icon: Home },
    { id: "schedule", to: "/app/schedule", uk: "Розклад", en: "Schedule", icon: CalendarDays },
    { id: "homework", to: "/app/homework", uk: "Завдання", en: "Homework", icon: BookOpen },
    {
      id: "chess",
      to: "/app/materials",
      search: { section: "useful" as const, tool: "chess" as const },
      uk: "Шахи",
      en: "Chess",
      icon: Swords,
    },
  ];
  return (
    <nav className="app-mobile-nav" aria-label={uk ? "Швидка навігація" : "Quick navigation"}>
      {items.map(({ icon: Icon, ...item }) => (
        <Link
          key={item.id}
          to={item.to}
          search={item.search}
          activeOptions={{ exact: true, includeSearch: true }}
          onClick={() => {
            if (open) onMenu();
          }}
          data-sound="navigate"
          aria-current={navItemActive(item, pathname, section, tool) ? "page" : undefined}
        >
          <Icon size={21} />
          <span>{uk ? item.uk : item.en}</span>
        </Link>
      ))}
      <button type="button" onClick={onMenu} aria-expanded={open} aria-controls="app-sidebar">
        <Menu size={21} />
        <span>{uk ? "Ще" : "More"}</span>
      </button>
    </nav>
  );
}
