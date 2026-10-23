import assert from "node:assert/strict";
import { existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
const output = "/workspace/screenshots",
  fixtureName = `__atlas-learning-review-${process.pid}.html`,
  html = `public/${fixtureName}`,
  prefix = `${output}/atlas-learning-restored`;
mkdirSync(output, { recursive: true });
assert.ok(!existsSync(html), "Review HTML already exists");
writeFileSync(
  html,
  `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Atlas learning review</title><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/tests/fixtures/atlas-learning-review.tsx"></script></body></html>`,
);
const listening = () =>
  new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: 8080 });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
let child, browser;
try {
  if (!(await listening())) {
    const log = openSync(`${prefix}-server.log`, "w");
    child = spawn("npm", ["run", "dev"], { detached: true, stdio: ["ignore", log, log] });
  }
  for (let i = 0; i < 300 && !(await listening()); i++) await delay(200);
  browser = await chromium.launch({
    ...(process.env.REVIEW_CHROMIUM ? { executablePath: process.env.REVIEW_CHROMIUM } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const results = [];
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } }),
      errors = [];
    page.setDefaultTimeout(45000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const base = `http://127.0.0.1:8080/${fixtureName}`,
      theme = width === 390 ? "dark" : "light";
    await page.goto(base + "?theme=" + theme, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator(".leaflet-overlay-pane path").first().waitFor({ state: "attached" });
    assert.equal(await page.getByRole("button", { name: "Світ", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Приклад: 1772 → 1795", exact: true }).click();
    // Development dependency optimization can reload the first request for a worker.
    for (let attempt = 0; attempt < 90; attempt++) {
      if (await page.getByTestId("atlas-comparison-summary").count()) break;
      const toggle = page.getByRole("checkbox", { name: "Порівняти дві дати", exact: true });
      if ((await toggle.count()) && !(await toggle.isChecked()))
        await page.getByRole("button", { name: "Приклад: 1772 → 1795", exact: true }).click();
      await delay(1000);
    }
    await page.getByTestId("atlas-comparison-summary").waitFor({ timeout: 1000 });
    assert.match(await page.getByTestId("atlas-comparison-summary").innerText(), /[1-9]\d*/);
    const changes = page.locator(".leaflet-atlas-comparison-pane path");
    assert.ok((await changes.count()) > 0);
    await changes.first().dispatchEvent("click");
    assert.match(
      await page.getByRole("region", { name: "Перехід території", exact: true }).innerText(),
      /1795/,
    );
    await page.locator(".atlas-map").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${prefix}-comparison-${width}.png`, fullPage: true });
    await page.getByRole("checkbox", { name: "Порівняти дві дати", exact: true }).uncheck();
    assert.equal(await changes.count(), 0);
    const route = page.getByRole("combobox", { name: "Навчальний маршрут", exact: true });
    for (const [id, first, last, steps] of [
      ["partitions", "05.08.1772", "24.10.1795", 4],
      ["cossacks", "01.01.1591", "01.01.1638", 7],
      ["byzantium", "01.01.1204", "29.05.1453", 3],
    ]) {
      await route.selectOption(id);
      await page.getByTestId("atlas-event-date").filter({ hasText: first }).waitFor();
      assert.equal(await page.locator(".atlas-event-marker").count(), steps);
      for (let i = 1; i < steps; i++)
        await page.getByRole("button", { name: "Далі", exact: true }).click();
      assert.equal(await page.getByTestId("atlas-event-date").innerText(), last);
      assert.ok(
        await page.getByRole("button", { name: "Маршрут завершено", exact: true }).isDisabled(),
      );
      await page.getByRole("button", { name: "Назад", exact: true }).click();
      assert.notEqual(await page.getByTestId("atlas-event-date").innerText(), last);
    }
    await route.selectOption("partitions");
    await page.locator('.atlas-event-marker[title="Другий поділ Речі Посполитої"]').click();
    const card = page.getByRole("region", { name: "Опис події", exact: true });
    assert.match(await card.innerText(), /Наслідки/);
    assert.ok((await card.locator('a[href^="https://"]').count()) > 0);
    assert.equal(await page.getByTestId("atlas-event-date").innerText(), "23.01.1793");
    await page.getByRole("checkbox", { name: "Події на мапі", exact: true }).uncheck();
    assert.equal(await page.locator(".atlas-event-marker").count(), 0);
    await page.getByRole("checkbox", { name: "Події на мапі", exact: true }).check();
    assert.equal(await page.locator(".atlas-event-marker").count(), 4);
    assert.ok(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
      "Map overflow",
    );
    await page.locator(".atlas-map").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${prefix}-map-${width}.png`, fullPage: true });
    await page.goto(base + "?view=article&theme=" + theme);
    // The map must be available through the normal widget type selector too.
    await page.getByRole("combobox", { name: "Тип віджета", exact: true }).selectOption("callout");
    await page.getByRole("combobox", { name: "Тип віджета", exact: true }).selectOption("map");
    const year = page.getByRole("spinbutton", { name: "Дата фрагмента: рік", exact: true });
    await year.fill("0");
    await year.press("Tab");
    assert.ok(
      await page.getByRole("button", { name: "Вставити у статтю", exact: true }).isDisabled(),
    );
    await year.fill("1795");
    await year.press("Tab");
    for (const [field, value] of [
      ["місяць", "10"],
      ["день", "24"],
    ]) {
      const input = page.getByRole("spinbutton", { name: "Дата фрагмента: " + field, exact: true });
      await input.fill(value);
      await input.press("Tab");
    }
    for (const [name, value] of [
      ["Широта", "51"],
      ["Довгота", "24"],
      ["Масштаб", "5"],
    ])
      await page.getByRole("spinbutton", { name, exact: true }).fill(value);
    await page
      .getByRole("group", { name: "Шари фрагмента", exact: true })
      .getByRole("checkbox", { name: "Річки", exact: true })
      .uncheck();
    await page.locator(".leaflet-overlay-pane path").first().waitFor({ state: "attached" });
    await page.locator(".leaflet-control-zoom-in").click();
    await page.getByRole("button", { name: "Зберегти цей ракурс у віджеті", exact: true }).click();
    const zoom = Number(
      await page.getByRole("spinbutton", { name: "Масштаб", exact: true }).inputValue(),
    );
    assert.ok(zoom > 5);
    await page.getByRole("button", { name: "Вставити у статтю", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Редагувати фрагмент", exact: true }).waitFor();
    await page.locator(".atlas-map").waitFor();
    const stored = await page.evaluate(() => localStorage.getItem("atlas-learning-review-body"));
    assert.match(stored, /1795/);
    assert.match(stored, /"zoom":/);
    assert.equal(await page.getByRole("checkbox", { name: "Річки", exact: true }).count(), 0);
    const events = page.getByRole("checkbox", { name: "Події", exact: true });
    await events.uncheck();
    assert.equal(await page.locator(".atlas-event-marker").count(), 0);
    await page.getByRole("button", { name: "Початковий вигляд", exact: true }).click();
    assert.ok(await events.isChecked());
    assert.equal(
      await page.evaluate(() => localStorage.getItem("atlas-learning-review-body")),
      stored,
    );
    assert.ok(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
      "Article overflow",
    );
    await page.screenshot({ path: `${prefix}-article-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Редагувати фрагмент", exact: true }).click();
    assert.equal(
      Number(await page.getByRole("spinbutton", { name: "Масштаб", exact: true }).inputValue()),
      zoom,
    );
    assert.equal(
      await page.getByRole("spinbutton", { name: "Дата фрагмента: рік", exact: true }).inputValue(),
      "1795",
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      routes: 3,
      markers: true,
      comparison: true,
      articleRoundTrip: true,
      errors,
    });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  writeFileSync(`${prefix}-review.json`, JSON.stringify(results, null, 2));
} catch (error) {
  for (const page of browser?.contexts().flatMap((c) => c.pages()) ?? []) {
    try {
      await page.screenshot({ path: `${prefix}-failure.png`, fullPage: true });
    } catch {}
  }
  throw error;
} finally {
  await browser?.close();
  if (existsSync(html)) unlinkSync(html);
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
