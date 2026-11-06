import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { chromium } from "playwright";

// Isolated, temporary component fixtures. No Firebase writes or authentication bypass in the app.
const source = "src/__experience-review.tsx";
const html = "public/__experience-review.html";
const output = "/workspace/screenshots";
assert.ok(!existsSync(source) && !existsSync(html), "Review fixture already exists");
mkdirSync(output, { recursive: true });
writeFileSync(
  source,
  `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider, Outlet, useSearch, useNavigate } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { HomePage } from '@/routes/app/index';
import { ChessClub } from '@/components/chess-club';
import { validateToolSearch } from '@/lib/learning-tools';
import { HomeworkStream } from '@/components/homework-stream';
import { SoundFeedback } from '@/components/sound-controls';
import { DEFAULT_SETTINGS } from '@/lib/school/settings';
import { usePrefs } from '@/lib/prefs';
import '@/styles.css';
const params = new URLSearchParams(location.search);
const role = params.get('role') || 'student';
usePrefs.getState().setTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
usePrefs.getState().setLang('uk');
const profile = { userId:'review-user', role, displayName:'Олександр Коваль', schoolId:'review-school', classId:'8a', className:'8-А', schoolName:'Ліцей «Горизонт»', isAdmin:role === 'teacher', points:120 };
const client = new QueryClient({ defaultOptions:{ queries:{ staleTime:Infinity, retry:false, refetchOnWindowFocus:false } } });
client.setQueryData(['me'], { profile, nextStep:'app' });
client.setQueryData(['school-settings','review-school','review-user'], { settings:DEFAULT_SETTINGS });
client.setQueryData(['notices'], { notices:[] });
client.setQueryData(['home'], { stats:{ students:24, subjects:9, lessonsToday:0, points:120 }, today:[] });
client.setQueryData(['materials','review-school'], { materials:[] });
const root = createRootRoute({ component:() => <QueryClientProvider client={client}><SoundFeedback/><Outlet/></QueryClientProvider> });
const app = createRoute({ getParentRoute:() => root, path:'/app', component:() => <AppShell profile={profile as any}/> });
const home = createRoute({ getParentRoute:() => app, path:'/', component:HomePage });
function Materials() { const search = useSearch({ strict:false }) as any; const navigate = useNavigate(); return <ChessClub tab={search.chessTab} onNavigate={(n)=>void navigate({ to:'/app/materials', search:{section:'useful',tool:'chess',chessTab:n.tab} })}/>; }
const materials = createRoute({ getParentRoute:() => app, path:'materials', validateSearch:(s)=>({section:String(s.section || 'overview'),...validateToolSearch(s)}), component:Materials });
function Homework() { const [done,setDone] = useState(false);return <HomeworkStream uk items={[{ id:'one', title:'Лінійні рівняння', subject:'Алгебра', due:'2026-11-07', body:'Розв’яжіть рівняння та поясніть свій розв’язок.', done }]} onToggle={(_,value)=>setDone(value)}/>; }
const routes = ['schedule','homework','tasks','grades','students','announcements','chat','clubs','selfgov','teachers','settings'].map((path) => createRoute({ getParentRoute:() => app, path, component:path === 'homework' ? Homework : () => <section><h1>{path}</h1><p>Navigation review fixture</p></section> }));
const router = createRouter({ routeTree:root.addChildren([app.addChildren([home,materials,...routes])]), history:createMemoryHistory({ initialEntries:[params.get('page') === 'home' ? '/app' : '/app/materials?section=useful&tool=chess'] }) });
const reactRoot = (window as any).__experienceRoot ??= createRoot(document.getElementById('root')!);
reactRoot.render(<RouterProvider router={router}/>);
if (import.meta.hot) import.meta.hot.dispose(()=>{reactRoot.unmount();delete (window as any).__experienceRoot;});
`,
);
writeFileSync(
  html,
  `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experience review fixture</title><link rel="icon" href="/favicon.svg"><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/src/__experience-review.tsx"></script></body></html>`,
);

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const reports = [];
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        hasTouch: width === 390,
      });
      await context.addInitScript(() => {
        window.__audioCreated = 0;
        window.__audioNotes = 0;
        const NativeAudio = window.AudioContext;
        window.AudioContext = class extends NativeAudio {
          constructor(...args) {
            super(...args);
            window.__audioCreated++;
          }
          createOscillator() {
            const oscillator = super.createOscillator(),
              start = oscillator.start.bind(oscillator);
            oscillator.start = (...args) => {
              window.__audioNotes++;
              return start(...args);
            };
            return oscillator;
          }
        };
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("response", (r) => {
        if (r.status() >= 400) console.error("HTTP", r.status(), r.url());
      });
      await page.goto(`http://127.0.0.1:8080/__experience-review.html?theme=${theme}`);
      await page
        .getByRole("grid")
        .waitFor()
        .catch(async (error) => {
          await page.screenshot({ path: output + "/experience-failed.png", fullPage: true });
          writeFileSync(output + "/experience-failed.html", await page.content());
          console.error("Fixture errors", JSON.stringify(errors));
          throw error;
        });
      assert.equal(
        await page.locator('.app-navigation [aria-current="page"]').count(),
        1,
        "Only the actual page is current in the sidebar",
      );
      assert.equal(
        await page.locator('.app-mobile-nav [aria-current="page"]').count(),
        1,
        "Only the actual page is current in mobile navigation",
      );
      assert.equal(await page.evaluate(() => window.__audioCreated), 0, "Audio must not autoplay");
      const board = page.getByRole("grid");
      const bounds = await board.boundingBox();
      assert.ok(
        bounds.width >= (width === 390 ? 330 : 440),
        "The board should have useful sized squares",
      );
      if (width === 390)
        assert.ok(bounds.y < 340, "Mobile board should not be buried under headers");
      // Both tap-to-move and pointer dragging use actual chess.js validation.
      await page.locator('[data-square="e2"]').click();
      await page.locator('[data-square="e4"]').click();
      await page.waitForFunction(
        () => document.querySelectorAll(".chess-move-row button").length >= 2,
      );
      assert.ok(
        (await page.evaluate(() => window.__audioNotes)) >= 2,
        "Human and bot moves should sound",
      );
      await page.getByRole("button", { name: "Удвох", exact: true }).click();
      const from = await page.locator('[data-square="g1"]').boundingBox(),
        to = await page.locator('[data-square="f3"]').boundingBox();
      if (width === 1440) {
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
        await page.mouse.up();
      } else {
        // Trusted touch events exercise touch-action and pointer capture, not HTML drag/drop.
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }],
        });
        for (let step = 1; step <= 6; step++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                x: from.x + from.width / 2 + ((to.x - from.x) * step) / 6,
                y: from.y + from.height / 2 + ((to.y - from.y) * step) / 6,
              },
            ],
          });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      }
      await page.waitForFunction(
        () => document.querySelectorAll(".chess-move-row button").length === 3,
      );
      assert.match(await page.locator('[data-square="f3"]').getAttribute("aria-label"), /кінь/);
      await page.getByRole("button", { name: "Повернути хід", exact: true }).click();
      assert.equal(await page.locator(".chess-move-row button").count(), 2);
      const notes = await page.evaluate(() => window.__audioNotes);
      await page.locator(".chess-heading").getByRole("button", { name: "Вимкнути звуки" }).click();
      await page.locator('[data-square="g1"]').click();
      await page.locator('[data-square="f3"]').click();
      assert.equal(
        await page.evaluate(() => window.__audioNotes),
        notes,
        "Mute must suppress move sounds",
      );
      await page.getByRole("button", { name: "Режим дошки", exact: true }).click();
      await page.locator(".chess-focused").waitFor();
      assert.equal(
        await page.locator('[data-square="f3"] .chess-piece').count(),
        1,
        "Focus mode preserves the game",
      );
      await page.screenshot({
        path: `${output}/experience-focus-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".chess-focused").count(), 0);
      await page.screenshot({
        path: `${output}/experience-chess-${theme}-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      // Sidebar search has one shared role-filtered tree and native dialog focus handling.
      if (width === 390) {
        await page.getByRole("button", { name: "Ще", exact: true }).click();
        await page.locator("#app-sidebar").getByRole("button", { name: "Знайти розділ" }).click();
      } else await page.getByRole("button", { name: "Знайти розділ" }).click();
      await page.getByRole("textbox", { name: "Назва розділу" }).fill("Домашні");
      await page
        .locator(".app-search-results")
        .getByRole("link", { name: "Домашні завдання" })
        .click();
      await page.locator(".homework-stream").waitFor();
      assert.equal(await page.locator(".app-search-dialog").evaluate((e) => e.open), false);
      if (width === 390) {
        await page
          .locator(".app-mobile-nav")
          .getByRole("link", { name: "Огляд", exact: true })
          .click();
      } else
        await page
          .locator(".app-navigation")
          .getByRole("link", { name: "Огляд", exact: true })
          .click();
      await page.locator(".home-tools").waitFor();
      await page.screenshot({
        path: `${output}/experience-home-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.locator(".home-tool").first().click();
      await page.getByRole("grid").waitFor();
      // Persisted mute and local game survive a full reload.
      await page.reload();
      await page.getByRole("grid").waitFor();
      assert.equal(
        await page
          .locator(".chess-heading")
          .getByRole("button", { name: "Увімкнути звуки" })
          .count(),
        1,
      );
      assert.match(await page.locator('[data-square="f3"]').getAttribute("aria-label"), /кінь/);
      if (width === 390) {
        await page.getByRole("button", { name: "Ще", exact: true }).click();
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("#app-sidebar").evaluate((e) => e.classList.contains("is-open")),
          false,
        );
      }
      assert.deepEqual(errors, []);
      reports.push({ width, theme, boardWidth: bounds.width, audioNotes: notes, errors });
      await context.close();
    }
  writeFileSync(output + "/experience-review.json", JSON.stringify(reports, null, 2));
  console.log(
    "Desktop/mobile, light/dark: navigation, actual bot reply, mouse/touch drag, takeback, focus, mute, persisted game and preferences passed.",
  );
} finally {
  await browser?.close();
  rmSync(source, { force: true });
  rmSync(html, { force: true });
}
