import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addLesson,
  addStarostaHomework,
  addSubject,
  deleteLesson,
  deleteSubject,
  listClasses,
  listGradebook,
  listLessons,
  listStudents,
  listSubjects,
  setGrade,
  toggleHomeworkDone,
  updateSubject,
} from "@/lib/school/server";
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
  const isStarosta = Boolean(me.data?.profile.isStarosta);
  const qc = useQueryClient();
  const lessonsQ = useQuery({ queryKey: ["lessons"], queryFn: () => listLessons() });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => listClasses(), enabled: isTeacher });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => listStudents(), enabled: isTeacher });
  const bookQ = useQuery({ queryKey: ["gradebook"], queryFn: () => listGradebook(), enabled: isTeacher });
  const [view, setView] = useState<"today" | "tomorrow" | "all">("today");
  const [kind, setKind] = useState<"lessons" | "homework">("lessons");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(todayFn());
  const [hwDate, setHwDate] = useState("");
  const [hasHw, setHasHw] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subName, setSubName] = useState("");
  const [subRoom, setSubRoom] = useState("");
  const [subMeet, setSubMeet] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [hwSort, setHwSort] = useState<"date" | "subject">("date");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [openJournal, setOpenJournal] = useState<string | null>(null);
  const [starSubject, setStarSubject] = useState("");
  const [starTitle, setStarTitle] = useState("");
  const [starBody, setStarBody] = useState("");
  const [starDate, setStarDate] = useState(shift(todayFn(), 1));

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
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
        },
      }),
    onSuccess: async () => {
      setTitle("");
      setContent("");
      await qc.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
  const addSub = useMutation({
    mutationFn: () => addSubject({ data: { name: subName, room: subRoom, meetLink: subMeet } }),
    onSuccess: async () => {
      setSubName("");
      setSubRoom("");
      setSubMeet("");
      await qc.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
  const tog = useMutation({
    mutationFn: (d: { lessonId: string; done: boolean }) => toggleHomeworkDone({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons"] }),
  });
  const delLes = useMutation({
    mutationFn: (lessonId: string) => deleteLesson({ data: { lessonId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons"] }),
  });
  const patchSub = useMutation({
    mutationFn: (d: { subjectId: string; studentsCanAddHw?: boolean }) => updateSubject({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
  const delSub = useMutation({
    mutationFn: (subjectId: string) => deleteSubject({ data: { subjectId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
  const starHw = useMutation({
    mutationFn: () =>
      addStarostaHomework({
        data: { subjectId: starSubject, title: starTitle, content: starBody, homeworkDue: starDate },
      }),
    onSuccess: async () => {
      setStarTitle("");
      setStarBody("");
      toast.success(t.gradeSaved);
      await qc.invalidateQueries({ queryKey: ["lessons"] });
    },
  });

  const today = todayFn();
  const tomorrow = shift(today, 1);
  const lessons = lessonsQ.data?.lessons ?? [];
  const done = new Set(lessonsQ.data?.doneIds ?? []);
  const isAdmin = Boolean(me.data?.profile.isAdmin);
  const mineIds = new Set(subjectsQ.data?.mine ?? []);
  const teachable = (subjectsQ.data?.subjects ?? []).filter((s) => isAdmin || mineIds.size === 0 || mineIds.has(s.id));
  const allowedHw = (subjectsQ.data?.subjects ?? []).filter((s) => s.studentsCanAddHw);
  const filtered = useMemo(() => {
    let list = lessons;
    if (kind === "homework") list = list.filter((l) => l.hasHomework);
    if (subjectFilter) list = list.filter((l) => l.subjectId === subjectFilter);
    if (view === "today") list = list.filter((l) => (kind === "homework" ? l.homeworkDue === today : l.lessonDate === today));
    if (view === "tomorrow") list = list.filter((l) => (kind === "homework" ? l.homeworkDue === tomorrow : l.lessonDate === tomorrow));
    if (hideDone && kind === "homework") list = list.filter((l) => !done.has(l.id));
    if (kind === "homework" && hwSort === "subject") {
      list = [...list].sort((a, b) => a.subjectName.localeCompare(b.subjectName, "uk") || a.homeworkDue!.localeCompare(b.homeworkDue || ""));
    }
    return list;
  }, [lessons, kind, view, hideDone, done, today, tomorrow, subjectFilter, hwSort]);

  return (
    <div>
      {isTeacher && (
        <>
          <Panel>
            <PanelTitle>{t.addLesson}</PanelTitle>
            <div className="grid gap-2">
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">{t.subjectName}</option>
                {(teachable.length ? teachable : subjectsQ.data?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.lessonTitle} />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t.lessonContent}
                rows={3}
                className="rounded-2xl border border-transparent bg-surface-2 px-4 py-3 text-sm outline-none focus:border-forest-mid/35 focus:bg-surface"
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
                <label className="text-xs font-bold text-muted">
                  {t.publishAt}
                  <TextInput type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="mt-1 block" />
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
                      className={cn("rounded-full px-3 py-1 text-xs font-bold", on ? "bg-forest text-paper" : "bg-surface-2")}
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
              <TextInput value={subRoom} onChange={(e) => setSubRoom(e.target.value)} placeholder={t.roomPh} />
              <TextInput value={subMeet} onChange={(e) => setSubMeet(e.target.value)} placeholder={t.meetLink} />
              <PillButton type="button" disabled={!subName.trim() || addSub.isPending} onClick={() => addSub.mutate()}>
                {t.add}
              </PillButton>
            </div>
          </Panel>
        </>
      )}

      {isStarosta && !isTeacher && (
        <Panel>
          <PanelTitle>{t.starostaHw}</PanelTitle>
          <Hint>{t.starostaHwHint}</Hint>
          {allowedHw.length === 0 ? (
            <p className="text-sm text-muted">{t.empty}</p>
          ) : (
            <div className="grid gap-2">
              <Select value={starSubject} onChange={(e) => setStarSubject(e.target.value)}>
                <option value="">{t.subjectName}</option>
                {allowedHw.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <TextInput value={starTitle} onChange={(e) => setStarTitle(e.target.value)} placeholder={t.lessonTitle} />
              <textarea
                value={starBody}
                onChange={(e) => setStarBody(e.target.value)}
                placeholder={t.lessonContent}
                rows={2}
                className="rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none"
              />
              <TextInput type="date" value={starDate} onChange={(e) => setStarDate(e.target.value)} />
              <PillButton type="button" disabled={!starTitle.trim() || !starSubject || starHw.isPending} onClick={() => starHw.mutate()}>
                {t.add}
              </PillButton>
            </div>
          )}
        </Panel>
      )}

      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["today", "tomorrow", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn("rounded-full px-3 py-1.5 font-display text-xs font-bold", view === v ? "bg-forest text-paper" : "bg-surface-2")}
            >
              {v === "today" ? t.viewToday : v === "tomorrow" ? t.viewTomorrow : t.viewAll}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
          {(["lessons", "homework"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={cn("rounded-full px-3 py-1.5 font-display text-xs font-bold", kind === v ? "bg-forest text-paper" : "bg-surface-2")}
            >
              {v === "lessons" ? t.viewLessons : t.viewHw}
            </button>
          ))}
          <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="h-9">
            <option value="">{t.allSubjects}</option>
            {(subjectsQ.data?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          {kind === "homework" && (
            <Select value={hwSort} onChange={(e) => setHwSort(e.target.value as "date" | "subject")} className="h-9">
              <option value="date">{t.hwByDate}</option>
              <option value="subject">{t.hwBySubject}</option>
            </Select>
          )}
          {kind === "homework" && !isTeacher && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              {t.hideDone}
            </label>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">{kind === "homework" ? t.noHw : t.noLessons}</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((l) => {
              const roster = (studentsQ.data ?? []).filter((s) => l.classIds.length === 0 || l.classIds.includes(s.classId));
              return (
                <li key={l.id} className="rounded-2xl border border-hairline bg-cream/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-extrabold">
                        {l.title}{" "}
                        {l.addedByStarosta && <span className="text-xs font-bold text-terracotta">{t.addedByStarosta}</span>}
                      </p>
                      <p className="text-xs font-bold text-forest-mid">{l.subjectName}</p>
                      {l.content && <p className="mt-1 text-sm text-ink-soft">{l.content}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {t.lessonDate}: {l.lessonDate}
                        {l.homeworkDue ? ` · ${t.hwDate}: ${l.homeworkDue}` : ""}
                        {l.publishAt ? ` · ${t.publishAt}: ${l.publishAt.slice(0, 16).replace("T", " ")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!isTeacher && l.hasHomework && (
                        <PillButton tone="ghost" type="button" onClick={() => tog.mutate({ lessonId: l.id, done: !done.has(l.id) })}>
                          {done.has(l.id) ? t.done : t.markDone}
                        </PillButton>
                      )}
                      {isTeacher && (
                        <>
                          <button type="button" className="text-xs font-bold text-forest" onClick={() => setOpenJournal(openJournal === l.id ? null : l.id)}>
                            {t.journal}
                          </button>
                          <button type="button" className="text-xs text-terracotta" onClick={() => { if (window.confirm(t.confirmDelete)) delLes.mutate(l.id); }}>
                            {t.deleteLesson}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isTeacher && openJournal === l.id && (
                    <Journal
                      students={roster}
                      grades={(bookQ.data?.grades ?? []).filter((g) => g.lessonId === l.id)}
                      subjectId={l.subjectId}
                      lessonId={l.id}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{isTeacher ? t.subjectsList : t.subjectsList}</PanelTitle>
        {(subjectsQ.data?.subjects ?? []).length === 0 ? (
          <Hint>{t.empty}</Hint>
        ) : (
          <ul className="space-y-1">
            {(subjectsQ.data?.subjects ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream/50 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{s.name}</span>
                  {s.room && <span className="ml-2 text-muted">{s.room}</span>}
                  {s.meetLink && (
                    <a href={s.meetLink} target="_blank" rel="noreferrer" className="ml-2 text-xs font-bold text-forest-mid">
                      {t.joinMeeting}
                    </a>
                  )}
                </span>
                {isTeacher && teachable.some((x) => x.id === s.id) && (
                  <span className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={s.studentsCanAddHw}
                        onChange={(e) => patchSub.mutate({ subjectId: s.id, studentsCanAddHw: e.target.checked })}
                      />
                      {t.studentsCanHw}
                    </label>
                    <button type="button" className="text-xs text-terracotta" onClick={() => { if (window.confirm(t.confirmDelete)) delSub.mutate(s.id); }}>
                      {t.deleteSubject}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Journal({
  students,
  grades,
  subjectId,
  lessonId,
}: {
  students: { id: string; name: string }[];
  grades: { rosterId: string; kind: string; value: string }[];
  subjectId: string;
  lessonId: string;
}) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (d: { rosterId: string; kind: "lesson" | "homework"; value: string }) =>
      setGrade({ data: { ...d, subjectId, lessonId } }),
    onSuccess: () => {
      toast.success(t.gradeSaved);
      void qc.invalidateQueries({ queryKey: ["gradebook"] });
      void qc.invalidateQueries({ queryKey: ["grades"] });
    },
  });
  if (students.length === 0) return <p className="mt-3 text-sm text-muted">{t.noStudents}</p>;
  return (
    <div className="mt-3 overflow-x-auto border-t border-hairline pt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">{t.tabStudents}</th>
            <th>{t.gradeLesson}</th>
            <th>{t.gradeHw}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const lesson = grades.find((g) => g.rosterId === s.id && g.kind === "lesson")?.value ?? "";
            const hw = grades.find((g) => g.rosterId === s.id && g.kind === "homework")?.value ?? "";
            return (
              <tr key={s.id} className="border-t border-hairline/70">
                <td className="py-1.5 font-semibold">{s.name}</td>
                <td>
                  <GradeBox key={`${s.id}-l-${lesson}`} initial={lesson} onSave={(value) => save.mutate({ rosterId: s.id, kind: "lesson", value })} />
                </td>
                <td>
                  <GradeBox key={`${s.id}-h-${hw}`} initial={hw} onSave={(value) => save.mutate({ rosterId: s.id, kind: "homework", value })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GradeBox({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim() !== initial) onSave(value.trim());
      }}
      placeholder="—"
      className="h-8 w-16 rounded-lg bg-surface px-2 text-center text-sm"
    />
  );
}
