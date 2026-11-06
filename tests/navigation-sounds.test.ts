import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POSITION } from "chess.js";
import { appNavigation, navItemActive, searchableNavigation } from "../src/lib/navigation";
import { DEFAULT_SETTINGS } from "../src/lib/school/settings";
import { chessMoveSound } from "../src/lib/chess/sound";

test("Five primary sections retain role-specific pages and feature settings", () => {
  for (const role of ["student", "parent", "teacher"] as const) {
    const nav = appNavigation({ role, isAdmin: false }, DEFAULT_SETTINGS);
    assert.equal(nav.length, 5);
    const pages = searchableNavigation(nav).map((item) => item.id);
    assert.ok(pages.includes("homework") && pages.includes("tasks") && pages.includes("chess"));
    assert.ok(!pages.includes("teachers"));
    if (role === "parent") assert.ok(!pages.includes("chat") && !pages.includes("students"));
  }
  const teacher = searchableNavigation(
    appNavigation(
      { role: "teacher", isAdmin: true },
      { ...DEFAULT_SETTINGS, points: false, chat: false, clubs: false, selfGovernment: false },
    ),
  );
  assert.ok(teacher.some((p) => p.id === "teachers"));
  assert.ok(teacher.some((p) => p.id === "students"));
  assert.ok(!teacher.some((p) => ["chat", "clubs", "selfgov"].includes(p.id)));
  const student = searchableNavigation(
    appNavigation({ role: "student", isAdmin: false }, { ...DEFAULT_SETTINGS, points: false }),
  );
  assert.ok(!student.some((p) => p.id === "students"));
});

test("Chess deep links highlight Chess, not the Library, while resource filters remain in Library", () => {
  const nav = appNavigation({ role: "student", isAdmin: false }, DEFAULT_SETTINGS);
  assert.deepEqual(
    nav
      .filter((item) => navItemActive(item, "/app/materials", "useful", "chess"))
      .map((item) => item.id),
    ["chess"],
  );
  assert.deepEqual(
    nav.filter((item) => navItemActive(item, "/app/materials", "articles")).map((item) => item.id),
    ["resources"],
  );
  assert.ok(navItemActive(nav[0], "/app/"));
  assert.ok(!navItemActive(nav[0], "/app/grades"));
});

test("Live sounds distinguish moves, captures, check and mate without sounding restored or reviewed moves", () => {
  assert.equal(chessMoveSound([], ["e2e4"], DEFAULT_POSITION), "move");
  assert.equal(
    chessMoveSound(["e2e4", "d7d5"], ["e2e4", "d7d5", "e4d5"], DEFAULT_POSITION),
    "capture",
  );
  assert.equal(chessMoveSound([], ["e1e8"], "7k/8/8/8/8/8/8/K3R3 w - - 0 1"), "check");
  assert.equal(
    chessMoveSound(["f2f3", "e7e5", "g2g4"], ["f2f3", "e7e5", "g2g4", "d8h4"], DEFAULT_POSITION),
    "end",
  );
  assert.equal(chessMoveSound([], ["e2e4", "e7e5"], DEFAULT_POSITION), null);
  assert.equal(chessMoveSound(["e2e4"], ["e2e4"], DEFAULT_POSITION), null);
  assert.equal(chessMoveSound(["e2e4"], [], DEFAULT_POSITION), null);
  assert.equal(chessMoveSound(["d2d4"], ["e2e4", "e7e5"], DEFAULT_POSITION), null);
  assert.equal(chessMoveSound([], ["e2e5"], DEFAULT_POSITION), null);
});
