import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMeQuery } from "./session-gate";
import { getSchoolSettings } from "@/lib/school/settings-api";
import { DEFAULT_SETTINGS, type SchoolSettings } from "@/lib/school/settings";
import { usePrefs } from "@/lib/prefs";
export function useSchoolSettings() {
  const p = useMeQuery().data?.profile;
  const query = useQuery({
    queryKey: ["school-settings", p?.schoolId, p?.userId],
    queryFn: getSchoolSettings,
    enabled: Boolean(p?.schoolId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  return { ...query, settings: query.data?.settings ?? DEFAULT_SETTINGS };
}
export function SchoolFeatureGate({
  feature,
  children,
}: {
  feature: "points" | "chat" | "selfGovernment" | "clubs";
  children: ReactNode;
}) {
  const { settings, isPending, isError } = useSchoolSettings();
  const uk = usePrefs((s) => s.lang === "uk");
  if (isPending)
    return <p role="status">{uk ? "Завантаження налаштувань…" : "Loading settings…"}</p>;
  if (isError)
    return (
      <p role="alert">
        {uk ? "Не вдалося перевірити налаштування школи." : "Could not check school settings."}
      </p>
    );
  if (!settings[feature])
    return (
      <p className="rounded-2xl border border-hairline bg-surface p-6">
        {uk
          ? "Цю можливість вимкнено в налаштуваннях школи."
          : "This feature is disabled in school settings."}
      </p>
    );
  return <>{children}</>;
}
