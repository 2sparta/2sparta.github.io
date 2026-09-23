import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthForm } from "@/components/auth-form";
import { RouteByProfile, Splash } from "@/components/session-gate";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const lang = usePrefs((s) => s.lang);
  if (isPending) return <Splash text={STRINGS[lang].loading} />;
  if (user) return <RouteByProfile />;
  return <AuthForm role="teacher" />;
}
