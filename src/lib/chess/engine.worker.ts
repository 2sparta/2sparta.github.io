import { searchPosition } from "./engine";
self.onmessage = (
  event: MessageEvent<{
    id: number;
    fen: string;
    depth: number;
    milliseconds: number;
    history?: string[];
  }>,
) => {
  const { id, fen, depth, milliseconds, history } = event.data;
  try {
    self.postMessage({ id, result: searchPosition(fen, depth, milliseconds, history) });
  } catch {
    self.postMessage({ id, error: "ENGINE_ERROR" });
  }
};
