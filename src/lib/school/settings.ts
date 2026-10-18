import { OFFICES } from "./ids.ts";
export const WORK_TYPES = [
  "lesson",
  "homework",
  "test",
  "practical",
  "semester",
  "independent",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const WORK_LABELS: Record<WorkType, [string, string]> = {
  lesson: ["Робота на уроці", "Lesson work"],
  homework: ["Домашня робота", "Homework"],
  test: ["Контрольна робота", "Test"],
  practical: ["Практична робота", "Practical work"],
  semester: ["Семестрова робота", "Semester assessment"],
  independent: ["Самостійна робота", "Independent work"],
};
export const CAPABILITIES = {
  postActivities: ["Публікувати події класу", "Publish class activities"],
  postHomework: ["Додавати домашні завдання класу", "Post class homework"],
  manageDuty: ["Редагувати чергування свого класу", "Edit own class duty roster"],
  manageHomeworkPermissions: [
    "Дозволяти однокласникам додавати ДЗ",
    "Delegate class homework posting",
  ],
  createRewards: ["Створювати нагороди", "Create rewards"],
  awardRewards: ["Видавати власні нагороди з бюджету", "Award own rewards from budget"],
  publishNews: ["Публікувати шкільні новини", "Publish school news"],
} as const;
export type Capability = keyof typeof CAPABILITIES;
export type CouncilOffice = { name: string; permissions: Capability[] };
export type GradePolicy = {
  method: "mean" | "weighted";
  rounding: "nearest" | "floor" | "ceil";
  includeHomework: boolean;
  minimumMarks: number;
  weights: Record<WorkType, number>;
  semester1From: string;
  semester1To: string;
  semester2From: string;
  semester2To: string;
};
export type SchoolSettings = {
  preset: "custom" | "standard" | "autonomous" | "motivated";
  studentArticles: boolean;
  points: boolean;
  chat: boolean;
  selfGovernment: boolean;
  clubs: boolean;
  studentHomework: boolean;
  allowSelfAssessment: boolean;
  feedMode: "off" | "proposals" | "news";
  feedLikes: boolean;
  feedComments: boolean;
  articleLikes: boolean;
  offices: Record<string, CouncilOffice>;
  grading: GradePolicy;
};
export const DEFAULT_SETTINGS: SchoolSettings = {
  preset: "custom",
  studentArticles: true,
  points: true,
  chat: true,
  selfGovernment: true,
  clubs: true,
  studentHomework: true,
  allowSelfAssessment: false,
  feedMode: "off",
  feedLikes: true,
  feedComments: true,
  articleLikes: true,
  offices: Object.fromEntries(
    OFFICES.map((o) => [o.id, { name: o.name, permissions: ["createRewards", "awardRewards"] }]),
  ),
  grading: {
    method: "mean",
    rounding: "nearest",
    includeHomework: true,
    minimumMarks: 1,
    weights: { lesson: 1, homework: 1, test: 2, practical: 1.5, semester: 3, independent: 1.5 },
    semester1From: "09-01",
    semester1To: "12-31",
    semester2From: "01-01",
    semester2To: "06-30",
  },
};
export const PRESETS = {
  standard: {
    title: ["Звичайна школа", "Standard school"],
    description: [
      "Оцінки виставляє вчитель. Статті учнів, бали, чат, гуртки, учнівське ДЗ та самоврядування вимкнені. Праворуч — новини вчителів без лайків і коментарів.",
      "Teachers grade. Student articles, points, chat, clubs, student homework and council are off. Teacher news appears on the right without likes or comments.",
    ],
    values: {
      studentArticles: false,
      points: false,
      chat: false,
      selfGovernment: false,
      clubs: false,
      studentHomework: false,
      allowSelfAssessment: false,
      feedMode: "news",
      feedLikes: false,
      feedComments: false,
      articleLikes: false,
    },
  },
  autonomous: {
    title: ["Автономне навчання", "Autonomous learning"],
    description: [
      "Учні подають власні оцінки за звичайний урок, учитель перевіряє їх. Дозволені статті й учнівське ДЗ. Бали, чат, гуртки та самоврядування вимкнені. Пропозиції й статті можна лайкати; коментарі вимкнені.",
      "Students submit marks for regular lessons for teacher review. Student articles and homework are allowed. Points, chat, clubs and council are off. Proposals and articles allow likes; comments are off.",
    ],
    values: {
      studentArticles: true,
      points: false,
      chat: false,
      selfGovernment: false,
      clubs: false,
      studentHomework: true,
      allowSelfAssessment: true,
      feedMode: "proposals",
      feedLikes: true,
      feedComments: false,
      articleLikes: true,
    },
  },
  motivated: {
    title: ["З додатковою мотивацією", "Extra motivation"],
    description: [
      "Увімкнені бали, нагороди, чат, гуртки, самоврядування, учнівські статті та ДЗ. Праворуч — пропозиції з лайками й коментарями. Оцінки виставляє вчитель.",
      "Points, rewards, chat, clubs, council, student articles and homework are enabled. Proposals allow likes and comments. Teachers grade.",
    ],
    values: {
      studentArticles: true,
      points: true,
      chat: true,
      selfGovernment: true,
      clubs: true,
      studentHomework: true,
      allowSelfAssessment: false,
      feedMode: "proposals",
      feedLikes: true,
      feedComments: true,
      articleLikes: true,
    },
  },
} as const;
export type Preset = keyof typeof PRESETS;
export function applyPreset(settings: SchoolSettings, preset: Preset): SchoolSettings {
  return { ...structuredClone(settings), ...PRESETS[preset].values, preset };
}
const booleanKeys = [
  "studentArticles",
  "points",
  "chat",
  "selfGovernment",
  "clubs",
  "studentHomework",
  "allowSelfAssessment",
  "feedLikes",
  "feedComments",
  "articleLikes",
] as const;
export function parseSettings(raw: unknown, legacySelfAssessment = false): SchoolSettings {
  const d = raw && typeof raw === "object" ? (raw as Partial<SchoolSettings>) : {};
  const result = structuredClone(DEFAULT_SETTINGS);
  for (const key of booleanKeys) if (typeof d[key] === "boolean") result[key] = d[key]!;
  if (typeof d.allowSelfAssessment !== "boolean") result.allowSelfAssessment = legacySelfAssessment;
  if (["off", "news", "proposals"].includes(d.feedMode!)) result.feedMode = d.feedMode!;
  if (["custom", "standard", "autonomous", "motivated"].includes(d.preset!))
    result.preset = d.preset!;
  if (d.offices && typeof d.offices === "object" && !Array.isArray(d.offices))
    result.offices = structuredClone(d.offices);
  if (d.grading)
    result.grading = {
      ...result.grading,
      ...d.grading,
      weights: { ...result.grading.weights, ...d.grading.weights },
    };
  return result;
}
export function validateSettings(raw: SchoolSettings): SchoolSettings {
  if (
    !raw ||
    booleanKeys.some((k) => typeof raw[k] !== "boolean") ||
    !["off", "news", "proposals"].includes(raw.feedMode) ||
    !["custom", "standard", "autonomous", "motivated"].includes(raw.preset)
  )
    throw new Error("INVALID_SETTINGS");
  const offices = Object.entries(raw.offices ?? {});
  if (offices.length > 30) throw new Error("OFFICE_LIMIT");
  for (const [id, office] of offices)
    if (
      !/^[a-z][a-z0-9_-]{0,49}$/.test(id) ||
      !office.name?.trim() ||
      office.name.length > 120 ||
      !Array.isArray(office.permissions) ||
      office.permissions.some((c) => !(c in CAPABILITIES)) ||
      new Set(office.permissions).size !== office.permissions.length
    )
      throw new Error("INVALID_OFFICE");
  const g = raw.grading;
  if (
    !g ||
    !["mean", "weighted"].includes(g.method) ||
    !["nearest", "floor", "ceil"].includes(g.rounding) ||
    typeof g.includeHomework !== "boolean" ||
    !Number.isInteger(g.minimumMarks) ||
    g.minimumMarks < 1 ||
    g.minimumMarks > 100 ||
    WORK_TYPES.some(
      (k) =>
        typeof g.weights[k] !== "number" ||
        !Number.isFinite(g.weights[k]) ||
        g.weights[k] < 0 ||
        g.weights[k] > 10,
    )
  )
    throw new Error("INVALID_GRADING");
  for (const date of [g.semester1From, g.semester1To, g.semester2From, g.semester2To]) {
    if (!/^\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_SEMESTER");
    const parsed = new Date(`2000-${date}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(5, 10) !== date)
      throw new Error("INVALID_SEMESTER");
  }
  for (let day = 0; day < 366; day++) {
    const date = new Date(Date.UTC(2000, 0, 1 + day)).toISOString().slice(5, 10);
    const contains = (from: string, to: string) =>
      from <= to ? date >= from && date <= to : date >= from || date <= to;
    if (contains(g.semester1From, g.semester1To) && contains(g.semester2From, g.semester2To))
      throw new Error("OVERLAPPING_SEMESTERS");
  }
  return parseSettings(raw);
}
export function canOffice(
  settings: SchoolSettings,
  profile: { role: unknown; office?: string | null },
  capability: Capability,
): boolean {
  return (
    settings.selfGovernment &&
    profile.role === "student" &&
    !!profile.office &&
    !!settings.offices[profile.office]?.permissions.includes(capability)
  );
}
export function workType(raw: unknown): WorkType {
  return WORK_TYPES.includes(raw as WorkType) ? (raw as WorkType) : "lesson";
}
