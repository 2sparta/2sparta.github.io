import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDutyGrid,
  insertDutyColumn,
  insertDutyRow,
  parseDutyGrid,
  pasteDutyCells,
  serializeDutyGrid,
} from "../src/lib/school/duty-grid.ts";
import {
  safeWebUrl,
  validateMaterial,
  videoEmbedUrl,
  type MaterialInput,
} from "../src/lib/materials/model.ts";

test("duty storage roundtrip keeps every cell and supports the old format", () => {
  const grid = {
    cols: ["День", "Чергові"],
    rows: [
      ["Понеділок", "Данило"],
      ["Вівторок", "Анна"],
    ],
  };
  assert.deepEqual(parseDutyGrid(grid), grid);
  const stored = serializeDutyGrid(grid);
  assert.ok(stored.rows.every((r) => !Array.isArray(r) && Array.isArray(r.cells)));
  assert.deepEqual(parseDutyGrid(stored), grid);
});
test("inserting between columns/rows preserves alignment", () => {
  const grid = {
    cols: ["A", "B"],
    rows: [
      ["a", "b"],
      ["c", "d"],
    ],
  };
  assert.deepEqual(insertDutyColumn(grid, 1), {
    cols: ["A", "", "B"],
    rows: [
      ["a", "", "b"],
      ["c", "", "d"],
    ],
  });
  assert.deepEqual(insertDutyRow(grid, 1).rows, [
    ["a", "b"],
    ["", ""],
    ["c", "d"],
  ]);
});
test("Excel paste grows rectangular grid, keeps unaffected data and refuses overflow", () => {
  const grid = { cols: ["A", "B"], rows: [["keep", "old"]] };
  assert.deepEqual(pasteDutyCells(grid, 0, 1, "x\ty\r\nz\tw\r\n"), {
    cols: ["A", "B", ""],
    rows: [
      ["keep", "x", "y"],
      ["", "z", "w"],
    ],
  });
  assert.throws(() => pasteDutyCells(emptyDutyGrid(), 39, 0, "one\ntwo"), /GRID_SIZE/);
  assert.throws(() => serializeDutyGrid({ cols: ["A", "B"], rows: [["short"]] }), /GRID_SIZE/);
  assert.throws(() => serializeDutyGrid({ cols: ["A"], rows: [["x".repeat(2001)]] }), /CELL_SIZE/);
});
test("resource links reject script/data/credential URLs", () => {
  for (const raw of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "//evil.example",
    "https://name:pass@example.com",
    "file:///tmp/example",
  ])
    assert.equal(safeWebUrl(raw), null);
  assert.equal(safeWebUrl("https://example.com/path"), "https://example.com/path");
});
test("video embeds allow only exact hosts and validated IDs", () => {
  assert.equal(
    videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(videoEmbedUrl("https://vimeo.com/12345"), "https://player.vimeo.com/video/12345");
  assert.equal(videoEmbedUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoEmbedUrl("https://youtube.com/watch?v=bad<script>"), null);
});
test("publishing validates content, bounded fields and status", () => {
  const draft: MaterialInput = {
    kind: "article",
    status: "draft",
    title: " Article ",
    topic: " History ",
    summary: "",
    body: "",
    url: "",
  };
  assert.equal(validateMaterial(draft).title, "Article");
  assert.throws(() => validateMaterial({ ...draft, status: "published" }), /ARTICLE_BODY_REQUIRED/);
  assert.throws(() => validateMaterial({ ...draft, title: "x".repeat(161) }), /INVALID_MATERIAL/);
  assert.throws(
    () => validateMaterial({ ...draft, kind: "video", url: "javascript:alert(1)" }),
    /INVALID_URL/,
  );
  assert.equal(
    validateMaterial({ ...draft, status: "published", body: "Text", url: "javascript:ignored" })
      .url,
    "",
  );
});
