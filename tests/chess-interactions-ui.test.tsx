import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chess } from "chess.js";
import { ChessBoard } from "../src/components/chess/board";
import { ChessPreferences } from "../src/components/chess/preferences";
import { usePremove } from "../src/components/chess/use-premove";
import { useChessPreferences } from "../src/lib/chess/preferences";
import { replay } from "../src/lib/chess/model";
const tick = () => new Promise((r) => setTimeout(r, 15));
async function click(e: Element) { await act(async () => { (e as HTMLElement).click(); await tick(); }); }
const square = (name: string) => document.querySelector('[data-square="' + name + '"]')!;
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
test("A premove waits, executes once after the reply, and clears on invalidation or cancellation", async () => {
  const sent: string[] = [];
  function Fixture() {
    const [moves, setMoves] = useState(["e2e4"]), [clock, setClock] = useState(0);
    const board = replay(moves);
    const queue = usePremove({ fen: board.fen(), color: "w", context: "test", ply: moves.length,
      active: true, enabled: true, ready: true,
      onPlay: (move) => { sent.push(move); setMoves((old) => [...old, move]); } });
    return <><ChessBoard board={board} premoveColor={board.turn() === "b" ? "w" : undefined}
      queuedPremove={queue.move} onPremove={queue.queue} onCancelPremove={queue.cancel}
      onMove={() => {}} />
      <output>{queue.move ?? "empty"}</output><span>{clock}</span>
      <button onClick={() => setMoves((old) => [...old, "e7e5"])}>Відповідь</button>
      <button onClick={() => { queue.cancel(); setMoves(["e2e4"]); sent.length = 0; }}>Скинути</button>
      <button onClick={() => setClock((n) => n + 1)}>Годинник</button></>;
  }
  useChessPreferences.getState().reset();
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<Fixture />));
    await click(square("g1")); await click(square("f3"));
    assert.equal(document.querySelector("output")!.textContent, "g1f3");
    assert.equal(sent.length, 0);
    await click(button("Відповідь"));
    assert.deepEqual(sent, ["g1f3"]);
    await click(button("Годинник")); assert.equal(sent.length, 1);
    assert.equal(document.querySelector("output")!.textContent, "empty");
    await click(button("Скинути"));
    await click(square("e4")); await click(square("e5"));
    await click(button("Відповідь"));
    assert.equal(sent.length, 0);
    assert.equal(document.querySelector("output")!.textContent, "empty");
    await click(button("Скинути"));
    await click(square("g1")); await click(square("f3"));
    await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })));
    assert.equal(document.querySelector("output")!.textContent, "empty");
  } finally { await act(async () => root.unmount()); useChessPreferences.getState().reset(); }
});
test("Piece sets, board colours, coordinates and premove underpromotion are selectable", async () => {
  useChessPreferences.getState().reset();
  let premove = "";
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<><ChessPreferences uk /><ChessBoard
      board={new Chess("7k/P7/8/8/8/8/8/7K b - - 0 1")} premoveColor="w"
      onPremove={(move) => { premove = move; }} /></>));
    assert.ok(document.querySelector('.chess-piece[data-piece-set="classic"]'));
    await click(document.querySelector('button[aria-label="Мінімальні"]')!);
    assert.ok(square("a7").querySelector('[data-piece-set="minimal"]'));
    await click(document.querySelector('button[aria-label="Горіх"]')!);
    assert.ok(document.querySelector(".chess-board-wrap.chess-theme-wood"));
    const coordinateToggle = [...document.querySelectorAll("label")].find((e) => e.textContent?.includes("Координати дошки"))!.querySelector("input")!;
    await click(coordinateToggle);
    assert.equal(document.querySelectorAll(".chess-rank,.chess-file").length, 0);
    await click(square("a7")); await click(square("a8"));
    assert.ok(document.querySelector('[role="dialog"]'));
    await click(document.querySelector('button[aria-label="кінь"]')!);
    assert.equal(premove, "a7a8n");
  } finally { await act(async () => root.unmount()); useChessPreferences.getState().reset(); }
});
test("Board annotations toggle and clear without making a chess move", async () => {
  let moves = 0;
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<ChessBoard board={new Chess()} onMove={() => { moves++; }} />));
    const grid = document.querySelector<HTMLDivElement>(".chess-board")!;
    grid.getBoundingClientRect = () => ({ left: 0, top: 0, right: 808, bottom: 808, width: 808, height: 808, x: 0, y: 0, toJSON: () => ({}) });
    async function draw(from: string, x: number, y: number) {
      await act(async () => {
        square(from).dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 2, clientX: x, clientY: y }));
        grid.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, button: 2, clientX: x, clientY: y }));
        await tick();
      });
    }
    await draw("e4", 454, 454);
    assert.equal(document.querySelectorAll(".chess-annotations circle").length, 1);
    await draw("e4", 454, 454);
    assert.equal(document.querySelectorAll(".chess-annotations circle").length, 0);
    await draw("e4", 454, 454);
    await click(button("Очистити позначки"));
    assert.equal(document.querySelectorAll(".chess-annotations circle").length, 0);
    assert.equal(moves, 0);
  } finally { await act(async () => root.unmount()); }
});
