import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addLesson, addSubject, listClasses, listLessons, listSubjects, toggleHomeworkDone } from "@/lib/school/server";
import { kyivToday as todayFn } from "@/lib/school/ids";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/tasks")({ component: TasksPage });

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function TasksPage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const qc = useQueryClient();
  const lessonsQ = useQuery({ queryKey: ["lessons"], queryFn: () => listLessons() });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => listClasses(), enabled: isTeacher });
  const [view, setView] = useState<"today" | "tomorrow" | "all">("today");
  const [kind, setKind] = useState<"lessons" | "homework">("lessons");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(todayFn());
  const [hwDate, setHwDate] = useState("");
  const [hasHw, setHasHw] = useState(false);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subName, setSubName] = useState("");
  const [hideDone, setHideDone] = useState(false);

  const addLes = useMutation({
    mutationFn: () =>
      addLesson({
        data: {
          subjectId: subjectId || subjectsQ.data?.subjects[0]?.id || "",
          title,
          content,
          lessonDate: date,
          hasHomework: hasHw || Boolean(hwDate),
          homeworkDue: hwDate || null,
          classIds,
        },
      }),
    onSuccess: async () => {
      setTitle("");
      setContent("");
      await qc.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
  const addSub = useMutation({
    mutationFn: () => addSubject({ data: { name: subName } }),
    onSuccess: async () => {
      setSubName("");
      await qc.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
  const tog = useMutation({
    mutationFn: (d: { lessonId: string; done: boolean }) => toggleHomeworkDone({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons"] }),
  });

  const today = todayFn();
  const tomorrow = shift(today, 1);
  const lessons = lessonsQ.data?.lessons ?? [];
  const done = new Set(lessonsQ.data?.doneIds ?? []);
  const filtered = useMemo(() => {
    let list = lessons;
    if (kind === "homework") list = list.filter((l) => l.hasHomework);
    if (view === "today") list = list.filter((l) => (kind === "homework" ? l.homeworkDue === today : l.lessonDate === today));
    if (view === "tomorrow") list = list.filter((l) => (kind === "homework" ? l.homeworkDue === tomorrow : l.lessonDate === tomorrow));
    if (hideDone && kind === "homework") list = list.filter((l) => !done.has(l.id));
    return list;
  }, [lessons, kind, view, hideDone, done, today, tomorrow]);

  return (
    <div>
      {isTeacher && (
        <>
          <Panel>
            <PanelTitle>{t.addLesson}</PanelTitle>
            <div className="grid gap-2">
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">{t.subjectName}</option>
                {(subjectsQ.data?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.lessonTitle} />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t.lessonContent}
                rows={3}
                className="rounded-2xl border border-transparent bg-paper-2 px-4 py-3 text-sm outline-none focus:border-forest-mid/35 focus:bg-white"
              />
              <div className="flex flex-wrap gap-2">
                <label className="text-xs font-bold text-muted">
                  {t.lessonDate}
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block" />
                </label>
                <label className="text-xs font-bold text-muted">
                  {t.hwDate}
                  <TextInput type="date" value={hwDate} onChange={(e) => setHwDate(e.target.value)} className="mt-1 block" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasHw} onChange={(e) => setHasHw(e.target.checked)} />
                {t.hasHw}
              </label>
              <p className="text-xs font-bold text-muted">{t.assignClasses}</p>
              <div className="flex flex-wrap gap-2">
                {(classesQ.data ?? []).map((c) => {
                  const on = classIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClassIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                      className={cn("rounded-full px-3 py-1 text-xs font-bold", on ? "bg-forest text-paper" : "bg-paper-2")}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <PillButton type="button" disabled={!title.trim() || addLes.isPending} onClick={() => addLes.mutate()}>
                {t.add}
              </PillButton>
            </div>
          </Panel>
          <Panel>
            <PanelTitle>{t.addSubject}</PanelTitle>
            <div className="flex flex-wrap gap-2">
              <TextInput value={subName} onChange={(e) => setSubName(e.target.value)} placeholder={t.subjectName} />
              <PillButton type="button" disabled={!subName.trim() || addSub.isPending} onClick={() => addSub.mutate()}>
                {t.add}
              </PillButton>
            </div>
          </Panel>
        </>
      )}

      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["today", "tomorrow", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn("rounded-full px-3 py-1.5 font-display text-xs font-bold", view === v ? "bg-forest text-paper" : "bg-paper-2")}
            >
              {v === "today" ? t.viewToday : v === "tomorrow" ? t.viewTomorrow : t.viewAll}
            </button>
          ))}
          <span className="mx-1 w-px bg-hairline" />
          {(["lessons", "homework"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={cn("rounded-full px-3 py-1.5 font-display text-xs font-bold", kind === v ? "bg-forest text-paper" : "bg-paper-2")}
            >
              {v === "lessons" ? t.viewLessons : t.viewHw}
            </button>
          ))}
          {kind === "homework" && !isTeacher && (
            <label className="ml-auto flex items-center gap-2 text-xs">
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              {t.hideDone}
            </label>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">{kind === "homework" ? t.noHw : t.noLessons}</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((l) => (
              <li key={l.id} className="rounded-2xl border border-hairline bg-cream/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-extrabold">{l.title}</p>
                    <p className="text-xs font-bold text-forest-mid">{l.subjectName}</p>
                    {l.content && <p className="mt-1 text-sm text-ink-soft">{l.content}</p>}
                    <p className="mt-1 text-xs text-muted">
                      {t.lessonDate}: {l.lessonDate}
                      {l.homeworkDue ? ` · ${t.hwDate}: ${l.homeworkDue}` : ""}
                    </p>
                  </div>
                  {!isTeacher && l.hasHomework && (
                    <PillButton
                      tone="ghost"
                      type="button"
                      onClick={() => tog.mutate({ lessonId: l.id, done: !done.has(l.id) })}
                    >
                      {done.has(l.id) ? t.done : t.markDone}
                    </PillButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t.subjectsList}</PanelTitle>
        {(subjectsQ.data?.subjects ?? []).length === 0 ? (
          <Hint>{t.empty}</Hint>
        ) : (
          <ul className="space-y-1">
            {(subjectsQ.data?.subjects ?? []).map((s) => (
              <li key={s.id} className="flex justify-between rounded-xl bg-cream/50 px-3 py-2 text-sm">
                <span className="font-semibold">{s.name}</span>
                {s.room && <span className="text-muted">{s.room}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
