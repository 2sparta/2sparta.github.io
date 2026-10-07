import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getDuty, setDuty } from "@/lib/school/server";
import { kyivWeekday } from "@/lib/school/ids";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { Hint, Panel, PanelTitle, Select } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function DutyBoard({ classId }: { classId: string }) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["duty", classId], queryFn: () => getDuty({ data: { classId } }), enabled: Boolean(classId) });
  const save = useMutation({
    mutationFn: (d: { weekday: string; rosterIds: string[] }) => setDuty({ data: { classId, ...d } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duty", classId] }),
  });
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!classId || !q.data) return null;
  const today = kyivWeekday();
  const names = new Map(q.data.students.map((s) => [s.id, s.name]));

  return (
    <Panel>
      <PanelTitle>{t.dutyTitle}</PanelTitle>
      <Hint>{t.dutyHint}</Hint>
      <div className="space-y-2">
        {DAYS.map((day) => {
          const ids = q.data?.days[day] ?? [];
          const free = q.data?.students.filter((s) => !ids.includes(s.id)) ?? [];
          return (
            <div key={day} className={cn("flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2", day === today ? "bg-forest/5" : "bg-cream/40")}>
              <span className={cn("w-24 shrink-0 text-sm font-extrabold", day === today ? "text-forest" : "text-ink")}>
                {t.weekdays[day]}
                {day === today ? <span className="ml-1 text-[10px] font-bold uppercase">{t.dutyToday}</span> : null}
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {ids.length === 0 ? <span className="text-sm text-muted">{t.dutyEmpty}</span> : null}
                {ids.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-sm font-semibold">
                    {names.get(id) || id}
                    {q.data?.canEdit && (
                      <button
                        type="button"
                        className="text-muted"
                        aria-label={t.delete}
                        onClick={() => save.mutate({ weekday: day, rosterIds: ids.filter((x) => x !== id) })}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {q.data?.canEdit && free.length > 0 && (
                <Select
                  className="h-9 w-40"
                  value={pick[day] || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    setPick((cur) => ({ ...cur, [day]: "" }));
                    save.mutate({ weekday: day, rosterIds: [...ids, id] });
                  }}
                >
                  <option value="">{t.dutyAdd}</option>
                  {free.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
