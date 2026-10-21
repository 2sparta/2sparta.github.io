import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, Copy } from "lucide-react";
import type { Chess } from "chess.js";
export function MoveList({
  game,
  ply,
  onPly,
  uk,
}: {
  game: Chess;
  ply: number;
  onPly: (ply: number) => void;
  uk: boolean;
}) {
  const history = game.history();
  return (
    <div>
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <h3 className="font-display font-extrabold">{uk ? "Ходи партії" : "Moves"}</h3>
        <span className="text-xs text-muted">
          {Math.ceil(history.length / 2)} {uk ? "ходів" : "moves"}
        </span>
      </div>
      <div className="chess-move-list" tabIndex={0} aria-label={uk ? "Історія ходів" : "Move history"}
        onKeyDown={(event) => {
          const next = event.key === "ArrowLeft" ? Math.max(0, ply - 1)
            : event.key === "ArrowRight" ? Math.min(history.length, ply + 1)
            : event.key === "Home" ? 0 : event.key === "End" ? history.length : null;
          if (next !== null) { event.preventDefault(); event.stopPropagation(); onPly(next); }
        }}>
        {!history.length && (
          <p className="px-3 py-8 text-center text-sm text-muted">
            {uk ? "Партія починається з першого ходу." : "Every game starts with a first move."}
          </p>
        )}
        {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
          <div key={i} className="chess-move-row">
            <span>{i + 1}.</span>
            {[0, 1].map((j) => {
              const n = i * 2 + j;
              return history[n] ? (
                <button
                  type="button"
                  key={j}
                  aria-current={ply === n + 1 ? "step" : undefined}
                  className={ply === n + 1 ? "is-current" : ""}
                  onClick={() => onPly(n + 1)}
                >
                  {history[n]}
                </button>
              ) : (
                <span key={j} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-hairline pt-2">
        {[
          [ChevronFirst, 0, uk ? "До початку" : "First"],
          [ChevronLeft, Math.max(0, ply - 1), uk ? "Попередній хід" : "Previous move"],
          [ChevronRight, Math.min(history.length, ply + 1), uk ? "Наступний хід" : "Next move"],
          [ChevronLast, history.length, uk ? "До поточної позиції" : "Latest position"],
        ].map(([Icon, n, label]) => {
          const I = Icon as typeof ChevronFirst;
          return (
            <button
              key={String(label)}
              type="button"
              aria-label={String(label)}
              onClick={() => onPly(Number(n))}
              disabled={ply === n}
              className="grid size-10 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-30"
            >
              <I className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function PgnActions({
  pgn,
  uk,
  onError,
}: {
  pgn: string;
  uk: boolean;
  onError: (s: string) => void;
}) {
  return (
    <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
      <button
        type="button"
        className="chess-text-button"
        onClick={() => {
          if (!navigator.clipboard) {
            onError(uk ? "Скористайтеся завантаженням PGN." : "Use PGN download.");
            return;
          }
          void navigator.clipboard
            .writeText(pgn)
            .catch(() =>
              onError(
                uk
                  ? "Не вдалося скопіювати PGN. Скористайтеся завантаженням."
                  : "Unable to copy PGN. Use download instead.",
              ),
            );
        }}
      >
        <Copy className="size-4" />
        PGN
      </button>
      <button
        type="button"
        className="chess-text-button"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([pgn], { type: "application/x-chess-pgn" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "school-chess.pgn";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        <Download className="size-4" />
        {uk ? "Зберегти" : "Save"}
      </button>
    </div>
  );
}
