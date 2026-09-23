import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateTeacherInvite, listTeachers } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton } from "@/components/ui/panel";

export const Route = createFileRoute("/app/teachers")({ component: Page });

function Page() {
  const me = useMeQuery();
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const isAdmin = Boolean(me.data?.profile.isAdmin);
  const data = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers(), enabled: isAdmin || me.data?.profile.role === "teacher" });
  const qc = useQueryClient();
  const gen = useMutation({
    mutationFn: () => generateTeacherInvite(),
    onSuccess: async (res) => {
      toast.success(`${t.inviteCode}: ${res.code}`);
      try {
        await navigator.clipboard.writeText(res.code);
      } catch {
        /* ignore */
      }
      await qc.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  if (me.data && me.data.profile.role !== "teacher") return <Navigate to="/app" />;

  return (
    <div>
      {data.data?.isAdmin && (
        <>
          <Panel>
            <PanelTitle>{t.teachersInvite}</PanelTitle>
            <Hint>{t.teachersHint}</Hint>
            <PillButton type="button" disabled={gen.isPending} onClick={() => gen.mutate()}>
              {t.generateCode}
            </PillButton>
          </Panel>
          <Panel>
            <PanelTitle>{t.unusedCodes}</PanelTitle>
            {(data.data.invites ?? []).length === 0 ? (
              <Hint>{t.noInvites}</Hint>
            ) : (
              <ul className="space-y-2">
                {data.data.invites.map((i) => (
                  <li key={i.code} className="flex items-center justify-between rounded-xl bg-cream/50 px-3 py-2">
                    <code className="font-mono tracking-wider">{i.code}</code>
                    <button
                      type="button"
                      className="text-xs font-bold text-forest-mid"
                      onClick={() => {
                        void navigator.clipboard.writeText(i.code);
                        toast.success(t.codeCopied);
                      }}
                    >
                      {t.copied}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
      <Panel>
        <PanelTitle>{t.schoolTeachers}</PanelTitle>
        <ul className="space-y-2">
          {(data.data?.teachers ?? []).map((p) => (
            <li key={p.userId} className="flex items-center justify-between rounded-xl bg-cream/50 px-3 py-2">
              <span className="font-semibold">{p.displayName || p.userId}</span>
              <span className="text-xs font-bold text-muted">{p.isAdmin ? t.admin : t.teacher}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
