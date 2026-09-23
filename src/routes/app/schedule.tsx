import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addClass, addElective, getSchedule, listClasses, listElectives, listSubjects, setScheduleSubject } from "@/lib/school/server";
import { WEEKDAYS, kyivWeekday } from "@/lib/school/ids";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/schedule")({ component: SchedulePage });

function SchedulePage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const [classId, setClassId] = useState<string>("");
  const activeClass = classId || me.data?.profile.classId || classes.data?.[0]?.id || "";
  const sched = useQuery({
    queryKey: ["schedule", activeClass],
    queryFn: () => getSchedule({ data: { classId: activeClass } }),
    enabled: Boolean(activeClass) || isTeacher,
  });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects(), enabled: isTeacher });
  const electives = useQuery({ queryKey: ["electives"], queryFn: () => listElectives(), enabled: !isTeacher });
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newClass, setNewClass] = useState("");
  const [elName, setElName] = useState("");
  const [elDay, setElDay] = useState("mon");
  const [elStart, setElStart] = useState("15:00");
  const [elEnd, setElEnd] = useState("16:00");

  const addClassMut = useMutation({
    mutationFn: () => addClass({ data: { name: newClass } }),
    onSuccess: async () => {
      setNewClass("");
      await qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
  const setSub = useMutation({
    mutationFn: (d: { entryId: string; subjectId: string | null }) => setScheduleSubject({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
  const addEl = useMutation({
    mutationFn: () => addElective({ data: { name: elName, weekday: elDay, startTime: elStart, endTime: elEnd } }),
    onSuccess: async () => {
      setElName("");
      await qc.invalidateQueries({ queryKey: ["electives"] });
    },
  });

  const entries = sched.data?.entries ?? [];
  const today = kyivWeekday();
  const byDay = WEEKDAYS.map((day) => ({
    day,
    rows: entries.filter((e) => e.weekday === day).sort((a, b) => a.period - b.period),
  }));

  return (
    <div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{isTeacher ? t.scheduleHeading : t.weeklySchedule}</PanelTitle>
          {isTeacher && (
            <PillButton tone="ghost" type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? t.applySchedule : t.editSchedule}
            </PillButton>
          )}
        </div>
        {!isTeacher && <Hint>{t.weeklyHint}</Hint>}
        {isTeacher && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{t.classLabel}:</span>
            <Select value={activeClass} onChange={(e) => setClassId(e.target.value)}>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <TextInput value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder={t.newClassPh} />
            <PillButton type="button" disabled={!newClass.trim() || addClassMut.isPending} onClick={() => addClassMut.mutate()}>
              {t.addClass}
            </PillButton>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {byDay.filter((d) => (d.day !== "sat" && d.day !== "sun") || d.rows.some((r) => r.subjectId)).map((d) => (
            <div key={d.day} className={cn("rounded-2xl border p-3", d.day === today ? "border-forest-mid/40 bg-forest/8" : "border-hairline bg-cream/50")}>
              <p className="mb-2 font-display text-sm font-extrabold">{t.weekdays[d.day]}</p>
              {d.rows.length === 0 && <p className="text-xs text-muted">{t.emptyDay}</p>}
              <ul className="space-y-1.5">
                {d.rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 rounded-xl bg-paper px-2.5 py-2 text-sm">
                    <span className="w-20 shrink-0 font-mono text-xs text-muted">
                      {row.startTime}–{row.endTime}
                    </span>
                    {editing && isTeacher ? (
                      <Select
                        className="h-9 flex-1"
                        value={row.subjectId ?? ""}
                        onChange={(e) => setSub.mutate({ entryId: row.id, subjectId: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {(subjects.data?.subjects ?? []).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {row.subjectName ?? "—"}
                        {row.room ? <span className="ml-1 text-xs font-normal text-muted">{row.room}</span> : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {!isTeacher && (
        <Panel>
          <PanelTitle>{t.myElectives}</PanelTitle>
          <Hint>{t.electivesHint}</Hint>
          <div className="mb-3 flex flex-wrap gap-2">
            <TextInput value={elName} onChange={(e) => setElName(e.target.value)} placeholder={t.electiveName} />
            <Select value={elDay} onChange={(e) => setElDay(e.target.value)}>
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>{t.weekdays[d]}</option>
              ))}
            </Select>
            <TextInput type="time" value={elStart} onChange={(e) => setElStart(e.target.value)} />
            <TextInput type="time" value={elEnd} onChange={(e) => setElEnd(e.target.value)} />
            <PillButton type="button" disabled={!elName.trim() || addEl.isPending} onClick={() => addEl.mutate()}>
              {t.add}
            </PillButton>
          </div>
          {(electives.data?.electives ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t.noElectives}</p>
          ) : (
            <ul className="space-y-1">
              {(electives.data?.electives ?? []).map((e) => (
                <li key={e.id} className="rounded-xl bg-cream/60 px-3 py-2 text-sm">
                  <span className="font-semibold">{e.name}</span>
                  <span className="ml-2 text-muted">
                    {t.weekdays[e.weekday as keyof typeof t.weekdays]} {e.startTime}–{e.endTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
