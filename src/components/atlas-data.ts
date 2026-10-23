import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { validateHistoricalCollection, type HistoricalCollection } from "@/lib/atlas/model";
import {
  applyWorldPatch,
  validateWorldManifest,
  validateWorldPatch,
  worldFrameAt,
} from "@/lib/atlas/world";
import type { AtlasDate } from "@/lib/atlas/date";
import type { ComparisonResult } from "@/lib/atlas/comparison";
export async function atlasJson(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("ATLAS_DOWNLOAD");
  return response.json();
}
export function useWorldSnapshot(date: AtlasDate, enabled = true) {
  const manifest = useQuery({
    queryKey: ["historical-atlas-world-manifest"],
    queryFn: async ({ signal }) =>
      validateWorldManifest(await atlasJson("/atlas/world/manifest.json", signal)),
    staleTime: Infinity,
    enabled: enabled && typeof window !== "undefined",
    retry: 1,
  });
  const frame = worldFrameAt(manifest.data, date),
    record = manifest.data?.baseFiles.find((f) => f.year === frame?.baseYear);
  const base = useQuery({
    queryKey: ["historical-atlas-world-base", record?.year],
    queryFn: async ({ signal }) =>
      validateHistoricalCollection(await atlasJson(`/atlas/world/${record!.path}`, signal)),
    enabled: enabled && Boolean(record),
    staleTime: Infinity,
    retry: 1,
  });
  const patch = useQuery({
    queryKey: ["historical-atlas-world-patch", frame?.path],
    queryFn: async ({ signal }) => {
      const p = validateWorldPatch(await atlasJson(`/atlas/world/${frame!.path}`, signal));
      if (p.baseYear !== frame!.baseYear) throw new Error("INVALID_WORLD_PATCH");
      return p;
    },
    enabled: enabled && Boolean(frame),
    staleTime: Infinity,
    retry: 1,
  });
  const collection = useMemo(
    () => (base.data && patch.data ? applyWorldPatch(base.data, patch.data) : undefined),
    [base.data, patch.data],
  );
  return {
    collection,
    frame,
    manifest,
    base,
    patch,
    loading: enabled && (manifest.isPending || base.isPending || patch.isPending),
    error: manifest.isError || base.isError || patch.isError,
    retry: () => {
      void manifest.refetch();
      if (record) void base.refetch();
      if (frame) void patch.refetch();
    },
  };
}
export function useAtlasPhysical() {
  return useQuery({
    queryKey: ["historical-atlas-physical"],
    queryFn: async ({ signal }) => {
      const [land, rivers] = await Promise.all([
        atlasJson("/atlas/land.geojson", signal),
        atlasJson("/atlas/rivers.geojson", signal),
      ]);
      return { land: land as FeatureCollection, rivers: rivers as FeatureCollection };
    },
    staleTime: Infinity,
    enabled: typeof window !== "undefined",
    retry: 1,
  });
}
export function useTerritoryComparison(
  before: HistoricalCollection | undefined,
  after: HistoricalCollection | undefined,
  enabled: boolean,
) {
  const [state, setState] = useState<{
    before?: HistoricalCollection;
    after?: HistoricalCollection;
    result?: ComparisonResult;
    error?: boolean;
  }>({});
  useEffect(() => {
    if (!enabled || !before || !after) return;
    if (before === after) {
      setState({
        before,
        after,
        result: { collection: { type: "FeatureCollection", features: [] }, skipped: 0 },
      });
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL("../lib/atlas/comparison.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) =>
        setState({ before, after, result: e.data.result, error: Boolean(e.data.error) });
      worker.onerror = () => setState({ before, after, error: true });
      worker.postMessage({ before, after });
    } catch {
      setState({ before, after, error: true });
    }
    return () => worker?.terminate();
  }, [before, after, enabled]);
  const current = enabled && state.before === before && state.after === after;
  return {
    result: current ? state.result : undefined,
    error: current && state.error,
    loading: enabled && Boolean(before && after) && !(current && (state.result || state.error)),
  };
}
