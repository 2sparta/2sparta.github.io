import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoricalAtlas } from "../src/components/historical-atlas";
const delay = () => new Promise((resolve) => setTimeout(resolve, 30));
test("The atlas loads the real dataset, switches occupation/land layers, and changes uprising markers with year", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = String(input);
    assert.ok(path.startsWith("/atlas/") && !path.includes(".."), path);
    return new Response(readFileSync(new URL(`../public${path}`, import.meta.url)), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { profile: { schoolId: "s", userId: "teacher", role: "teacher" } });
  client.setQueryData(["atlas-manual", "s", "teacher"], {
    entries: [],
    revision: 0,
    canEdit: false,
    schoolId: "s",
  });
  let jump: (n: number) => void = () => {};
  function Page() {
    const [year, setYear] = useState(1655);
    jump = setYear;
    return <HistoricalAtlas year={year} view="commonwealth" onChange={setYear} />;
  }
  const root = createRoot(document.getElementById("root")!);
  const check = (name: string) =>
    [...document.querySelectorAll("label")]
      .find((l) => l.textContent?.includes(name))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
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
    for (
      let i = 0;
      i < 30 && !document.querySelector('option[value="pllt-deluge-occupation"]');
      i++
    )
      await act(async () => {
        await delay();
      });
    assert.ok(document.querySelector('option[value="pllt-deluge-occupation"]'));
    assert.ok(document.querySelector('option[value*="moscow-occupation"]'));
    assert.ok(document.querySelector('option[value^="pllt-land-"]'));
    await click(check("Окупації · штрихування"));
    assert.equal(document.querySelector('option[value="pllt-deluge-occupation"]'), null);
    assert.equal(document.querySelector('option[value*="moscow-occupation"]'), null);
    assert.ok(document.querySelector('option[value*="hetmanate"]'));
    await click(check("Історичні українські землі"));
    assert.equal(document.querySelector('option[value^="pllt-land-"]'), null);
    await click(check("Окупації · штрихування"));
    await act(async () => {
      jump(1660);
      await delay();
    });
    assert.equal(document.querySelector('option[value="pllt-deluge-occupation"]'), null);
    await act(async () => {
      jump(1635);
      await delay();
    });
    assert.ok(
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Кодак · Виступ Івана Сулими",
      ),
    );
    await click(check("Козацька автономія та повстання"));
    assert.ok(
      ![...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Кодак · Виступ Івана Сулими",
      ),
    );
    await act(async () => {
      jump(1795);
      await delay();
    });
    assert.equal(document.querySelector('option[value^="pllt-"]'), null);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
