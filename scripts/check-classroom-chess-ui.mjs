import assert from "node:assert/strict";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
const output = "/workspace/screenshots";
const fixtureSource = "src/__classroom-review.tsx", fixtureHtml = "public/__classroom-review.html";
const base = "http://127.0.0.1:8080";
mkdirSync(output, { recursive: true });
assert.ok(!existsSync(fixtureSource) && !existsSync(fixtureHtml), "Refusing to overwrite an existing review fixture");
writeFileSync(fixtureSource, "import React, { useState } from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { QueryClient, QueryClientProvider } from \"@tanstack/react-query\";\nimport { ChessClub, type ChessNavigation } from \"@/components/chess-club\";\nimport { HomeworkStream } from \"@/components/homework-stream\";\nimport { homeworkToday, shiftHomeworkDate } from \"@/lib/school/homework\";\nimport { usePrefs } from \"@/lib/prefs\";\nimport \"@/styles.css\";\nconst params = new URLSearchParams(location.search);\nusePrefs.getState().setTheme(params.get(\"theme\") === \"dark\" ? \"dark\" : \"light\");\nusePrefs.getState().setLang(\"uk\");\nconst client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });\nclient.setQueryData([\"me\"], { profile: { userId: \"review-user\", displayName: \"Гравець клубу\", schoolId: \"review-school\", role: \"student\" } });\nconst today = homeworkToday();\nfunction Fixture() {\n  const [navigation, setNavigation] = useState<ChessNavigation>({ tab: \"play\" });\n  const [items, setItems] = useState([\n    { id: \"math\", title: \"Лінійні рівняння\", subject: \"Алгебра\", due: today, body: \"Розв’яжіть № 8–12.\\nПоясніть хід розв’язання.\", author: \"Учитель математики\", done: false },\n    { id: \"history\", title: \"Українські землі у складі Речі Посполитої\", subject: \"Історія України\", due: shiftHomeworkDate(today, 1), body: \"Опрацюйте матеріал і складіть хронологічну таблицю.\", author: \"Учитель історії\", done: false },\n    { id: \"old\", title: \"Практична робота: вимірювання\", subject: \"Фізика\", due: shiftHomeworkDate(today, -1), body: \"Запишіть результати спостереження.\", done: false },\n    { id: \"done\", title: \"Площа трикутника\", subject: \"Геометрія\", due: today, body: \"Повторення формул.\", done: true },\n  ]);\n  return <QueryClientProvider client={client}><main style={{ maxWidth: 1100, margin: \"20px auto\", padding: 20, background: \"var(--color-surface)\", borderRadius: 22, minWidth: 0 }}>\n    {params.get(\"view\") === \"homework\"\n      ? <HomeworkStream uk items={items} onToggle={(id, done) => setItems((old) => old.map((item) => item.id === id ? { ...item, done } : item))} />\n      : <ChessClub tab={navigation.tab} onNavigate={setNavigation} />}\n  </main></QueryClientProvider>;\n}\ndocument.body.style.padding = \"0 16px\";\ncreateRoot(document.getElementById(\"root\")!).render(<Fixture />);\n");
writeFileSync(fixtureHtml, "<!doctype html><html lang=\"uk\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>UI review fixture</title>\n<script type=\"module\">import RefreshRuntime from \"/@react-refresh\";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>\n</head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/__classroom-review.tsx\"></script></body></html>\n");
const children = [];
function run(command, args, log) {
  return new Promise((resolve, reject) => {
    const descriptor = openSync(log, "w");
    const child = spawn(command, args, { stdio: ["ignore", descriptor, descriptor], env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(command + " failed (" + code + ")\n" + readFileSync(log, "utf8").slice(-8000))));
  });
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await delay(200);
  }
  throw new Error("Dev server did not start");
}
let browser;
try {
  let serving = false;
  try { serving = (await fetch(base)).ok; } catch {}
  if (!serving) {
    const child = spawn("npm", ["run", "dev"], { detached: true, stdio: ["ignore", openSync(output + "/review-dev.log", "w"), openSync(output + "/review-dev.log", "a")] });
    children.push(child);
  }
  await ready();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const results = [];
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(base + "/__classroom-review.html?view=homework&theme=" + theme);
    await page.locator(".hw-card").first().waitFor();
    assert.equal(await page.locator(".hw-card").count(), 4);
    await page.getByRole("button", { name: /Лінійні рівняння/ }).click();
    await page.getByRole("button", { name: "Позначити виконаним", exact: true }).click();
    await page.getByRole("button", { name: "Виконано", exact: true }).click();
    assert.equal(await page.locator(".hw-card").count(), 2);
    await page.getByRole("button", { name: "Усі", exact: true }).click();
    await page.getByLabel("Пошук домашніх завдань", { exact: true }).fill("Лінійні рівняння");
    assert.equal(await page.locator(".hw-card").count(), 1);
    await page.getByLabel("Пошук домашніх завдань", { exact: true }).fill("");
    await page.getByRole("button", { name: /Лінійні рівняння/ }).click();
    await page.screenshot({ path: output + "/homework-review-" + theme + "-" + width + ".png", fullPage: true });
    assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "Homework overflow");
    await page.goto(base + "/__classroom-review.html?view=chess&theme=" + theme);
    await page.getByRole("grid").waitFor();
    await page.locator(".chess-preferences summary").click();
    await page.getByRole("button", { name: "Мінімальні", exact: true }).click();
    assert.equal(await page.locator('.chess-board [data-piece-set="minimal"]').count(), 32);
    await page.getByRole("button", { name: "Горіх", exact: true }).click();
    await page.getByLabel("Координати дошки", { exact: true }).uncheck();
    assert.equal(await page.locator(".chess-rank,.chess-file").count(), 0);
    await page.getByLabel("Координати дошки", { exact: true }).check();
    await page.getByRole("button", { name: "Класичні", exact: true }).click();
    await page.reload();
    await page.getByRole("grid").waitFor();
    assert.ok(await page.locator(".chess-board-wrap").evaluate((element) => element.classList.contains("chess-theme-wood")));
    assert.equal(await page.locator('.chess-board [data-piece-set="classic"]').count(), 32);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".chess-move-row button").length >= 2);
    if (width > 500) {
      const from = await page.locator('[data-square="e2"]').boundingBox(), to = await page.locator('[data-square="e4"]').boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down({ button: "right" });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2);
      await page.mouse.up({ button: "right" });
      assert.equal(await page.locator(".chess-annotations line").count(), 1);
    } else {
      await page.getByRole("button", { name: "Позначки", exact: true }).click();
      await page.locator('[data-square="e4"]').click();
      assert.equal(await page.locator(".chess-annotations circle").count(), 1);
    }
    await page.screenshot({ path: output + "/chess-review-" + theme + "-" + width + ".png", fullPage: true });
    await page.getByRole("button", { name: "Очистити позначки", exact: true }).click();
    assert.equal(await page.locator(".chess-annotations circle,.chess-annotations line").count(), 0);
    assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "Chess overflow");
    assert.deepEqual(errors, []);
    results.push({ width, theme, errors, overflow: false });
    await context.close();
  }
  writeFileSync(output + "/classroom-chess-review.json", JSON.stringify(results, null, 2));
  // Fixtures must never be present in the publishable build.
  rmSync(fixtureSource); rmSync(fixtureHtml);
  // The root route discovers additional dependencies after the isolated fixtures.
  // Let Vite complete that optimization, and verify real hydration before auditing
  // fresh pages. No errors from the actual smoke run are suppressed or retried.
  const warm = await browser.newPage();
  await warm.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await warm.route("https://grok.com/grok-app-builder/extensions.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await warm.goto(base, { waitUntil: "domcontentloaded" });
      const toggle = warm.getByRole("button", { name: /^(Dark|Light) theme$/ });
      await toggle.waitFor({ state: "visible", timeout: 6000 });
      const before = await toggle.getAttribute("aria-label");
      const after = before === "Dark theme" ? "Light theme" : "Dark theme";
      await toggle.click();
      await warm.getByRole("button", { name: after, exact: true }).waitFor({ state: "visible", timeout: 6000 });
      await warm.getByRole("button", { name: after, exact: true }).click();
      await warm.getByRole("button", { name: before, exact: true }).waitFor({ state: "visible" });
      break;
    } catch (error) { if (attempt === 2) throw error; }
  }
  await warm.close();
  await browser.close(); browser = null;
  await run("node", ["--import", "./scripts/review-smoke-runtime.mjs", "scripts/browser-smoke.mjs", base + "/", output + "/review-dev.png"], output + "/review-dev-smoke.log");
  await run("npm", ["run", "build"], output + "/review-build.log");
  assert.ok(!existsSync(".vercel/output/static/__classroom-review.html"), "Review HTML leaked into the build");
  await run("npm", ["run", "preview:restart"], output + "/review-preview.log");
  await run("node", ["--import", "./scripts/review-smoke-runtime.mjs", "scripts/browser-smoke.mjs", "http://127.0.0.1:8081/", output + "/review-production.png", "--baseline", output + "/review-dev.json"], output + "/review-production-smoke.log");
  const production = JSON.parse(readFileSync(output + "/review-production.json", "utf8"));
  assert.equal(production.divergesFromBaseline, false);
  for (const view of Object.values(production.viewports)) {
    assert.deepEqual(view.consoleErrors, []); assert.deepEqual(view.pageErrors, []);
    assert.equal(view.horizontalOverflow, false);
  }
  console.log("Homework/chess desktop and mobile UI checks passed in both themes; dev/production smoke agrees.");
} finally {
  if (browser) await browser.close();
  // Optional review transport for environments without a local image viewer.
  // Only generated fixture/sign-in screenshots are emitted, never user data.
  if (process.env.REVIEW_INLINE_IMAGES === "1") {
    const names = [
      "review-dev.png", "review-dev-mobile.png", "review-production.png", "review-production-mobile.png",
      ...["homework", "chess"].flatMap((view) => ["light", "dark"].flatMap((theme) =>
        [1440, 390].map((width) => view + "-review-" + theme + "-" + width + ".png"))),
    ];
    for (const name of names) if (existsSync(output + "/" + name)) {
      const encoded = readFileSync(output + "/" + name).toString("base64");
      console.log("REVIEW_PNG_BEGIN " + name + " " + encoded.length);
      for (let offset = 0; offset < encoded.length; offset += 6000)
        console.log("REVIEW_PNG_CHUNK " + name + " " + encoded.slice(offset, offset + 6000));
      console.log("REVIEW_PNG_END " + name);
    }
  }
  rmSync(fixtureSource, { force: true }); rmSync(fixtureHtml, { force: true });
  for (const child of children) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
  try { await run("npm", ["run", "preview:stop"], output + "/review-preview-stop.log"); } catch {}
}
