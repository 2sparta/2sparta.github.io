import { test } from "node:test";
import assert from "node:assert/strict";
import { groupHomework, homeworkBucket, homeworkDate, homeworkToday, selectHomework, shiftHomeworkDate, type HomeworkItem } from "../src/lib/school/homework.ts";
const item = (id: string, due: string | null, done = false): HomeworkItem => ({
  id, due, done, title: "Завдання " + id, subject: "Алгебра", body: "Рівняння", author: "Петренко",
});
test("Kyiv calendar days and day arithmetic survive midnight, DST and month boundaries", () => {
  assert.equal(homeworkToday(new Date("2026-10-19T22:30:00Z")), "2026-10-20");
  assert.equal(homeworkToday(new Date("2026-10-25T22:30:00Z")), "2026-10-26");
  assert.equal(shiftHomeworkDate("2026-10-25", 1), "2026-10-26");
  assert.equal(shiftHomeworkDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftHomeworkDate("2028-02-28", 1), "2028-02-29");
  assert.equal(homeworkDate("2026-02-29"), null);
  assert.equal(homeworkDate("2026-13-01"), null);
  assert.equal(homeworkDate("2026-10-20<script>"), null);
});
test("Completion precedes due-date status and today's work is not overdue", () => {
  const today = "2026-10-20";
  assert.equal(homeworkBucket(item("old", "2026-10-19"), today), "overdue");
  assert.equal(homeworkBucket(item("today", today), today), "today");
  assert.equal(homeworkBucket(item("next", "2026-10-21"), today), "tomorrow");
  assert.equal(homeworkBucket(item("week", "2026-10-27"), today), "week");
  assert.equal(homeworkBucket(item("later", "2026-10-28"), today), "later");
  assert.equal(homeworkBucket(item("undated", null), today), "undated");
  assert.equal(homeworkBucket(item("invalid", "2026-02-30"), today), "undated");
  assert.equal(homeworkBucket(item("done", "2026-10-01", true), today), "done");
});
test("Grouping shows nearest overdue dates, orders upcoming dates and never mutates data", () => {
  const data = [item("future", "2026-11-01"), item("older", "2026-10-01"), item("recent", "2026-10-19"), item("no-date", null), item("completed", "2026-10-01", true)];
  const before = JSON.stringify(data);
  const groups = groupHomework(data, "2026-10-20");
  assert.deepEqual(groups.map((g) => g.key), ["overdue", "later", "undated", "done"]);
  assert.deepEqual(groups[0].items.map((i) => i.id), ["recent", "older"]);
  assert.equal(JSON.stringify(data), before);
});
test("Subject, status and Cyrillic text filters compose without inventing completion", () => {
  const data = [item("todo", "2026-10-20"), { ...item("done", null, true), subject: "Геометрія" }, { ...item("post", null), done: undefined }];
  assert.equal(selectHomework(data, { search: "ПЕТРЕНКО", subject: "", status: "all" }).length, 3);
  assert.deepEqual(selectHomework(data, { search: "рівняння", subject: "Геометрія", status: "done" }).map((i) => i.id), ["done"]);
  assert.deepEqual(selectHomework(data, { search: "", subject: "", status: "active" }).map((i) => i.id), ["todo", "post"]);
  assert.equal(groupHomework(data, "2026-10-20", true).length, 2);
});
