import type { HistoricalCollection } from "./model.ts";
/** Do not present differences between older fallback basemaps as changes on the selected dates. */
export function comparisonSnapshot(
  collection: HistoricalCollection | undefined,
  year: number,
  baseYear: number | undefined,
) {
  if (!collection || baseYear === year) return collection;
  return {
    ...collection,
    features: collection.features.filter(
      (f) => f.properties.custom || f.properties.sourceId !== "basemaps",
    ),
  };
}
