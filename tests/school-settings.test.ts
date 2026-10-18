import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPreset,
  DEFAULT_SETTINGS,
  parseSettings,
  validateSettings,
  canOffice,
} from "../src/lib/school/settings.ts";
import { calculateSemester, inAcademicSemester } from "../src/lib/school/grading.ts";
const base = () => structuredClone(DEFAULT_SETTINGS);
test("Presets describe real switches, preserve offices/policy and keep stored legacy options", () => {
  const standard = applyPreset(base(), "standard"),
    auto = applyPreset(base(), "autonomous"),
    motivation = applyPreset(base(), "motivated");
  assert.equal(standard.points, false);
  assert.equal(standard.chat, false);
  assert.equal(standard.studentArticles, false);
  assert.equal(auto.allowSelfAssessment, true);
  assert.equal(auto.points, false);
  assert.equal(auto.feedMode, "proposals");
  assert.ok(motivation.points && motivation.selfGovernment && motivation.feedComments);
  assert.deepEqual(standard.offices, DEFAULT_SETTINGS.offices);
  assert.deepEqual(auto.grading, DEFAULT_SETTINGS.grading);
  assert.equal(parseSettings(null, true).allowSelfAssessment, true);
  assert.ok(parseSettings(null).studentArticles);
  for (const preset of [standard, auto, motivation])
    assert.doesNotThrow(() => validateSettings(preset));
});
test("Removed offices lose privileges and unrelated rights never grant grading", () => {
  const config = base();
  config.offices.editor = { name: "Редактор", permissions: ["publishNews"] };
  const student = { role: "student", office: "editor" };
  assert.ok(canOffice(config, student, "publishNews"));
  assert.equal(canOffice(config, student, "awardRewards"), false);
  delete config.offices.editor;
  assert.equal(canOffice(config, student, "publishNews"), false);
  assert.throws(() =>
    validateSettings({
      ...base(),
      offices: { bad: { name: "Bad", permissions: ["setGrades"] as never[] } },
    }),
  );
  config.selfGovernment = false;
  assert.equal(canOffice(config, { role: "student", office: "media" }, "createRewards"), false);
});
test("Semester weighting, rounding and zero/missing weights produce explainable results", () => {
  const g = base().grading;
  const marks = [
    { value: "8", kind: "lesson", workType: "lesson" as const, createdAt: "" },
    { value: "12", kind: "lesson", workType: "test" as const, createdAt: "" },
  ];
  assert.equal(calculateSemester(marks, g).value, 10);
  g.method = "weighted";
  g.weights.test = 3;
  assert.equal(calculateSemester(marks, g).value, 11);
  g.weights.test = 2;
  g.rounding = "floor";
  assert.equal(calculateSemester(marks, g).value, 10);
  g.rounding = "ceil";
  assert.equal(calculateSemester(marks, g).value, 11);
  g.weights.test = 0;
  assert.equal(calculateSemester(marks, g).value, 8);
  g.weights.lesson = 0;
  assert.equal(calculateSemester(marks, g).value, null);
  assert.equal(
    calculateSemester(
      [
        { value: "Н", kind: "lesson", createdAt: "" },
        { value: "12", kind: "final", createdAt: "" },
      ],
      g,
    ).value,
    null,
  );
  assert.throws(() =>
    validateSettings({
      ...base(),
      grading: { ...base().grading, weights: { ...base().grading.weights, test: NaN } },
    }),
  );
});
test("Academic year and configurable cross-year semester dates exclude other years", () => {
  const g = base().grading;
  assert.ok(inAcademicSemester("2026-10-18", "semester1", 2026, g));
  assert.equal(inAcademicSemester("2025-10-18", "semester1", 2026, g), false);
  assert.ok(inAcademicSemester("2027-05-18", "semester2", 2026, g));
  assert.equal(inAcademicSemester("2026-05-18", "semester2", 2026, g), false);
  g.semester1To = "01-20";
  g.semester2From = "01-21";
  assert.ok(inAcademicSemester("2027-01-19", "semester1", 2026, g));
  assert.doesNotThrow(() => validateSettings({ ...base(), grading: g }));
  assert.throws(() => validateSettings({ ...base(), grading: { ...g, semester2From: "01-01" } }));
});
