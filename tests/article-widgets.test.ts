import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyArticleHeading,
  articleEditorProjection,
  articleHeadings,
  articleWidgets,
  newArticleWidget,
  serializeArticleWidget,
  validateArticleWidget,
  type ArticleWidget,
} from "../src/lib/materials/article-widgets.ts";
import {
  duplicateDutyColumn,
  moveDutyColumn,
  parseDutyGrid,
  serializeDutyGrid,
} from "../src/lib/school/duty-grid.ts";

const widgets: ArticleWidget[] = [
  { type: "toc", title: "Зміст" },
  {
    ...newArticleWidget("conflict", true),
    type: "conflict",
    title: "Конфлікт",
    summary: 'Цитата: "текст"\n:::widget',
    date: "1914–1918",
    location: "Європа",
    result: "Результат",
    sides: [
      {
        name: "Сторона А",
        participants: "Учасники А",
        leaders: "Керівник А",
        forces: "100",
        losses: "10",
      },
      {
        name: "Сторона Б",
        participants: "Учасники Б",
        leaders: "Керівник Б",
        forces: "200",
        losses: "20",
      },
    ],
  },
  { type: "infobox", title: "Картка", rows: [{ label: "Рік", value: "2026" }] },
  {
    type: "timeline",
    title: "Події",
    entries: [{ date: "12 жовтня", text: "Початок\n<script>alert(1)</script>" }],
  },
  { type: "callout", title: "Увага", tone: "warning", text: "Текст\n:::\nКінець" },
];
test("all widget types survive body storage with literal Unicode, quotes and delimiter-like text", () => {
  const body =
    "# Заголовок\n\n" + widgets.map(serializeArticleWidget).join("\n\n") + "\n\nОстанній текст";
  const parsed = articleWidgets(body);
  assert.deepEqual(
    parsed.map((b) => b.widget),
    widgets,
  );
  for (const b of parsed)
    assert.deepEqual(articleWidgets(body.slice(b.start, b.end))[0].widget, b.widget);
  assert.deepEqual(
    articleHeadings(body).map((h) => h.text),
    ["Заголовок"],
  );
});
test("widget edit offsets replace only the selected block, including CRLF input", () => {
  const before = "Початок\r\n\r\n";
  const block = serializeArticleWidget(widgets[0]).replace(/\n/g, "\r\n");
  const after = "\r\n\r\n## Кінець";
  const body = before + block + after;
  const parsed = articleWidgets(body)[0];
  assert.equal(parsed.start, before.length);
  assert.equal(parsed.end, before.length + block.length);
  const changed =
    body.slice(0, parsed.start) + serializeArticleWidget(widgets[2]) + body.slice(parsed.end);
  assert.ok(changed.startsWith(before));
  assert.ok(changed.endsWith(after));
  assert.equal(articleWidgets(changed)[0].widget.type, "infobox");
});
test("editor placeholders hide stored widget data and preserve cursor positions and literal marker-like text", () => {
  const literal = "⟦Віджет 1: Зміст⟧\n\n";
  const body = literal + serializeArticleWidget(widgets[0]) + "\n\nFinal paragraph";
  const display = articleEditorProjection(body);
  assert.ok(!display.text.includes(":::widget"));
  assert.equal(display.expand(display.text), body);
  const sourcePosition = body.indexOf("Final");
  const visiblePosition = display.text.indexOf("Final");
  assert.equal(display.toSource(visiblePosition), sourcePosition);
  assert.equal(display.toVisible(sourcePosition), visiblePosition);
  assert.equal(
    display.expand(display.text.replace("Final", "Edited")),
    body.replace("Final", "Edited"),
  );
  assert.throws(
    () => display.expand(display.text.replace(display.tokens[0].label, "broken")),
    /WIDGET_PLACEHOLDER/,
  );
  assert.equal(
    display.intersectsWidget(display.tokens[0].visibleStart, display.tokens[0].visibleEnd),
    true,
  );
  assert.equal(display.intersectsWidget(visiblePosition, display.text.length), false);
  const special = articleEditorProjection(
    serializeArticleWidget({ type: "toc", title: "A[+](B)" }),
  );
  assert.equal(
    special.expand(special.text),
    serializeArticleWidget({ type: "toc", title: "A[+](B)" }),
  );
});
test("malformed and unknown widgets are never executed or accepted", () => {
  for (const text of [
    ":::widget\n<script>alert(1)</script>\n:::",
    ':::widget\n{"type":"unknown","title":"X"}\n:::',
    ':::widget\n{"type":"toc","title":"X"}',
  ])
    assert.deepEqual(articleWidgets(text), []);
  assert.throws(
    () => validateArticleWidget({ type: "conflict", title: "X", sides: [] }),
    /INVALID_WIDGET/,
  );
  assert.throws(
    () => validateArticleWidget({ type: "callout", title: "X", tone: "anything", text: "Text" }),
    /INVALID_WIDGET/,
  );
  assert.throws(
    () =>
      validateArticleWidget({
        type: "timeline",
        title: "X",
        entries: Array(21).fill({ date: "date", text: "text" }),
      }),
    /INVALID_WIDGET/,
  );
  assert.throws(
    () => validateArticleWidget({ type: "infobox", title: "X", rows: [{ label: "", value: "X" }] }),
    /INVALID_WIDGET/,
  );
});
test("all five heading levels have unique anchors and ordered nested numbering", () => {
  const headings = articleHeadings(
    "# **Історія**\n## Причини\n### Події\n#### Наслідки\n##### Деталі\n# Історія\n## Причини",
  );
  assert.deepEqual(
    headings.map((h) => h.level),
    [1, 2, 3, 4, 5, 1, 2],
  );
  assert.deepEqual(
    headings.map((h) => h.number),
    ["1", "1.1", "1.1.1", "1.1.1.1", "1.1.1.1.1", "2", "2.1"],
  );
  assert.equal(headings[0].id, "історія");
  assert.equal(headings[5].id, "історія-2");
  assert.equal(new Set(headings.map((h) => h.id)).size, headings.length);
});
test("changing heading levels rewrites whole selected lines without losing text or accumulating prefixes", () => {
  const body = "Початок\n## Розділ\nКінець";
  const next = applyArticleHeading(body, 10, 12, 5, "Підзаголовок 4");
  assert.equal(next.body, "Початок\n##### Розділ\nКінець");
  assert.equal(
    applyArticleHeading(next.body, next.start, next.end, 0, "").body,
    "Початок\nРозділ\nКінець",
  );
  assert.equal(applyArticleHeading("one\ntwo\nkeep", 0, 8, 2, "").body, "## one\n## two\nkeep");
  assert.equal(applyArticleHeading("", 0, 0, 1, "Заголовок").body, "# Заголовок");
  assert.throws(() => applyArticleHeading(body, 0, 0, 6, ""), /HEADING_LEVEL/);
});
test("duplicating and moving a duty column preserve every row and the source grid", () => {
  const source = {
    cols: ["A", "B", "C"],
    rows: [
      ["a1", "b1", "c1"],
      ["a2", "b2", "c2"],
    ],
  };
  const copy = duplicateDutyColumn(source, 1);
  assert.deepEqual(copy, {
    cols: ["A", "B", "B", "C"],
    rows: [
      ["a1", "b1", "b1", "c1"],
      ["a2", "b2", "b2", "c2"],
    ],
  });
  const moved = moveDutyColumn(copy, 2, 1);
  assert.deepEqual(moved, {
    cols: ["A", "B", "C", "B"],
    rows: [
      ["a1", "b1", "c1", "b1"],
      ["a2", "b2", "c2", "b2"],
    ],
  });
  assert.deepEqual(moveDutyColumn(moved, 3, -1), copy);
  assert.deepEqual(source, {
    cols: ["A", "B", "C"],
    rows: [
      ["a1", "b1", "c1"],
      ["a2", "b2", "c2"],
    ],
  });
  assert.deepEqual(parseDutyGrid(serializeDutyGrid(moved)), moved);
});
test("column operations stop at table boundaries and the 12-column limit", () => {
  const full = { cols: Array(12).fill("X"), rows: [Array(12).fill("data")] };
  assert.equal(duplicateDutyColumn(full, 0), full);
  assert.equal(moveDutyColumn(full, 0, -1), full);
  assert.equal(moveDutyColumn(full, 11, 1), full);
  assert.equal(duplicateDutyColumn(full, -1), full);
});
