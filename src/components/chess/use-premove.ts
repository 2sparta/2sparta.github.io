import { useCallback, useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import { legalPremove } from "@/lib/chess/premove";
type QueuedMove = { move: string; fen: string; context: string; ply: number };
export function usePremove({
  fen, color, context, ply, active, enabled, ready, onPlay,
}: {
  fen: string; color: Color | null; context: string; ply: number; active: boolean;
  enabled: boolean; ready: boolean; onPlay: (move: string) => void;
}) {
  const [queued, setQueued] = useState<QueuedMove | null>(null);
  const pending = useRef<QueuedMove | null>(null);
  const play = useRef(onPlay);
  play.current = onPlay;
  const cancel = useCallback(() => { pending.current = null; setQueued(null); }, []);
  const queue = useCallback((move: string) => {
    if (!active || !enabled || !color || fen.split(" ")[1] === color) return;
    const value = { move, fen, context, ply };
    pending.current = value;
    setQueued(value);
  }, [active, enabled, color, fen, context, ply]);
  useEffect(() => {
    const value = pending.current;
    if (!value) return;
    if (!enabled || !active || value.context !== context || ply < value.ply || (ply === value.ply && fen !== value.fen)) { cancel(); return; }
    if (!ready || fen === value.fen || fen.split(" ")[1] !== color || !color) return;
    const move = legalPremove(fen, value.move, color);
    // Consume before dispatch: re-renders, clock ticks and StrictMode cannot send twice.
    cancel();
    if (move) play.current(move);
  }, [fen, color, context, ply, active, enabled, ready, cancel]);
  useEffect(() => {
    if (!queued) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [queued, cancel]);
  return { move: queued?.context === context ? queued.move : undefined, queue, cancel };
}
