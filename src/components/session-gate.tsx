import { useEffect, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMe } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { AuthCard, AuthLayout } from "@/components/auth-layout";
import { usePrefs } from "@/lib/prefs";

export function useMeQuery(enabled = true) {
  const { user, isPending } = useCurrentUserState();
  return {
    user,
    authPending: isPending,
    ...useQuery({
      queryKey: ["me"],
      queryFn: () => getMe(),
      enabled: enabled && !isPending && Boolean(user),
    }),
  };
}

export function SignedOutToLogin({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const { lang } = usePrefs();
  if (isPending) return <Splash text={STRINGS[lang].loading} />;
  if (!user) return <RedirectToSignIn to="/login" />;
  return <>{children}</>;
}

export function RouteByProfile() {
  const { user, isPending } = useCurrentUserState();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: !isPending && Boolean(user),
  });
  const { lang } = usePrefs();

  if (isPending) return <Splash text={STRINGS[lang].loading} />;
  if (!user) return <RedirectToSignIn to="/login" />;
  if (me.isPending) return <Splash text={STRINGS[lang].loading} />;
  if (me.isError) return <RedirectToSignIn to="/login" />;
  const step = me.data?.nextStep ?? "role";
  if (step === "role") return <Navigate to="/onboarding/role" />;
  if (step === "school") return <Navigate to="/onboarding/school" />;
  if (step === "setup") return <Navigate to="/onboarding/setup" />;
  if (step === "link") return <Navigate to="/onboarding/link" />;
  return <Navigate to="/app" />;
}

export function RequireStep({
  allow,
  children,
}: {
  allow: Array<"role" | "school" | "setup" | "link" | "app">;
  children: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: !isPending && Boolean(user),
  });
  const { lang } = usePrefs();
  if (isPending) return <Splash text={STRINGS[lang].loading} />;
  if (!user) return <RedirectToSignIn to="/login" />;
  if (me.isPending) return <Splash text={STRINGS[lang].loading} />;
  if (me.isError) return <RedirectToSignIn to="/login" />;
  const step = me.data?.nextStep ?? "role";
  if (!allow.includes(step)) {
    if (step === "app") return <Navigate to="/app" />;
    if (step === "school") return <Navigate to="/onboarding/school" />;
    if (step === "setup") return <Navigate to="/onboarding/setup" />;
    if (step === "link") return <Navigate to="/onboarding/link" />;
    return <Navigate to="/onboarding/role" />;
  }
  return <>{children}</>;
}

export function Splash({ text }: { text: string }) {
  return (
    <AuthLayout variant="cream">
      <AuthCard>
        <p className="text-center font-display text-lg font-bold text-ink">{text}</p>
      </AuthCard>
    </AuthLayout>
  );
}

export function useDocumentLang() {
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [lang, theme]);
}
