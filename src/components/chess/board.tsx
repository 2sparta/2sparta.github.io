import { useEffect, useId, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { PIECE_NAMES } from "@/lib/chess/model";
import { premoveTargets } from "@/lib/chess/premove";
import { useChessPreferences, type PieceSet } from "@/lib/chess/preferences";
export function ChessPiece({ piece, color, set }: { piece: PieceSymbol; color: Color; set?: PieceSet }) {
  const preferred = useChessPreferences((s) => s.pieces);
  const appearance = set ?? preferred;
  if (appearance !== "club") return (
    <svg viewBox="0 0 48 48" className="chess-piece" data-piece-set={appearance} aria-hidden="true"
      fill={color === "w" ? "#fffaf0" : "#303536"} stroke={color === "w" ? "#293233" : "#11191b"}
      strokeWidth={appearance === "classic" ? "1.5" : "2"} strokeLinejoin="round" strokeLinecap="round">
      {appearance === "classic" ? <>
        {piece === "p" && <><circle cx="24" cy="12" r="5.8" /><path d="M20 18h8l-1 5c0 5 2 7 5 10H16c3-3 5-5 5-10z" /><path d="M18 19h12" /></>}
        {piece === "r" && <><path d="M13 8h5v5h4V8h4v5h4V8h5v11l-5 4 1 10H17l1-10-5-4z" /><path d="M16 18h16M18 24h12" /></>}
        {piece === "n" && <><path d="m15 33 2-8 10-10-6 1-6 6-6-3 6-9 9-2 5-5 1 8c8 5 9 14 5 22z" /><path d="m26 16 1 8-6 7" /><circle cx="22" cy="12" r="1.2" fill={color === "w" ? "#293233" : "#d4d0c6"} stroke="none" /></>}
        {piece === "b" && <><path d="M24 5c-8 6-12 13-9 18l6 4-5 6h16l-5-6 6-4c3-5-1-12-9-18z" /><path d="m25 11-5 10M17 26h14" /><circle cx="24" cy="5" r="2" /></>}
        {piece === "q" && <><path d="m12 15 5 15-2 3h18l-2-3 5-15-8 6-4-12-4 12z" /><path d="M17 28h14" /><circle cx="11" cy="12" r="2.5" /><circle cx="24" cy="7" r="2.5" /><circle cx="37" cy="12" r="2.5" /></>}
        {piece === "k" && <><path d="M24 4v12M19 9h10" fill="none" strokeWidth="3" /><path d="M24 20c-7-12-20-4-13 6l6 7h14l6-7c7-10-6-18-13-6z" /><path d="M24 20v9M17 29h14" /></>}
        <path d="M15 33h18l2 4H13zM13 37h22l3 5H10z" />
        {color === "b" && <path d="M16 37h16" stroke="#aeb9b4" strokeWidth="1" />}
      </> : <>
        {piece === "p" && <><circle cx="24" cy="13" r="7" /><path d="m20 22-5 13h18l-5-13z" /></>}
        {piece === "n" && <><path d="m12 35 6-13 11-6-9 1-8 6-4-5L21 7l9-2 5 13v17z" /><circle cx="26" cy="12" r="1.5" fill={color === "w" ? "#293233" : "#eee8d8"} stroke="none" /></>}
        {piece === "b" && <><path d="m24 5-11 16 9 5-6 9h16l-6-9 9-5z" /><path d="m26 12-6 9" /></>}
        {piece === "r" && <path d="M12 8h7v6h10V8h7v13l-5 4 1 10H16l1-10-5-4z" />}
        {piece === "q" && <><path d="m10 12 10 9 4-14 4 14 10-9-6 23H16z" /><path d="M17 30h14" /></>}
        {piece === "k" && <><path d="M24 4v12M18 9h12" strokeWidth="3" /><path d="m15 20 9-5 9 5-4 8 4 7H15l4-7z" /></>}
        <path d="M13 35h22v6H13z" />
      </>}
    </svg>
  );

  return (
    <svg
      viewBox="0 0 48 48"
      className="chess-piece"
      data-piece-set="club"
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
  board, orientation = "w", disabled = false, onMove, lastMove, hint, uk = true,
  premoveColor, queuedPremove, onPremove, onCancelPremove,
}: {
  board: Chess; orientation?: Color; disabled?: boolean; onMove?: (move: string) => void;
  lastMove?: string; hint?: string; uk?: boolean; premoveColor?: Color;
  queuedPremove?: string; onPremove?: (move: string) => void; onCancelPremove?: () => void;
}) {
  const prefs = useChessPreferences();
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; color: Color; premove: boolean } | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [marks, setMarks] = useState<{ from: Square; to: Square; color: string }[]>([]);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [focus, setFocus] = useState("e2");
  const drawing = useRef<{ from: Square; color: string } | null>(null);
  const ignoreClick = useRef(false);
  const arrowId = useId().replace(/:/g, "");
  const fen = board.fen();
  const waiting = Boolean(premoveColor && premoveColor !== board.turn());
  const movingColor = waiting ? premoveColor! : board.turn();
  useEffect(() => { setSelected(null); setPromotion(null); }, [fen, disabled, premoveColor]);
  useEffect(() => { setMarks([]); drawing.current = null; }, [fen]);
  const targets = selected
    ? waiting ? premoveTargets(board, selected, movingColor) : board.moves({ square: selected, verbose: true }).map((move) => move.to)
    : [];
  const squares = Array.from({ length: 64 }, (_, i) =>
    ("abcdefgh"[orientation === "w" ? i % 8 : 7 - i % 8] +
      (orientation === "w" ? 8 - Math.floor(i / 8) : 1 + Math.floor(i / 8))) as Square,
  );
  function cancel() { setSelected(null); setPromotion(null); onCancelPremove?.(); }
  function finishMove(from: Square, to: Square, promote?: string) {
    const move = from + to + (promote ?? "");
    if (waiting) {
      if (move === queuedPremove) onCancelPremove?.();
      else onPremove?.(move);
    } else onMove?.(move);
    setSelected(null);
    setPromotion(null);
  }
  function choose(from: Square, to: Square) {
    if (disabled || board.get(from)?.color !== movingColor) return;
    if (waiting) {
      if (!onPremove || !premoveTargets(board, from, movingColor).includes(to)) return;
      if (board.get(from)?.type === "p" && (to[1] === "1" || to[1] === "8")) {
        if (prefs.autoQueen) finishMove(from, to, "q");
        else setPromotion({ from, to, color: movingColor, premove: true });
      } else finishMove(from, to);
      return;
    }
    if (!onMove) return;
    const move = board.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!move) return;
    if (move.promotion && !prefs.autoQueen) setPromotion({ from, to, color: movingColor, premove: false });
    else finishMove(from, to, move.promotion ? "q" : undefined);
  }
  function pick(square: Square) {
    if (ignoreClick.current || annotationMode) return;
    setMarks([]);
    if (disabled || (!onMove && !onPremove)) return;
    if (queuedPremove && (square === queuedPremove.slice(0, 2) || square === queuedPremove.slice(2, 4))) { cancel(); return; }
    if (selected === square) { setSelected(null); return; }
    if (selected && targets.includes(square)) { choose(selected, square); return; }
    setSelected(board.get(square)?.color === movingColor ? square : null);
  }
  function pointSquare(element: HTMLDivElement, clientX: number, clientY: number) {
    const rect = element.getBoundingClientRect();
    const x = (clientX - rect.left - 4) / (rect.width - 8);
    const y = (clientY - rect.top - 4) / (rect.height - 8);
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;
    return squares[Math.floor(y * 8) * 8 + Math.floor(x * 8)];
  }
  function addMark(from: Square, to: Square, color: string) {
    setMarks((old) => {
      const found = old.some((mark) => mark.from === from && mark.to === to && mark.color === color);
      return found ? old.filter((mark) => !(mark.from === from && mark.to === to && mark.color === color))
        : [...old.slice(-31), { from, to, color }];
    });
  }
  const check = board.isCheck() ? board.board().flat().find((p) => p?.type === "k" && p.color === board.turn())?.square : null;
  const center = (square: Square) => { const index = squares.indexOf(square); return { x: index % 8 * 100 + 50, y: Math.floor(index / 8) * 100 + 50 }; };
  const tr = (a: string, b: string) => uk ? a : b;
  return <div className={"chess-board-wrap chess-theme-" + prefs.board}>
    <div className={"chess-board" + (annotationMode ? " is-annotating" : "")} role="grid" aria-label={tr("Шахова дошка", "Chess board")}
      onContextMenu={(e) => { e.preventDefault(); if (queuedPremove) cancel(); }}
      onPointerDown={(e) => {
        if (e.button !== 2 && !(e.button === 0 && (annotationMode || e.shiftKey))) return;
        e.preventDefault();
        ignoreClick.current = true;
        if (queuedPremove) { cancel(); return; }
        const square = (e.target as Element).closest<HTMLElement>("[data-square]")?.dataset.square as Square | undefined;
        if (!square) return;
        drawing.current = { from: square, color: e.shiftKey ? "#e07c62" : e.altKey ? "#6f9fe8" : "#4ba877" };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = drawing.current;
        drawing.current = null;
        if (start) {
          e.preventDefault();
          const to = pointSquare(e.currentTarget, e.clientX, e.clientY);
          if (to) addMark(start.from, to, start.color);
        }
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        setTimeout(() => { ignoreClick.current = false; }, 0);
      }}
      onPointerCancel={() => { drawing.current = null; ignoreClick.current = false; }}
    >
      {Array.from({ length: 8 }, (_, row) => <div role="row" className="contents" key={row}>
        {squares.slice(row * 8, row * 8 + 8).map((square, column) => {
          const i = row * 8 + column, piece = board.get(square), target = targets.includes(square);
          const queued = queuedPremove?.slice(0, 2) === square || queuedPremove?.slice(2, 4) === square;
          const light = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 0;
          const last = prefs.highlightLast && (lastMove?.slice(0, 2) === square || lastMove?.slice(2, 4) === square);
          return <button type="button" role="gridcell" key={square}
            ref={(el) => { if (el) buttons.current.set(square, el); else buttons.current.delete(square); }}
            tabIndex={focus === square ? 0 : -1} onFocus={() => setFocus(square)}
            aria-label={square + (piece ? " · " + (piece.color === "w" ? tr("білі", "white") : tr("чорні", "black")) + " " + PIECE_NAMES[piece.type][uk ? 0 : 1] : "") + (target ? tr(waiting ? " · можливий премув" : " · можливий хід", waiting ? " · possible premove" : " · legal move") : "") + (queued ? tr(" · премув", " · queued premove") : "")}
            aria-selected={selected === square} aria-disabled={disabled && !annotationMode}
            aria-rowindex={row + 1} aria-colindex={column + 1} data-square={square}
            className={"chess-square " + (light ? "chess-light" : "chess-dark") + (selected === square ? " chess-selected" : "") + (last ? " chess-last" : "") + (hint?.slice(0, 2) === square || hint?.slice(2, 4) === square ? " chess-hint" : "") + (check === square ? " chess-check" : "") + (queued ? " chess-premove" : "")}
            onClick={() => pick(square)}
            onKeyDown={(e) => {
              const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 8 : e.key === "ArrowUp" ? -8 : 0;
              if (delta) { e.preventDefault(); buttons.current.get(squares[Math.max(0, Math.min(63, i + delta))])?.focus(); }
              if (e.key === "Escape") { cancel(); setMarks([]); setAnnotationMode(false); }
            }}
            draggable={!annotationMode && !disabled && piece?.color === movingColor}
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", square); setSelected(square); }}
            onDragOver={(e) => { if (!disabled && !annotationMode) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (/^[a-h][1-8]$/.test(from)) choose(from as Square, square); }}
          >
            {prefs.coordinates && i % 8 === 0 && <span className="chess-rank">{square[1]}</span>}
            {prefs.coordinates && i >= 56 && <span className="chess-file">{square[0]}</span>}
            {piece && <ChessPiece piece={piece.type} color={piece.color} />}
            {target && prefs.legalHints && <span className={piece ? "chess-capture-ring" : "chess-legal-dot"} />}
          </button>;
        })}
      </div>)}
      <svg className="chess-annotations" viewBox="0 0 800 800" aria-hidden="true">
        <defs>{["#e07c62", "#6f9fe8", "#4ba877"].map((color, i) => <marker key={color} id={arrowId + i} viewBox="0 0 12 12" refX="9" refY="6" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
          <path d="m1 1 10 5-10 5 2-5z" fill={color} /></marker>)}</defs>
        {marks.map((mark) => {
          const a = center(mark.from), b = center(mark.to), index = ["#e07c62", "#6f9fe8", "#4ba877"].indexOf(mark.color);
          return mark.from === mark.to
            ? <circle key={mark.from + mark.to + mark.color} cx={a.x} cy={a.y} r="40" fill="none" stroke={mark.color} strokeWidth="9" opacity=".85" />
            : <line key={mark.from + mark.to + mark.color} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={mark.color} strokeWidth="16" strokeLinecap="round" opacity=".85" markerEnd={"url(#" + arrowId + index + ")"} />;
        })}
      </svg>
    </div>
    <div className="chess-annotation-toolbar">
      <button type="button" aria-pressed={annotationMode} onClick={() => { cancel(); setAnnotationMode((old) => !old); }}>{tr("Позначки", "Annotate")}</button>
      <span>{annotationMode ? tr("Торкніться клітинки або протягніть стрілку.", "Tap a square or draw an arrow.") : tr("Права кнопка: коло / стрілка", "Right-click: circle / arrow")}</span>
      <button type="button" disabled={!marks.length} onClick={() => setMarks([])}>{tr("Очистити позначки", "Clear marks")}</button>
    </div>
    {promotion && <div className="chess-promotion" role="dialog" aria-modal="true" aria-label={tr("Перетворення пішака", "Pawn promotion")}
      onKeyDown={(e) => {
        if (e.key === "Escape") { setPromotion(null); buttons.current.get(promotion.from)?.focus(); }
        if (e.key === "Tab") {
          const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")], first = items[0], last = items.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <p>{tr("Оберіть фігуру", "Choose a piece")}</p>
      <div className="flex gap-2">{(["q", "r", "b", "n"] as const).map((p) => <button key={p} type="button" autoFocus={p === "q"} aria-label={PIECE_NAMES[p][uk ? 0 : 1]}
        onClick={() => {
          // A position change cancels this dialog before any queued promotion is submitted.
          if (promotion.premove === waiting) finishMove(promotion.from, promotion.to, p);
          else setPromotion(null);
        }}><ChessPiece piece={p} color={promotion.color} /></button>)}</div>
      <button type="button" onClick={() => setPromotion(null)} className="mt-3 text-sm underline">{tr("Скасувати", "Cancel")}</button>
    </div>}
  </div>;
}
