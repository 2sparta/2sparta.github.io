import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoricalAtlas } from "../src/components/historical-atlas";
import { normalizeAtlasDate, type AtlasDate } from "../src/lib/atlas/date.ts";
import type { AtlasView } from "../src/lib/atlas/model.ts";
const delay = () => new Promise((r) => setTimeout(r, 35));
test("The real atlas changes days/months, fronts and views while retaining the selected date", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = String(input);
    assert.ok(path.startsWith("/atlas/") && !path.includes(".."));
    return new Response(readFileSync(new URL("../public" + path, import.meta.url)));
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { profile: { schoolId: "s", userId: "t", role: "teacher" } });
  client.setQueryData(["atlas-manual", "s", "t"], {
    entries: [],
    revision: 0,
    canEdit: false,
    schoolId: "s",
  });
  let jump = (d: AtlasDate) => {};
  function Page() {
    const [d, setDate] = useState<AtlasDate>({ year: 1936, month: 9, day: 29 });
    const [v, setView] = useState<AtlasView>("spain");
    jump = setDate;
    return (
      <HistoricalAtlas
        {...d}
        view={v}
        onChange={(year, view, date) => {
          setDate(normalizeAtlasDate(year, date?.month, date?.day));
          setView(view);
        }}
      />
    );
  }
  const root = createRoot(document.getElementById("root")!);
  const button = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
  const label = (text: string) =>
    [...document.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(text))!;
  const click = async (e: HTMLElement) =>
    act(async () => {
      e.click();
      await delay();
    });
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Page />
        </QueryClientProvider>,
      );
      await delay();
    });
    for (let i = 0; i < 40 && !document.querySelector('option[value="es-civil-republic"]'); i++)
      await act(async () => {
        await delay();
      });
    const selected = () => document.querySelector('[data-testid="atlas-event-date"]')!.textContent;
    assert.equal(selected(), "29.09.1936");
    assert.match(document.querySelector('[data-testid="spain-snapshot"]')!.textContent!, /07.1936/);
    await click(document.querySelector('[aria-label="Наступний день"]')!);
    assert.equal(selected(), "30.09.1936");
    assert.match(document.querySelector('[data-testid="spain-snapshot"]')!.textContent!, /09.1936/);
    await click(button("Іспанська імперія"));
    assert.equal(selected(), "30.09.1936");
    await click(label("Фронти громадянської війни").querySelector("input")!);
    assert.equal(document.querySelector('option[value="es-civil-republic"]'), null);
    await click(label("Фронти громадянської війни").querySelector("input")!);
    assert.ok(document.querySelector('option[value="es-civil-republic"]'));
    await click(button("01.04.1939"));
    assert.equal(selected(), "01.04.1939");
    assert.equal(document.querySelector('option[value="es-civil-republic"]'), null);
    assert.ok(document.querySelector('option[value="es-civil-victory"]'));
    await act(async () => {
      jump({ year: 1936, month: 2, day: 29 });
      await delay();
    });
    const month = label("Місяць подій").querySelector("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")!.set!.call(
        month,
        "4",
      );
      month.dispatchEvent(new window.Event("change", { bubbles: true }));
      await delay();
    });
    assert.equal(selected(), "29.04.1936");
    await act(async () => {
      jump({ year: 1938, month: 12, day: 31 });
      await delay();
    });
    await click(document.querySelector('[aria-label="Наступний день"]')!);
    assert.equal(selected(), "01.01.1939");
    await act(async () => {
      jump({ year: 1783, month: 1, day: 1 });
      await delay();
    });
    assert.ok(
      [...document.querySelectorAll("option")].some(
        (o) => o.value.startsWith("es-1783-") && o.textContent?.includes("Перу"),
      ),
    );
    await click(label("Колоніальні володіння").querySelector("input")!);
    assert.ok(
      ![...document.querySelectorAll("option")].some(
        (o) => o.value.startsWith("es-1783-") && o.textContent?.includes("Перу"),
      ),
    );
  } finally {
    await act(async () => root.unmount());
    client.clear();
    globalThis.fetch = fetch;
  }
});
