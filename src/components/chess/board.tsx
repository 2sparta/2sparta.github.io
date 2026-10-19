import { useEffect, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { PIECE_NAMES, uciOf } from "@/lib/chess/model";
export function ChessPiece({ piece, color }: { piece: PieceSymbol; color: Color }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="chess-piece"
      aria-hidden="true"
      fill={color === "w" ? "#fff9e9" : "#203e35"}
      stroke={color === "w" ? "#29483e" : "#e9d5a8"}
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {piece === "p" ? (
        <>
          <circle cx="24" cy="14" r="6" />
          <path d="M20 20h8l-1 5 5 10H16l5-10z" />
        </>
      ) : null}
      {piece === "r" ? (
        <>
          <path d="M13 8h6v6h4V8h3v6h4V8h6v12l-5 5 1 10H16l1-10-4-5z" />
          <path d="M17 23h14M18 30h12" />
        </>
      ) : null}
      {piece === "b" ? (
        <>
          <path d="M24 6c-9 6-12 12-8 18l5 4-6 7h18l-6-7 5-4c4-6 1-12-8-18z" />
          <path d="m25 13-5 8M18 27h12" />
        </>
      ) : null}
      {piece === "q" ? (
        <>
          <path d="m13 16 3 15-2 4h20l-2-4 3-15-7 7-4-11-4 11z" />
          <circle cx="12" cy="13" r="2.5" />
          <circle cx="24" cy="9" r="2.5" />
          <circle cx="36" cy="13" r="2.5" />
          <path d="M17 30h14" />
        </>
      ) : null}
      {piece === "k" ? (
        <>
          <path d="M21 7h6v4h4v5h-4v5h-6v-5h-4v-5h4z" />
          <path d="M24 22c-15-10-19 3-10 7l3 6h14l3-6c9-4 5-17-10-7z" />
          <path d="M19 30h10" />
        </>
      ) : null}
      {piece === "n" ? (
        <>
          <path d="M14 35c-1-10 7-11 11-17l-8 7-7-3 5-10 8-3 4-5 3 7c9 6 8 17 5 24z" />
          <path d="m17 17 4-3M29 16c4 5 4 10 2 14" />
          <circle cx="24" cy="13" r="1" fill="#29483e" stroke="none" />
        </>
      ) : null}
      <path d="M15 35h18l3 5H12z" />
      <path d="M11 41h26" />
    </svg>
  );
}
export function ChessBoard({
  board,
  orientation = "w",
  disabled = false,
  onMove,
  lastMove,
  hint,
  uk = true,
}: {
  board: Chess;
  orientation?: Color;
  disabled?: boolean;
  onMove?: (move: string) => void;
  lastMove?: string;
  hint?: string;
  uk?: boolean;
}) {
  const [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()),
    [focus, setFocus] = useState("e2");
  const fen = board.fen();
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen, disabled]);
  const legal = selected ? board.moves({ square: selected, verbose: true }) : [];
  const squares = Array.from(
    { length: 64 },
    (_, i) =>
      `${"abcdefgh"[orientation === "w" ? i % 8 : 7 - (i % 8)]}${orientation === "w" ? 8 - Math.floor(i / 8) : 1 + Math.floor(i / 8)}` as Square,
  );
  function pick(square: Square) {
    if (disabled || !onMove) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    const move = legal.find((m) => m.to === square);
    if (move && selected) {
      if (move.promotion) {
        setPromotion({ from: selected, to: square });
        return;
      }
      onMove(uciOf(move));
      setSelected(null);
      return;
    }
    const piece = board.get(square);
    setSelected(piece?.color === board.turn() ? square : null);
  }
  function drop(from: string, to: Square) {
    if (disabled || !onMove) return;
    const moves = board.moves({ square: from as Square, verbose: true });
    const move = moves.find((m) => m.to === to);
    if (!move) return;
    if (move.promotion) {
      setPromotion({ from: from as Square, to });
      return;
    }
    onMove(uciOf(move));
  }
  const check = board.isCheck()
    ? board
        .board()
        .flat()
        .find((p) => p?.type === "k" && p.color === board.turn())?.square
    : null;
  return (
    <div className="chess-board-wrap">
      <div className="chess-board" role="grid" aria-label={uk ? "Шахова дошка" : "Chess board"}>
        {Array.from({ length: 8 }, (_, row) => (
          <div role="row" className="contents" key={row}>
            {squares.slice(row * 8, row * 8 + 8).map((square, column) => {
              const i = row * 8 + column;
              const piece = board.get(square),
                target = legal.some((m) => m.to === square);
              const light = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 0;
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={square}
                  ref={(el) => {
                    if (el) buttons.current.set(square, el);
                    else buttons.current.delete(square);
                  }}
                  tabIndex={focus === square ? 0 : -1}
                  onFocus={() => setFocus(square)}
                  aria-label={`${square}${piece ? ` · ${piece.color === "w" ? (uk ? "білі" : "white") : uk ? "чорні" : "black"} ${PIECE_NAMES[piece.type][uk ? 0 : 1]}` : ""}${target ? (uk ? " · можливий хід" : " · legal move") : ""}`}
                  aria-selected={selected === square}
                  aria-disabled={disabled}
                  aria-rowindex={Math.floor(i / 8) + 1}
                  aria-colindex={(i % 8) + 1}
                  data-square={square}
                  className={`chess-square ${light ? "chess-light" : "chess-dark"} ${selected === square ? "chess-selected" : ""} ${lastMove?.slice(0, 2) === square || lastMove?.slice(2, 4) === square ? "chess-last" : ""} ${hint?.slice(0, 2) === square || hint?.slice(2, 4) === square ? "chess-hint" : ""} ${check === square ? "chess-check" : ""}`}
                  onClick={() => pick(square)}
                  onKeyDown={(e) => {
                    const delta =
                      e.key === "ArrowRight"
                        ? 1
                        : e.key === "ArrowLeft"
                          ? -1
                          : e.key === "ArrowDown"
                            ? 8
                            : e.key === "ArrowUp"
                              ? -8
                              : 0;
                    if (delta) {
                      e.preventDefault();
                      buttons.current.get(squares[Math.max(0, Math.min(63, i + delta))])?.focus();
                    }
                    if (e.key === "Escape") setSelected(null);
                  }}
                  draggable={!disabled && Boolean(piece) && piece?.color === board.turn()}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", square);
                    setSelected(square);
                  }}
                  onDragOver={(e) => {
                    if (!disabled) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(e.dataTransfer.getData("text/plain"), square);
                  }}
                >
                  {i % 8 === 0 && <span className="chess-rank">{square[1]}</span>}
                  {i >= 56 && <span className="chess-file">{square[0]}</span>}
                  {piece && <ChessPiece piece={piece.type} color={piece.color} />}
                  {target && <span className={piece ? "chess-capture-ring" : "chess-legal-dot"} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {promotion && (
        <div
          className="chess-promotion"
          role="dialog"
          aria-modal="true"
          aria-label={uk ? "Перетворення пішака" : "Pawn promotion"}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPromotion(null);
              buttons.current.get(promotion.from)?.focus();
            }
            if (e.key === "Tab") {
              const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")],
                first = items[0],
                last = items.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <p>{uk ? "Оберіть фігуру" : "Choose a piece"}</p>
          <div className="flex gap-2">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button
                key={p}
                type="button"
                autoFocus={p === "q"}
                aria-label={PIECE_NAMES[p][uk ? 0 : 1]}
                onClick={() => {
                  onMove?.(promotion.from + promotion.to + p);
                  setPromotion(null);
                }}
              >
                <ChessPiece piece={p} color={board.turn()} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPromotion(null)}
            className="mt-3 text-sm underline"
          >
            {uk ? "Скасувати" : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}
