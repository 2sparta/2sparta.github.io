import { compareTerritories } from "./comparison";
import type { HistoricalCollection } from "./model";
self.onmessage = (
  event: MessageEvent<{ before: HistoricalCollection; after: HistoricalCollection }>,
) => {
  try {
    self.postMessage({ result: compareTerritories(event.data.before, event.data.after) });
  } catch {
    self.postMessage({ error: "COMPARISON_FAILED" });
  }
};
