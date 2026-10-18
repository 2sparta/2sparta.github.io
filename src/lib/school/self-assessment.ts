/** Shared eligibility checks for lesson self-assessment. Official grades stay separate. */
export function selfGradeValue(value: string) {
  if (!/^(?:[1-9]|1[0-2])$/.test(value.trim())) throw new Error("GRADE_RANGE");
  return value.trim();
}
export function canAssessLesson(
  lesson: {
    schoolId?: unknown;
    subjectId?: unknown;
    classIds?: unknown;
    lessonDate?: unknown;
    publishAt?: unknown;
    workType?: unknown;
  },
  student: { schoolId: string | null; classId: string | null },
  today: string,
  now = Date.now(),
) {
  return (
    (lesson.workType == null || lesson.workType === "lesson") &&
    lesson.schoolId === student.schoolId &&
    typeof lesson.subjectId === "string" &&
    !!lesson.subjectId &&
    !!student.classId &&
    Array.isArray(lesson.classIds) &&
    (lesson.classIds.length === 0 || lesson.classIds.includes(student.classId)) &&
    typeof lesson.lessonDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(lesson.lessonDate) &&
    lesson.lessonDate <= today &&
    (!lesson.publishAt ||
      (typeof lesson.publishAt === "string" && new Date(lesson.publishAt).getTime() <= now))
  );
}
export type SelfAssessment = {
  id: string;
  schoolId: string;
  rosterId: string;
  authorId: string;
  lessonId: string;
  subjectId: string;
  lessonTitle: string;
  lessonDate: string;
  value: string;
  status: "pending" | "reviewed";
  submittedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewedValue?: string;
};
