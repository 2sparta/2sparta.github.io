import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, School } from "lucide-react";
import { AuthCard, AuthLayout, PrimaryButton } from "@/components/auth-layout";
import { RequireStep } from "@/components/session-gate";
import { createSchool, joinSchool } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";

export const Route = createFileRoute("/onboarding/school")({ component: Page });

function Page() {
  return (
    <RequireStep allow={["school"]}>
      <SchoolScreen />
    </RequireStep>
  );
}

function SchoolScreen() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Ліцей №1");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const gate = typeof window !== "undefined" && hasGateSessionMarker();

  const mut = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        if (!name.trim()) throw new Error(t.needSchoolName);
        return createSchool({ data: { name } });
      }
      if (!code.trim()) throw new Error(t.needCode);
      return joinSchool({ data: { code } });
    },
    onSuccess: async (profile) => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: profile.setupComplete ? "/app" : "/onboarding/setup" });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "CODE_NOT_FOUND") setError(t.codeNotFound);
      else if (msg === "CODE_USED") setError(t.codeUsed);
      else setError(msg || t.codeNotFound);
    },
  });

  return (
    <AuthLayout variant="forest">
      <AuthCard>
        <h1 className="mb-2 text-center font-display text-[28px] font-extrabold text-ink">{t.schoolHeading}</h1>
        <p className="mb-5 text-center text-sm leading-relaxed text-muted">{t.schoolHint}</p>
        <p className="mb-2 font-display text-sm font-bold text-ink">{t.whatToDo}</p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Choice
            selected={mode === "create"}
            onSelect={() => setMode("create")}
            icon={<School className="size-6" />}
            title={t.createSchool}
            desc={t.createSchoolDesc}
          />
          <Choice
            selected={mode === "join"}
            onSelect={() => setMode("join")}
            icon={<Link2 className="size-6" />}
            title={t.joinSchool}
            desc={t.joinSchoolDesc}
          />
        </div>
        {mode === "create" ? (
          <label className="mb-3 block">
            <span className="mb-1.5 block font-display text-sm font-bold">{t.schoolName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.schoolNamePh}
              className="h-12 w-full rounded-full border border-transparent bg-paper-2 px-4 text-[15px] outline-none focus:border-forest-mid/35 focus:bg-white"
            />
          </label>
        ) : (
          <label className="mb-3 block">
            <span className="mb-1.5 block font-display text-sm font-bold">{t.inviteLabel}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.invitePh}
              maxLength={20}
              className="h-12 w-full rounded-full border border-transparent bg-paper-2 px-4 text-[15px] tracking-widest outline-none focus:border-forest-mid/35 focus:bg-white"
            />
          </label>
        )}
        <PrimaryButton type="button" disabled={mut.isPending} onClick={() => { setError(""); mut.mutate(); }}>
          {t.continueBtn}
        </PrimaryButton>
        {!gate && (
          <button
            type="button"
            className="mt-2 h-12 w-full rounded-full border-[1.5px] border-forest/30 font-display text-sm font-bold text-ink-soft"
            onClick={() => void signOut()}
          >
            {t.logout}
          </button>
        )}
        {error && <p className="mt-2 text-center text-sm text-terracotta">{error}</p>}
      </AuthCard>
    </AuthLayout>
  );
}

function Choice({
  selected,
  onSelect,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[20px] border-[1.5px] bg-paper p-4 text-left",
        selected
          ? "border-forest-mid bg-forest/[0.07] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-forest)_12%,transparent)]"
          : "border-hairline",
      )}
    >
      <span className="relative mb-2 flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-full border border-forest/20 text-forest-mid">{icon}</span>
        <span
          className={cn(
            "mt-1 size-4 rounded-full border-2",
            selected ? "border-forest-mid bg-forest-mid" : "border-muted/40",
          )}
        />
      </span>
      <span className="block font-display text-sm font-extrabold text-ink">{title}</span>
      <span className="mt-1 block text-xs leading-snug text-muted">{desc}</span>
    </button>
  );
}
