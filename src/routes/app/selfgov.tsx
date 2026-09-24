import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { announceElection, closeElection, getElection, listActivities, listClasses, addActivity, deleteActivity, runForElection, voteElection } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";
import { WideNotice } from "@/routes/app/announcements";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/selfgov")({ component: Page });

function Page() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const classes = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const [classId, setClassId] = useState(me.data?.profile.classId ?? "");
  const active = classId || me.data?.profile.classId || classes.data?.[0]?.id || "";
  const el = useQuery({
    queryKey: ["election", active],
    queryFn: () => getElection({ data: { classId: active } }),
    enabled: Boolean(active),
  });
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hist, setHist] = useState(false);
  const [actTitle, setActTitle] = useState("");
  const [actBody, setActBody] = useState("");
  const [actClasses, setActClasses] = useState<string[]>([]);
  const [actImportant, setActImportant] = useState(false);
  const isStarosta = me.data?.profile.role === "student" && me.data.profile.isStarosta;
  const canPost = isTeacher || isStarosta;
  const postIds = isTeacher ? actClasses : me.data?.profile.classId ? [me.data.profile.classId] : [];
  const activities = useQuery({
    queryKey: ["activities", active],
    queryFn: () => listActivities({ data: { classId: active } }),
    enabled: Boolean(active),
  });

  const announce = useMutation({
    mutationFn: () => announceElection({ data: { classId: active, startsAt: start, endsAt: end } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["election"] }),
  });
  const run = useMutation({
    mutationFn: () => runForElection({ data: { electionId: el.data?.election?.id ?? "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["election"] }),
  });
  const vote = useMutation({
    mutationFn: (candidateId: string) => voteElection({ data: { electionId: el.data?.election?.id ?? "", candidateId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["election"] }),
  });
  const close = useMutation({
    mutationFn: () => closeElection({ data: { electionId: el.data?.election?.id ?? "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["election"] }),
  });
  const publish = useMutation({
    mutationFn: () => addActivity({ data: { classIds: postIds, title: actTitle, body: actBody, important: actImportant } }),
    onSuccess: async () => {
      setActTitle("");
      setActBody("");
      setActImportant(false);
      await qc.invalidateQueries({ queryKey: ["activities", active] });
    },
  });
  const dropAct = useMutation({
    mutationFn: (id: string) => deleteActivity({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });

  const election = el.data?.election;
  const now = Date.now();
  const phase = !election
    ? null
    : new Date(election.startsAt).getTime() > now
      ? "candidacy"
      : "voting";

  const totalVotes = election?.candidates.reduce((a, c) => a + c.votes, 0) ?? 0;

  return (
    <div>
      <Panel>
        <PanelTitle>{t.selfGov}</PanelTitle>
        <Hint>{isTeacher ? t.selfGovTeacherHint : t.selfGovStudentHint}</Hint>
        {isTeacher && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{t.classLabel}:</span>
            <Select value={active} onChange={(e) => setClassId(e.target.value)}>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        )}
        {isTeacher && !election && (
          <div className="mb-4 grid gap-2 md:grid-cols-2">
            <label className="text-xs font-bold">
              {t.startAt}
              <TextInput type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block w-full" />
            </label>
            <label className="text-xs font-bold">
              {t.endAt}
              <TextInput type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block w-full" />
            </label>
            <PillButton type="button" disabled={!start || !end || announce.isPending} onClick={() => announce.mutate()}>
              {t.announceElection}
            </PillButton>
          </div>
        )}
        {!election && <p className="text-sm text-muted">{t.noElection}</p>}
        {election && (
          <div>
            <p className="mb-3 font-display font-bold text-forest-mid">
              {phase === "candidacy" ? t.phaseCandidacy : t.phaseVoting}
            </p>
            {totalVotes > 0 && (
              <div
                className="mx-auto mb-4 size-36 rounded-full"
                style={{
                  background: `conic-gradient(${election.candidates
                    .map((c, i, arr) => {
                      const colors = [
                        "var(--color-forest-mid)",
                        "var(--color-terracotta)",
                        "var(--color-sage)",
                        "var(--color-leaf-tan)",
                        "var(--color-forest)",
                      ];
                      const startPct = arr.slice(0, i).reduce((a, x) => a + x.votes, 0) / totalVotes;
                      const endPct = startPct + c.votes / totalVotes;
                      return `${colors[i % colors.length]} ${startPct * 360}deg ${endPct * 360}deg`;
                    })
                    .join(",")})`,
                }}
              />
            )}
            <p className="mb-2 font-bold">{t.candidates}</p>
            {election.candidates.length === 0 && <p className="text-sm text-muted">{t.noCandidates}</p>}
            <ul className="space-y-2">
              {election.candidates.map((c) => (
                <li key={c.rosterId} className="flex items-center justify-between rounded-xl bg-cream/50 px-3 py-2">
                  <span className="font-semibold">{c.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm text-muted">
                      {c.votes} {t.votes}
                    </span>
                    {!isTeacher && phase === "voting" && (
                      <PillButton type="button" tone={election.myVote === c.rosterId ? "primary" : "ghost"} onClick={() => vote.mutate(c.rosterId)}>
                        {t.vote}
                      </PillButton>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {!isTeacher && phase === "candidacy" && !election.myCandidate && (
              <PillButton className="mt-3" type="button" onClick={() => run.mutate()}>
                {t.runFor}
              </PillButton>
            )}
            {isTeacher && (
              <PillButton className="mt-3" tone="ghost" type="button" onClick={() => close.mutate()}>
                {t.closeNow}
              </PillButton>
            )}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelTitle>{t.activityTitle}</PanelTitle>
        <Hint>{t.activityHint}</Hint>
        {canPost && (
          <div className="mb-4 grid gap-2">
            {isTeacher ? (
              <>
                <p className="text-xs font-bold text-muted">{t.annPickClass}</p>
                <div className="flex flex-wrap gap-2">
                  {(classes.data ?? []).map((c) => {
                    const on = actClasses.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActClasses((cur) => (on ? cur.filter((id) => id !== c.id) : [...cur, c.id]))}
                        className={cn("rounded-full px-3 py-1 text-xs font-bold", on ? "bg-forest text-paper" : "bg-surface-2 text-ink")}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs font-bold text-muted">
                {t.annPickClass}: {me.data?.profile.className || "—"}
              </p>
            )}
            {postIds.length === 0 && <p className="text-xs text-muted">{t.annNeedClass}</p>}
            <TextInput value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder={t.activityPhTitle} />
            <textarea
              value={actBody}
              onChange={(e) => setActBody(e.target.value)}
              placeholder={t.activityPhBody}
              rows={3}
              className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink outline-none focus:bg-surface"
            />
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={actImportant} onChange={(e) => setActImportant(e.target.checked)} />
              {t.annImportant}
            </label>
            <PillButton type="button" disabled={postIds.length === 0 || !actTitle.trim() || !actBody.trim() || publish.isPending} onClick={() => publish.mutate()}>
              {t.activityPublish}
            </PillButton>
          </div>
        )}
        {!canPost && <p className="mb-3 text-xs text-muted">{t.activityCanPost}</p>}
      </Panel>
      {(activities.data?.activities ?? []).length === 0 ? (
        <p className="mb-4 text-sm text-muted">{t.activityEmpty}</p>
      ) : (
        <ul className="mb-4 space-y-3">
            {(activities.data?.activities ?? []).map((a) => {
              const names = (a.classIds?.length ? a.classIds : [a.classId])
                .map((id) => (classes.data ?? []).find((c) => c.id === id)?.name)
                .filter(Boolean)
                .join(", ");
              return (
                <WideNotice
                  key={a.id}
                  title={a.title}
                  body={a.body}
                  important={a.important}
                  importantLabel={t.annImportant}
                  meta={`${t.from} ${a.authorName}${names ? ` · ${names}` : ""}${
                    a.createdAt
                      ? ` · ${new Date(a.createdAt).toLocaleString(lang === "uk" ? "uk-UA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                      : ""
                  }`}
                  onDelete={isTeacher || a.authorId === me.data?.profile.userId ? () => dropAct.mutate(a.id) : undefined}
                  deleteLabel={t.delete}
                />
              );
            })}
          </ul>
      )}
      <Panel>
        <div className="flex items-center justify-between">
          <PanelTitle>{t.history}</PanelTitle>
          <PillButton tone="ghost" type="button" onClick={() => setHist((v) => !v)}>
            {hist ? t.collapse : t.expand}
          </PillButton>
        </div>
        {hist && (
          (el.data?.history ?? []).length === 0 ? (
            <Hint>{t.noHistory}</Hint>
          ) : (
            <ul className="mt-2 space-y-2">
              {(el.data?.history ?? []).map((h) => (
                <li key={h.id} className="rounded-xl bg-cream/50 px-3 py-2 text-sm">
                  {t.winner}: {h.candidates.find((c) => c.rosterId === h.winnerRosterId)?.name ?? "—"}
                </li>
              ))}
            </ul>
          )
        )}
      </Panel>
    </div>
  );
}
