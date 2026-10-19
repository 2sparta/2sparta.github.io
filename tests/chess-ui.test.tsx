import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { ChessClub, type ChessNavigation } from "../src/components/chess-club";
import { ChessBoard } from "../src/components/chess/board";
import { searchPosition } from "../src/lib/chess/engine.ts";
import type { ChessApi } from "../src/lib/chess/api";
const tick = (n = 30) => new Promise((r) => setTimeout(r, n));
const byText = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
async function click(e: Element) {
  await act(async () => {
    (e as HTMLElement).click();
    await tick();
  });
}
async function fill(e: HTMLTextAreaElement | HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      e instanceof window.HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(e, value);
    e.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick();
  });
}
test("The board exposes legal targets, supports keyboard navigation and offers underpromotion", async () => {
  let move = "";
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        <ChessBoard board={new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1")} onMove={(m) => (move = m)} />,
      ),
    );
    await click(document.querySelector('[data-square="a7"]')!);
    assert.match(
      document.querySelector('[data-square="a8"]')!.getAttribute("aria-label")!,
      /можливий хід/,
    );
    await click(document.querySelector('[data-square="a8"]')!);
    assert.ok(document.querySelector('[role="dialog"]'));
    await click(document.querySelector('button[aria-label="кінь"]')!);
    assert.equal(move, "a7a8n");
    const cell = document.querySelector<HTMLElement>('[data-square="h1"]')!;
    await act(async () => {
      cell.focus();
      cell.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    assert.equal(document.activeElement?.getAttribute("data-square"), "g1");
  } finally {
    await act(async () => root.unmount());
  }
});
test("The actual club plays a bot reply, keeps move history, loads openings and validates PGN/FEN imports", async () => {
  const originalWorker = globalThis.Worker,
    originalFetch = globalThis.fetch;
  globalThis.localStorage = window.localStorage;
  localStorage.clear();
  class TestWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: any;
    timer: ReturnType<typeof setTimeout> | undefined;
    postMessage(data: any) {
      this.timer = setTimeout(() => {
        this.onmessage?.({
          data: { id: data.id, result: searchPosition(data.fen, 1, 100, data.history) },
        });
      }, 1);
    }
    terminate() {
      clearTimeout(this.timer);
    }
  }
  globalThis.Worker = TestWorker as any;
  globalThis.fetch = async () =>
    new Response(readFileSync(new URL("../public/chess/openings.json", import.meta.url)), {
      headers: { "Content-Type": "application/json" },
    });
  const unexpected = () => {
    throw new Error("Unexpected online call");
  };
  const api = {
    action: unexpected,
    game: unexpected,
    lobby: unexpected,
    mine: unexpected,
    tournament: unexpected,
    tournaments: unexpected,
    tournamentGames: unexpected,
  } as unknown as ChessApi;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], {
    profile: { userId: "a", displayName: "Alice", schoolId: "s", role: "student" },
  });
  function Page() {
    const [n, setN] = useState<ChessNavigation>({ tab: "play" });
    return (
      <QueryClientProvider client={client}>
        <ChessClub tab={n.tab} onNavigate={setN} api={api} />
      </QueryClientProvider>
    );
  }
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(<Page />);
      await tick();
    });
    await click(document.querySelector('[data-square="e2"]')!);
    await click(document.querySelector('[data-square="e4"]')!);
    for (let i = 0; i < 30 && document.querySelectorAll(".chess-move-row button").length < 2; i++)
      await act(async () => tick());
    assert.equal(document.querySelectorAll(".chess-move-row button").length, 2);
    assert.match(localStorage.getItem("school-chess-local:v1:a")!, /e2e4/);
    await click(document.querySelector('button[aria-label="До початку"]')!);
    assert.match(
      document.querySelector('[data-square="e2"]')!.getAttribute("aria-label")!,
      /пішак/,
    );
    await click(byText("Дебюти"));
    for (let i = 0; i < 30 && !document.querySelector(".chess-opening-results>button"); i++)
      await act(async () => tick());
    assert.ok(document.querySelectorAll(".chess-guides button").length >= 12);
    assert.ok(document.querySelector(".chess-opening-results>button"));
    await click(byText("Аналіз"));
    const input = document.querySelector("textarea")!;
    await fill(input, "nonsense");
    await click(byText("Завантажити позицію"));
    assert.ok(document.querySelector('[role="alert"]'));
    await fill(input, "7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
    await click(byText("Завантажити позицію"));
    for (let i = 0; i < 30 && !document.querySelector(".chess-engine-line"); i++)
      await act(async () => tick());
    assert.match(document.querySelector(".chess-engine-line")!.textContent!, /#/);
    assert.equal(document.querySelector('[role="alert"]'), null);
    await click(document.querySelector(".chess-engine-line")!);
    assert.match(document.querySelector(".chess-move-list")!.textContent!, /#/);
    const longGame = new Chess();
    for (let i = 0; i < 150; i++)
      for (const move of ["Nf3", "Nf6", "Ng1", "Ng8"]) longGame.move(move);
    await fill(input, longGame.pgn());
    await click(byText("Завантажити позицію"));
    await click(document.querySelector('[data-square="e2"]')!);
    await click(document.querySelector('[data-square="e4"]')!);
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /600 півходів/);
    assert.equal(document.querySelectorAll(".chess-move-row button").length, 600);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    globalThis.Worker = originalWorker;
    globalThis.fetch = originalFetch;
  }
});
