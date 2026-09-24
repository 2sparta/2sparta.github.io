import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ClipboardPaste, Copy, Pencil, Plus, Replace, X } from "lucide-react";
import { toast } from "sonner";
import {
  addClass,
  addElective,
  addGroup,
  addSchedulePeriod,
  applyScheduleCells,
  clearDayTimes,
  deleteClass,
  deleteElective,
  deleteGroup,
  enableCustomDay,
  getSchedule,
  listClasses,
  listElectives,
  listSubjects,
  setScheduleSubject,
  setScheduleTimes,
  setWeekOverride,
} from "@/lib/school/server";
import { WEEKDAYS, kyivClock, kyivWeekday } from "@/lib/school/ids";
import { describeLive } from "@/lib/school/live";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/schedule")({ component: SchedulePage });

const BASE_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

function SchedulePage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const [classId, setClassId] = useState<string>("");
  const [groupId, setGroupId] = useState("");
  const activeClass = classId || me.data?.profile.classId || classes.data?.[0]?.id || "";
  const groups = classes.data?.find((c) => c.id === activeClass)?.groups ?? [];
  const activeGroup = groups.some((g) => g.id === groupId) ? groupId : groups[0]?.id || me.data?.profile.groupId || "";
  const sched = useQuery({
    queryKey: ["schedule", activeClass, activeGroup],
    queryFn: () => getSchedule({ data: { classId: activeClass, groupId: activeGroup || null } }),
    enabled: Boolean(activeClass) || isTeacher,
  });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const electives = useQuery({ queryKey: ["electives"], queryFn: () => listElectives(), enabled: !isTeacher });
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [swap, setSwap] = useState(false);
  const [timesOpen, setTimesOpen] = useState(false);
  const [draft, setDraft] = useState<null | { kind: "class" | "group"; name: string }>(null);
  const [elName, setElName] = useState("");
  const [elDay, setElDay] = useState("mon");
  const [elStart, setElStart] = useState("15:00");
  const [elEnd, setElEnd] = useState("16:00");
  const [clock, setClock] = useState(kyivClock());
  useEffect(() => {
    const id = window.setInterval(() => setClock(kyivClock()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule"] });
  const addClassMut = useMutation({
    mutationFn: (name: string) => addClass({ data: { name } }),
    onSuccess: async (res) => {
      setClassId(res.id);
      setGroupId("");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["classes"] });
      refresh();
    },
  });
  const addGroupMut = useMutation({
    mutationFn: (name: string) => addGroup({ data: { classId: activeClass, name } }),
    onSuccess: async (res) => {
      setGroupId(res.id);
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["classes"] });
      refresh();
    },
  });
  const delClass = useMutation({
    mutationFn: () => deleteClass({ data: { classId: activeClass } }),
    onSuccess: async () => {
      setClassId("");
      await qc.invalidateQueries({ queryKey: ["classes"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message === "ONLY_CLASS" ? t.onlyOneClass : e.message),
  });
  const delGroup = useMutation({
    mutationFn: () => deleteGroup({ data: { groupId: activeGroup } }),
    onSuccess: async () => {
      setGroupId("");
      await qc.invalidateQueries({ queryKey: ["classes"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message === "ONLY_GROUP" ? t.onlyOneGroup : e.message),
  });
  const setSub = useMutation({
    mutationFn: (d: { entryId: string; subjectId: string | null }) => setScheduleSubject({ data: d }),
    onSuccess: refresh,
  });
  const override = useMutation({
    mutationFn: (d: { entryId: string; subjectId: string | null }) => setWeekOverride({ data: d }),
    onSuccess: refresh,
  });
  const setTime = useMutation({
    mutationFn: (d: { period: number; startTime: string; endTime: string; weekday?: string | null }) =>
      setScheduleTimes({ data: { classId: activeClass, groupId: activeGroup || null, ...d } }),
    onSuccess: refresh,
  });
  const customDay = useMutation({
    mutationFn: (d: { weekday: string; on: boolean }) =>
      d.on
        ? enableCustomDay({ data: { classId: activeClass, groupId: activeGroup || null, weekday: d.weekday } })
        : clearDayTimes({ data: { classId: activeClass, groupId: activeGroup || null, weekday: d.weekday } }),
    onSuccess: refresh,
  });
  const addPeriod = useMutation({
    mutationFn: () => addSchedulePeriod({ data: { classId: activeClass, groupId: activeGroup || null } }),
    onSuccess: refresh,
  });
  const paste = useMutation({
    mutationFn: (cells: { weekday: string; period: number; subjectId: string | null }[]) =>
      applyScheduleCells({ data: { classId: activeClass, groupId: activeGroup || null, cells } }),
    onSuccess: refresh,
  });
  const addEl = useMutation({
    mutationFn: () => addElective({ data: { name: elName, weekday: elDay, startTime: elStart, endTime: elEnd } }),
    onSuccess: async () => {
      setElName("");
      await qc.invalidateQueries({ queryKey: ["electives"] });
    },
  });
  const delEl = useMutation({
    mutationFn: (id: string) => deleteElective({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["electives"] }),
  });

  const entries = sched.data?.entries ?? [];
  const today = kyivWeekday();
  const extraDays = (["sat", "sun"] as const).filter((day) =>
    entries.some((e) => e.weekday === day && (e.subjectId || e.customTimes)),
  );
  const days = [...BASE_DAYS, ...extraDays];
  const periods = [...new Set(entries.map((e) => e.period))].filter((p) => p > 0).sort((a, b) => a - b);
  const shownPeriods = periods.length ? periods : [1, 2, 3, 4, 5];
  const cell = (day: string, period: number) => entries.find((e) => e.weekday === day && e.period === period);
  const shared = (period: number) =>
    entries.find((e) => e.period === period && !e.customTimes) ?? entries.find((e) => e.period === period);
  const dayCustom = (day: string) => entries.some((e) => e.weekday === day && e.customTimes);
  const live = describeLive(entries, today, clock);

  return (
    <div>
      {live && live.phase !== "none" && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-hairline bg-surface px-4 py-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-forest-mid uppercase">
              {live.phase === "lesson" ? t.liveLesson : live.phase === "break" ? t.liveBreak : t.nextLesson}
            </p>
            <p className="font-display text-lg font-extrabold">{live.name}</p>
            <p className="text-xs text-muted">{t.minutesLeft.replace("{n}", String(live.minutes))}</p>
          </div>
          {live.meetLink && (
            <a href={live.meetLink} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full bg-forest-mid px-5 font-display text-sm font-bold text-paper">
              {t.joinMeeting}
            </a>
          )}
        </section>
      )}
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{isTeacher ? t.scheduleHeading : t.weeklySchedule}</PanelTitle>
        </div>
        {!isTeacher && <Hint>{t.weeklyHint}</Hint>}
        {isTeacher && (
          <div className="mb-4 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0 text-sm font-bold">{t.classLabel}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(classes.data ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClassId(c.id);
                      setGroupId("");
                    }}
                    className={cn(
                      "h-9 rounded-lg px-3 font-display text-sm font-bold",
                      c.id === activeClass ? "bg-forest text-paper" : "bg-cream/80 text-ink hover:bg-cream",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
                {draft?.kind === "class" ? (
                  <input
                    autoFocus
                    value={draft.name}
                    placeholder={t.newClassPh}
                    onChange={(e) => setDraft({ kind: "class", name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDraft(null);
                      if (e.key === "Enter") {
                        const name = draft.name.trim();
                        if (name) addClassMut.mutate(name);
                      }
                    }}
                    className="h-9 w-44 rounded-lg border border-forest bg-surface px-3 text-sm text-ink outline-none"
                  />
                ) : (
                  <RoundBtn label={t.addClass} disabled={addClassMut.isPending} onClick={() => setDraft({ kind: "class", name: "" })}>
                    <Plus className="size-4" strokeWidth={2.4} />
                  </RoundBtn>
                )}
                <RoundBtn
                  label={t.deleteClass}
                  tone="danger"
                  disabled={(classes.data?.length ?? 0) <= 1 || delClass.isPending || !activeClass}
                  onClick={() => {
                    if (window.confirm(t.confirmDelete)) delClass.mutate();
                  }}
                >
                  <X className="size-4" strokeWidth={2.4} />
                </RoundBtn>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0 text-sm font-bold">{t.groupLabel}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupId(g.id)}
                    className={cn(
                      "h-9 rounded-lg px-3 font-display text-sm font-bold",
                      g.id === activeGroup ? "bg-forest text-paper" : "bg-cream/80 text-ink hover:bg-cream",
                    )}
                  >
                    {g.name}
                  </button>
                ))}
                {draft?.kind === "group" ? (
                  <input
                    autoFocus
                    value={draft.name}
                    placeholder={t.newGroupPh}
                    onChange={(e) => setDraft({ kind: "group", name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDraft(null);
                      if (e.key === "Enter") {
                        const name = draft.name.trim();
                        if (name) addGroupMut.mutate(name);
                      }
                    }}
                    className="h-9 w-44 rounded-lg border border-forest bg-surface px-3 text-sm text-ink outline-none"
                  />
                ) : (
                  <RoundBtn
                    label={t.addGroup}
                    disabled={!activeClass || addGroupMut.isPending}
                    onClick={() => setDraft({ kind: "group", name: "" })}
                  >
                    <Plus className="size-4" strokeWidth={2.4} />
                  </RoundBtn>
                )}
                <RoundBtn
                  label={t.deleteGroup}
                  tone="danger"
                  disabled={groups.length <= 1 || delGroup.isPending || !activeGroup}
                  onClick={() => {
                    if (window.confirm(t.confirmDelete)) delGroup.mutate();
                  }}
                >
                  <X className="size-4" strokeWidth={2.4} />
                </RoundBtn>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-cream/70 text-left">
                <th className="w-10 px-2 py-2 font-display text-xs font-extrabold text-muted">{t.periodNo}</th>
                <th className="w-36 px-2 py-2 font-display text-xs font-extrabold text-muted">{t.timeColumn}</th>
                {days.map((day) => (
                  <th
                    key={day}
                    className={cn(
                      "px-2 py-2 font-display text-xs font-extrabold",
                      day === today ? "text-forest" : "text-ink",
                    )}
                  >
                    {t.weekdaysShort[day as keyof typeof t.weekdaysShort]}
                    {dayCustom(day) ? <span className="ml-1 text-[10px] font-bold text-terracotta">*</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownPeriods.map((period) => {
                const time = shared(period);
                return (
                  <tr key={period} className="border-t border-hairline">
                    <td className="px-2 py-2 font-display font-extrabold text-muted">{period}</td>
                    <td className="px-2 py-2">
                      {editing && isTeacher && time ? (
                        <TimePair
                          key={`${period}-${time.startTime}-${time.endTime}`}
                          start={time.startTime}
                          end={time.endTime}
                          onCommit={(startTime, endTime) => setTime.mutate({ period, startTime, endTime })}
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted">
                          {time ? `${time.startTime}–${time.endTime}` : "—"}
                        </span>
                      )}
                    </td>
                    {days.map((day) => {
                      const row = cell(day, period);
                      const differs = row && time && (row.startTime !== time.startTime || row.endTime !== time.endTime);
                      return (
                        <td key={day} className={cn("px-2 py-2 align-top", day === today && "bg-forest/5")}>
                          {editing && isTeacher && row ? (
                            <Select
                              className="h-9 w-full min-w-[120px] rounded-xl"
                              value={row.subjectId ?? ""}
                              onChange={(e) => setSub.mutate({ entryId: row.id, subjectId: e.target.value || null })}
                            >
                              <option value="">—</option>
                              {(subjects.data?.subjects ?? []).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </Select>
                          ) : swap && isTeacher && row ? (
                            <Select
                              className="h-9 w-full min-w-[120px] rounded-xl"
                              value={row.overrideOn ? row.overrideSubjectId ?? "" : ""}
                              onChange={(e) => override.mutate({ entryId: row.id, subjectId: e.target.value || null })}
                            >
                              <option value="">{t.clearOverride}</option>
                              {(subjects.data?.subjects ?? []).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </Select>
                          ) : (
                            <div>
                              <p className="font-semibold">
                                {row?.shownSubjectName || row?.subjectName || "—"}
                                {row?.overrideOn ? <span className="ml-1 text-[10px] font-bold text-terracotta">*</span> : null}
                              </p>
                              {row?.room ? <p className="text-[11px] text-muted">{row.room}</p> : null}
                              {differs ? (
                                <p className="font-mono text-[11px] text-terracotta">
                                  {row.startTime}–{row.endTime}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {isTeacher && editing && (
                <tr className="border-t border-hairline">
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      title={t.addPeriod}
                      aria-label={t.addPeriod}
                      disabled={!activeClass || addPeriod.isPending}
                      onClick={() => addPeriod.mutate()}
                      className="grid size-8 place-items-center rounded-lg text-forest hover:bg-forest/10 disabled:opacity-40"
                    >
                      <Plus className="size-4" strokeWidth={2.6} />
                    </button>
                  </td>
                  <td colSpan={days.length + 1} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isTeacher && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <IconBtn
              label={editing ? t.applySchedule : t.editSchedule}
              active={editing}
              onClick={() => {
                setEditing((v) => !v);
                setSwap(false);
              }}
            >
              {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
            </IconBtn>
            <IconBtn
              label={t.copySchedule}
              disabled={!activeClass}
              onClick={() => {
                localStorage.setItem(
                  "kp-sched-clip",
                  JSON.stringify(entries.map((e) => ({ weekday: e.weekday, period: e.period, subjectId: e.subjectId }))),
                );
                toast.success(t.copiedSchedule);
              }}
            >
              <Copy className="size-4" />
            </IconBtn>
            <IconBtn
              label={t.pasteSchedule}
              disabled={!activeClass || paste.isPending}
              onClick={() => {
                const raw = localStorage.getItem("kp-sched-clip");
                if (!raw) return;
                paste.mutate(JSON.parse(raw) as { weekday: string; period: number; subjectId: string | null }[]);
              }}
            >
              <ClipboardPaste className="size-4" />
            </IconBtn>
            <IconBtn
              label={swap ? t.clearOverride : t.weekOverride}
              active={swap}
              onClick={() => {
                setSwap((v) => !v);
                setEditing(false);
              }}
            >
              <Replace className="size-4" />
            </IconBtn>
          </div>
        )}

        <div className="mt-4 border-t border-hairline pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setTimesOpen((v) => !v)}
            aria-expanded={timesOpen}
          >
            <span>
              <span className="block font-display text-base font-extrabold">{t.specialTimes}</span>
              {!timesOpen && <span className="text-xs text-muted">{t.specialTimesHint}</span>}
            </span>
            <ChevronDown className={cn("size-5 shrink-0 text-muted transition", timesOpen && "rotate-180")} />
          </button>
          {timesOpen && (
            <div className="mt-3 space-y-3">
              <Hint>{t.specialTimesHint}</Hint>
              {WEEKDAYS.filter((day) => isTeacher || dayCustom(day)).map((day) => {
                const on = dayCustom(day);
                return (
                  <div key={day} className="rounded-2xl bg-cream/50 px-3 py-3">
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!isTeacher || !activeClass || customDay.isPending}
                        onChange={(e) => {
                          if (!isTeacher) return;
                          customDay.mutate({ weekday: day, on: e.target.checked });
                        }}
                      />
                      {t.weekdays[day]}
                      <span className="font-medium text-muted">{on ? `· ${t.customDay}` : ""}</span>
                    </label>
                    {on && (
                      <div className="mt-2 space-y-2">
                        {shownPeriods.map((period) => {
                          const row = cell(day, period);
                          return (
                            <div key={period} className="flex flex-wrap items-center gap-2">
                              <span className="w-6 font-display text-sm font-extrabold text-muted">{period}</span>
                              <TimePair
                                key={`${day}-${period}-${row?.startTime ?? ""}-${row?.endTime ?? ""}`}
                                start={row?.startTime ?? shared(period)?.startTime ?? "08:30"}
                                end={row?.endTime ?? shared(period)?.endTime ?? "09:15"}
                                disabled={!isTeacher}
                                onCommit={(startTime, endTime) => setTime.mutate({ period, startTime, endTime, weekday: day })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                <li key={e.id} className="flex items-center justify-between rounded-xl bg-cream/60 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{e.name}</span>
                    <span className="ml-2 text-muted">
                      {t.weekdays[e.weekday as keyof typeof t.weekdays]} {e.startTime}–{e.endTime}
                    </span>
                  </span>
                  <button type="button" className="text-xs text-terracotta" onClick={() => delEl.mutate(e.id)}>
                    {t.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function RoundBtn({
  label,
  onClick,
  disabled,
  tone = "forest",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "forest" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg border bg-surface disabled:opacity-40",
        tone === "danger"
          ? "border-terracotta text-terracotta hover:bg-terracotta/10"
          : "border-forest text-forest hover:bg-forest/10",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-11 place-items-center rounded-xl border disabled:opacity-40",
        active ? "border-forest bg-forest text-paper" : "border-hairline bg-surface text-ink hover:border-forest hover:text-forest",
      )}
    >
      {children}
    </button>
  );
}

function TimePair({
  start,
  end,
  disabled,
  onCommit,
}: {
  start: string;
  end: string;
  disabled?: boolean;
  onCommit: (start: string, end: string) => void;
}) {
  const [a, setA] = useState(start);
  const [b, setB] = useState(end);
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="time"
        disabled={disabled}
        value={a}
        onChange={(e) => setA(e.target.value)}
        onBlur={() => {
          if (a && b && (a !== start || b !== end)) onCommit(a, b);
        }}
        className="h-8 rounded-lg border border-hairline bg-surface px-1 text-xs"
      />
      <span className="text-muted">–</span>
      <input
        type="time"
        disabled={disabled}
        value={b}
        onChange={(e) => setB(e.target.value)}
        onBlur={() => {
          if (a && b && (a !== start || b !== end)) onCommit(a, b);
        }}
        className="h-8 rounded-lg border border-hairline bg-surface px-1 text-xs"
      />
    </span>
  );
}
