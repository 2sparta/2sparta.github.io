import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { addStudent, adjustPoints, deleteStudent, listClasses, listStudents } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";

export const Route = createFileRoute("/app/students")({ component: StudentsPage });

function StudentsPage() {
  const me = useMeQuery();
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const isTeacher = me.data?.profile.role === "teacher";
  const students = useQuery({ queryKey: ["students"], queryFn: () => listStudents(), enabled: isTeacher });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses(), enabled: isTeacher });
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("points");
  const [lbMode, setLbMode] = useState<"school" | "class">("school");

  useEffect(() => {
    if (!classId && classes.data?.[0]?.id) setClassId(classes.data[0].id);
  }, [classId, classes.data]);

  const add = useMutation({
    mutationFn: () => addStudent({ data: { name, classId: classId || classes.data?.[0]?.id || "" } }),
    onSuccess: async (res) => {
      setName("");
      toast.success(`${t.inviteCode}: ${res.inviteCode}`);
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
  const pts = useMutation({
    mutationFn: (d: { rosterId: string; delta: number }) => adjustPoints({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
  const del = useMutation({
    mutationFn: (rosterId: string) => deleteStudent({ data: { rosterId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });

  const list = useMemo(() => {
    let rows = students.data ?? [];
    if (q.trim()) rows = rows.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
    if (lbMode === "class" && classId) rows = rows.filter((s) => s.classId === classId);
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "uk");
      if (sort === "linked") return Number(Boolean(b.linkedUserId)) - Number(Boolean(a.linkedUserId));
      return b.points - a.points;
    });
    return rows;
  }, [students.data, q, sort, lbMode, classId]);

  if (me.data && me.data.profile.role !== "teacher") return <Navigate to="/app" />;

  return (
    <div>
      <Panel>
        <PanelTitle>{t.leaderboard}</PanelTitle>
        <Hint>{t.leaderboardHint}</Hint>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setLbMode("school")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${lbMode === "school" ? "bg-forest text-paper" : "bg-paper-2"}`}>
            {t.lbSchool}
          </button>
          <button type="button" onClick={() => setLbMode("class")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${lbMode === "class" ? "bg-forest text-paper" : "bg-paper-2"}`}>
            {t.lbClass}
          </button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.noLeaderboard}</p>
        ) : (
          <ol className="space-y-1">
            {list.slice(0, 10).map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl bg-cream/50 px-3 py-2">
                <span className="w-6 font-display font-extrabold text-muted">{i + 1}</span>
                <span className="flex-1 font-semibold">{s.name}</span>
                <span className="font-display font-extrabold">{s.points}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t.addStudent}</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t.studentName} />
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
            </Select>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchName} />
          </div>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{q ? t.noMatches : t.noStudents}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-cream/40 px-3 py-3">
                <div className="min-w-[160px] flex-1">
                  <p className="font-display font-extrabold">
                    {s.name} {s.isStarosta && <span className="ml-1 text-xs font-bold text-terracotta">{t.starosta}</span>}
                  </p>
                  <p className="text-xs text-muted">{s.className}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="grid size-8 place-items-center rounded-full bg-paper" onClick={() => pts.mutate({ rosterId: s.id, delta: -1 })}>
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-10 text-center font-display font-extrabold">{s.points}</span>
                  <button type="button" className="grid size-8 place-items-center rounded-full bg-paper" onClick={() => pts.mutate({ rosterId: s.id, delta: 1 })}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-paper px-3 py-1 font-mono text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(s.inviteCode);
                    toast.success(t.copied);
                  }}
                >
                  {s.inviteCode}
                </button>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.linkedUserId ? "bg-sage/20 text-forest" : "bg-paper-2 text-muted"}`}>
                  {s.linkedUserId ? t.linked : t.pending}
                </span>
                <button type="button" className="text-xs text-terracotta" onClick={() => del.mutate(s.id)}>
                  {t.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
