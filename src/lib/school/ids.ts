const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newId(): string {
  return crypto.randomUUID();
}

export function teacherInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += ALPH[b % ALPH.length];
  return out;
}

export function studentInviteCode(): string {
  const n = 100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
  return String(n);
}

export function kyivToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

export function kyivClock(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Kyiv",
  });
}

export function kyivWeekday(): string {
  const map: Record<string, string> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  const short = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Europe/Kyiv",
  });
  return map[short] ?? "mon";
}

export function isoWeekKey(date = new Date()): string {
  const iso = date.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const d = new Date(`${iso}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function minutesOf(hhmm: string): number | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DEFAULT_BELLS: { start: string; end: string }[] = [
  { start: "08:30", end: "09:15" },
  { start: "09:25", end: "10:10" },
  { start: "10:20", end: "11:05" },
  { start: "11:25", end: "12:10" },
  { start: "12:20", end: "13:05" },
  { start: "13:15", end: "14:00" },
  { start: "14:10", end: "14:55" },
];
