import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotices, markNoticesRead } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export function NotificationsBell() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ["notices"], queryFn: () => listNotices(), refetchInterval: 20000 });
  const unread = (notes.data?.notices ?? []).filter((n) => !n.read).length;
  const mark = useMutation({
    mutationFn: () => markNoticesRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
  const locale = lang === "uk" ? "uk-UA" : "en-GB";

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid size-10 place-items-center rounded-full border border-hairline bg-white/70 text-ink"
        aria-label={t.notifications}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread) mark.mutate();
        }}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(320px,80vw)] rounded-2xl border border-hairline bg-paper p-3 shadow-lg">
          <p className="mb-2 font-display text-sm font-extrabold">{t.notifications}</p>
          {(notes.data?.notices ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t.noNotif}</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-auto">
              {(notes.data?.notices ?? []).map((n) => (
                <li key={n.id} className="rounded-xl bg-cream/60 px-3 py-2">
                  <p className="text-sm font-bold">{n.title}</p>
                  {n.body && <p className="text-xs text-muted">{n.body}</p>}
                  <p className="text-[11px] text-muted">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
