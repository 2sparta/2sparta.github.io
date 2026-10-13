# Historical atlas data

Historical polygon snapshots: André Ourednik and contributors, **Historical Basemaps**, pinned at `da7a4b735ecef70aebdc9c73e409d8a2500d50f3`.
https://github.com/aourednik/historical-basemaps

The repository supplies its LICENSE under GPL-3.0. Its complete original license is retained in `historical-basemaps-LICENSE.txt` and accompanies the derived `world-*.geojson` files. No separate permissive license is claimed for these data. This is a separately attributed data collection, not a change of license for unrelated application files.

Changes: retained NAME, SUBJECTO and BORDERPRECISION as name, subject and precision; assigned feature IDs; simplified lines/rings with Douglas–Peucker tolerance 0.02° and rounded coordinates to four decimal places. No temporal interpolation or new authoritative boundary claims. Source and result hashes are recorded in manifest.json. The preparation script is scripts/build-historical-atlas.mjs.

This dataset is a work in progress with approximate and overlapping historical regions. Known regional limitations: the 800 Rus' Khaganate is hypothetical; the 1200 Rus principalities are aggregated; the 1279/1300 layers omit a separately named Galicia-Volhynia; the 1400 Poland-Lithuania polygon aggregates two states under dynastic union. The UI identifies these issues rather than treating them as verified annual borders.

Physical land and rivers: **Natural Earth 5.1.2**, public domain.
https://www.naturalearthdata.com/about/terms-of-use/
https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2

Land and selected river features are simplified/rounded by the same script. They show modern physical geography for orientation, not reconstructed medieval shorelines or river channels. No modern political boundaries are displayed.

Historical descriptions, source references, settlement/reference markers and chronology are independently curated in src/lib/atlas/content.ts. They are summaries, not copied encyclopedia entries. Named regional circles mark reference locations, not surveyed territorial outlines. A settlement's first written mention is not asserted to be its foundation date. Historical names and uncertainty are preserved.

## Detailed Byzantine extension (395–1453)

The overview license does not relicense the user-supplied Lucius maps. See `byzantium/NOTICE.md` and `byzantium/manifest.json` for the separate source, copyrights, conic georeferencing, segmentation and raster provenance. Other countries have no configured geometry before 500 or after 1400. No temporal interpolation.
