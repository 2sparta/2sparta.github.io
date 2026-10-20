import { useSchoolSettings } from "@/components/school-settings-context";
import { canOffice } from "@/lib/school/settings";
import { useState } from "react";
import { HomeworkStream } from "@/components/homework-stream";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addClassHomework,
  deleteClassHomework,
  listClassHomework,
  listClassmates,
  setStudentPerms,
} from "@/lib/school/server";
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
  const { settings } = useSchoolSettings();
  const canPost =
    settings.studentHomework &&
    profile?.role === "student" &&
    (profile.isStarosta || profile.canPostHw || canOffice(settings, profile, "postHomework"));
  const isStarosta =
    settings.studentHomework &&
    Boolean(
      (settings.selfGovernment && profile?.isStarosta) ||
      canOffice(settings, profile ?? { role: null }, "manageHomeworkPermissions"),
    );
  const q = useQuery({ queryKey: ["class-homework"], queryFn: () => listClassHomework() });
  const mates = useQuery({
    queryKey: ["classmates"],
    queryFn: () => listClassmates(),
    enabled: isStarosta,
  });
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
            <TextInput
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder={t.subjectFree}
            />
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.annTitle}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.annBody}
              rows={3}
              className="rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none"
            />
            <label className="text-xs font-bold text-muted">
              {t.dueDate}
              <TextInput
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1"
              />
            </label>
            <PillButton
              type="button"
              disabled={!title.trim() || !subjectName.trim() || !due || add.isPending}
              onClick={() => add.mutate()}
            >
              {t.postHw}
            </PillButton>
          </div>
        )}
        <HomeworkStream
          uk={lang === "uk"}
          loading={q.isPending}
          error={q.isError || drop.isError || add.isError
            ? (lang === "uk" ? "Не вдалося завантажити або зберегти ДЗ. Повторіть спробу." : "Could not load or save homework. Please try again.")
            : undefined}
          onRetry={() => { add.reset(); drop.reset(); void q.refetch(); }}
          items={posts.map((p) => ({
            id: p.id, title: p.title, subject: p.subjectName, body: p.body,
            due: p.due || null, author: p.authorName,
            label: lang === "uk" ? "Дошка класу" : "Class board",
          }))}
          renderActions={(item) => {
            const post = posts.find((p) => p.id === item.id)!;
            return profile?.role === "teacher" || profile?.isStarosta || profile?.rosterId === post.authorRosterId
              ? <button type="button" className="text-terracotta" disabled={drop.isPending}
                  onClick={() => { if (window.confirm(lang === "uk" ? "Видалити це домашнє завдання?" : "Delete this homework?")) drop.mutate(item.id); }}>
                  {t.delete}
                </button>
              : null;
          }}
        />
      </Panel>
      {isStarosta && (
        <Panel>
          <PanelTitle>{t.studentRights}</PanelTitle>
          <Hint>{t.canPostHw}</Hint>
          <ul className="space-y-1">
            {(mates.data?.students ?? [])
              .filter((s) => s.id !== profile?.rosterId)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-cream/40 px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{s.name}</span>
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={s.canPostHw}
                      onChange={(e) =>
                        permit.mutate({ rosterId: s.id, canPostHw: e.target.checked })
                      }
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
