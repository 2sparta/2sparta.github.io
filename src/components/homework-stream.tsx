import { useEffect, useId, useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, Check, ChevronDown, ClipboardList, Search } from "lucide-react";
import {
  groupHomework, homeworkBucket, homeworkDateLabel, homeworkToday, selectHomework,
  subjectColor, HOMEWORK_LABELS, type HomeworkBucket, type HomeworkItem,
} from "@/lib/school/homework";
import { PhotoStrip } from "@/components/photo-attach";
import "./homework-stream.css";

export function HomeworkStream({
  items, uk, loading = false, error, onRetry, onToggle, pending = false,
  renderActions, renderDetails, today: suppliedToday,
}: {
  items: HomeworkItem[];
  uk: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onToggle?: (id: string, done: boolean) => void;
  pending?: boolean;
  renderActions?: (item: HomeworkItem) => ReactNode;
  renderDetails?: (item: HomeworkItem) => ReactNode;
  today?: string;
}) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "done">("all");
  const [grouping, setGrouping] = useState("date");
  const [day, setDay] = useState(homeworkToday);
  useEffect(() => {
    const timer = setInterval(() => setDay(homeworkToday()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const today = suppliedToday ?? day;
  const subjects = [...new Set(items.map((item) => item.subject))].sort((a, b) => a.localeCompare(b, uk ? "uk" : "en"));
  const selectedSubject = subjects.includes(subject) ? subject : "";
  const visible = selectHomework(items, { search, subject: selectedSubject, status });
  const groups = groupHomework(visible, today, grouping === "subject");
  const hasCompletion = items.some((item) => typeof item.done === "boolean");
  const tr = (a: string, b: string) => uk ? a : b;
  const count = (bucket: HomeworkBucket) => items.filter((item) => homeworkBucket(item, today) === bucket).length;
  const statuses = hasCompletion ? ["all", "active", "done"] as const : ["all"] as const;
  return (
    <section className="homework-stream" aria-label={tr("Стрічка домашніх завдань", "Homework stream")}>
      <header className="hw-stream-header">
        <div className="hw-stream-heading">
          <span className="hw-stream-symbol"><ClipboardList aria-hidden="true" /></span>
          <div><p>{tr("МІЙ НАВЧАЛЬНИЙ ПЛАН", "MY STUDY PLAN")}</p>
            <h2>{tr("Усе ДЗ — під рукою", "Your homework, in one place")}</h2></div>
        </div>
        <div className="hw-overview" aria-label={tr("Огляд термінів", "Due date overview")}>
          <span><b>{count("today")}</b>{tr("на сьогодні", "due today")}</span>
          <span><b>{count("tomorrow") + count("week")}</b>{tr("наступні 7 днів", "next 7 days")}</span>
          {hasCompletion && <span><b>{count("done")}</b>{tr("виконано", "completed")}</span>}
        </div>
      </header>
      {error && <div className="hw-error" role="alert">
        <span>{error}</span>{onRetry && <button type="button" onClick={onRetry}>{tr("Спробувати ще", "Retry")}</button>}
      </div>}
      <div className="hw-workspace">
        <aside className="hw-subjects" aria-label={tr("Предмети домашніх завдань", "Homework subjects")}>
          <h3>{tr("Предмети", "Subjects")}</h3>
          <button type="button" aria-pressed={!selectedSubject} onClick={() => setSubject("")}>
            <BookOpen aria-hidden="true" /><span>{tr("Усі предмети", "All subjects")}</span><b>{items.length}</b>
          </button>
          {subjects.map((name) => <button key={name} type="button" aria-pressed={selectedSubject === name} onClick={() => setSubject(name)}>
            <i className={"hw-subject-dot hw-tone-" + subjectColor(name)} /><span>{name || tr("Без предмета", "No subject")}</span>
            <b>{items.filter((item) => item.subject === name).length}</b>
          </button>)}
        </aside>
        <div className="hw-main">
          <div className="hw-toolbar">
            <label className="hw-search"><Search aria-hidden="true" />
              <input type="search" aria-label={tr("Пошук домашніх завдань", "Search homework")} placeholder={tr("Знайти завдання…", "Find an assignment…")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label className="hw-mobile-subject"><span className="sr-only">{tr("Предмет", "Subject")}</span>
              <select value={selectedSubject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">{tr("Усі предмети", "All subjects")}</option>
                {subjects.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </label>
            <label><span className="sr-only">{tr("Групувати завдання", "Group assignments")}</span>
              <select value={grouping} onChange={(e) => setGrouping(e.target.value)}>
                <option value="date">{tr("За термінами", "By due date")}</option>
                <option value="subject">{tr("За предметами", "By subject")}</option>
              </select>
            </label>
          </div>
          <div className="hw-filter-row">
            <div className="hw-status-tabs" aria-label={tr("Статус домашніх завдань", "Homework status")}>
              {statuses.map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
                {value === "all" ? tr("Усі", "All") : value === "active" ? tr("До виконання", "To do") : tr("Виконано", "Completed")}
              </button>)}
            </div>
            <span className="hw-result-count" role="status">{loading ? tr("Завантаження…", "Loading…") : tr("Завдань: ", "Assignments: ") + visible.length}</span>
          </div>
          {loading ? <div className="hw-skeleton" role="status" aria-label={tr("Завантаження ДЗ", "Loading homework")}><i /><i /><i /></div>
            : !visible.length ? <div className="hw-empty">
              <Check aria-hidden="true" /><h3>{items.length ? tr("Тут усе спокійно", "All clear here") : tr("Нові завдання з’являться тут", "New assignments will appear here")}</h3>
              <p>{items.length ? tr("За цими фільтрами завдань немає.", "No assignments match these filters.") : tr("Предмет, термін і деталі будуть зібрані в одній картці.", "Subject, due date and details will stay together in one card.")}</p>
              {(search || selectedSubject || status !== "all") && <button type="button" onClick={() => { setSearch(""); setSubject(""); setStatus("all"); }}>{tr("Скинути фільтри", "Reset filters")}</button>}
            </div>
            : groups.map((group) => <section className="hw-group" key={group.key}>
              <h3>{grouping === "subject" ? group.key : HOMEWORK_LABELS[group.key as HomeworkBucket][uk ? 0 : 1]}<span>{group.items.length}</span></h3>
              <ul>{group.items.map((item) => <HomeworkCard key={item.id} item={item} today={today} uk={uk} onToggle={onToggle} pending={pending} actions={renderActions?.(item)} details={renderDetails?.(item)} />)}</ul>
            </section>)}
        </div>
      </div>
    </section>
  );
}
function HomeworkCard({ item, today, uk, onToggle, pending, actions, details }: {
  item: HomeworkItem; today: string; uk: boolean; onToggle?: (id: string, done: boolean) => void;
  pending: boolean; actions: ReactNode; details: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const bucket = homeworkBucket(item, today);
  const status = HOMEWORK_LABELS[bucket][uk ? 0 : 1];
  const scheduled = Boolean(item.published && new Date(item.published).getTime() > Date.now());
  return <li className={"hw-card hw-tone-" + subjectColor(item.subject) + (item.done ? " hw-is-done" : "")}>
    <button type="button" className="hw-card-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
      <span className="hw-assignment-icon">{item.done ? <Check aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}</span>
      <span className="hw-card-copy"><strong>{item.title}</strong><span>{item.subject}{item.label ? " · " + item.label : ""}</span></span>
      <span className={"hw-deadline hw-deadline-" + bucket}><span>{status}</span><time dateTime={item.due ?? undefined}>{homeworkDateLabel(item.due, uk)}</time></span>
      <ChevronDown className={open ? "hw-chevron is-open" : "hw-chevron"} aria-hidden="true" />
    </button>
    {open && <div className="hw-card-content" id={id}>
      <div className="hw-card-metadata">
        {item.author && <span>{item.author}</span>}
        {scheduled && <span>{uk ? "Заплановано: " : "Scheduled: "}{new Intl.DateTimeFormat(uk ? "uk-UA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }).format(new Date(item.published!))}</span>}
        <span><CalendarDays aria-hidden="true" />{homeworkDateLabel(item.due, uk)}</span>
      </div>
      <p className="hw-description">{item.body || (uk ? "Додаткового опису немає." : "No additional description.")}</p>
      {Boolean(item.images?.length) && <PhotoStrip urls={item.images ?? []} />}
      <div className="hw-card-actions">
        {onToggle && typeof item.done === "boolean" && <button type="button" className={item.done ? "hw-complete is-done" : "hw-complete"} disabled={pending} aria-pressed={item.done} onClick={() => onToggle(item.id, !item.done)}>
          <Check aria-hidden="true" />{item.done ? (uk ? "Повернути до виконання" : "Mark as to do") : (uk ? "Позначити виконаним" : "Mark completed")}
        </button>}
        {actions}
      </div>
      {typeof item.done === "boolean" && <p className="hw-personal-note">{uk ? "«Виконано» — особиста позначка, а не здача роботи чи оцінка вчителя." : "“Completed” is a personal checklist mark, not a submission or teacher grade."}</p>}
    </div>}
    {details && <div className="hw-extra-details">{details}</div>}
  </li>;
}
