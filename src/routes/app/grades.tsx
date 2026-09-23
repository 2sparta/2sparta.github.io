import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listGrades, listStudents, listSubjects, setGrade } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
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
  const add = useMutation({
    mutationFn: () =>
      setGrade({
        data: {
          rosterId,
          subjectId: subjectId || subjects.data?.subjects[0]?.id || "",
          kind: "lesson",
          value,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });

  const grades = gradesQ.data?.grades ?? [];
  const numeric = grades.filter((g) => /^\d+$/.test(g.value)).map((g) => ({ ...g, n: Number(g.value) }));
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
            <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="1–12 / Н" className="w-24" />
            <PillButton type="button" disabled={!rosterId || add.isPending} onClick={() => add.mutate()}>
              {t.save}
            </PillButton>
          </div>
        )}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini label={t.overallAvg} value={numeric.length ? avg.toFixed(1) : "—"} extra={t.ofMax} />
          <Mini label={t.gradesCount} value={String(grades.length)} />
          <Mini label={t.absences} value={String(absences)} />
          <Mini label={t.bestSubject} value={best?.name ?? "—"} />
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
      </Panel>
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
                    <td>{g.kind === "homework" ? t.gradeHw : t.gradeLesson}</td>
                    <td className="font-display font-extrabold">{g.value}</td>
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
