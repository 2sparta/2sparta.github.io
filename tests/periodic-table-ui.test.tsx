import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { PeriodicTable } from "../src/components/periodic-table";
import { LearningToolsNav } from "../src/components/learning-tools-nav";
import { validateToolSearch } from "../src/lib/learning-tools";
import { type PeriodicLayout, formatNumber } from "../src/lib/periodic/model";

function Fixture() {
  const [number, setNumber] = useState(4);
  const [layout, setLayout] = useState<PeriodicLayout>("compact");
  return (
    <PeriodicTable
      number={number}
      layout={layout}
      onChange={(n, l) => {
        setNumber(n);
        setLayout(l);
      }}
    />
  );
}
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().startsWith(text),
  );
  assert.ok(node, `Button ${text}`);
  return node;
}
async function click(node: HTMLElement) {
  await act(async () => {
    node.click();
  });
}
function field(label: string) {
  const node = document.querySelector(`[aria-label="${label}"]`);
  assert.ok(node, `Field ${label}`);
  return node as HTMLInputElement | HTMLSelectElement;
}
async function fill(label: string, value: string) {
  const node = field(label);
  const select = node.tagName === "SELECT";
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new window.Event(select ? "change" : "input", { bubbles: true }));
  });
}
function property(title: string) {
  const node = [...document.querySelectorAll(".periodic-property")].find((n) =>
    n.querySelector("dt > span")?.textContent?.startsWith(title),
  );
  assert.ok(node, title);
  return node;
}
function value(title: string) {
  return property(title).querySelector("dd strong")!.textContent;
}
function cell(number: number) {
  return document.querySelector(`.periodic-cell[aria-label^="${number}."]`) as HTMLButtonElement;
}

test("rendered table selects elements, changes layouts, converts units and preserves missing values", async () => {
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(<Fixture />);
    });
    assert.equal(document.querySelectorAll(".periodic-cell").length, 118);
    assert.equal(value("Атомна маса"), "9,0121831");
    assert.equal(value("Атомний радіус"), "112");
    assert.equal(value("Твердість"), "600");
    assert.equal(value("Відкриття"), "1798 р. н. е.");
    assert.equal(field("Ступінь іонізації").querySelectorAll("option").length, 4);
    assert.equal(
      property("Поширеність").querySelector("dd strong")!.textContent,
      formatNumber(1e-7),
    );
    await fill("Ступінь іонізації", "4");
    assert.equal(value("Енергія іонізації"), formatNumber(21006.6));
    await fill("Одиниці енергії", "eV");
    assert.equal(value("Енергія іонізації"), formatNumber(21006.6 / 96.4853321233));
    await fill("Одиниця густини", "g/cm³");
    assert.equal(value("Густина"), "1,848");
    await fill("Шкала твердості", "mohs");
    assert.equal(value("Твердість"), "5,5");
    assert.equal(property("Твердість").querySelector(".periodic-unit"), null);
    await fill("Тип радіуса", "vanderwaals");
    assert.equal(value("Атомний радіус"), "Немає даних");
    await fill("Одиниця температури", "F");
    assert.equal(field("Температура для визначення стану").value, "68");
    assert.equal(value("Агрегатний стан"), "Тверде тіло");
    await fill("Одиниця температури", "K");
    assert.equal(field("Температура для визначення стану").value, "293.15");
    await fill("Температура для визначення стану", "-1");
    assert.match(value("Агрегатний стан")!, /абсолютний нуль/);
    await fill("Температура для визначення стану", "");
    assert.equal(value("Агрегатний стан"), "Введіть коректну температуру");
    await fill("Температура для визначення стану", "293,15");
    await click(cell(80));
    assert.equal(document.querySelector("h3")!.textContent, "Меркурій");
    assert.equal(value("Агрегатний стан"), "Рідина");
    await click(button("Довгий"));
    assert.ok(document.querySelector(".periodic-grid-long"));
    assert.equal(cell(57).style.gridRow, "7");
    await click(button("Короткий"));
    assert.equal(cell(57).style.gridRow, "10");
    await fill("Знайти елемент", "залізо");
    assert.equal(document.querySelectorAll(".periodic-cell:not(.periodic-cell-dim)").length, 1);
    await click(button("Fe · Ферум"));
    assert.equal(document.querySelector("h3")!.textContent, "Ферум");
    await fill("Знайти елемент", "неіснуючий");
    assert.match(
      document.querySelector(".periodic-results")!.textContent!,
      /Елементів не знайдено/,
    );
    await click(button("Скинути пошук"));
    await click(button("Галогени"));
    assert.equal(document.querySelectorAll(".periodic-cell:not(.periodic-cell-dim)").length, 5);
    await click(cell(1));
    assert.equal(field("Ступінь іонізації").value, "1");
    assert.equal(field("Ступінь іонізації").querySelectorAll("option").length, 1);
    await click(cell(118));
    assert.equal(value("Атомна маса"), "[294]");
    assert.match(value("Агрегатний стан")!, /Невідомий/);
    assert.equal(document.querySelectorAll(".periodic-cell[aria-pressed=true]").length, 1);
    await click(cell(4));
    cell(4).focus();
    await act(async () => {
      cell(4).dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });
    assert.equal(document.activeElement, cell(3));
  } finally {
    await act(async () => root.unmount());
  }
});

test("useful navigation expands without navigating and its sublinks select tools", async () => {
  let navigations = 0;
  function MenuFixture() {
    const search = useRouterState({
      select: (state) => state.location.search as { section: string; tool?: string },
    });
    return (
      <LearningToolsNav
        active={search.section === "useful"}
        tool={search.tool ?? "atlas"}
        uk
        onNavigate={() => {
          navigations++;
        }}
      />
    );
  }
  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/materials",
    validateSearch: (s) => ({ section: String(s.section ?? "overview"), ...validateToolSearch(s) }),
    component: MenuFixture,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/app/materials?section=overview"] }),
  });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => {
      await router.load();
      root.render(<RouterProvider router={router} />);
    });
    assert.equal(button("Корисне").getAttribute("aria-expanded"), "false");
    await click(button("Корисне"));
    assert.equal(router.state.location.search.section, "overview");
    assert.equal(document.querySelectorAll("#learning-tools-subnav a").length, 3);
    const link = [...document.querySelectorAll("a")].find(
      (n) => n.textContent === "Періодична таблиця",
    )!;
    await act(async () => {
      link.click();
      await new Promise((r) => setTimeout(r, 40));
    });
    assert.equal(router.state.location.search.tool, "periodic");
    assert.equal(router.state.location.search.section, "useful");
    assert.equal(navigations, 1);
    assert.equal(link.getAttribute("aria-current"), "page");
    const chessLink = [...document.querySelectorAll("#learning-tools-subnav a")].find(
      (n) => n.textContent === "Шахи",
    )!;
    await act(async () => {
      chessLink.click();
      await new Promise((r) => setTimeout(r, 40));
    });
    assert.equal(router.state.location.search.tool, "chess");
    assert.equal(chessLink.getAttribute("aria-current"), "page");
    assert.equal(navigations, 2);
    await click(button("Корисне"));
    assert.equal(document.querySelector("#learning-tools-subnav"), null);
  } finally {
    await act(async () => root.unmount());
  }
});
