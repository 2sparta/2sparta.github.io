# Periodic table data provenance

Retrieved 2026-10-13. Only numerical facts and classifications are included; no source prose, pictures or HTML summaries are redistributed.

- **Bowserinator / Periodic-Table-JSON**: commit `9090b1c472a1e68f7295e77280f374f8d125cefc`, `PeriodicTableJSON.json`. CC BY-SA 3.0. Used for atomic numbers, symbols, English names, positions (18 / 32 columns), shells, configurations, phase-change temperatures, affinity, electronegativity, ionization stages, and selected isotope mass numbers. https://github.com/Bowserinator/Periodic-Table-JSON/tree/9090b1c472a1e68f7295e77280f374f8d125cefc
- **Scott Weaver / periodic-table-data-complete**: commit `313307516fec8a9de2bc6e840df95fed641e9a5f`, `pTable.json`. MIT (notice below). Used for radius, hardness, moduli, densities, conductivities, heat, abundances, classification and discovery dates. https://github.com/sweaver2112/periodic-table-data-complete/tree/313307516fec8a9de2bc6e840df95fed641e9a5f
- **CIAAW Standard Atomic Weights 2024**: https://ciaaw.org/atomic-weights.htm. Used for standard masses and natural-composition intervals. The parentheses denote uncertainty, NOT extra decimal digits. This corrects the concatenated uncertainties in both upstream JSON files. Numeric snapshot HTML SHA-256: `b48282594b1fb01eee3cbc9d469ce5e3483b628157ea1b09ede33e3476895cf2`.
- **Royal Society of Chemistry**: factual corrections for discovery of Be (1798), He (1868), helium phase exception at atmospheric pressure, and carbon sublimation (4098 K). https://periodic-table.rsc.org/element/4/beryllium ; https://periodic-table.rsc.org/element/2/helium ; https://periodic-table.rsc.org/element/6/carbon . No RSC prose or images copied.

## Adaptation

`data.ts` is the adapted, Ukrainian-labelled data snapshot, attributed to the above authors and distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). This data license does not change the surrounding application code license. Ukrainian element names, substance-name aliases, unit corrections, category normalization and explicit nulls were added by this site. Element 119, which is not confirmed, is excluded. Five established halogens have their own category; uncertain superheavy classifications remain labelled unknown. Missing properties remain null; zero is preserved. Radioactive elements without standard atomic weights show a selected isotope's mass number in square brackets; it is NOT an atomic mass in u. Interval masses use the source's nominal value only in small tiles; the full CIAAW interval appears in the detail card. Negative ancient discovery dates represent approximate historical attestations, not modern laboratory discoveries.

The generator accepts three local source snapshots:

```sh
python scripts/import-periodic-data.py PeriodicTableJSON.json pTable.json atomic-weights.html
```

## Units and limitations

- Temperatures: K, converted with C = K − 273.15 and F = C × 9/5 + 32.
- Ionization and affinity: kJ/mol; eV/particle = kJ/mol ÷ 96.4853321233. Negative affinities mean energy absorption in this source convention.
- Radii: pm. Hardness: Brinell/Vickers MPa; Mohs is dimensionless (upstream units map incorrectly assigned MPa to Mohs). Moduli: GPa.
- Density: kg/m³ (including gases); g/cm³ = kg/m³ ÷ 1000. STP identifies the source's reference values, not a density calculated for the temperature input. Liquid density is a separate reference near melting.
- Thermal conductivity: W/(m K); electric conductivity: MS/m.
- Specific heat: J/(kg K); heats of fusion/vaporization: kJ/mol.
- Abundances: approximate mass percentages, not fractions. Electronegativity is dimensionless (Pauling), despite an erroneous unit in the upstream units file.
- Phase display is an approximate threshold model at 1 atm. Helium, carbon and arsenic need special handling; no fictitious liquid state is assigned to subliming carbon or arsenic. Melting of helium and C/As phase-transition data require elevated pressure. For elements Z ≥ 104 the phase is marked unknown/predicted instead of treating calculated values as observed measurements. Critical temperatures, plasma, chemical reactions, allotrope changes and pressure-dependent phase diagrams are not modelled. Physical properties do NOT recalculate with the temperature input.
- Aggregated source values may vary by method/allotrope and are not metrology reference data. The UI discloses missing and predicted values and links to all sources.

## Scott Weaver MIT notice

MIT License

Copyright (c) 2025 Scott Weaver

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
