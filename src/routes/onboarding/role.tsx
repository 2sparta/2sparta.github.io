import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, School } from "lucide-react";
import { AuthCard, AuthLayout, PrimaryButton, SecondaryButton } from "@/components/auth-layout";
import { RequireStep } from "@/components/session-gate";
import { chooseRole, enterDemoAsStudent } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/onboarding/role")({ component: Page });

function Page() {
  return (
    <RequireStep allow={["role"]}>
      <RoleScreen />
    </RequireStep>
  );
}

function RoleScreen() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const intended =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("kp-intended-role") as "teacher" | "student" | null)
      : null;
  const [role, setRole] = useState<"teacher" | "student">(intended ?? "teacher");
  const mut = useMutation({
    mutationFn: () => chooseRole({ data: { role } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: role === "teacher" ? "/onboarding/school" : "/onboarding/link" });
    },
  });
  const demo = useMutation({
    mutationFn: () => enterDemoAsStudent(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
      await navigate({ to: "/app" });
    },
  });

  return (
    <AuthLayout variant="forest">
      <AuthCard>
        <h1 className="mb-2 text-center font-display text-[28px] font-extrabold text-ink">{t.roleHeading}</h1>
        <p className="mb-5 text-center text-sm text-muted">{t.roleHint}</p>
        <p className="mb-2 font-display text-sm font-bold text-ink">{t.whatToDo}</p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <RoleCard
            selected={role === "teacher"}
            onSelect={() => setRole("teacher")}
            icon={<School className="size-6" />}
            title={t.iAmTeacher}
            desc={t.iAmTeacherDesc}
          />
          <RoleCard
            selected={role === "student"}
            onSelect={() => setRole("student")}
            icon={<GraduationCap className="size-6" />}
            title={t.iAmStudent}
            desc={t.iAmStudentDesc}
          />
        </div>
        <PrimaryButton type="button" disabled={mut.isPending || demo.isPending} onClick={() => mut.mutate()}>
          {t.continueBtn}
        </PrimaryButton>
        <SecondaryButton type="button" disabled={mut.isPending || demo.isPending} onClick={() => demo.mutate()}>
          {t.demoStudent}
        </SecondaryButton>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted">{t.demoStudentHint}</p>
        {mut.error && <p className="mt-2 text-center text-sm text-terracotta">{mut.error.message}</p>}
        {demo.error && <p className="mt-2 text-center text-sm text-terracotta">{demo.error.message}</p>}
      </AuthCard>
    </AuthLayout>
  );
}

function RoleCard({
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
        "rounded-[20px] border-[1.5px] bg-surface p-4 text-left transition",
        selected
          ? "border-forest-mid bg-forest/[0.07] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-forest)_12%,transparent)]"
          : "border-hairline",
      )}
    >
      <span className="mb-2 grid size-10 place-items-center rounded-full border border-forest/20 text-forest-mid">
        {icon}
      </span>
      <span className="block font-display text-sm font-extrabold text-ink">{title}</span>
      <span className="mt-1 block text-xs leading-snug text-muted">{desc}</span>
    </button>
  );
}