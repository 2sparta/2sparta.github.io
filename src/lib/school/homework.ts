export type HomeworkItem = {
  id: string;
  title: string;
  subject: string;
  body: string;
  due: string | null;
  author?: string;
  published?: string | null;
  images?: string[];
  done?: boolean;
  label?: string;
};
export type HomeworkBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "undated" | "done";
export const HOMEWORK_BUCKETS: HomeworkBucket[] = [
  "overdue", "today", "tomorrow", "week", "later", "undated", "done",
];
export const HOMEWORK_LABELS: Record<HomeworkBucket, [string, string]> = {
  overdue: ["Термін минув", "Past the due date"],
  today: ["На сьогодні", "Due today"],
  tomorrow: ["На завтра", "Due tomorrow"],
  week: ["Наступні 7 днів", "Next 7 days"],
  later: ["Пізніше", "Later"],
  undated: ["Без терміну", "No due date"],
  done: ["Виконано", "Completed"],
};
/** School dates are calendar days in Kyiv, including across DST transitions. */
export function homeworkToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return value("year") + "-" + value("month") + "-" + value("day");
}
export function homeworkDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function shiftHomeworkDate(day: string, days: number) {
  if (!homeworkDate(day)) throw new Error("INVALID_DATE");
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function homeworkBucket(item: HomeworkItem, today: string): HomeworkBucket {
  if (item.done) return "done";
  const due = homeworkDate(item.due);
  if (!due) return "undated";
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === shiftHomeworkDate(today, 1)) return "tomorrow";
  return due <= shiftHomeworkDate(today, 7) ? "week" : "later";
}
export function homeworkDateLabel(value: string | null, uk: boolean) {
  const day = homeworkDate(value);
  return day
    ? new Intl.DateTimeFormat(uk ? "uk-UA" : "en-GB", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      }).format(new Date(day + "T12:00:00Z"))
    : uk ? "Без терміну" : "No due date";
}
export function subjectColor(subject: string) {
  return Array.from(subject).reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) % 5;
}
export function selectHomework(
  items: readonly HomeworkItem[],
  options: { search: string; subject: string; status: "all" | "active" | "done" },
) {
  const search = options.search.trim().toLocaleLowerCase();
  return items.filter((item) =>
    (!options.subject || item.subject === options.subject) &&
    (options.status === "all" || (options.status === "done" ? item.done === true : !item.done)) &&
    (!search || [item.title, item.subject, item.body, item.author ?? ""].join(" ").toLocaleLowerCase().includes(search)),
  );
}
export function groupHomework(items: readonly HomeworkItem[], today: string, bySubject = false) {
  const sorted = [...items].sort((a, b) => {
    const dateA = homeworkDate(a.due), dateB = homeworkDate(b.due);
    if (dateA === dateB) return a.title.localeCompare(b.title, "uk") || a.id.localeCompare(b.id);
    if (!dateA) return 1;
    if (!dateB) return -1;
    if (dateA < today && dateB < today && !a.done && !b.done) return dateB.localeCompare(dateA);
    return dateA.localeCompare(dateB);
  });
  const keys: string[] = bySubject
    ? [...new Set(items.map((item) => item.subject))].sort((a, b) => a.localeCompare(b, "uk"))
    : HOMEWORK_BUCKETS;
  return keys.map((key) => ({
    key,
    items: sorted.filter((item) => bySubject ? item.subject === key : homeworkBucket(item, today) === key),
  })).filter((group) => group.items.length > 0);
}
