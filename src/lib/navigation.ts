import type { Profile } from "./school/types";
import type { SchoolSettings } from "./school/settings";

export type NavItem = {
  id: string;
  to: string;
  uk: string;
  en: string;
  search?: { section: "overview" | "useful"; tool?: "chess" | "atlas" | "periodic" };
  children?: NavItem[];
};

/** One navigation tree for every page, search, desktop and mobile. */
export function appNavigation(
  profile: Pick<Profile, "role" | "isAdmin">,
  settings: SchoolSettings,
): NavItem[] {
  const teacher = profile.role === "teacher";
  const parent = profile.role === "parent";
  return [
    { id: "home", to: "/app", uk: "Огляд", en: "Overview" },
    {
      id: "learning",
      to: "/app/schedule",
      uk: "Навчання",
      en: "Learning",
      children: [
        { id: "schedule", to: "/app/schedule", uk: "Розклад", en: "Schedule" },
        { id: "homework", to: "/app/homework", uk: "Домашні завдання", en: "Homework" },
        { id: "tasks", to: "/app/tasks", uk: "Уроки та завдання", en: "Lessons & tasks" },
        { id: "grades", to: "/app/grades", uk: "Оцінки", en: "Grades" },
      ],
    },
    {
      id: "resources",
      to: "/app/materials",
      search: { section: "overview" },
      uk: "Бібліотека",
      en: "Library",
      children: [
        {
          id: "materials",
          to: "/app/materials",
          search: { section: "overview" },
          uk: "Усі матеріали",
          en: "All resources",
        },
        {
          id: "atlas",
          to: "/app/materials",
          search: { section: "useful", tool: "atlas" },
          uk: "Історична мапа",
          en: "Historical map",
        },
        {
          id: "periodic",
          to: "/app/materials",
          search: { section: "useful", tool: "periodic" },
          uk: "Періодична таблиця",
          en: "Periodic table",
        },
      ],
    },
    {
      id: "chess",
      to: "/app/materials",
      search: { section: "useful", tool: "chess" },
      uk: "Шахи",
      en: "Chess",
    },
    {
      id: "community",
      to: "/app/announcements",
      uk: "Спільнота",
      en: "Community",
      children: [
        { id: "announcements", to: "/app/announcements", uk: "Оголошення", en: "Announcements" },
        ...(!parent && (teacher || settings.points)
          ? [
              {
                id: "students",
                to: "/app/students",
                uk: teacher ? "Учні" : "Бали та учні",
                en: teacher ? "Students" : "Points & students",
              },
            ]
          : []),
        ...(!parent && settings.chat
          ? [{ id: "chat", to: "/app/chat", uk: "Чат", en: "Chat" }]
          : []),
        ...(!parent && settings.clubs
          ? [{ id: "clubs", to: "/app/clubs", uk: "Гуртки", en: "Clubs" }]
          : []),
        ...(!parent && settings.selfGovernment
          ? [{ id: "selfgov", to: "/app/selfgov", uk: "Самоврядування", en: "Student council" }]
          : []),
        ...(teacher && profile.isAdmin
          ? [{ id: "teachers", to: "/app/teachers", uk: "Учителі", en: "Teachers" }]
          : []),
      ],
    },
  ];
}

export function navItemActive(
  item: NavItem,
  pathname: string,
  section = "overview",
  tool = "atlas",
): boolean {
  if (item.children)
    return item.children.some((child) => navItemActive(child, pathname, section, tool));
  if (pathname.replace(/\/+$/, "") !== item.to) return false;
  if (!item.search) return true;
  return item.search.section === "useful"
    ? section === "useful" && tool === item.search.tool
    : section !== "useful";
}

export function searchableNavigation(items: NavItem[]) {
  return [
    ...items.flatMap((item) => item.children ?? [item]),
    { id: "settings", to: "/app/settings", uk: "Налаштування", en: "Settings" },
  ];
}
