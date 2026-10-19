import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chess, DEFAULT_POSITION, type Color, type PieceSymbol } from "chess.js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  FlipVertical2,
  Globe2,
  Lightbulb,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { chessApi, type ChessApi } from "@/lib/chess/api";
import {
  colorOf,
  parseUci,
  remaining,
  replay,
  terminal,
  uciOf,
  validatePgn,
  type ChessGame,
} from "@/lib/chess/model";
import { OPENING_GUIDES, lineMoves, openingLabel, type Opening } from "@/lib/chess/openings";
import { ChessBoard, ChessPiece } from "./chess/board";
import { MoveList, PgnActions } from "./chess/moves";
import { evaluate } from "@/lib/chess/engine";
import { useChessEngine } from "./chess/use-engine";
import { OnlineLobby } from "./chess/online";
import { ChessTournaments } from "./chess/tournaments";
import "./chess/chess.css";
export type ChessTab = "play" | "openings" | "analysis" | "tournaments";
export type ChessNavigation = { tab: ChessTab; gameId?: string; tournamentId?: string };
type LocalGame = {
  initialFen: string;
  moves: string[];
  human: Color;
  difficulty: number;
  mode: "bot" | "local";
  resigned: Color | null;
};
const fresh = (): LocalGame => ({
  initialFen: DEFAULT_POSITION,
  moves: [],
  human: "w",
  difficulty: 1,
  mode: "bot",
  resigned: null,
});
const LEVELS = [
  { uk: "Перші кроки", en: "First steps", depth: 1, budget: 250 },
  { uk: "Клубний", en: "Club", depth: 2, budget: 800 },
  { uk: "Виклик", en: "Challenge", depth: 3, budget: 1800 },
];
function errorText(error: unknown, uk: boolean) {
  const message = error instanceof Error ? error.message : "";
  const pairs: Record<string, [string, string]> = {
    ILLEGAL_MOVE: ["Цей хід неможливий.", "That move is not legal."],
    NOT_YOUR_TURN: ["Зараз хід суперника.", "It is your opponent’s turn."],
    STALE_GAME: [
      "Позиція вже змінилася. Дочекайтеся оновлення й повторіть хід.",
      "The position has changed. Wait for the update and try again.",
    ],
    ROOM_CLOSED: [
      "Це запрошення вже закрите або його час минув.",
      "This invitation has closed or expired.",
    ],
    FORBIDDEN: [
      "У вас немає доступу до цієї дії або партії.",
      "You do not have access to this action or game.",
    ],
    ROUND_NOT_FINISHED: [
      "Спочатку мають завершитися всі партії поточного туру.",
      "All games in the current round must finish first.",
    ],
    TOURNAMENT_FULL: ["У турнірі вже 16 учасників.", "This tournament already has 16 players."],
    REGISTRATION_CLOSED: ["Реєстрацію вже закрито.", "Registration has closed."],
    INVALID_PLAYERS: [
      "Для початку потрібні щонайменше два учасники.",
      "At least two players are needed to start.",
    ],
    RATE_LIMIT: [
      "Зачекайте трохи перед створенням наступного запрошення чи турніру.",
      "Wait a little before creating another invitation or tournament.",
    ],
    CLOCK_RUNNING: [
      "За серверним годинником час іще не минув.",
      "Time has not expired on the server clock.",
    ],
    GAME_CLOSED: ["Ця партія вже завершилася.", "This game has ended."],
    NO_DRAW_OFFER: [
      "Немає пропозиції нічиєї від суперника.",
      "There is no draw offer from your opponent.",
    ],
    UNAUTHENTICATED: ["Увійдіть в обліковий запис для онлайн-гри.", "Sign in to play online."],
    NOT_FOUND: ["Партію або турнір не знайдено.", "Game or tournament not found."],
    NO_SCHOOL: [
      "Для шкільної гри спочатку приєднайтеся до школи.",
      "Join a school to use the school lobby.",
    ],
  };
  const found = Object.entries(pairs).find(([key]) => message.includes(key));
  return found
    ? found[1][uk ? 0 : 1]
    : uk
      ? "Онлайн-сервіс не відповів. Перевірте підключення та повторіть спробу. Гра з ботом доступна окремо."
      : "The online service did not respond. Check your connection and retry. Bot play is available separately.";
}
const reasonLabel = (reason: string | null, uk: boolean) =>
  ({
    checkmate: uk ? "Мат" : "Checkmate",
    stalemate: uk ? "Пат" : "Stalemate",
    repetition: uk ? "Повторення позиції" : "Repetition",
    material: uk ? "Недостатньо матеріалу" : "Insufficient material",
    fifty: uk ? "Правило 50 ходів" : "Fifty-move rule",
    resignation: uk ? "Здача партії" : "Resignation",
    agreement: uk ? "Нічия за згодою" : "Draw by agreement",
    timeout: uk ? "Час вичерпано" : "Time expired",
    "move-limit": uk ? "Ліміт довжини партії" : "Game length limit",
  })[reason ?? ""] ?? "";
function clockText(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function PlayerBar({
  name,
  color,
  clock,
  active,
  uk,
}: {
  name: string;
  color: Color;
  clock?: number;
  active?: boolean;
  uk: boolean;
}) {
  return (
    <div className={`chess-player-bar ${active ? "is-moving" : ""}`}>
      <span className={`chess-player-avatar ${color === "w" ? "is-white" : ""}`}>
        <ChessPiece piece="k" color={color} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate">{name}</strong>
        <span className="text-xs text-muted">
          {color === "w" ? (uk ? "Білі" : "White") : uk ? "Чорні" : "Black"}
          {active ? ` · ${uk ? "хід" : "to move"}` : ""}
        </span>
      </div>
      {clock !== undefined ? (
        <time className={`chess-clock ${clock < 30_000 ? "is-low" : ""}`}>{clockText(clock)}</time>
      ) : (
        <span className="text-xs text-muted">{uk ? "Без годинника" : "Untimed"}</span>
      )}
    </div>
  );
}
const PIECE_POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
function CapturedPieces({
  pieces,
  color,
  lead,
}: {
  pieces: PieceSymbol[];
  color: Color;
  lead: number;
}) {
  if (!pieces.length && lead <= 0) return null;
  return (
    <div className="chess-captures">
      {pieces.map((piece, i) => (
        <ChessPiece key={`${piece}-${i}`} piece={piece} color={color} />
      ))}
      {lead > 0 ? <b>+{lead}</b> : null}
    </div>
  );
}
function PositionControls({
  onFlip,
  onReset,
  uk,
}: {
  onFlip: () => void;
  onReset?: () => void;
  uk: boolean;
}) {
  return (
    <div className="my-3 flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">
        {uk
          ? "Оберіть фігуру й клітинку або перетягніть її."
          : "Tap a piece and a square, or drag the piece."}
      </span>
      <div className="flex shrink-0 gap-1">
        <button
          className="chess-icon-button"
          type="button"
          title={uk ? "Перевернути дошку" : "Flip board"}
          aria-label={uk ? "Перевернути дошку" : "Flip board"}
          onClick={onFlip}
        >
          <FlipVertical2 className="size-4" />
        </button>
        {onReset && (
          <button
            className="chess-icon-button"
            type="button"
            title={uk ? "Нова партія" : "New game"}
            aria-label={uk ? "Нова партія" : "New game"}
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
export function ChessClub({
  tab: requestedTab = "play",
  gameId,
  tournamentId,
  onNavigate,
  api = chessApi,
}: {
  tab?: ChessTab;
  gameId?: string;
  tournamentId?: string;
  onNavigate?: (n: ChessNavigation) => void;
  api?: ChessApi;
}) {
  const uk = usePrefs((s) => s.lang) === "uk",
    profile = useMeQuery().data?.profile;
  const [tab, setTab] = useState<ChessTab>(requestedTab),
    [mode, setMode] = useState<"bot" | "online" | "local">(gameId ? "online" : "bot");
  const [local, setLocal] = useState<LocalGame>(fresh),
    [localPly, setLocalPly] = useState(0),
    [orientation, setOrientation] = useState<Color>("w"),
    [restored, setRestored] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(gameId ?? null),
    [game, setGame] = useState<ChessGame | null>(null),
    [gameLoading, setGameLoading] = useState(false),
    [gamePly, setGamePly] = useState(0),
    [pending, setPending] = useState(false),
    [offset, setOffset] = useState(0),
    [now, setNow] = useState(Date.now()),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [hintFen, setHintFen] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(tournamentId ?? null);
  const [analysis, setAnalysis] = useState({ initialFen: DEFAULT_POSITION, moves: [] as string[] }),
    [analysisPly, setAnalysisPly] = useState(0),
    [importText, setImportText] = useState("");
  const [search, setSearch] = useState(""),
    [eco, setEco] = useState(""),
    [selectedOpening, setSelectedOpening] = useState<{ name: string; pgn: string; eco: string }>(
      OPENING_GUIDES[0],
    ),
    [openingPly, setOpeningPly] = useState(6),
    [openingLimit, setOpeningLimit] = useState(40);
  const tr = (a: string, b: string) => (uk ? a : b);
  useEffect(() => setTab(requestedTab), [requestedTab]);
  useEffect(() => {
    setSelectedGame(gameId ?? null);
    if (gameId) {
      setMode("online");
      setTab("play");
    }
  }, [gameId]);
  useEffect(() => setSelectedTournament(tournamentId ?? null), [tournamentId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const storageKey = `school-chess-local:v1:${profile?.userId ?? "guest"}`;
  useEffect(() => {
    setRestored(false);
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) ?? "null") as LocalGame | null;
      if (
        data &&
        typeof data.initialFen === "string" &&
        Array.isArray(data.moves) &&
        data.moves.length <= 600 &&
        ["w", "b"].includes(data.human) &&
        [0, 1, 2].includes(data.difficulty) &&
        ["bot", "local"].includes(data.mode)
      ) {
        replay(data.moves, data.initialFen);
        const next = {
          ...data,
          resigned: data.resigned === "w" || data.resigned === "b" ? data.resigned : null,
        };
        setLocal(next);
        setLocalPly(next.moves.length);
        setOrientation(next.human);
        if (!gameId) setMode(next.mode);
      } else {
        setLocal(fresh());
        setLocalPly(0);
      }
    } catch {
      setLocal(fresh());
      setLocalPly(0);
    }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (restored)
      try {
        localStorage.setItem(storageKey, JSON.stringify(local));
      } catch {}
  }, [storageKey, local, restored]);
  useEffect(() => {
    if (!selectedGame || !profile) {
      setGame(null);
      return;
    }
    setGame(null);
    setGameLoading(true);
    setError("");
    const started = Date.now();
    void api
      .action({ action: "ping" })
      .then((r) => setOffset(r.serverNow - (started + Date.now()) / 2))
      .catch(() => {});
    return api.game(
      selectedGame,
      (g) => {
        setGame(g);
        setGamePly(g?.moves.length ?? 0);
        setGameLoading(false);
        if (g) {
          const c = colorOf(g, profile.userId);
          if (c) setOrientation(c);
        }
      },
      () => {
        setGameLoading(false);
        setError(
          tr(
            "Не вдалося відкрити партію. Вона може бути недоступна вашій спільноті.",
            "Unable to open the game. It may be outside your community.",
          ),
        );
      },
    );
  }, [api, selectedGame, profile?.userId]);
  const localFull = useMemo(
    () => replay(local.moves, local.initialFen),
    [local.moves, local.initialFen],
  );
  const localBoard = useMemo(
    () => replay(local.moves.slice(0, localPly), local.initialFen),
    [local.moves, local.initialFen, localPly],
  );
  const localEnd =
      terminal(localFull) ??
      (local.moves.length >= 600 ? { result: "1/2-1/2" as const, reason: "move-limit" } : null),
    localFinished = Boolean(localEnd || local.resigned);
  const botEnabled =
    tab === "play" && mode === "bot" && !localFinished && localFull.turn() !== local.human;
  const level = LEVELS[local.difficulty];
  const bot = useChessEngine(
    botEnabled ? localFull.fen() : undefined,
    level.depth,
    level.budget,
    local.initialFen === DEFAULT_POSITION ? local.moves : [],
  );
  useEffect(() => {
    if (!botEnabled || bot.fen !== localFull.fen() || !bot.result?.lines[0]) return;
    const move = bot.result.lines[0].move;
    setLocal((old) => {
      const b = replay(old.moves, old.initialFen);
      if (b.fen() !== bot.fen || b.turn() === old.human || terminal(b) || old.resigned) return old;
      try {
        b.move(parseUci(move));
        return { ...old, moves: [...old.moves, move] };
      } catch {
        return old;
      }
    });
    setLocalPly(local.moves.length + 1);
  }, [bot.result, botEnabled, bot.fen, localFull, local.human, local.moves.length]);
  const analysisFull = useMemo(() => replay(analysis.moves, analysis.initialFen), [analysis]);
  const analysisBoard = useMemo(
    () => replay(analysis.moves.slice(0, analysisPly), analysis.initialFen),
    [analysis, analysisPly],
  );
  const analysisJob = useChessEngine(
    tab === "analysis" ? analysisBoard.fen() : undefined,
    3,
    1600,
    analysis.initialFen === DEFAULT_POSITION ? analysis.moves.slice(0, analysisPly) : [],
  );
  const hintJob = useChessEngine(hintFen ?? undefined, 2, 500);
  const openingMoves = useMemo(() => lineMoves(selectedOpening.pgn), [selectedOpening.pgn]);
  const openingFull = useMemo(() => replay(openingMoves), [openingMoves]);
  const openingBoard = useMemo(
    () => replay(openingMoves.slice(0, Math.min(openingPly, openingMoves.length))),
    [openingMoves, openingPly],
  );
  const openings = useQuery<Opening[]>({
    queryKey: ["chess-openings"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/chess/openings.json", { signal });
      if (!response.ok) throw new Error("OPENINGS_UNAVAILABLE");
      const data = await response.json();
      if (
        !Array.isArray(data) ||
        !data.every(
          (o) =>
            typeof o.eco === "string" &&
            typeof o.name === "string" &&
            typeof o.pgn === "string" &&
            Array.isArray(o.uci),
        )
      )
        throw new Error("INVALID_OPENINGS");
      return data;
    },
    enabled: tab === "openings",
    staleTime: Infinity,
    retry: 1,
  });
  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return (openings.data ?? []).filter(
      (o) =>
        (!eco || o.eco.startsWith(eco)) &&
        (!q ||
          `${o.name} ${openingLabel(o, uk)} ${o.eco} ${o.pgn}`.toLocaleLowerCase().includes(q)),
    );
  }, [openings.data, eco, search, uk]);
  useEffect(() => setOpeningLimit(40), [search, eco]);
  const onlineFull = useMemo(() => {
    try {
      return game ? replay(game.moves) : new Chess();
    } catch {
      return new Chess();
    }
  }, [game?.moves]);
  const onlineBoard = useMemo(() => {
    try {
      return game ? replay(game.moves.slice(0, gamePly)) : new Chess();
    } catch {
      return new Chess();
    }
  }, [game?.moves, gamePly]);
  function navigate(n: ChessNavigation) {
    setTab(n.tab);
    setSelectedGame(n.gameId ?? null);
    setSelectedTournament(n.tournamentId ?? null);
    onNavigate?.(n);
  }
  function openGame(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
      setError(tr("Некоректний код партії.", "Invalid game code."));
      return;
    }
    setMode("online");
    navigate({ tab: "play", gameId: id });
  }
  async function action(data: Record<string, unknown>) {
    setError("");
    setPending(true);
    const start = Date.now();
    try {
      const result = await api.action(data);
      setOffset(result.serverNow - (start + Date.now()) / 2);
      return result;
    } catch (e) {
      setError(errorText(e, uk));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  function applyLocal(move: string) {
    setError("");
    if (
      localFinished ||
      localPly !== local.moves.length ||
      (mode === "bot" && localFull.turn() !== local.human)
    )
      return;
    try {
      replay(local.moves, local.initialFen).move(parseUci(move));
      setLocal((old) => ({ ...old, moves: [...old.moves, move] }));
      setLocalPly(local.moves.length + 1);
    } catch {
      setError(tr("Цей хід неможливий.", "That move is not legal."));
    }
  }
  function newLocal(options: Partial<LocalGame> = {}) {
    if (
      local.moves.length &&
      !localFinished &&
      !confirm(
        tr(
          "Почати нову партію? Поточну локальну партію буде замінено.",
          "Start a new game? The current local game will be replaced.",
        ),
      )
    )
      return;
    const next = { ...local, ...options, moves: [], initialFen: DEFAULT_POSITION, resigned: null };
    setLocal(next);
    setLocalPly(0);
    setOrientation(next.human);
    setError("");
  }
  function studyGame(board: Chess) {
    const moves = board.history({ verbose: true }).map(uciOf);
    setAnalysis({ initialFen: board.getHeaders().FEN ?? DEFAULT_POSITION, moves });
    setAnalysisPly(moves.length);
    setImportText("");
    navigate({ tab: "analysis" });
  }
  function importPosition() {
    try {
      const value = importText.trim();
      let b: Chess;
      if (value.includes("/") && !value.includes("[")) {
        b = new Chess(value);
        setAnalysis({ initialFen: b.fen(), moves: [] });
        setAnalysisPly(0);
      } else {
        b = validatePgn(value);
        const moves = b.history({ verbose: true }).map(uciOf);
        setAnalysis({ initialFen: b.getHeaders().FEN ?? DEFAULT_POSITION, moves });
        setAnalysisPly(moves.length);
      }
      setError("");
    } catch {
      setError(
        tr(
          "Не вдалося прочитати позицію. Перевірте FEN або PGN; підтримуються партії до 600 півходів.",
          "Unable to read the position. Check FEN or PGN; games up to 600 plies are supported.",
        ),
      );
    }
  }
  function analysisMove(move: string) {
    if (analysisPly >= 600) {
      setError(
        tr(
          "Досягнуто ліміту 600 півходів. Поверніться до попередньої позиції або завантажте нову.",
          "The 600-ply limit has been reached. Return to an earlier position or load a new one.",
        ),
      );
      return;
    }
    try {
      const b = replay(analysis.moves.slice(0, analysisPly), analysis.initialFen);
      b.move(parseUci(move));
      setAnalysis((old) => ({ ...old, moves: [...old.moves.slice(0, analysisPly), move] }));
      setAnalysisPly(analysisPly + 1);
    } catch {
      setError(tr("Цей хід неможливий.", "That move is not legal."));
    }
  }
  async function share() {
    if (!selectedGame) return;
    const url = new URL(location.href);
    url.searchParams.set("section", "useful");
    url.searchParams.set("tool", "chess");
    url.searchParams.set("chessTab", "play");
    url.searchParams.set("chessGame", selectedGame);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice(tr("Посилання скопійовано.", "Link copied."));
    } catch {
      setNotice(tr("Код партії:", "Game code:") + " " + selectedGame);
    }
  }
  const activeOnline = mode === "online" && selectedGame;
  const board =
    tab === "openings"
      ? openingBoard
      : tab === "analysis"
        ? analysisBoard
        : activeOnline
          ? onlineBoard
          : localBoard;
  const full =
    tab === "openings"
      ? openingFull
      : tab === "analysis"
        ? analysisFull
        : activeOnline
          ? onlineFull
          : localFull;
  const ply =
    tab === "openings"
      ? openingPly
      : tab === "analysis"
        ? analysisPly
        : activeOnline
          ? gamePly
          : localPly;
  const moveHistory = full.history({ verbose: true });
  const reviewed = moveHistory.slice(0, Math.min(ply, moveHistory.length));
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of reviewed) {
    if (move.captured) captured[move.color].push(move.captured);
  }
  const material = (pieces: PieceSymbol[]) =>
    pieces.reduce((sum, piece) => sum + PIECE_POINTS[piece], 0);
  const whiteLead = material(captured.w) - material(captured.b);
  const hintMove =
    !activeOnline && hintJob.fen === board.fen() ? hintJob.result?.lines[0]?.move : undefined;
  const practiceEval = tab === "play" && !activeOnline ? evaluate(board) : null;
  const selectedGuide = OPENING_GUIDES.find(
    (g) => g.pgn === selectedOpening.pgn || selectedOpening.name.startsWith(g.en),
  );
  const showBoard =
    tab === "openings" ||
    tab === "analysis" ||
    (tab === "play" && (mode !== "online" || Boolean(selectedGame)));
  const myColor = game && profile ? colorOf(game, profile.userId) : null;
  const canOnlineMove = Boolean(
    game &&
    game.status === "active" &&
    myColor === game.turn &&
    gamePly === game.moves.length &&
    !pending,
  );
  const localResult = local.resigned ? (local.resigned === "w" ? "0-1" : "1-0") : localEnd?.result;
  const gameStatus = activeOnline
    ? game?.status === "waiting"
      ? game.expiresAt <= now + offset
        ? tr("Час запрошення минув", "Invitation expired")
        : tr("Чекаємо на суперника", "Waiting for an opponent")
      : game?.status === "cancelled"
        ? tr("Запрошення скасовано", "Invitation cancelled")
        : game?.status === "finished"
          ? `${game.result} · ${reasonLabel(game.reason, uk)}`
          : gameLoading
            ? tr("Підключення…", "Connecting…")
            : game
              ? tr("Партія триває", "Game in progress")
              : tr("Партію не знайдено", "Game not found")
    : localFinished
      ? `${localResult} · ${reasonLabel(local.resigned ? "resignation" : (localEnd?.reason ?? null), uk)}`
      : bot.busy
        ? tr("Бот обмірковує хід…", "The bot is thinking…")
        : board.isCheck()
          ? tr("Шах. Захистіть короля.", "Check. Protect your king.")
          : localPly !== local.moves.length
            ? tr("Перегляд історії партії", "Reviewing game history")
            : tr("Ваш наступний хід.", "Your next move.");
  return (
    <section className="chess-club" aria-label={tr("Шаховий клуб", "Chess club")}>
      <header className="chess-hero">
        <div className="relative z-10">
          <div className="chess-hero-kicker">
            <span className="size-1.5 rounded-full bg-[#d5b879]" />
            {tr("КЛАСНИЙ ПРОСТІР · ШАХОВИЙ КЛУБ", "CLASS SPACE · CHESS CLUB")}
          </div>
          <h1>{tr("Думайте на хід уперед.", "Think one move ahead.")}</h1>
          <p>
            {tr(
              "Навчайтеся, грайте й знаходьте своїх суперників. Від першого дебюту до шкільного кубка.",
              "Learn, play and find your opponents. From your first opening to the school cup.",
            )}
          </p>
          <div className="chess-hero-meta">
            <span>
              <BookOpen className="size-4" />
              {tr("База дебютів", "Opening library")}
            </span>
            <span>
              <Cpu className="size-4" />
              {tr("Бот і аналіз", "Bot & analysis")}
            </span>
            <span>
              <Trophy className="size-4" />
              {tr("Живі турніри", "Live tournaments")}
            </span>
          </div>
        </div>
        <div className="chess-hero-art">
          <ChessPiece piece="n" color="w" />
          <div className="chess-art-board" />
        </div>
      </header>
      <nav className="chess-tabs" aria-label={tr("Розділи шахів", "Chess sections")}>
        {(
          [
            ["play", Swords, tr("Грати", "Play")],
            ["openings", BookOpen, tr("Дебюти", "Openings")],
            ["analysis", Sparkles, tr("Аналіз", "Analysis")],
            ["tournaments", Trophy, tr("Турніри", "Tournaments")],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            type="button"
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "is-active" : ""}
            onClick={() =>
              navigate({
                tab: key,
                ...(key === "play" && selectedGame ? { gameId: selectedGame } : {}),
                ...(key === "tournaments" && selectedTournament
                  ? { tournamentId: selectedTournament }
                  : {}),
              })
            }
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div className="chess-error" role="alert">
          <span className="flex-1">{error}</span>
          <button
            aria-label={tr("Закрити повідомлення", "Dismiss error")}
            onClick={() => setError("")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="chess-notice my-4" role="status">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            aria-label={tr("Закрити повідомлення", "Dismiss message")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {tab === "play" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="chess-mode-switch" aria-label={tr("Режим гри", "Game mode")}>
            {(["bot", "online", "local"] as const).map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={mode === m}
                className={mode === m ? "is-active" : ""}
                onClick={() => {
                  setMode(m);
                  if (m !== "online") setLocal((old) => ({ ...old, mode: m }));
                  if (m !== "online") navigate({ tab: "play" });
                  else if (selectedGame) navigate({ tab: "play", gameId: selectedGame });
                }}
              >
                {m === "bot"
                  ? tr("З ботом", "Bot")
                  : m === "online"
                    ? tr("З людьми", "People")
                    : tr("На одній дошці", "Same device")}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">
            {mode === "online"
              ? tr(
                  "Час і ходи синхронізуються між гравцями.",
                  "Clocks and moves are synchronized between players.",
                )
              : tr(
                  "Локальна партія зберігається на цьому пристрої.",
                  "Your local game is saved on this device.",
                )}
          </span>
        </div>
      )}
      {showBoard && (
        <>
          {activeOnline && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button className="chess-text-button" onClick={() => navigate({ tab: "play" })}>
                <ArrowLeft className="size-4" />
                {tr("До спільноти", "Back to lobby")}
              </button>
              <button className="chess-secondary" onClick={() => void share()}>
                <Copy className="size-4" />
                {tr("Запросити за посиланням", "Share game link")}
              </button>
            </div>
          )}
          <div className="chess-game-layout">
            <div className="min-w-0">
              <div className="chess-board-frame">
                <PlayerBar
                  name={
                    tab === "openings"
                      ? tr("Розбираємо дебют", "Opening study")
                      : tab === "analysis"
                        ? tr("Аналіз позиції", "Position analysis")
                        : activeOnline
                          ? ((orientation === "w" ? game?.black?.name : game?.white?.name) ??
                            tr("Місце для суперника", "Opponent’s seat"))
                          : mode === "local"
                            ? orientation === "w"
                              ? tr("Другий гравець", "Second player")
                              : tr("Перший гравець", "First player")
                            : orientation === local.human
                              ? tr("Клубний бот", "Club bot")
                              : profile?.displayName || tr("Ви", "You")
                  }
                  color={orientation === "w" ? "b" : "w"}
                  clock={
                    activeOnline && game
                      ? remaining(game, orientation === "w" ? "b" : "w", now + offset)
                      : undefined
                  }
                  active={tab === "play" && board.turn() !== orientation}
                  uk={uk}
                />
                <CapturedPieces
                  pieces={captured[orientation === "w" ? "b" : "w"]}
                  color={orientation}
                  lead={orientation === "w" ? Math.max(0, -whiteLead) : Math.max(0, whiteLead)}
                />
                <ChessBoard
                  board={board}
                  orientation={orientation}
                  uk={uk}
                  hint={hintMove}
                  lastMove={
                    ply > 0
                      ? uciOf(
                          moveHistory[Math.min(ply, moveHistory.length) - 1] ?? {
                            from: "",
                            to: "",
                          },
                        )
                      : undefined
                  }
                  disabled={
                    tab === "openings" ||
                    (tab === "play" &&
                      (activeOnline
                        ? !canOnlineMove
                        : localFinished ||
                          localPly !== local.moves.length ||
                          (mode === "bot" && localFull.turn() !== local.human)))
                  }
                  onMove={
                    tab === "analysis"
                      ? analysisMove
                      : activeOnline
                        ? (move) => {
                            if (game)
                              void action({
                                action: "move",
                                id: game.id,
                                move,
                                revision: game.revision,
                              });
                          }
                        : applyLocal
                  }
                />
                <CapturedPieces
                  pieces={captured[orientation]}
                  color={orientation === "w" ? "b" : "w"}
                  lead={orientation === "w" ? Math.max(0, whiteLead) : Math.max(0, -whiteLead)}
                />
                <PlayerBar
                  name={
                    tab === "openings"
                      ? openingLabel(selectedOpening, uk)
                      : tab === "analysis"
                        ? tr("Ваша дошка для досліджень", "Your study board")
                        : activeOnline
                          ? ((orientation === "w" ? game?.white?.name : game?.black?.name) ??
                            tr("Вільне місце", "Open seat"))
                          : mode === "local"
                            ? orientation === "w"
                              ? tr("Перший гравець", "First player")
                              : tr("Другий гравець", "Second player")
                            : orientation === local.human
                              ? profile?.displayName || tr("Ви", "You")
                              : tr("Клубний бот", "Club bot")
                  }
                  color={orientation}
                  clock={
                    activeOnline && game ? remaining(game, orientation, now + offset) : undefined
                  }
                  active={tab === "play" && board.turn() === orientation}
                  uk={uk}
                />
              </div>
              <PositionControls
                uk={uk}
                onFlip={() => setOrientation((c) => (c === "w" ? "b" : "w"))}
                onReset={tab === "play" && !activeOnline ? () => newLocal() : undefined}
              />
              {tab === "play" && (
                <div className="chess-position-status" role="status">
                  <span
                    className={`chess-status-dot ${localFinished || game?.status === "finished" ? "is-finished" : ""}`}
                  />
                  {gameStatus}
                </div>
                {practiceEval !== null && (
                  <div className="chess-eval-strip">
                    <div
                      className="chess-eval-track"
                      title={tr(
                        "Приблизна оцінка з боку білих",
                        "Approximate evaluation from White’s side",
                      )}
                    >
                      <span
                        style={{
                          width: `${Math.max(6, Math.min(94, 50 + (Math.abs(practiceEval) > 90000 ? (practiceEval > 0 ? 40 : -40) : practiceEval / 12)))}%`,
                        }}
                      />
                    </div>
                    <span>
                      {Math.abs(practiceEval) > 90000
                        ? practiceEval > 0
                          ? "M+"
                          : "M−"
                        : `${practiceEval > 0 ? "+" : ""}${(practiceEval / 100).toFixed(1)}`}
                    </span>
                  </div>
                )}
              )}
              {tab === "analysis" && (
                <div className="chess-eval-summary">
                  <span className="chess-eval-number">
                    {analysisJob.busy ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : analysisJob.result?.lines[0] ? (
                      Math.abs(analysisJob.result.lines[0].score) > 90000 ? (
                        analysisJob.result.lines[0].score > 0 ? (
                          "M+"
                        ) : (
                          "M−"
                        )
                      ) : (
                        (analysisJob.result.lines[0].score > 0 ? "+" : "") +
                        (analysisJob.result.lines[0].score / 100).toFixed(2)
                      )
                    ) : (
                      (terminal(analysisBoard)?.result ?? "—")
                    )}
                  </span>
                  <p>
                    {tr(
                      "Орієнтовна оцінка з боку білих. «+» на користь білих, «−» — чорних.",
                      "Approximate evaluation from White’s perspective. + favours White; − favours Black.",
                    )}
                    <small>
                      {tr(
                        "Локальний навчальний рушій · не Stockfish",
                        "Local teaching engine · not Stockfish",
                      )}
                    </small>
                  </p>
                </div>
              )}
              {tab === "openings" && selectedGuide && (
                <div className="chess-opening-note">
                  <span className="chess-count">{selectedOpening.eco}</span>
                  <h3 className="mt-3 text-lg font-extrabold">
                    {openingLabel(selectedOpening, uk)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {uk ? selectedGuide.text : selectedGuide.english}
                  </p>
                </div>
              )}
            </div>
            <aside className="min-w-0 space-y-4">
              {tab === "play" && !activeOnline && (
                <div className="chess-config">
                  <span className="chess-eyebrow">
                    {mode === "bot"
                      ? tr("ВАШ СПАРИНГ-ПАРТНЕР", "YOUR SPARRING PARTNER")
                      : tr("ГРА ПОРУЧ", "SIDE BY SIDE")}
                  </span>
                  <h2>
                    {mode === "bot"
                      ? tr("Партія без поспіху", "An unhurried game")
                      : tr("Одна дошка, двоє друзів", "One board, two friends")}
                  </h2>
                  <p>
                    {mode === "bot"
                      ? tr(
                          "Три рівні для практики. Оберіть свій темп і спробуйте новий план.",
                          "Three practice levels. Choose your pace and try a new plan.",
                        )
                      : tr(
                          "Передавайте пристрій після ходу. Обидва гравці керують своїми фігурами.",
                          "Pass the device after each move. Both players control their own pieces.",
                        )}
                  </p>
                  {mode === "bot" && (
                    <>
                      <label className="chess-field mt-4">
                        {tr("Рівень суперника", "Opponent level")}
                        <select
                          value={local.difficulty}
                          onChange={(e) => newLocal({ difficulty: Number(e.target.value) })}
                        >
                          {LEVELS.map((l, i) => (
                            <option key={i} value={i}>
                              {uk ? l.uk : l.en}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-4 flex gap-2">
                        {(["w", "b"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`chess-colour-choice ${local.human === c ? "is-active" : ""}`}
                            aria-pressed={local.human === c}
                            onClick={() => newLocal({ human: c })}
                          >
                            <ChessPiece piece="k" color={c} />
                            {c === "w" ? tr("За білих", "White") : tr("За чорних", "Black")}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    className="chess-primary mt-4 w-full"
                    onClick={() => newLocal({ mode: mode === "bot" ? "bot" : "local" })}
                  >
                    <RotateCcw className="size-4" />
                    {tr("Нова партія", "New game")}
                  </button>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="chess-text-button"
                      disabled={
                        localFinished ||
                        bot.busy ||
                        localPly !== local.moves.length ||
                        (mode === "bot" && localFull.turn() !== local.human)
                      }
                      onClick={() => setHintFen(localBoard.fen())}
                    >
                      <Lightbulb className="size-3.5" />
                      {hintJob.busy && hintFen === localBoard.fen()
                        ? tr("Шукаю…", "Looking…")
                        : hintMove
                          ? `${tr("Підказка", "Hint")} · ${hintJob.result?.lines[0]?.san}`
                          : tr("Підказка", "Hint")}
                    </button>
                    <button
                      className="chess-text-button"
                      onClick={() => {
                        const fen = localBoard.fen();
                        navigator.clipboard
                          ?.writeText(fen)
                          .then(() => setNotice(tr("Позицію скопійовано.", "Position copied.")))
                          .catch(() => setNotice(fen));
                      }}
                    >
                      <Copy className="size-3.5" />
                      {tr("Копіювати FEN", "Copy FEN")}
                    </button>
                    <button
                      className="chess-text-button"
                      disabled={!local.moves.length || bot.busy}
                      onClick={() => {
                        const count = mode === "bot" && localFull.turn() === local.human ? 2 : 1;
                        const moves = local.moves.slice(0, Math.max(0, local.moves.length - count));
                        setLocal((old) => ({ ...old, moves, resigned: null }));
                        setLocalPly(moves.length);
                      }}
                    >
                      {tr("Повернути хід", "Take back")}
                    </button>
                    <button
                      className="chess-text-button"
                      disabled={!local.moves.length || localFinished}
                      onClick={() => {
                        if (confirm(tr("Здати цю локальну партію?", "Resign this local game?")))
                          setLocal((old) => ({
                            ...old,
                            resigned: mode === "bot" ? old.human : localFull.turn(),
                          }));
                      }}
                    >
                      {tr("Здатися", "Resign")}
                    </button>
                    <button
                      className="chess-text-button"
                      disabled={!local.moves.length}
                      onClick={() => studyGame(localFull)}
                    >
                      {tr("Розібрати партію", "Analyze game")}
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                  {bot.error && (
                    <p className="mt-3 text-sm" role="alert">
                      {tr(
                        "Бот не запустився. Спробуйте нову партію або режим на одній дошці.",
                        "The bot could not start. Try a new game or same-device play.",
                      )}
                    </p>
                  )}
                </div>
              )}
              {tab === "play" && activeOnline && game && (
                <div className="chess-card">
                  <span className="chess-eyebrow">{tr("ОНЛАЙН-ПАРТІЯ", "ONLINE GAME")}</span>
                  <h2 className="mt-2 text-lg font-extrabold">
                    {game.scope === "school"
                      ? tr("Шкільна спільнота", "School community")
                      : tr("Гравці всього сайту", "Site community")}
                  </h2>
                  <p className="mt-2 break-all text-xs text-muted">
                    {tr("Код:", "Code:")} {game.id}
                  </p>
                  {game.status === "waiting" && profile && (
                    <button
                      className="chess-primary mt-4 w-full"
                      disabled={pending || game.expiresAt <= now + offset}
                      onClick={() =>
                        game.hostId === profile.userId
                          ? void action({ action: "cancel", id: game.id })
                          : void action({ action: "join", id: game.id })
                      }
                    >
                      {game.hostId === profile.userId
                        ? tr("Скасувати запрошення", "Cancel invitation")
                        : tr("Приєднатися до партії", "Join game")}
                    </button>
                  )}
                  {game.status === "active" && myColor && (
                    <>
                      <p className="chess-notice mt-4">
                        {tr(
                          "Аналіз і підказки не відображаються під час онлайн-партії.",
                          "Analysis and hints are hidden during an online game.",
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="chess-secondary"
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                tr(
                                  "Здати партію? Суперник отримає перемогу.",
                                  "Resign the game? Your opponent will win.",
                                ),
                              )
                            )
                              void action({ action: "resign", id: game.id });
                          }}
                        >
                          {tr("Здатися", "Resign")}
                        </button>
                        <button
                          className="chess-secondary"
                          disabled={pending || Boolean(game.drawOffer)}
                          onClick={() => void action({ action: "offer", id: game.id })}
                        >
                          {tr("Нічия", "Offer draw")}
                        </button>
                        {remaining(game, game.turn, now + offset) === 0 && (
                          <button
                            className="chess-primary"
                            disabled={pending}
                            onClick={() => void action({ action: "timeout", id: game.id })}
                          >
                            {tr("Перевірити час", "Claim timeout")}
                          </button>
                        )}
                      </div>
                      {game.drawOffer && (
                        <div className="chess-notice mt-4">
                          {game.drawOffer === profile?.userId ? (
                            tr("Ви запропонували нічию.", "You offered a draw.")
                          ) : (
                            <>
                              <p>
                                {tr("Суперник пропонує нічию.", "Your opponent offers a draw.")}
                              </p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  className="chess-primary"
                                  disabled={pending}
                                  onClick={() => void action({ action: "accept", id: game.id })}
                                >
                                  {tr("Прийняти", "Accept")}
                                </button>
                                <button
                                  className="chess-secondary"
                                  disabled={pending}
                                  onClick={() => void action({ action: "decline", id: game.id })}
                                >
                                  {tr("Відхилити", "Decline")}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {game.status === "active" && !myColor && (
                    <p className="mt-4 text-sm text-muted">
                      {tr("Ви спостерігаєте за партією.", "You are watching this game.")}
                    </p>
                  )}
                  {game.status === "finished" && (
                    <button
                      className="chess-primary mt-4 w-full"
                      onClick={() => studyGame(onlineFull)}
                    >
                      <Sparkles className="size-4" />
                      {tr("Проаналізувати партію", "Analyze game")}
                    </button>
                  )}
                </div>
              )}
              {tab === "analysis" && (
                <div className="chess-card">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold">{tr("Кандидати на хід", "Candidate moves")}</h2>
                    {analysisJob.busy && <Loader2 className="size-4 animate-spin" />}
                  </div>
                  {analysisJob.result?.lines.map((line, i) => (
                    <button
                      type="button"
                      className="chess-engine-line"
                      key={line.move}
                      onClick={() => analysisMove(line.move)}
                    >
                      <span className="chess-count">{i + 1}</span>
                      <strong>{line.san}</strong>
                      <span className="ml-auto font-mono">
                        {Math.abs(line.score) > 90000
                          ? "M"
                          : `${line.score > 0 ? "+" : ""}${(line.score / 100).toFixed(2)}`}
                      </span>
                      <ChevronRight className="size-4" />
                    </button>
                  ))}
                  {analysisJob.error && (
                    <p className="mt-3 text-sm text-muted">
                      {tr(
                        "Локальний рушій не запустився. Дошка та імпорт позицій залишаються доступними.",
                        "The local engine could not start. The board and imports remain available.",
                      )}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted">
                    {tr(
                      "Обмежений розрахунок — перевіряйте ідеї власним аналізом.",
                      "A bounded search — verify ideas with your own analysis.",
                    )}{" "}
                    {analysisJob.result
                      ? `${tr("Глибина", "Depth")}: ${analysisJob.result.depth} · ${analysisJob.result.nodes} ${tr("вузлів", "nodes")}`
                      : ""}
                  </p>
                </div>
              )}
              <div className="chess-card">
                <MoveList
                  game={full}
                  ply={Math.min(ply, moveHistory.length)}
                  onPly={
                    tab === "openings"
                      ? setOpeningPly
                      : tab === "analysis"
                        ? setAnalysisPly
                        : activeOnline
                          ? setGamePly
                          : setLocalPly
                  }
                  uk={uk}
                />
                <PgnActions pgn={full.pgn()} uk={uk} onError={setError} />
              </div>
              {tab === "openings" && (
                <div className="chess-card">
                  <h3 className="font-extrabold">
                    {tr("Спробуйте цей дебют", "Try this opening")}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{selectedOpening.pgn}</p>
                  <button
                    className="chess-primary mt-4 w-full"
                    onClick={() => {
                      const moves = openingMoves.slice(0, openingPly);
                      setLocal({ ...fresh(), moves, human: openingBoard.turn() });
                      setLocalPly(moves.length);
                      setOrientation(openingBoard.turn());
                      setMode("bot");
                      navigate({ tab: "play" });
                    }}
                  >
                    {tr("Зіграти з цієї позиції", "Play this position")}
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    className="chess-secondary mt-2 w-full"
                    onClick={() => studyGame(openingBoard)}
                  >
                    {tr("Відкрити в аналізі", "Open in analysis")}
                  </button>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      {tab === "analysis" && (
        <div className="chess-card mt-6">
          <h2 className="text-lg font-extrabold">
            {tr(
              "Ваша партія — матеріал для наступної перемоги",
              "Your game is material for your next win",
            )}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {tr(
              "Вставте PGN партії або FEN позиції. Далі переглядайте ходи чи випробовуйте власні продовження на дошці.",
              "Paste a game’s PGN or a position’s FEN. Review the moves or try your own continuations on the board.",
            )}
          </p>
          <label className="chess-field mt-4">
            PGN / FEN
            <textarea
              aria-label="PGN / FEN"
              rows={3}
              value={importText}
              maxLength={30000}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="1. e4 e5 2. Nf3 Nc6…"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="chess-primary"
              disabled={!importText.trim()}
              onClick={importPosition}
            >
              {tr("Завантажити позицію", "Load position")}
            </button>
            <button
              className="chess-secondary"
              onClick={() => {
                setAnalysis({ initialFen: DEFAULT_POSITION, moves: [] });
                setAnalysisPly(0);
                setError("");
              }}
            >
              {tr("Початкова позиція", "Starting position")}
            </button>
          </div>
          <p className="mt-4 break-all font-mono text-xs text-muted">FEN: {analysisBoard.fen()}</p>
        </div>
      )}
      {tab === "openings" && (
        <div className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="chess-eyebrow">
                {tr("ОСМИСЛЕНІ ПЕРШІ ХОДИ", "PURPOSEFUL FIRST MOVES")}
              </p>
              <h2 className="text-2xl font-extrabold">
                {tr("Знайдіть свій дебют", "Find your opening")}
              </h2>
            </div>
            <span className="text-xs text-muted">
              {openings.data?.length.toLocaleString() ?? "…"}{" "}
              {tr("варіантів · база Lichess CC0", "variations · Lichess CC0")}
            </span>
          </div>
          <div className="chess-guides">
            {OPENING_GUIDES.map((g) => (
              <button
                type="button"
                key={g.en}
                aria-pressed={selectedOpening.pgn === g.pgn}
                className={selectedOpening.pgn === g.pgn ? "is-selected" : ""}
                onClick={() => {
                  setSelectedOpening(g);
                  setOpeningPly(lineMoves(g.pgn).length);
                }}
              >
                <span className="chess-guide-eco">{g.eco}</span>
                <strong>{uk ? g.name : g.en}</strong>
                <span>{g.pgn}</span>
                <ArrowUpRightIcon />
              </button>
            ))}
          </div>
          <div className="chess-card mt-6">
            <div className="mb-4 flex flex-wrap gap-3">
              <label className="chess-search min-w-0 flex-1">
                <Search className="size-4" />
                <input
                  aria-label={tr("Знайти дебют", "Search openings")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("Назва, код ECO або ходи…", "Name, ECO code or moves…")}
                />
              </label>
              <label className="chess-field">
                <span className="sr-only">{tr("Том ECO", "ECO volume")}</span>
                <select
                  value={eco}
                  onChange={(e) => setEco(e.target.value)}
                  aria-label={tr("Том ECO", "ECO volume")}
                >
                  <option value="">{tr("Усі ECO", "All ECO")}</option>
                  {["A", "B", "C", "D", "E"].map((c) => (
                    <option key={c} value={c}>
                      {c}00–{c}99
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {openings.isError ? (
              <div className="chess-empty">
                <p>
                  {tr(
                    "Каталог не завантажився. Навчальні дебюти вище доступні.",
                    "The catalogue could not load. The teaching openings above remain available.",
                  )}
                </p>
                <button className="chess-secondary mt-3" onClick={() => void openings.refetch()}>
                  {tr("Повторити", "Retry")}
                </button>
              </div>
            ) : openings.isPending ? (
              <p className="py-6 text-sm text-muted" role="status">
                {tr("Завантажуємо каталог…", "Loading catalogue…")}
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted">
                  {filteredOpenings.length} {tr("знайдено", "found")}
                </p>
                <div className="chess-opening-results">
                  {filteredOpenings.slice(0, openingLimit).map((o) => (
                    <button
                      type="button"
                      key={`${o.eco}:${o.name}:${o.pgn}`}
                      onClick={() => {
                        setSelectedOpening(o);
                        setOpeningPly(o.uci.length);
                        document
                          .querySelector(".chess-game-layout")
                          ?.scrollIntoView({ behavior: "auto", block: "start" });
                      }}
                    >
                      <span className="chess-count">{o.eco}</span>
                      <span className="min-w-0 flex-1">
                        <strong>{openingLabel(o, uk)}</strong>
                        <small>{o.pgn}</small>
                      </span>
                      <ChevronRight className="size-4 shrink-0" />
                    </button>
                  ))}
                </div>
                {!filteredOpenings.length && (
                  <div className="chess-empty">
                    {tr("За цим запитом дебютів немає.", "No openings match your search.")}
                  </div>
                )}
                {filteredOpenings.length > openingLimit && (
                  <button
                    className="chess-secondary mt-4"
                    onClick={() => setOpeningLimit((n) => n + 40)}
                  >
                    {tr("Показати ще", "Show more")}
                  </button>
                )}
              </>
            )}
            <p className="mt-5 border-t border-hairline pt-3 text-xs text-muted">
              {tr(
                "Каталог назв і ходів, без статистики перемог. Пояснення додано до навчальної добірки.",
                "A catalogue of names and moves, without win statistics. Teaching notes accompany the curated selection.",
              )}{" "}
              <a
                className="underline"
                href="/chess/NOTICE.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("Джерела й методика", "Sources and method")}
              </a>
            </p>
          </div>
        </div>
      )}
      {tab === "play" &&
        mode === "online" &&
        !selectedGame &&
        (profile ? (
          <OnlineLobby profile={profile} api={api} onOpen={openGame} onAction={action} uk={uk} />
        ) : (
          <div className="chess-empty">
            {tr(
              "Увійдіть в обліковий запис, щоб грати з іншими людьми.",
              "Sign in to play other people.",
            )}
          </div>
        ))}
      {tab === "tournaments" &&
        (profile ? (
          <ChessTournaments
            profile={profile}
            api={api}
            selected={selectedTournament}
            onSelect={(id) => navigate({ tab: "tournaments", ...(id ? { tournamentId: id } : {}) })}
            onGame={openGame}
            onAction={action}
            uk={uk}
          />
        ) : (
          <div className="chess-empty">
            {tr("Для турнірів потрібен обліковий запис.", "Sign in to join tournaments.")}
          </div>
        ))}
      <footer className="chess-footer">
        <span>
          <Check className="size-3.5" />
          {tr(
            "Легальні ходи · рокіровка · взяття на проході · перетворення",
            "Legal moves · castling · en passant · promotion",
          )}
        </span>
        <a href="/chess/NOTICE.md" target="_blank" rel="noopener noreferrer">
          {tr("Про шаховий розділ", "About chess")}
        </a>
      </footer>
    </section>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0" aria-hidden="true">
      <path
        d="M4 12 12 4M5 4h7v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
