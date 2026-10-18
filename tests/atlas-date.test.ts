import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAtlasDate,
  atlasDateKey,
  parseAtlasDate,
  atlasDateOrdinal,
  atlasDateFromOrdinal,
  shiftAtlasDay,
  ATLAS_LAST_DAY,
  validateAtlasSearchDate,
} from "../src/lib/atlas/date.ts";

test("The daily timeline crosses month/year/leap boundaries without timezone shifts", () => {
  assert.deepEqual(shiftAtlasDay({ year: 1936, month: 2, day: 28 }, 1), {
    year: 1936,
    month: 2,
    day: 29,
  });
  assert.deepEqual(shiftAtlasDay({ year: 1936, month: 2, day: 29 }, 1), {
    year: 1936,
    month: 3,
    day: 1,
  });
  assert.deepEqual(shiftAtlasDay({ year: 1938, month: 12, day: 31 }, 1), {
    year: 1939,
    month: 1,
    day: 1,
  });
  assert.deepEqual(shiftAtlasDay({ year: 1939, month: 1, day: 1 }, -1), {
    year: 1938,
    month: 12,
    day: 31,
  });
  assert.deepEqual(atlasDateFromOrdinal(-1), { year: 395, month: 1, day: 1 });
  assert.deepEqual(atlasDateFromOrdinal(ATLAS_LAST_DAY + 100), { year: 1994, month: 12, day: 31 });
  for (let n = 0; n <= ATLAS_LAST_DAY; n += 127)
    assert.equal(atlasDateOrdinal(atlasDateFromOrdinal(n)), n);
});
test("Date URLs remain compatible with old year links and reject impossible dates", () => {
  assert.deepEqual(validateAtlasSearchDate({ year: "1936" }), { year: 1936, month: 1, day: 1 });
  assert.deepEqual(validateAtlasSearchDate({ year: "1937", month: "2", day: "31" }), {
    year: 1937,
    month: 2,
    day: 28,
  });
  assert.deepEqual(validateAtlasSearchDate({}), {});
  assert.deepEqual(normalizeAtlasDate(1936, 4, 31), { year: 1936, month: 4, day: 30 });
  assert.equal(parseAtlasDate("1937-02-29"), undefined);
  assert.equal(parseAtlasDate("1936-2-29"), undefined);
  assert.equal(parseAtlasDate("1936-07-31T00:00Z"), undefined);
  assert.equal(atlasDateKey(parseAtlasDate("0711-01-01")!), "0711-01-01");
});
