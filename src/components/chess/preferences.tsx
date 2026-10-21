import { Settings2 } from "lucide-react";
import { BOARD_THEMES, PIECE_SETS, useChessPreferences } from "@/lib/chess/preferences";
import { ChessPiece } from "./board";
export function ChessPreferences({ uk }: { uk: boolean }) {
  const prefs = useChessPreferences();
  const pieceNames = { classic: ["Класичні", "Classic"], club: ["Клубні", "Club"], minimal: ["Мінімальні", "Minimal"] };
  const boardNames = { forest: ["Шавлія", "Sage"], wood: ["Горіх", "Walnut"], slate: ["Сланець", "Slate"] };
  const tr = (a: string, b: string) => uk ? a : b;
  return <details className="chess-preferences">
    <summary><Settings2 className="size-4" aria-hidden="true" /><span>{tr("Дошка та налаштування гри", "Board & play preferences")}</span></summary>
    <div className="chess-preferences-body">
      <div className="chess-appearance-grid">
        <fieldset><legend>{tr("Фігури", "Pieces")}</legend>
          <div className="chess-piece-choices">{PIECE_SETS.map((set) => <button key={set} type="button"
            aria-pressed={prefs.pieces === set} aria-label={pieceNames[set][uk ? 0 : 1]}
            onClick={() => prefs.update({ pieces: set })}>
            <span><ChessPiece piece="n" color="w" set={set} /><ChessPiece piece="k" color="b" set={set} /></span>
            <b>{pieceNames[set][uk ? 0 : 1]}</b>
          </button>)}</div>
        </fieldset>
        <fieldset><legend>{tr("Колір дошки", "Board colour")}</legend>
          <div className="chess-board-choices">{BOARD_THEMES.map((board) => <button type="button" key={board}
            aria-pressed={prefs.board === board} aria-label={boardNames[board][uk ? 0 : 1]} onClick={() => prefs.update({ board })}>
            <span className={"chess-theme-preview chess-theme-" + board} /><b>{boardNames[board][uk ? 0 : 1]}</b>
          </button>)}</div>
        </fieldset>
      </div>
      <div className="chess-preference-toggles">
        {([
          ["premoves", tr("Премуви", "Premoves")],
          ["autoQueen", tr("Автоматичне перетворення на ферзя", "Automatically promote to queen")],
          ["coordinates", tr("Координати дошки", "Board coordinates")],
          ["legalHints", tr("Підсвічувати можливі ходи", "Show possible moves")],
          ["highlightLast", tr("Підсвічувати останній хід", "Highlight the last move")],
        ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={prefs[key]}
          onChange={(e) => prefs.update({ [key]: e.target.checked })} /><span>{label}</span></label>)}
      </div>
      <div className="chess-preference-note"><p>{tr(
        "Премув — один хід, обраний під час ходу суперника. Він виконається, лише якщо залишиться легальним. Скасування: Esc, права кнопка миші або кнопка біля дошки.",
        "A premove is one move queued during your opponent’s turn. It executes only if it remains legal. Cancel with Esc, right-click or the button beside the board.",
      )}</p><button type="button" onClick={prefs.reset}>{tr("Відновити типові", "Restore defaults")}</button></div>
      <p className="chess-preference-note">{tr("Налаштування зберігаються на цьому пристрої.", "Preferences are saved on this device.")}</p>
    </div>
  </details>;
}
