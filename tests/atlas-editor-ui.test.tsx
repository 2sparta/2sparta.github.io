import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { AtlasEditingPanel, useAtlasEditor } from "../src/components/atlas-editing-panel";
import { HistoricalMapCanvas } from "../src/components/historical-map-canvas";
import {
  applyAtlasEdits,
  newAtlasEdit,
  validateAtlasEdits,
  type AtlasEdit,
} from "../src/lib/atlas/edits";
import type { HistoricalFeature } from "../src/lib/atlas/model";
const base: HistoricalFeature = {
  type: "Feature",
  id: "kyiv",
  properties: {
    name: "Principality of Kyiv",
    subject: "Русь",
    color: "#b99565",
    precision: 1,
    region: "rus",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [28, 49],
        [33, 49],
        [33, 52],
        [28, 52],
        [28, 49],
      ],
    ],
  },
};
let saved: AtlasEdit[] = [];
const delay = () => new Promise((r) => setTimeout(r, 25));
function Fixture() {
  const editor = useAtlasEditor();
  const [entries, setEntries] = useState<AtlasEdit[]>(() =>
    validateAtlasEdits([
      {
        ...newAtlasEdit(1240, base, true),
        name: "Русь — залежність",
        subject: "Золота Орда",
        relation: "Данницька залежність",
        color: "#c04e31",
        from: 1240,
        to: 1260,
      },
    ]),
  );
  const baseCollection = { type: "FeatureCollection" as const, features: [base] };
  return (
    <>
      <AtlasEditingPanel
        editor={editor}
        entries={entries}
        base={baseCollection}
        year={1240}
        uk
        saving={false}
        canEdit
        onSave={async (next) => {
          saved = validateAtlasEdits(next);
          setEntries(saved);
          return true;
        }}
        onRemove={async (id) => {
          saved = entries.filter((x) => x.id !== id);
          setEntries(saved);
          return true;
        }}
        onRefresh={() => {}}
        error=""
      />
      <HistoricalMapCanvas
        historical={applyAtlasEdits(baseCollection, entries, 1240)}
        places={[]}
        view="rus"
        uk
        borders
        riverLayer={false}
        onPlace={() => {}}
        onPolity={() => {}}
        edit={editor.canvas}
      />
    </>
  );
}
function button(text: string) {
  const b = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  assert.ok(b, `Button ${text}`);
  return b;
}
function field(text: string, tag = "input") {
  const label = [...document.querySelectorAll("label")].find((l) =>
    l.textContent?.trim().startsWith(text),
  );
  assert.ok(label, `Label ${text}`);
  const input = label.querySelector(tag);
  assert.ok(input, `Field ${text}`);
  return input as HTMLInputElement;
}
async function click(text: string) {
  await act(async () => {
    button(text).click();
    await delay();
  });
}
async function fill(text: string, value: string, tag = "input") {
  const el = field(text, tag);
  await act(async () => {
    const proto =
      tag === "select" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new window.Event(tag === "select" ? "change" : "input", { bubbles: true }));
    await delay();
  });
}
test("The actual editor draws and updates valid geometry, supports undo, and renders SVG hatches above the core country", async () => {
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(<Fixture />);
      await delay();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
    assert.ok(document.querySelector(".leaflet-atlas-custom-pane svg defs pattern"));
    const hatch = document.querySelector('.leaflet-atlas-custom-pane svg path[fill^="url"]');
    assert.ok(hatch);
    assert.ok(document.querySelector(".leaflet-overlay-pane svg path"));
    await click("Редактор країн і територій");
    await fill("Наявний контур цього року", "kyiv", "select");
    await click("Виправити контур");
    assert.equal(document.querySelectorAll(".atlas-edit-vertex").length, 4);
    await fill("Точка", "1", "select");
    await fill("Довгота", "34");
    await click("Змінити координати");
    await click("Скасувати точку");
    assert.equal(field("Точка", "select").value, "");
    await click("Повторити");
    await click("Зберегти у спільному атласі");
    assert.equal(saved.length, 2);
    const edited = saved.find((e) => e.operation === "replace")!;
    assert.equal(edited.geometry.coordinates[0][1][0], 34);
    const painted = [...document.querySelectorAll(".leaflet-atlas-custom-pane svg > g > path")];
    assert.ok(
      painted.at(-1)?.getAttribute("fill")?.startsWith("url("),
      "Relative hatch stays above later core edits",
    );
    assert.ok(document.querySelector(".leaflet-atlas-custom-pane svg defs pattern"));
    await click("Нова відносна територія");
    await fill("Назва території", "Нова залежна область");
    await fill("Держава / сторона", "Золота Орда");
    const map = document.querySelector(".atlas-map")!;
    for (const [x, y] of [
      [280, 140],
      [450, 145],
      [420, 280],
    ])
      await act(async () => {
        map.dispatchEvent(
          new window.MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
        );
        await delay();
      });
    await click("Завершити малювання");
    assert.equal(document.querySelectorAll(".atlas-edit-vertex").length, 3);
    await click("Зберегти у спільному атласі");
    assert.equal(saved.length, 3);
    assert.equal(saved.find((e) => e.name === "Нова залежна область")?.control, "relative");
    assert.ok(document.querySelector(".leaflet-atlas-custom-pane svg defs pattern"));
    assert.equal(document.querySelectorAll(".atlas-edit-vertex").length, 0);
  } finally {
    await act(async () => root.unmount());
  }
});
