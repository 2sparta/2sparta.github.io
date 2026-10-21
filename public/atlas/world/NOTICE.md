# Єдина історична мапа / Unified historical map

World contours: André Ourednik and contributors, **Historical Basemaps**, pinned
at `da7a4b735ecef70aebdc9c73e409d8a2500d50f3`.
https://github.com/aourednik/historical-basemaps
GPL-3.0; the complete license is retained at `../historical-basemaps-LICENSE.txt`.
The upstream collection contains approximate states, cultural regions and
dependencies; these are not cadastral or uniformly precise political borders.

The 42 world source snapshots span 500 BCE–1994. Source and output SHA-256 hashes
are in `manifest.json`. The last snapshot at or before the selected date is used;
future borders are never borrowed. A day selected in the interface does not imply
daily cartographic accuracy. In particular the 1800 world background remains in
use until the 1815 source is available: it is not a reconstruction of the individual
Napoleonic campaigns. World War II has no daily reconstruction in this collection;
the source year remains visible. Unspecified regions remain neutral land.

One source label is corrected: the 1930 polygon called `White Russia`, whose
extent covers the Soviet Union, is labeled `USSR`. The source geometry and its
original checksum remain recorded. The correction refers to the Library of
Congress account of the treaty establishing the USSR on 30 December 1922:
https://blogs.loc.gov/law/2013/01/treaty-on-the-creation-of-the-soviet-union-signed-sealed-and-delivered/

Regional refinements retain their existing sources, attribution and licenses:

- Byzantium: [source notice](../byzantium/NOTICE.md), Lucius, separate copyright.
- Frankish realms: [source notice](../franks/NOTICE.md), Sémhur, Trasamundo, Romain0; CC BY-SA / public domain.
- Rus: [source notice](../rus/NOTICE.md), Unochepassava94, Koryakov Yuri, Das Steinerne Herz, Redx360, Hellerick, Mnohohrishnyi; CC BY-SA / CC0.
- Mongols, khanates and Mughals: [source notice](../mongols/NOTICE.md), Cattette,
  Gabagool, Elvonudinium, Avantiputra7, Joppen; CC BY / CC BY-SA. Direct contours
  retain their documented validity. The combined Mongol extent of 1259/1294 is
  not drawn as one state after the division in 1260; the world source supplies
  the background until individual successor-state contours become available.
- Poland, Lithuania and Commonwealth: [source notice](../commonwealth/NOTICE.md), Mathiasrex, Halibutt, Grandiose, NordNordWest, Sneecs, Rowanwindwhistler;
  CC BY / CC BY-SA / Historical Basemaps GPL-3.0.
- Spain: [source notice](../spain/NOTICE.md), Kaidor, Rowanwindwhistler, FDRMRZUSA and contributors; CC BY-SA 4.0 / GPL-3.0.

The schematic Germany, Napoleonic, antiquity, British Isles and overseas polygon
layers are superseded in the unified map by the world source snapshots. Their
curated settlement cards and event descriptions remain available. France and
other states are present directly in the worldwide source rather than being
drawn twice as independent regional maps.

Preparation: `scripts/build-world-atlas.py`, Python 3 + Shapely 2.1.2. Invalid source
polygons are repaired with GEOS MakeValid; only polygonal parts are retained.
The physical coast is Natural Earth 5.1.2 (public domain), using the existing
atlas land mask. World polygons are intersected with that mask, simplified at
0.012 degrees and snapped to 0.0001 degrees. Regional states remove the overlap
from neighbouring world polygons by geometric difference, never by rectangular
bounding boxes. Optional historical areas, dependencies and occupations are
overlays and do not erase sovereign states. Approximate differences between
sources can still leave neutral slivers; these are not claims about uninhabited
land or exact historical border lines. The existing regional notices document
their remaining cartographic limits.

Each dated patch contains only removed or changed world features and the regional
additions. The browser fetches one base and one patch, then merges by stable IDs;
it does no geometric reconstruction. Base files and patches are cached independently.
Dates of the 1772, 1793 and 1795 partitions and monthly Spanish Civil War fronts
remain explicit. The Byzantine pre-conquest layer stops on 29 May 1453.

The merged datasets retain all applicable original terms. This notice does not
relicense the source datasets or unrelated application code.
