import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clubClusters, listClubs, pickClub } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export function ClubPlan() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const q = useQuery({ queryKey: ["clubs"], queryFn: () => listClubs() });
  const qc = useQueryClient();
  const pick = useMutation({
    mutationFn: (clubId: string) => pickClub({ data: { clubId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs"] }),
  });
  const me = useMeQuery();
  const canPick = me.data?.profile.role === "student";
  const joined = (q.data?.clubs ?? []).filter((c) => c.joined);
  const picks = q.data?.picks ?? {};
  if (joined.length === 0) return null;
  const groups = clubClusters(joined);

  return (
    <Panel>
      <PanelTitle>{t.tabClubs}</PanelTitle>
      <Hint>{t.clubsHint}</Hint>
      <div className="space-y-3">
        {groups.map((group) => {
          const key = group.map((c) => c.id).sort().join(",");
          const chosen = picks[key];
          const conflict = group.length > 1;
          return (
            <div key={key} className={cn("rounded-2xl px-3 py-2", conflict && !chosen ? "bg-forest/5" : "bg-cream/40")}>
              {conflict && <p className="mb-1 text-xs font-bold text-forest">{t.clubConflict}</p>}
              {group.map((c) => {
                const on = !conflict || chosen === c.id;
                return (
                  <div key={c.id} className={cn("flex flex-wrap items-center justify-between gap-2 py-1", conflict && chosen && !on && "opacity-50")}>
                    <span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="ml-2 text-sm text-muted">
                        {(c.sessions?.length ? c.sessions : [{ weekday: c.weekday, startTime: c.startTime, endTime: c.endTime }])
                          .map((s) => `${t.weekdaysShort[s.weekday as keyof typeof t.weekdaysShort] || s.weekday} ${s.startTime}–${s.endTime}`)
                          .join(" · ")}
                        {c.room ? ` · ${c.room}` : ""}
                      </span>
                    </span>
                    {conflict && canPick && (
                      <PillButton type="button" tone={on && chosen ? "primary" : "ghost"} disabled={pick.isPending} onClick={() => pick.mutate(c.id)}>
                        {on && chosen ? t.pickClub : t.pickClub}
                      </PillButton>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
