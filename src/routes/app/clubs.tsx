import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addClub, deleteClub, joinClub, listClubs, updateClub } from "@/lib/school/server";
import { WEEKDAYS } from "@/lib/school/ids";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "@/components/ui/panel";
import { PhotoAttach } from "@/components/photo-attach";
import { ClubPlan } from "@/components/club-plan";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/clubs")({ component: ClubsPage });

type ClubRow = {
  id: string;
  name: string;
  kind: "club" | "elective";
  weekday: string;
  startTime: string;
  endTime: string;
  sessions: { weekday: string; startTime: string; endTime: string }[];
  room: string;
  about: string;
  imageUrl: string;
  memberCount: number;
  joined: boolean;
};

function whenLabel(c: Pick<ClubRow, "sessions" | "weekday" | "startTime" | "endTime">, short: Record<string, string>) {
  const sessions = c.sessions?.length ? c.sessions : [{ weekday: c.weekday, startTime: c.startTime, endTime: c.endTime }];
  const day = (d: string) => short[d] || d;
  const same = sessions.every((s) => s.startTime === sessions[0].startTime && s.endTime === sessions[0].endTime);
  if (same) return `${sessions.map((s) => day(s.weekday)).join(", ")} · ${sessions[0].startTime}–${sessions[0].endTime}`;
  return sessions.map((s) => `${day(s.weekday)} ${s.startTime}–${s.endTime}`).join(" · ");
}

function ClubsPage() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const isTeacher = me.data?.profile.role === "teacher";
  const isStudent = me.data?.profile.role === "student";
  const q = useQuery({ queryKey: ["clubs"], queryFn: () => listClubs() });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"club" | "elective">("club");
  const [weekdays, setWeekdays] = useState<string[]>(["thu"]);
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("16:00");
  const [room, setRoom] = useState("");
  const [about, setAbout] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const payload = { name, kind, weekdays, startTime, endTime, room, about, imageUrl: photos[0] || "" };
  const reset = () => {
    setEditId(null);
    setName("");
    setKind("club");
    setWeekdays(["thu"]);
    setStartTime("15:00");
    setEndTime("16:00");
    setRoom("");
    setAbout("");
    setPhotos([]);
    setOpen(false);
  };
  const save = useMutation({
    mutationFn: async () => {
      if (editId) await updateClub({ data: { id: editId, ...payload } });
      else await addClub({ data: payload });
    },
    onSuccess: async () => {
      reset();
      await qc.invalidateQueries({ queryKey: ["clubs"] });
    },
  });
  const drop = useMutation({
    mutationFn: (id: string) => deleteClub({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs"] }),
  });
  const toggle = useMutation({
    mutationFn: (d: { id: string; join: boolean }) => joinClub({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs"] }),
  });
  const clubs = (q.data?.clubs ?? []) as ClubRow[];
  const startEdit = (c: ClubRow) => {
    setEditId(c.id);
    setName(c.name);
    setKind(c.kind);
    setWeekdays(c.sessions.length ? c.sessions.map((s) => s.weekday) : [c.weekday]);
    setStartTime(c.startTime || "15:00");
    setEndTime(c.endTime || "16:00");
    setRoom(c.room);
    setAbout(c.about);
    setPhotos(c.imageUrl ? [c.imageUrl] : []);
    setOpen(true);
  };

  return (
    <div>
      <Panel>
        <PanelTitle>{t.tabClubs}</PanelTitle>
        <Hint>{t.clubsHint}</Hint>
        {clubs.length === 0 && !open ? <p className="mb-3 text-sm text-muted">{t.empty}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clubs.map((c) => {
            const elective = c.kind === "elective";
            return (
              <article
                key={c.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-[22px] border bg-surface shadow-[0_10px_30px_-18px_rgba(27,77,62,0.45)]",
                  c.joined ? "border-forest" : "border-hairline",
                )}
              >
                <div className="relative h-44">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className={cn(
                        "flex h-full items-end bg-gradient-to-br p-4",
                        elective ? "from-[#8a5228] to-[#e7c9a4]" : "from-[#1b4d3e] to-[#8eae96]",
                      )}
                    >
                      <span className="font-display text-7xl font-extrabold text-white/25">{c.name.slice(0, 1)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <span className={cn("absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold", elective ? "bg-[#f3e2d2] text-[#8a5228]" : "bg-white/90 text-forest")}>
                    {elective ? t.electiveKind : t.clubKind}
                  </span>
                  {c.joined && (
                    <span className="absolute top-3 right-3 rounded-full bg-forest px-2.5 py-1 text-[11px] font-bold text-paper">{t.clubJoined}</span>
                  )}
                  <h3 className="absolute right-3 bottom-3 left-3 font-display text-xl leading-tight font-extrabold text-white">{c.name}</h3>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <p className="text-sm font-bold text-ink">
                    {whenLabel(c, t.weekdaysShort)}
                    {c.room ? <span className="font-semibold text-muted"> · {c.room}</span> : null}
                  </p>
                  {c.about ? <p className="text-sm leading-relaxed text-ink-soft">{c.about}</p> : null}
                  <p className="text-xs font-bold text-forest-mid">{c.memberCount} {t.clubMembers}</p>
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    {isStudent && (
                      <PillButton type="button" tone={c.joined ? "ghost" : "primary"} disabled={toggle.isPending} onClick={() => toggle.mutate({ id: c.id, join: !c.joined })}>
                        {c.joined ? t.leaveClub : t.joinClub}
                      </PillButton>
                    )}
                    {isTeacher && (
                      <div className="ml-auto flex gap-1.5">
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-full bg-surface-2 text-forest"
                          aria-label={t.editClub}
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-full bg-surface-2 text-terracotta"
                          aria-label={t.delete}
                          onClick={() => drop.mutate(c.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {isTeacher && (
          <button
            type="button"
            className="mx-auto mt-5 grid size-12 place-items-center rounded-full bg-forest text-paper shadow-[0_8px_20px_-10px_rgba(27,77,62,0.8)]"
            aria-label={t.addClub}
            onClick={() => {
              if (open && !editId) setOpen(false);
              else {
                setEditId(null);
                setName("");
                setKind("club");
                setWeekdays(["thu"]);
                setStartTime("15:00");
                setEndTime("16:00");
                setRoom("");
                setAbout("");
                setPhotos([]);
                setOpen(true);
              }
            }}
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </button>
        )}
        {isTeacher && open && (
          <div className="mx-auto mt-4 grid max-w-xl gap-2 rounded-[22px] border border-hairline bg-cream/40 p-4">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t.electiveName} />
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder={t.clubAbout}
              rows={2}
              className="rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={kind} onChange={(e) => setKind(e.target.value as "club" | "elective")}>
                <option value="club">{t.clubKind}</option>
                <option value="elective">{t.electiveKind}</option>
              </Select>
              <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              <TextInput value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t.roomPh} className="w-28" />
            </div>
            <p className="text-xs font-bold text-muted">{t.clubDays}</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWeekdays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-bold", on ? "bg-forest text-paper" : "bg-surface-2 text-muted")}
                  >
                    {t.weekdaysShort[d]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-muted">{t.clubCover}</p>
            <PhotoAttach urls={photos} onChange={(urls) => setPhotos(urls.slice(0, 1))} max={1} disabled={save.isPending} />
            <div className="flex gap-2">
              <PillButton type="button" disabled={!name.trim() || weekdays.length === 0 || save.isPending} onClick={() => save.mutate()}>
                {editId ? t.save : t.addClub}
              </PillButton>
              {editId ? (
                <PillButton type="button" tone="ghost" onClick={reset}>{t.cancel}</PillButton>
              ) : null}
            </div>
          </div>
        )}
      </Panel>
      {isStudent && <ClubPlan />}
    </div>
  );
}
