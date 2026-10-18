import { workType, type GradePolicy, type WorkType } from "./settings.ts";
export type MarkForCalculation = {
  value: string;
  kind: string;
  workType?: WorkType;
  lessonDate?: string | null;
  createdAt: string;
};
export function semesterContains(
  date: string,
  semester: "semester1" | "semester2",
  policy: GradePolicy,
) {
  const day = date.slice(5, 10);
  const from = semester === "semester1" ? policy.semester1From : policy.semester2From;
  const to = semester === "semester1" ? policy.semester1To : policy.semester2To;
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}
export function calculateSemester(marks: MarkForCalculation[], policy: GradePolicy) {
  const rows: { value: number; weight: number; type: WorkType }[] = [];
  for (const mark of marks) {
    if (mark.kind === "final" || (!policy.includeHomework && mark.kind === "homework")) continue;
    if (!/^(?:[1-9]|1[0-2])$/.test(mark.value.trim())) continue;
    const type = mark.kind === "homework" ? "homework" : workType(mark.workType);
    const weight = policy.method === "weighted" ? policy.weights[type] : 1;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    rows.push({ value: Number(mark.value), weight, type });
  }
  const totalWeight = rows.reduce((n, r) => n + r.weight, 0);
  if (rows.length < policy.minimumMarks || !totalWeight)
    return { value: null, raw: null, count: rows.length, totalWeight };
  const raw = rows.reduce((n, r) => n + r.value * r.weight, 0) / totalWeight;
  const round =
    policy.rounding === "floor" ? Math.floor : policy.rounding === "ceil" ? Math.ceil : Math.round;
  return {
    value: Math.min(12, Math.max(1, round(Number(raw.toFixed(10))))),
    raw,
    count: rows.length,
    totalWeight,
  };
}
export function academicStartYear(today: string, policy: GradePolicy) {
  return Number(today.slice(0, 4)) - (today.slice(5, 10) < policy.semester1From ? 1 : 0);
}
export function inAcademicSemester(
  date: string,
  semester: "semester1" | "semester2",
  year: number,
  policy: GradePolicy,
) {
  const from = semester === "semester1" ? policy.semester1From : policy.semester2From;
  const to = semester === "semester1" ? policy.semester1To : policy.semester2To;
  const startYear = year + (semester === "semester2" && from < policy.semester1From ? 1 : 0);
  return date >= `${startYear}-${from}` && date <= `${startYear + (to < from ? 1 : 0)}-${to}`;
}
