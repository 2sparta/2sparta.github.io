import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addClassHomework, deleteClassHomework, listClassHomework, listClassmates, setStudentPerms } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, TextInput } from "@/components/ui/panel";

export const Route = createFileRoute("/app/homework")({ component: HomeworkPage });

function HomeworkPage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const profile = me.data?.profile;
  const canPost = profile?.role === "student" && (profile.isStarosta || profile.canPostHw);
  const isStarosta = Boolean(profile?.isStarosta);
  const q = useQuery({ queryKey: ["class-homework"], queryFn: () => listClassHomework() });
  const mates = useQuery({ queryKey: ["classmates"], queryFn: () => listClassmates(), enabled: isStarosta });
  const qc = useQueryClient();
  const [subjectName, setSubjectName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const add = useMutation({
    mutationFn: () => addClassHomework({ data: { subjectName, title, body, due } }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["class-homework"] });
    },
  });
  const drop = useMutation({
    mutationFn: (id: string) => deleteClassHomework({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-homework"] }),
  });
  const permit = useMutation({
    mutationFn: (d: { rosterId: string; canPostHw: boolean }) => setStudentPerms({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classmates"] }),
  });
  const posts = q.data?.posts ?? [];

  return (
    <div>
      <Panel>
        <PanelTitle>{t.hwBoard}</PanelTitle>
        <Hint>{t.hwBoardHint}</Hint>
        {canPost && (
          <div className="mb-4 grid gap-2">
            <TextInput value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder={t.subjectFree} />
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.annTitle} />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.annBody}
              rows={3}
              className="rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none"
            />
            <label className="text-xs font-bold text-muted">
              {t.dueDate}
              <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
            </label>
            <PillButton type="button" disabled={!title.trim() || !subjectName.trim() || !due || add.isPending} onClick={() => add.mutate()}>
              {t.postHw}
            </PillButton>
          </div>
        )}
        {posts.length === 0 ? (
          <p className="text-sm text-muted">{t.empty}</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="rounded-2xl border border-hairline bg-cream/40 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-extrabold">{p.title}</p>
                    <p className="text-xs font-bold text-forest-mid">{p.subjectName}{p.due ? ` · ${t.dueDate} ${p.due}` : ""}</p>
                    {p.body && <p className="mt-1 text-sm">{p.body}</p>}
                    <p className="mt-1 text-xs text-muted">{p.authorName}</p>
                  </div>
                  {(profile?.role === "teacher" || profile?.isStarosta || profile?.rosterId === p.authorRosterId) && (
                    <button type="button" className="text-xs font-bold text-terracotta" onClick={() => drop.mutate(p.id)}>{t.delete}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {isStarosta && (
        <Panel>
          <PanelTitle>{t.studentRights}</PanelTitle>
          <Hint>{t.canPostHw}</Hint>
          <ul className="space-y-1">
            {(mates.data?.students ?? []).filter((s) => s.id !== profile?.rosterId).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl bg-cream/40 px-3 py-2 text-sm">
                <span className="font-semibold">{s.name}</span>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={s.canPostHw}
                    onChange={(e) => permit.mutate({ rosterId: s.id, canPostHw: e.target.checked })}
                  />
                  {t.canPostHw}
                </label>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
