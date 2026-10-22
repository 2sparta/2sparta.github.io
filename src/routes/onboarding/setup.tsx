import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthCard, AuthLayout, PrimaryButton } from "@/components/auth-layout";
import { RequireStep } from "@/components/session-gate";
import { completeSetup, listSubjects } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/cn";
import { signOutApp } from "@/lib/firebase";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";

export const Route = createFileRoute("/onboarding/setup")({ component: Page });

function Page() {
  return (
    <RequireStep allow={["setup"]}>
      <SetupScreen />
    </RequireStep>
  );
}

function SetupScreen() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const [name, setName] = useState("");
  const admin = false;
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const gate = typeof window !== "undefined" && hasGateSessionMarker();

  const mut = useMutation({
    mutationFn: () => completeSetup({ data: { displayName: name, isAdmin: admin, subjectIds: picked } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: "/app" });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NAME") setError(t.needName);
      else if (msg === "SUBJECTS") setError(t.needSubjects);
      else setError(msg);
    },
  });

  return (
    <AuthLayout variant="cream">
      <AuthCard>
        <h1 className="mb-2 text-center font-display text-[28px] font-extrabold text-ink">{t.setupHeading}</h1>
        <p className="mb-5 text-center text-sm text-muted">{t.setupHint}</p>
        <label className="mb-3 block">
          <span className="mb-1.5 block font-display text-sm font-bold">{t.setupName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.setupNamePh}
            className="h-12 w-full rounded-full border border-transparent bg-surface-2 px-4 text-[15px] outline-none focus:border-forest-mid/35 focus:bg-surface"
          />
        </label>
        {!admin && (
          <div className="mb-3">
            <p className="mb-2 font-display text-sm font-bold">{t.mySubjects}</p>
            <p className="mb-2 text-xs text-muted">{t.setupSubjectsHint}</p>
            <div className="flex flex-wrap gap-2">
              {(subjects.data?.subjects ?? []).map((s) => {
                const on = picked.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                    className={cn(
                      "rounded-full px-3 py-1.5 font-display text-xs font-bold",
                      on ? "bg-forest text-paper" : "bg-surface-2 text-ink",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <PrimaryButton type="button" disabled={mut.isPending} onClick={() => { setError(""); mut.mutate(); }}>
          {t.saveContinue}
        </PrimaryButton>
        {!gate && (
          <button type="button" className="mt-2 h-12 w-full font-display text-sm font-bold text-muted" onClick={() => void signOutApp()}>
            {t.logout}
          </button>
        )}
        {error && <p className="mt-2 text-center text-sm text-terracotta">{error}</p>}
      </AuthCard>
    </AuthLayout>
  );
}
