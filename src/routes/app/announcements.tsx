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
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [important, setImportant] = useState(false);
  const add = useMutation({
    mutationFn: () => addAnnouncement({ data: { title, body, classIds, important } }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      setClassIds([]);
      setImportant(false);
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
              className="rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none focus:bg-surface"
            />
            <p className="text-xs font-bold text-muted">{t.annPickClass}</p>
            <div className="flex flex-wrap gap-2">
              {(classes.data ?? []).map((c) => {
                const on = classIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClassIds((cur) => (on ? cur.filter((id) => id !== c.id) : [...cur, c.id]))}
                    className={cn("rounded-full px-3 py-1 text-xs font-bold", on ? "bg-forest text-paper" : "bg-surface-2 text-ink")}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            {classIds.length === 0 && <p className="text-xs text-muted">{t.annNeedClass}</p>}
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
              {t.annImportant}
            </label>
            <PillButton type="button" disabled={classIds.length === 0 || !title.trim() || !body.trim() || add.isPending} onClick={() => add.mutate()}>
              {t.add}
            </PillButton>
          </div>
        </Panel>
      )}
      <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">{t.announcements}</h2>
      {(list.data?.announcements ?? []).length === 0 ? (
        <Hint>{t.noAnn}</Hint>
      ) : (
        <ul className="space-y-3">
          {(list.data?.announcements ?? []).map((a) => (
            <WideNotice
              key={a.id}
              title={a.title}
              body={a.body}
              meta={`${t.from} ${a.authorName}${classNames(classes.data, a.classIds)}`}
              important={a.important}
              importantLabel={t.annImportant}
              onDelete={isTeacher ? () => del.mutate(a.id) : undefined}
              deleteLabel={t.delete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function classNames(classes: { id: string; name: string }[] | undefined, ids: string[]) {
  const names = ids.map((id) => classes?.find((c) => c.id === id)?.name).filter(Boolean);
  return names.length ? ` · ${names.join(", ")}` : "";
}

export function WideNotice({
  title,
  body,
  meta,
  accent = "bg-forest",
  important = false,
  importantLabel,
  onDelete,
  deleteLabel,
}: {
  title: string;
  body: string;
  meta: string;
  accent?: string;
  important?: boolean;
  importantLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <li className="relative flex w-full overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-soft)]">
      {!important && <span className="pointer-events-none absolute inset-0 rounded-[22px] border border-hairline" />}
      {important && (
        <div className="pointer-events-none absolute z-0 overflow-hidden rounded-r-[12px]" style={{ top: 10, right: 10, bottom: 10, left: 29 }}>
          <div
            className="medal-ring"
            style={{
              background: "conic-gradient(from 0deg, #fff4c4, #e0b43a, #8a6410, #fff8dc, #c9962a, #fff4c4)",
              width: "220%",
              height: "auto",
              aspectRatio: "1",
            }}
          />
          <div className="absolute top-[2.5px] right-[2.5px] bottom-[2.5px] left-0 rounded-r-[10px] bg-surface" />
        </div>
      )}
      <div className={`relative z-[1] w-[30px] shrink-0 ${accent}`} />
      <div className={cn("relative z-[1] min-w-0 flex-1 px-5 py-4 sm:px-6", important && "py-6 pr-7")}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-extrabold tracking-tight">
            {title}
            {important && importantLabel && (
              <span className="ml-2 align-middle text-xs font-extrabold tracking-wide text-[#a8841a] uppercase">{importantLabel}</span>
            )}
          </h3>
          {onDelete && (
            <button type="button" className="shrink-0 text-xs text-terracotta" onClick={onDelete}>
              {deleteLabel}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{meta}</p>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{body}</p>
      </div>
    </li>
  );
}
