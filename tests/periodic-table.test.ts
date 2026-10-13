import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  ELEMENTS,
  elementByNumber,
  formatNumber,
  massLabel,
  matchesElement,
  stateAt,
  temperatureFromKelvin,
  temperatureToKelvin,
  wikipediaUrl,
} from "../src/lib/periodic/model.ts";
import { validateToolSearch } from "../src/lib/learning-tools.ts";

test("118 confirmed elements have unique positions and complete electron counts in both layouts", () => {
  assert.deepEqual(
    ELEMENTS.map((e) => e.number),
    Array.from({ length: 118 }, (_, i) => i + 1),
  );
  assert.equal(new Set(ELEMENTS.map((e) => e.symbol)).size, 118);
  for (const key of ["position", "widePosition"] as const) {
    assert.equal(new Set(ELEMENTS.map((e) => e[key].join(":"))).size, 118);
    for (const e of ELEMENTS) {
      assert.ok(e[key][0] >= 1 && e[key][0] <= (key === "position" ? 18 : 32));
      assert.ok(e[key][1] >= 1 && e[key][1] <= (key === "position" ? 10 : 7));
    }
  }
  for (const e of ELEMENTS) {
    assert.equal(
      e.shells.reduce((sum, n) => sum + n, 0),
      e.number,
      e.symbol,
    );
    assert.ok(CATEGORIES[e.category]);
    assert.ok(e.ionization.length <= e.number);
    assert.ok(!e.isotopeMass || Number.isInteger(e.mass));
  }
  assert.deepEqual(elementByNumber(57).position, [3, 9]);
  assert.deepEqual(elementByNumber(57).widePosition, [3, 6]);
  assert.deepEqual(elementByNumber(89).widePosition, [3, 7]);
});
test("CIAAW masses separate uncertainty digits, intervals and isotope mass numbers", () => {
  assert.equal(elementByNumber(4).mass, 9.0121831);
  assert.equal(elementByNumber(2).mass, 4.002602);
  assert.equal(elementByNumber(40).mass, 91.222);
  assert.equal(elementByNumber(64).mass, 157.249);
  assert.equal(elementByNumber(71).mass, 174.96669);
  assert.equal(massLabel(elementByNumber(4)), "9,0121831");
  assert.deepEqual(elementByNumber(82).massRange, [206.14, 207.94]);
  assert.equal(massLabel(elementByNumber(118)), "[294]");
});
test("phase calculation handles liquid, gas, sublimation, helium and invalid temperatures", () => {
  const hg = elementByNumber(80);
  assert.equal(stateAt(hg, 293.15), "Рідина");
  assert.equal(stateAt(elementByNumber(4), 293.15), "Тверде тіло");
  assert.equal(stateAt(elementByNumber(8), 293.15), "Газ");
  assert.match(stateAt(elementByNumber(6), 4200), /сублімація/);
  assert.match(stateAt(elementByNumber(33), 900), /сублімація/);
  assert.match(stateAt(elementByNumber(2), 0.5), /Рідина/);
  assert.match(stateAt(elementByNumber(118), 293.15), /Невідомий/);
  assert.match(stateAt(hg, -1), /абсолютний нуль/);
  for (const unit of ["C", "F", "K"] as const) {
    const k = temperatureToKelvin(20, unit);
    assert.ok(Math.abs(temperatureFromKelvin(k, unit)! - 20) < 1e-10);
  }
  assert.equal(temperatureToKelvin(32, "F"), 273.15);
});
test("search accepts Ukrainian element and substance names, symbols and numbers", () => {
  assert.ok(matchesElement(elementByNumber(26), "залізо"));
  assert.ok(matchesElement(elementByNumber(26), "ФЕРУМ"));
  assert.ok(matchesElement(elementByNumber(26), "Fe"));
  assert.ok(matchesElement(elementByNumber(26), "26"));
  assert.ok(matchesElement(elementByNumber(8), "кисень"));
  assert.equal(
    wikipediaUrl(elementByNumber(4)),
    "https://uk.wikipedia.org/wiki/%D0%91%D0%B5%D1%80%D0%B8%D0%BB%D1%96%D0%B9",
  );
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(null), "Немає даних");
  assert.notEqual(formatNumber(1e-7), "0");
});
test("tool deep links validate values and preserve legacy atlas defaults", () => {
  assert.deepEqual(validateToolSearch({ year: 1240, view: "rus" }), {});
  assert.deepEqual(validateToolSearch({ tool: "periodic", element: "4", layout: "long" }), {
    tool: "periodic",
    element: 4,
    layout: "long",
  });
  for (const element of [0, 119, NaN, Infinity, "bad", 4.5])
    assert.deepEqual(validateToolSearch({ element }), {});
  assert.deepEqual(validateToolSearch({ tool: "bad", layout: "bad" }), {});
});
