import { useEffect, useRef } from "react";
import { chessMoveSound } from "@/lib/chess/sound";
import { playSound } from "@/lib/sounds";

export function useChessSounds({
  context,
  moves,
  initialFen,
  result,
  ready,
}: {
  context: string;
  moves: string[];
  initialFen: string;
  result?: string | null;
  ready: boolean;
}) {
  const previous = useRef<{ context: string; moves: string[]; result?: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (!ready) {
      previous.current = null;
      return;
    }
    const before = previous.current;
    previous.current = { context, moves: [...moves], result };
    if (!before || before.context !== context) return;
    if (result && !before.result) playSound("end");
    else {
      const sound = chessMoveSound(before.moves, moves, initialFen);
      if (sound) playSound(sound);
    }
  }, [context, moves, initialFen, result, ready]);
}
