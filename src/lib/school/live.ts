import { minutesOf } from "./ids";

type Slot = {
  weekday: string;
  startTime: string;
  endTime: string;
  shownSubjectName?: string | null;
  subjectName?: string | null;
  meetLink?: string;
  room?: string;
};

export function describeLive(entries: Slot[], weekday: string, clock: string) {
  const now = minutesOf(clock);
  if (now == null) return null;
  const today = entries
    .filter((e) => e.weekday === weekday && (e.shownSubjectName || e.subjectName))
    .map((e) => ({
      name: e.shownSubjectName || e.subjectName || "",
      room: e.room || "",
      meetLink: e.meetLink || "",
      start: minutesOf(e.startTime),
      end: minutesOf(e.endTime),
    }))
    .filter((e) => e.start != null && e.end != null && e.name)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const current = today.find((e) => now >= (e.start ?? 0) && now < (e.end ?? 0));
  if (current) {
    return {
      phase: "lesson" as const,
      name: current.name,
      room: current.room,
      meetLink: current.meetLink,
      minutes: (current.end ?? now) - now,
    };
  }
  const next = today.find((e) => (e.start ?? 0) > now);
  if (!next) return { phase: "none" as const, name: "", room: "", meetLink: "", minutes: 0 };
  const prev = [...today].reverse().find((e) => (e.end ?? 0) <= now);
  return {
    phase: (prev ? "break" : "next") as "break" | "next",
    name: next.name,
    room: next.room,
    meetLink: next.meetLink,
    minutes: (next.start ?? now) - now,
  };
}
