# France in Europe, 843–1994

Dated educational snapshots, not annual surveyed borders. Every year uses the
last available source date, explicitly displayed in the interface. Medieval
polygons may combine crown lands, fiefs and areas of nominal sovereignty.
This layer covers European components, including Corsica, and excludes colonies.
No territorial interpolation, invented intermediate conquests or modern-country
outline projected into the Middle Ages is used. Gaps between source dates remain
uncertainty, particularly during wars and rapidly changing occupation (1940–1944).

843, 870, 881, 888: reused West Francia / disputed Aquitaine geometries from the
Frankish atlas. See ../franks/NOTICE.md for Trasamundo, Sémhur and source licenses.

1000–1994: André Ourednik and Historical Basemaps contributors, GPL-3.0.
Pinned source commit, SHA-256 checksums, dates and exact per-frame URLs are
recorded in manifest.json and frames.json. Full upstream license:
../historical-basemaps-LICENSE.txt. Whole European polygon components selected;
no artificial clipping or interpolation. Degenerate zero-area rings removed, extra
ordinates dropped, invalid linework repaired with GEOS make_valid and polygon
union, same-polity records merged, coordinates snapped to 1e-6 degrees. Original source can
be retrieved using each immutable frame URL. Reproduce with
`scripts/build-france-atlas.py` and the pinned historical-basemaps checkout.

Chronology: Grand Verdun municipal archives, France Diplomatie,
Assemblée nationale, Élysée and Archives d’Alsace (linked in the app).
Chronology events do not imply availability of a corresponding border snapshot.
