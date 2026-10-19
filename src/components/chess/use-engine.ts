import { useEffect, useState } from "react";
import type { EngineResult } from "@/lib/chess/engine";
export function useChessEngine(
  fen: string | undefined,
  depth: number,
  budget: number,
  history: string[] = [],
) {
  const [state, setState] = useState<{
    fen?: string;
    result?: EngineResult;
    busy: boolean;
    error?: string;
  }>({ busy: false });
  const historyKey = history.join(" ");
  useEffect(() => {
    if (!fen) {
      setState({ busy: false });
      return;
    }
    let worker: Worker | undefined,
      alive = true;
    setState({ fen, busy: true });
    try {
      worker = new Worker(new URL("../../lib/chess/engine.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => {
        if (alive) setState({ fen, busy: false, result: e.data.result, error: e.data.error });
      };
      worker.onerror = () => {
        if (alive) setState({ fen, busy: false, error: "ENGINE_ERROR" });
      };
      worker.postMessage({
        id: 1,
        fen,
        depth,
        milliseconds: budget,
        history: historyKey ? historyKey.split(" ") : [],
      });
    } catch {
      setState({ fen, busy: false, error: "ENGINE_ERROR" });
    }
    return () => {
      alive = false;
      worker?.terminate();
    };
  }, [fen, depth, budget, historyKey]);
  return state;
}
