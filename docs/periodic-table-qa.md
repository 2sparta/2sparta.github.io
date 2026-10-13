# Periodic table and useful subnavigation

Validated 2026-10-13.

- `npm run typecheck` and `npm run build`: passed.
- `npm run test:periodic`: 5 data/model tests and 2 rendered React interaction tests passed. Checks all 118 atomic numbers, symbols, positions and electron totals; CIAAW masses/intervals; temperature and phase exceptions; name/symbol/number search; invalid URLs; both layouts; selection and keyboard focus; density and energy conversions; successive ionization stages; missing values; dimensionless Mohs scale; category filtering; and expanding/navigating/collapsing Useful subnavigation with the actual TanStack router.
- Existing `npm run test:school-tools` (52 tests) and `npm run test:atlas-ui` (1 test): passed. Historical data and editor files are unchanged.
- Compiled production SSR component was rendered with the production build's own bundled React and renderer: both compact Be and long Og rendered 118 cells, correct mass data and source links (62,112 and 61,536 bytes of HTML respectively). The temporary renderer export used for verification was removed; application output was not changed.
- Desktop/mobile browser smoke was attempted on dev and production preview. Both are blocked because the environment has no Playwright Chromium executable. No screenshots or browser console verdict are claimed. DOM interaction tests do not establish visual layout correctness. The table deliberately scrolls inside a bounded region; details collapse to one column below 560px.

The Useful sidebar is an expander; its children and the in-page tool links navigate. Existing URLs containing `section=useful&year=1240&view=rus` still select the map. The new table supports `section=useful&tool=periodic&element=4&layout=compact` and `layout=long`. Changes to the selected element or layout preserve scroll position. New tools can be registered in `src/lib/learning-tools.ts` for both navigation surfaces.

Data and unit limitations are documented in `src/lib/periodic/SOURCES.md` and displayed below the element properties. No external data requests are made when browsing the table. The table code/data/styles are lazy-loaded when its tool is opened.
