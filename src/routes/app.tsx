import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireStep, Splash, useMeQuery } from "@/components/session-gate";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  return (
    <RequireStep allow={["app"]}>
      <Shell />
    </RequireStep>
  );
}

function Shell() {
  const me = useMeQuery();
  const lang = usePrefs((s) => s.lang);
  if (!me.data?.profile) return <Splash text={STRINGS[lang].loading} />;
  return <AppShell profile={me.data.profile} />;
}
