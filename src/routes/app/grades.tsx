import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { gradeOutOfRange, listGradebook, listGrades, listLessons, listStudents, listSubjects, setGrade } from "@/lib/school/server";
import { kyivToday } from "@/lib/school/ids";
import { STRINGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";

export const Route = createFileRoute("/app/grades")({ component: GradesPage });

function GradesPage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const students = useQuery({ queryKey: ["students"], queryFn: () => listStudents(), enabled: isTeacher });
  const [rosterId, setRosterId] = useState("");
  const gradesQ = useQuery({
    queryKey: ["grades", rosterId],
    queryFn: () => listGrades({ data: { rosterId: rosterId || undefined } }),
  });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const qc = useQueryClient();
  const [value, setValue] = useState("10");
  const [subjectId, setSubjectId] = useState("");
  const [kind, setKind] = useState<"lesson" | "homework" | "final">("lesson");
  const [comment, setComment] = useState("");
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [finalPeriod, setFinalPeriod] = useState("semester1");
  const [journal, setJournal] = useState(false);
  const add = useMutation({
    mutationFn: () =>
      setGrade({
        data: {
          rosterId,
          subjectId: subjectId || subjects.data?.subjects[0]?.id || "",
          kind,
          value,
          comment,
          finalPeriod: kind === "final" ? finalPeriod : null,
        },
      }),
    onSuccess: () => {
      setComment("");
      void qc.invalidateQueries({ queryKey: ["grades"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "GRADE_RANGE") toast.error(t.gradeRange);
    },
  });

  const allGrades = gradesQ.data?.grades ?? [];
  const grades = useMemo(() => filterPeriod(allGrades, period, from, to), [allGrades, period, from, to]);
  const numeric = grades.filter((g) => g.kind !== "final" && /^\d+$/.test(g.value)).map((g) => ({ ...g, n: Number(g.value) }));
  const absences = grades.filter((g) => g.value === "Н" || g.value === "A").length;
  const avg = numeric.length ? numeric.reduce((a, g) => a + g.n, 0) / numeric.length : 0;
  const bySubject = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const g of numeric) {
      const arr = map.get(g.subjectName) ?? [];
      arr.push(g.n);
      map.set(g.subjectName, arr);
    }
    return [...map.entries()].map(([name, vals]) => ({
      name,
      avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }));
  }, [numeric]);
  const best = bySubject.slice().sort((a, b) => b.avg - a.avg)[0];
  const trend = useMemo(() => {
    if (numeric.length < 4) return "none" as const;
    const mid = Math.floor(numeric.length / 2);
    const early = numeric.slice(0, mid).reduce((a, g) => a + g.n, 0) / mid;
    const late = numeric.slice(mid).reduce((a, g) => a + g.n, 0) / (numeric.length - mid);
    if (late - early >= 0.4) return "up" as const;
    if (early - late >= 0.4) return "down" as const;
    return "stable" as const;
  }, [numeric]);
  const finals = allGrades.filter((g) => g.kind === "final");
  const trendLabel = trend === "up" ? t.trendUp : trend === "down" ? t.trendDown : trend === "stable" ? t.trendStable : t.trendNone;

  return (
    <div>
      <Panel>
        <PanelTitle>{isTeacher ? t.tabGrades : t.gradesHeading}</PanelTitle>
        <Hint>{isTeacher ? t.teacherGradesHint : t.gradesHint}</Hint>
        {isTeacher && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Select value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
              <option value="">{t.pickStudent}</option>
              {(students.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {(subjects.data?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="lesson">{t.gradeLesson}</option>
              <option value="homework">{t.gradeHw}</option>
              <option value="final">{t.finalGrades}</option>
            </Select>
            {kind === "final" && (
              <Select value={finalPeriod} onChange={(e) => setFinalPeriod(e.target.value)}>
                <option value="semester1">{t.sem1}</option>
                <option value="semester2">{t.sem2}</option>
                <option value="year">{t.yearGrade}</option>
              </Select>
            )}
            <TextInput value={value} onChange={(e) => { if (!gradeOutOfRange(e.target.value)) setValue(e.target.value); }} placeholder="1–12 / Н" className="w-24" />
            <TextInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.commentPh} />
            <PillButton type="button" tone={journal ? "primary" : "ghost"} onClick={() => setJournal((v) => !v)}>
              {t.gradebook}
            </PillButton>
            <PillButton type="button" disabled={!rosterId || add.isPending} onClick={() => add.mutate()}>
              {t.save}
            </PillButton>
            <PillButton
              tone="ghost"
              type="button"
              disabled={!rosterId || !subjectId || add.isPending}
              onClick={() => {
                const pool = filterPeriod(allGrades, finalPeriod === "year" ? "all" : finalPeriod).filter(
                  (g) => g.subjectId === (subjectId || subjects.data?.subjects[0]?.id) && g.kind !== "final" && /^\d+$/.test(g.value),
                );
                if (!pool.length) return;
                const avgN = Math.min(12, Math.max(1, Math.round(pool.reduce((a, g) => a + Number(g.value), 0) / pool.length)));
                setValue(String(avgN));
                setKind("final");
              }}
            >
              {t.autoGrade}
            </PillButton>
          </div>
        )}
        <div className="mb-3">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9">
            <option value="all">{t.periodAll}</option>
            <option value="thisMonth">{t.periodMonth}</option>
            <option value="lastMonth">{t.periodLast}</option>
            <option value="semester1">{t.periodSem1}</option>
            <option value="semester2">{t.periodSem2}</option>
            <option value="custom">{t.periodCustom}</option>
          </Select>
          {period === "custom" && (
            <span className="ml-2 inline-flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
              {t.periodFrom}
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              {t.periodTo}
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </span>
          )}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Mini label={t.overallAvg} value={numeric.length ? avg.toFixed(1) : "—"} extra={t.ofMax} />
          <Mini label={t.gradesCount} value={String(grades.filter((g) => g.kind !== "final").length)} />
          <Mini label={t.absences} value={String(absences)} />
          <Mini label={t.bestSubject} value={best?.name ?? "—"} />
          <Mini label={t.trend} value={trendLabel} />
        </div>
        {bySubject.length > 0 && (
          <div className="h-56">
            <p className="mb-2 text-sm font-bold">{t.chartBySubject}</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 12]} />
                <Tooltip />
                <Bar dataKey="avg" fill="var(--color-forest-mid)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {numeric.length > 1 && (
          <div className="mt-4 h-40">
            <p className="mb-2 text-sm font-bold">{t.chartTrend}</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={numeric.map((g, i) => ({ i: i + 1, n: g.n, name: g.subjectName }))}>
                <XAxis dataKey="i" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 12]} />
                <Tooltip />
                <Line type="monotone" dataKey="n" stroke="var(--color-terracotta)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      {isTeacher && journal && <GradeJournal t={t} lang={lang} />}
      {finals.length > 0 && (
        <Panel>
          <PanelTitle>{t.finalGrades}</PanelTitle>
          <ul className="space-y-1">
            {finals.map((g) => (
              <li key={g.id} className="flex justify-between rounded-xl bg-cream/50 px-3 py-2 text-sm">
                <span className="font-semibold">
                  {g.subjectName} · {g.finalPeriod === "semester2" ? t.sem2 : g.finalPeriod === "year" ? t.yearGrade : t.sem1}
                </span>
                <span className="font-display font-extrabold">{g.value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel>
        <PanelTitle>{t.gradesHeading}</PanelTitle>
        {grades.length === 0 ? (
          <p className="text-sm text-muted">{t.noGrades}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2">{t.tabTasks}</th>
                  <th>{t.gradeLesson}</th>
                  <th>{t.tabGrades}</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.id} className="border-t border-hairline">
                    <td className="py-2 font-semibold">{g.subjectName}</td>
                    <td>{g.kind === "homework" ? t.gradeHw : g.kind === "final" ? t.yearGrade : t.gradeLesson}</td>
                    <td className="font-display font-extrabold">{g.value}</td>
                    <td className="text-xs text-muted">{g.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function GradeJournal({ t, lang }: { t: (typeof STRINGS)[Lang]; lang: Lang }) {
  const today = kyivToday();
  const lessonsQ = useQuery({ queryKey: ["lessons"], queryFn: () => listLessons() });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => listStudents() });
  const bookQ = useQuery({ queryKey: ["gradebook"], queryFn: () => listGradebook() });
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<"lesson" | "homework">("lesson");
  const [period, setPeriod] = useState("thisMonth");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const save = useMutation({
    mutationFn: (d: { rosterId: string; subjectId: string; lessonId: string; value: string }) =>
      setGrade({ data: { ...d, kind, comment: "" } }),
    onSuccess: () => {
      toast.success(t.gradeSaved);
      void qc.invalidateQueries({ queryKey: ["gradebook"] });
      void qc.invalidateQueries({ queryKey: ["grades"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "GRADE_RANGE") toast.error(t.gradeRange);
    },
  });

  const lessons = useMemo(() => {
    return (lessonsQ.data?.lessons ?? [])
      .filter((l) => !subjectId || l.subjectId === subjectId)
      .filter((l) => !classId || l.classIds.length === 0 || l.classIds.includes(classId))
      .filter((l) => lessonInPeriod(l.lessonDate, period, from, to))
      .slice()
      .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.subjectName.localeCompare(b.subjectName, lang));
  }, [lessonsQ.data, subjectId, classId, period, from, to, lang]);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lessonsQ.data?.lessons ?? []) map.set(l.subjectId, l.subjectName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], lang));
  }, [lessonsQ.data, lang]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of studentsQ.data ?? []) if (s.classId) map.set(s.classId, s.className || s.classId);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], lang));
  }, [studentsQ.data, lang]);

  const students = useMemo(() => {
    const classIds = new Set(lessons.flatMap((l) => l.classIds));
    return (studentsQ.data ?? [])
      .filter((s) => (classId ? s.classId === classId : classIds.size === 0 || classIds.has(s.classId)))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [studentsQ.data, lessons, classId, lang]);

  const gradeAt = (rosterId: string, lessonId: string) =>
    bookQ.data?.grades.find((g) => g.rosterId === rosterId && g.lessonId === lessonId && g.kind === kind)?.value ?? "";

  return (
    <Panel>
      <PanelTitle>{t.gradebook}</PanelTitle>
      <Hint>{t.gradebookHint}</Hint>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-9">
          <option value="">{t.allSubjects}</option>
          {subjects.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-9">
          <option value="">{t.allClasses}</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as "lesson" | "homework")} className="h-9">
          <option value="lesson">{t.gradeLesson}</option>
          <option value="homework">{t.gradeHw}</option>
        </Select>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9">
          <option value="all">{t.periodAll}</option>
          <option value="thisMonth">{t.periodMonth}</option>
          <option value="lastMonth">{t.periodLast}</option>
          <option value="semester1">{t.periodSem1}</option>
          <option value="semester2">{t.periodSem2}</option>
          <option value="custom">{t.periodCustom}</option>
        </Select>
        {period === "custom" && (
          <span className="inline-flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
            {t.periodFrom}
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            {t.periodTo}
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </span>
        )}
      </div>
      {lessons.length === 0 ? (
        <p className="text-sm text-muted">{t.gradebookEmpty}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-muted">{t.noStudents}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-44 bg-surface px-3 py-2 text-left font-display text-xs font-extrabold text-muted">
                  {t.tabStudents}
                </th>
                {lessons.map((l) => {
                  const on = l.lessonDate === today;
                  return (
                    <th
                      key={l.id}
                      className={cn(
                        "min-w-24 px-2 py-2 text-center font-display text-xs font-extrabold",
                        on ? "bg-forest/5 text-forest" : "text-ink",
                      )}
                    >
                      <div>{shortDate(l.lessonDate, lang)}</div>
                      <div className={cn("mt-0.5 text-[10px] font-bold", on ? "text-forest" : "text-muted")}>{l.subjectName}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="sticky left-0 z-10 border-t border-hairline bg-surface px-3 py-1.5 font-semibold">{s.name}</td>
                  {lessons.map((l) => {
                    const value = gradeAt(s.id, l.id);
                    return (
                      <td key={l.id} className={cn("border-t border-hairline px-1 py-1 text-center", l.lessonDate === today && "bg-forest/5")}>
                        <JournalCell
                          key={`${s.id}-${l.id}-${kind}-${value}`}
                          initial={value}
                          onSave={(next) => save.mutate({ rosterId: s.id, subjectId: l.subjectId, lessonId: l.id, value: next })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function JournalCell({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => {
        if (!gradeOutOfRange(e.target.value)) setValue(e.target.value);
      }}
      onBlur={() => {
        if (value.trim() !== initial) onSave(value.trim());
      }}
      placeholder="—"
      className="h-8 w-14 rounded-lg bg-surface text-center text-sm font-bold text-ink outline-none"
    />
  );
}

function shortDate(iso: string, lang: "uk" | "en") {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function lessonInPeriod(iso: string, period: string, from: string, to: string) {
  if (!iso || period === "all") return true;
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return false;
  const now = new Date();
  if (period === "thisMonth") return y === now.getFullYear() && m === now.getMonth() + 1;
  if (period === "lastMonth") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return y === prev.getFullYear() && m === prev.getMonth() + 1;
  }
  if (period === "semester1") return m >= 9 && m <= 12;
  if (period === "semester2") return m >= 1 && m <= 5;
  if (period === "custom") {
    if (from && iso < from) return false;
    if (to && iso > to) return false;
  }
  return true;
}

function Mini({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="rounded-2xl bg-cream/50 p-3">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="font-display text-2xl font-extrabold">
        {value} {extra && <span className="text-sm font-bold text-muted">{extra}</span>}
      </p>
    </div>
  );
}

function filterPeriod<T extends { createdAt: string; kind: string }>(grades: T[], period: string, from = "", to = "") {
  const now = new Date();
  return grades.filter((g) => {
    if (period === "all" || period === "year") return true;
    const d = new Date(g.createdAt);
    if (Number.isNaN(d.getTime())) return period === "all";
    const month = d.getMonth() + 1;
    if (period === "thisMonth") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === "lastMonth") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    }
    if (period === "semester1") return month >= 9 && month <= 12;
    if (period === "semester2") return month >= 1 && month <= 5;
    if (period === "custom") {
      const day = d.toISOString().slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}
