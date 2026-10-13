# Periodic table and useful subnavigation

Validated 2026-10-13.

- `npm run typecheck` and `npm run build`: passed.
- `npm run test:periodic`: 5 data/model tests and 2 rendered React interaction tests passed. Checks all 118 atomic numbers, symbols, positions and electron totals; CIAAW masses/intervals; temperature and phase exceptions; name/symbol/number search; invalid URLs; both layouts; selection and keyboard focus; density and energy conversions; successive ionization stages; missing values; dimensionless Mohs scale; category filtering; and expanding/navigating/collapsing Useful subnavigation with the actual TanStack router.
- Initial-release regression checks: `npm run test:school-tools` (52 tests) and `npm run test:atlas-ui` (1 test) passed. Historical data and editor files are unchanged.
- Compiled production SSR component was rendered with the production build's own bundled React and renderer: both compact Be and long Og rendered 118 cells, correct mass data and source links (62,047 and 61,471 bytes of HTML respectively). The temporary renderer export used for verification was removed; application output was not changed.
- Desktop/mobile browser smoke was attempted on dev and production preview. Both are blocked because the environment has no Playwright Chromium executable. No screenshots or browser console verdict are claimed. DOM interaction tests do not establish visual layout correctness. The table deliberately scrolls inside a bounded region; details collapse to one column below 560px of available tool width.

The Useful sidebar is an expander; its children and the in-page tool links navigate. Existing URLs containing `section=useful&year=1240&view=rus` still select the map. The new table supports `section=useful&tool=periodic&element=4&layout=compact` and `layout=long`. Changes to the selected element or layout preserve scroll position. New tools can be registered in `src/lib/learning-tools.ts` for both navigation surfaces.

Data and unit limitations are documented in `src/lib/periodic/SOURCES.md` and displayed below the element properties. No external data requests are made when browsing the table. The table code/data/styles are lazy-loaded when its tool is opened.

## Wide layout revision

The Useful route uses all available content width with exactly 25px left and right padding; the previous 1080px cap remains on other app pages. Both the atlas and periodic table inherit this layout. The table workspace places the table on the left and the scrollable element passport on the right. At tool widths below 820px, the passport follows the table; below 560px it uses one property column. Both table layouts use square cells (`aspect-ratio: 1 / 1`) and content-sized rows rather than the old fixed 87px rows. The category legend occupies the empty upper part of the table. There is no temperature control above the table; the existing numeric temperature/unit controls are inside the passport's state property.

Typecheck, build and all 7 periodic tests passed again. The compiled production SSR was also inspected for both layouts: 118 cells, passport as a sibling to the table area, category legend inside the table, and temperature inputs only inside the passport. Dev/production browser smoke remains blocked by the missing Chromium executable; pixel dimensions and screenshots have not been verified.
