# Frankish realms, 481–900

Prepared 2026-10-13. This is a dated educational reconstruction, not a set of independently verified annual borders. 481 is the traditional accession of Clovis; the imperial coronation took place in 800. The source’s 888 frame is explicitly retained for 888–900, without assigning its named rulers to 900.

## Original vector maps and rights

The six original SVGs are bundled, unmodified, in `originals/`; exact source SHA-256, authors, download URLs and license URLs are in `manifest.json` and `scripts/atlas/frankish-originals.json`.

- Sémhur, [Frankish Empire 481 to 814-fr.svg](https://commons.wikimedia.org/wiki/File:Frankish_Empire_481_to_814-fr.svg), based on William R. Shepherd, *Historical Atlas* (1911). **CC BY-SA 3.0**, selected from the offered multi-license: https://creativecommons.org/licenses/by-sa/3.0/ . Derived growth geometries are CC BY-SA 3.0, with geographic registration and path flattening as the changes.
- Romain0, on Historicair’s Gaul base map, [Le royaume des Francs en 561.svg](https://commons.wikimedia.org/wiki/File:Le_royaume_des_Francs_en_561.svg). **Public domain**. Historical references: Paul Vidal de La Blache (1894), Frédéric Armand (2008), Bruno Dumézil (2008). Provincial red lines describe metropolitan church provinces and have not been treated as political boundaries.
- Trasamundo, [Carolingian empire 843](https://commons.wikimedia.org/wiki/File:Carolingian_empire_843.svg), [870](https://commons.wikimedia.org/wiki/File:Carolingian_empire_870.svg), [881](https://commons.wikimedia.org/wiki/File:Carolingian_empire_881.svg), [888](https://commons.wikimedia.org/wiki/File:Carolingian_empire_888.svg). **CC BY-SA 3.0**, selected from offered multi-licenses: https://creativecommons.org/licenses/by-sa/3.0/ . Derived successor geometries are CC BY-SA 3.0. Changes: geographic registration, direct SVG curve flattening, subtraction of painted sea masks and explicit separation of disputed Aquitaine (the whole region enclosed by the orange band, not just the band).

These licenses apply to the corresponding map data and source images. They do not replace the licenses of unrelated source code, Byzantine maps or overview layers. Wallonia, DHS, Met, BnF and UNESCO contextual sources are linked in the atlas; their maps have not been copied or traced.

## Transfer and limitations

`build-frankish-atlas.py` transfers original political paths, applies all ancestor SVG transforms, samples Bézier curves at at most one source coordinate unit, simplifies at 0.2 units with topology preserved and retains disjoint islands and enclosed holes. Painted seas are subtracted so an underlying polygon does not become an invented maritime territory. No hand-drawn straight-line country shapes or annual boundary interpolation are added.

The SVGs do not declare a geographic CRS. City markers in the growth and 561 sources are registered to modern city centres, keeping fitting and held-out markers separate. Several standard projections with an affine adjustment are compared using only fitting-point residuals. Held-out residuals, affine coefficients and control-point identities are published in `manifest.json` and `scripts/atlas/frankish-control-points.json`. These are empirical map alignment models, not identification of the authors’ original projections, nor estimates of historical border accuracy. The 561 source itself is schematic in some places, notably Angers.

Later sources have no cities or graticule. Their shoreline controls are approximate historical-map landmarks; registration is less certain than the Byzantine graticule transfer. Coastlines have been generalized differently by the original cartographers. Do not infer fine local historical ownership from a modern coast overlay. Original maps with legends remain available in the atlas for comparison.

481, 511, 614, 768 and 814 are cumulative **endpoints of the source’s growth stages**, not independently reconstructed maps for every intervening year. In particular, 511 and 768 do not encode internal hereditary partitions. Vasconia’s changing control is not reconstructed year by year. 814-dependent territories are separate from direct territory; 843 disputed Aquitaine is separate from uncontested West Francia; the 881 possessions of Emperor Charles III (Italy and his eastern lands), the two West Frankish parts and the two Burgundy kingdoms of 888 remain distinct.

Unspecified overview records are omitted throughout the atlas. The underlying neutral land does not imply the absence of a state, people or historical evidence.
