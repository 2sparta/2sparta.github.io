import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HomeworkStream } from "../src/components/homework-stream";
import type { HomeworkItem } from "../src/lib/school/homework";
const tick = () => new Promise((r) => setTimeout(r, 15));
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
const card = (title: string) => [...document.querySelectorAll<HTMLButtonElement>(".hw-card-toggle")].find((b) => b.textContent?.includes(title))!;
async function click(element: Element) { await act(async () => { (element as HTMLElement).click(); await tick(); }); }
async function fill(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick();
  });
}
test("Homework cards expand, complete, filter and preserve the actual teacher actions", async () => {
  const data: HomeworkItem[] = [
    { id: "math", title: "Лінійні рівняння", subject: "Алгебра", body: "Розв’яжіть № 8.\nПоясніть відповідь.", due: "2026-10-20", done: false, author: "Петренко" },
    { id: "history", title: "Козацька держава", subject: "Історія", body: "Параграф 12", due: "2026-10-19", done: false },
    { id: "done", title: "Трикутники", subject: "Геометрія", body: "", due: "2026-10-18", done: true },
  ];
  const updates: { id: string; done: boolean }[] = [];
  let deleted = "";
  function Fixture() {
    const [items, setItems] = useState(data);
    return <HomeworkStream items={items} uk today="2026-10-20"
      onToggle={(id, done) => { updates.push({ id, done }); setItems((old) => old.map((item) => item.id === id ? { ...item, done } : item)); }}
      renderActions={(item) => <button type="button" onClick={() => { deleted = item.id; }}>Журнал учителя</button>} />;
  }
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<Fixture />));
    assert.equal(document.querySelectorAll(".hw-card").length, 3);
    assert.equal(card("Лінійні рівняння").getAttribute("aria-expanded"), "false");
    await click(card("Лінійні рівняння"));
    assert.match(document.querySelector(".hw-description")!.textContent!, /Поясніть відповідь/);
    await click(button("Журнал учителя")); assert.equal(deleted, "math");
    await click(button("Позначити виконаним"));
    assert.deepEqual(updates, [{ id: "math", done: true }]);
    await click(button("Виконано"));
    assert.equal(document.querySelectorAll(".hw-card").length, 2);
    await click(button("До виконання"));
    assert.equal(document.querySelectorAll(".hw-card").length, 1);
    await click(button("Усі"));
    await fill(document.querySelector('input[type="search"]')!, "ПЕТРЕНКО");
    assert.equal(document.querySelectorAll(".hw-card").length, 1);
    await click(card("Лінійні рівняння"));
    assert.match(document.querySelector(".hw-personal-note")!.textContent!, /не здача роботи/);
    await fill(document.querySelector('input[type="search"]')!, "немає такого завдання");
    assert.ok(document.querySelector(".hw-empty"));
    await click(button("Скинути фільтри"));
    assert.equal(document.querySelectorAll(".hw-card").length, 3);
  } finally { await act(async () => root.unmount()); }
});
test("Loading and error states expose retry instead of hiding the failure", async () => {
  let retried = false;
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<HomeworkStream uk items={[]} loading />));
    assert.ok(document.querySelector(".hw-skeleton"));
    await act(async () => root.render(<HomeworkStream uk items={[]} error="Не вдалося завантажити" onRetry={() => { retried = true; }} />));
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /Не вдалося/);
    await click(button("Спробувати ще"));
    assert.equal(retried, true);
  } finally { await act(async () => root.unmount()); }
});
