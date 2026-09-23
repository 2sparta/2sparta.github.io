import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthCard, AuthLayout, PrimaryButton, SecondaryButton } from "@/components/auth-layout";
import { RequireStep } from "@/components/session-gate";
import { enterDemoAsStudent, linkStudent } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";

export const Route = createFileRoute("/onboarding/link")({ component: Page });

function Page() {
  return (
    <RequireStep allow={["link"]}>
      <LinkScreen />
    </RequireStep>
  );
}

function LinkScreen() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const gate = typeof window !== "undefined" && hasGateSessionMarker();

  async function goHome() {
    await qc.invalidateQueries({ queryKey: ["me"] });
    await qc.invalidateQueries({ queryKey: ["home"] });
    await navigate({ to: "/app" });
  }

  const mut = useMutation({
    mutationFn: () => linkStudent({ data: { code } }),
    onSuccess: goHome,
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "CODE_USED" ? t.codeUsed : t.codeNotFound);
    },
  });
  const demo = useMutation({
    mutationFn: () => enterDemoAsStudent(),
    onSuccess: goHome,
    onError: (e) => setError(e instanceof Error ? e.message : t.codeNotFound),
  });

  return (
    <AuthLayout variant="forest">
      <AuthCard>
        <h1 className="mb-2 text-center font-display text-[28px] font-extrabold text-ink">{t.linkHeading}</h1>
        <p className="mb-5 text-center text-sm text-muted">{t.linkHint}</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.linkPh}
          className="mb-3 h-12 w-full rounded-full border border-transparent bg-paper-2 px-4 text-center text-[15px] tracking-widest outline-none focus:border-forest-mid/35 focus:bg-paper"
        />
        <PrimaryButton
          type="button"
          disabled={mut.isPending || demo.isPending}
          onClick={() => {
            setError("");
            mut.mutate();
          }}
        >
          {t.linkBtn}
        </PrimaryButton>
        <SecondaryButton type="button" disabled={mut.isPending || demo.isPending} onClick={() => demo.mutate()}>
          {t.demoStudent}
        </SecondaryButton>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted">{t.demoStudentHint}</p>
        {!gate && (
          <button type="button" className="mt-2 h-12 w-full font-display text-sm font-bold text-muted" onClick={() => void signOut()}>
            {t.logout}
          </button>
        )}
        {error && <p className="mt-2 text-center text-sm text-terracotta">{error}</p>}
      </AuthCard>
    </AuthLayout>
  );
}