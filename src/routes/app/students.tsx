import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addStudent,
  adjustPoints,
  deleteStudent,
  listClasses,
  listLeaderboard,
  listPointsHistory,
  listStudents,
  setStarosta,
} from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";

export const Route = createFileRoute("/app/students")({ component: StudentsPage });

function StudentsPage() {
  const me = useMeQuery();
  if (me.data?.profile.role === "student") return <StudentPoints />;
  return <TeacherStudents />;
}

function StudentPoints() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const history = useQuery({ queryKey: ["points-history", "me"], queryFn: () => listPointsHistory() });
  const board = useQuery({ queryKey: ["leaderboard"], queryFn: () => listLeaderboard() });
  const [lbMode, setLbMode] = useState<"school" | "class">("class");
  const classId = me.data?.profile.classId;
  const rows = (board.data ?? []).filter((s) => lbMode === "school" || !classId || s.classId === classId);
  const points = me.data?.profile.points ?? 0;

  return (
    <div>
      <Panel>
        <PanelTitle>{t.tabPoints}</PanelTitle>
        <Hint>{t.pointsExplain}</Hint>
        <p className="font-display text-5xl font-extrabold tracking-tight text-forest">
          {points}
          <span className="ml-2 text-base font-bold text-muted">{t.pointsLabel}</span>
        </p>
      </Panel>
      <Panel>
        <PanelTitle>{t.pointsHistory}</PanelTitle>
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t.pointsHistoryEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {(history.data ?? []).map((item) => (
              <HistoryRow key={item.id} item={item} lang={lang} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <PanelTitle>{t.leaderboard}</PanelTitle>
        <Hint>{t.leaderboardHint}</Hint>
        <div className="mb-3 flex gap-2">
          <ModeButton active={lbMode === "class"} onClick={() => setLbMode("class")}>{t.lbClass}</ModeButton>
          <ModeButton active={lbMode === "school"} onClick={() => setLbMode("school")}>{t.lbSchool}</ModeButton>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t.noLeaderboard}</p>
        ) : (
          <ol className="space-y-1">
            {rows.slice(0, 15).map((s, i) => (
              <RankRow key={s.id} place={i + 1} name={s.name} points={s.points} extra={s.className} />
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function TeacherStudents() {
  const me = useMeQuery();
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const isTeacher = me.data?.profile.role === "teacher";
  const students = useQuery({ queryKey: ["students"], queryFn: () => listStudents(), enabled: isTeacher });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses(), enabled: isTeacher });
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("points");
  const [lbMode, setLbMode] = useState<"school" | "class">("school");
  const groups = (classes.data ?? []).find((c) => c.id === classId)?.groups ?? [];

  useEffect(() => {
    if (!classId && classes.data?.[0]?.id) setClassId(classes.data[0].id);
  }, [classId, classes.data]);

  const add = useMutation({
    mutationFn: () =>
      addStudent({ data: { name, classId: classId || classes.data?.[0]?.id || "", groupId: groupId || groups[0]?.id || null } }),
    onSuccess: async (res) => {
      setName("");
      toast.success(`${t.inviteCode}: ${res.inviteCode}`);
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
  const del = useMutation({
    mutationFn: (rosterId: string) => deleteStudent({ data: { rosterId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const list = useMemo(() => {
    let rows = students.data ?? [];
    if (q.trim()) rows = rows.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
    if (lbMode === "class" && classId) rows = rows.filter((s) => s.classId === classId);
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "uk");
      if (sort === "linked") return Number(Boolean(b.linkedUserId)) - Number(Boolean(a.linkedUserId));
      if (sort === "group") return (a.groupName || "").localeCompare(b.groupName || "", "uk") || a.name.localeCompare(b.name, "uk");
      return b.points - a.points;
    });
    return rows;
  }, [students.data, q, sort, lbMode, classId]);

  if (me.isPending) return <p className="pt-8 font-display text-lg font-bold text-muted">{t.loading}</p>;
  if (!isTeacher) return null;

  return (
    <div>
      <Panel>
        <PanelTitle>{t.leaderboard}</PanelTitle>
        <Hint>{t.pointsExplain}</Hint>
        <div className="mb-3 flex gap-2">
          <ModeButton active={lbMode === "school"} onClick={() => setLbMode("school")}>{t.lbSchool}</ModeButton>
          <ModeButton active={lbMode === "class"} onClick={() => setLbMode("class")}>{t.lbClass}</ModeButton>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.noLeaderboard}</p>
        ) : (
          <ol className="space-y-1">
            {list.slice(0, 10).map((s, i) => (
              <RankRow key={s.id} place={i + 1} name={s.name} points={s.points} ranked={sort === "points"} />
            ))}
          </ol>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t.addStudent}</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t.studentName} />
          <Select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setGroupId("");
            }}
          >
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={groupId || groups[0]?.id || ""} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
          <PillButton type="button" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            {t.add}
          </PillButton>
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <PanelTitle>{t.studentsList}</PanelTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">{t.sortName}</option>
              <option value="points">{t.sortPoints}</option>
              <option value="linked">{t.sortLinked}</option>
              <option value="group">{t.sortGroup}</option>
            </Select>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchName} />
          </div>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{q ? t.noMatches : t.noStudents}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((s) => (
              <TeacherRow
                key={s.id}
                student={s}
                lang={lang}
                onDelete={() => del.mutate(s.id)}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function RankRow({ place, name, points, extra, ranked = true }: { place: number; name: string; points: number; extra?: string; ranked?: boolean }) {
  const medal = ranked && place === 1 ? "gold" : ranked && place === 2 ? "silver" : ranked && place === 3 ? "bronze" : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        medal === "gold"
          ? "bg-medal-gold-bg"
          : medal === "silver"
            ? "bg-medal-silver-bg"
            : medal === "bronze"
              ? "bg-medal-bronze-bg"
              : "bg-cream/70"
      }`}
    >
      <span
        className={`grid size-7 place-items-center rounded-full font-display text-sm font-extrabold ${
          medal === "gold"
            ? "bg-medal-gold text-medal-ink"
            : medal === "silver"
              ? "bg-medal-silver text-medal-ink"
              : medal === "bronze"
                ? "bg-medal-bronze text-medal-ink"
                : "text-muted"
        }`}
      >
        {place}
      </span>
      <span className="flex-1 font-semibold text-ink">{name}</span>
      {extra && <span className="text-xs text-ink-soft">{extra}</span>}
      <span
        className={`font-display font-extrabold ${
          medal === "gold" ? "text-medal-gold" : medal === "silver" ? "text-medal-silver" : medal === "bronze" ? "text-medal-bronze" : "text-ink"
        }`}
      >
        {points}
      </span>
    </li>
  );
}

function TeacherRow({
  student,
  lang,
  onDelete,
}: {
  student: {
    id: string;
    name: string;
    className: string;
    points: number;
    inviteCode: string;
    linkedUserId: string | null;
    isStarosta: boolean;
    groupName: string | null;
  };
  lang: "uk" | "en";
  onDelete: () => void;
}) {
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ["points-history", student.id],
    queryFn: () => listPointsHistory({ data: { rosterId: student.id } }),
    enabled: open,
  });
  const pts = useMutation({
    mutationFn: (delta: number) => adjustPoints({ data: { rosterId: student.id, delta, note } }),
    onSuccess: async () => {
      setNote("");
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
      await qc.invalidateQueries({ queryKey: ["points-history", student.id] });
      await qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
  const n = Number(amount);
  const star = useMutation({
    mutationFn: (on: boolean) => setStarosta({ data: { rosterId: student.id, on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
  const locale = lang === "uk" ? "uk-UA" : "en-GB";

  return (
    <li className="rounded-2xl border border-hairline bg-cream/40 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <p className="font-display font-extrabold">
            {student.name} {student.isStarosta && <span className="ml-1 text-xs font-bold text-terracotta">{t.starosta}</span>}
          </p>
          <p className="text-xs text-muted">
            {student.className}
            {student.groupName ? ` · ${student.groupName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-8 place-items-center rounded-full bg-surface" onClick={() => pts.mutate(-1)} aria-label="-1">
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center font-display font-extrabold">{student.points}</span>
          <button type="button" className="grid size-8 place-items-center rounded-full bg-surface" onClick={() => pts.mutate(1)} aria-label="+1">
            <Plus className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          className="rounded-full bg-surface px-3 py-1 font-mono text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(student.inviteCode);
            toast.success(t.copied);
          }}
        >
          {student.inviteCode}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${student.linkedUserId ? "bg-sage/20 text-forest" : "bg-surface-2 text-muted"}`}>
          {student.linkedUserId ? t.linked : t.pending}
        </span>
        <button type="button" className="text-xs font-bold text-forest" onClick={() => star.mutate(!student.isStarosta)}>
          {student.isStarosta ? t.unsetStarosta : t.makeStarosta}
        </button>
        <button type="button" className="text-xs font-bold text-forest" onClick={() => setOpen((v) => !v)}>
          {t.pointsHistory}
        </button>
        <button type="button" className="text-xs text-terracotta" onClick={onDelete}>
          {t.delete}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TextInput
          className="h-9 w-24"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={t.pointsAmount}
        />
        <TextInput className="h-9 min-w-[180px] flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.pointsNotePh} />
        <PillButton
          type="button"
          disabled={!Number.isFinite(n) || n === 0 || pts.isPending}
          onClick={() => pts.mutate(n)}
        >
          {t.pointsApply}
        </PillButton>
      </div>
      {open && (
        <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
          {(history.data ?? []).length === 0 ? (
            <li className="text-sm text-muted">{t.pointsHistoryEmpty}</li>
          ) : (
            (history.data ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className={`font-display font-extrabold ${item.delta > 0 ? "text-forest" : "text-terracotta"}`}>
                  {item.delta > 0 ? "+" : ""}
                  {item.delta}
                </span>
                <span className="text-muted">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : ""}
                  {item.byName ? ` · ${item.byName}` : ""}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function HistoryRow({
  item,
  lang,
}: {
  item: { id: string; delta: number; note: string; byName: string; createdAt: number };
  lang: "uk" | "en";
}) {
  const locale = lang === "uk" ? "uk-UA" : "en-GB";
  return (
    <li className="flex items-baseline gap-3 rounded-xl bg-cream/50 px-3 py-2 text-sm">
      <span className={`w-12 font-display text-lg font-extrabold ${item.delta > 0 ? "text-forest" : "text-terracotta"}`}>
        {item.delta > 0 ? "+" : ""}
        {item.delta}
      </span>
      <span className="text-muted">
        {item.createdAt
          ? new Date(item.createdAt).toLocaleString(locale, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
        {item.byName ? ` · ${item.byName}` : ""}
        {item.note ? ` — ${item.note}` : ""}
      </span>
    </li>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-forest text-paper" : "bg-surface-2"}`}
    >
      {children}
    </button>
  );
}
