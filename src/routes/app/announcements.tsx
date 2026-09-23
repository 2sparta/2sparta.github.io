import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addAnnouncement, deleteAnnouncement, listAnnouncements, listClasses } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/announcements")({ component: Page });

function Page() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const list = useQuery({ queryKey: ["announcements"], queryFn: () => listAnnouncements() });
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses(), enabled: isTeacher });
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const add = useMutation({
    mutationFn: () => addAnnouncement({ data: { title, body, classIds } }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      setClassIds([]);
      await qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteAnnouncement({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div>
      {isTeacher && (
        <Panel>
          <PanelTitle>{t.addAnnouncement}</PanelTitle>
          <div className="grid gap-2">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.annTitle} />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.annBody}
              rows={4}
              className="rounded-2xl bg-paper-2 px-4 py-3 text-sm outline-none focus:bg-white"
            />
            <div className="flex flex-wrap gap-2">
              {(classes.data ?? []).map((c) => {
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
            <PillButton type="button" disabled={!title.trim() || !body.trim() || add.isPending} onClick={() => add.mutate()}>
              {t.add}
            </PillButton>
          </div>
        </Panel>
      )}
      <Panel>
        <PanelTitle>{t.announcements}</PanelTitle>
        {(list.data?.announcements ?? []).length === 0 ? (
          <Hint>{t.noAnn}</Hint>
        ) : (
          <ul className="space-y-3">
            {(list.data?.announcements ?? []).map((a) => (
              <li key={a.id} className="rounded-2xl bg-cream/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-extrabold">{a.title}</p>
                  {isTeacher && (
                    <button type="button" className="text-xs text-terracotta" onClick={() => del.mutate(a.id)}>
                      {t.delete}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {t.from} {a.authorName}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
