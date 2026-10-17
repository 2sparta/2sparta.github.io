import { test } from "node:test";
import assert from "node:assert/strict";
import { canAssessLesson, selfGradeValue } from "../src/lib/school/self-assessment.ts";
test("Self-assessment accepts only integer lesson marks 1–12", () => {
  for (let i = 1; i <= 12; i++) assert.equal(selfGradeValue(String(i)), String(i));
  for (const s of ["", "0", "13", "-1", "10.5", "Н", "A", "NaN", "1e1", "01"])
    assert.throws(() => selfGradeValue(s));
});
test("Self-assessment excludes other schools/classes, future lessons and unpublished lessons", () => {
  const student = { schoolId: "school", classId: "class" };
  const lesson = {
    schoolId: "school",
    subjectId: "math",
    classIds: ["class"],
    lessonDate: "2026-10-16",
    publishAt: null,
  };
  assert.ok(canAssessLesson(lesson, student, "2026-10-17"));
  assert.ok(canAssessLesson({ ...lesson, classIds: [] }, student, "2026-10-17"));
  for (const change of [
    { schoolId: "other" },
    { classIds: ["other"] },
    { lessonDate: "2026-10-18" },
    { subjectId: "" },
    { publishAt: "2099-01-01T00:00:00Z" },
    { publishAt: "invalid" },
  ])
    assert.equal(canAssessLesson({ ...lesson, ...change }, student, "2026-10-17"), false);
});
