import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotices, markNoticesRead } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/cn";

export function NotificationsNav() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ["notices"], queryFn: () => listNotices(), refetchInterval: 20000 });
  const list = notes.data?.notices ?? [];
  const unread = list.filter((n) => !n.read).length;
  const mark = useMutation({
    mutationFn: () => markNoticesRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
  const locale = lang === "uk" ? "uk-UA" : "en-GB";

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative pb-2">
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 flex max-h-[min(420px,55vh)] w-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface text-ink shadow-lg">
          <div className="border-b border-hairline px-3 py-3">
            <p className="font-display text-sm font-extrabold">{t.notifications}</p>
            <p className="mt-1 text-xs text-muted">{t.notifHint}</p>
          </div>
          {list.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">{t.noNotif}</p>
          ) : (
            <ul className="space-y-2 overflow-auto p-2">
              {list.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-xl bg-cream/60 px-3 py-2",
                    !n.read && "border-l-[3px] border-forest bg-cream",
                  )}
                >
                  <p className="text-sm font-bold">{n.title}</p>
                  {n.body && <p className="text-xs text-muted whitespace-pre-wrap">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString(locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 font-display text-sm font-bold text-paper/80 hover:bg-white/10 hover:text-white"
        onClick={() => {
          setOpen((v) => {
            if (!v && unread) mark.mutate();
            return !v;
          });
        }}
      >
        <Bell className="size-[18px]" strokeWidth={2} />
        <span className="flex-1 text-left">{t.notifications}</span>
        {unread > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-terracotta px-1.5 text-[10px] font-bold text-paper">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
