import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, RefreshCw, Users, Globe2, Clock3 } from "lucide-react";
import type { ChessApi } from "@/lib/chess/api";
import { TIME_CONTROLS, type ChessGame, type ChessScope } from "@/lib/chess/model";
import type { Profile } from "@/lib/school/types";
export function ScopePicker({
  scope,
  onChange,
  schoolId,
  uk,
}: {
  scope: ChessScope;
  onChange: (s: ChessScope) => void;
  schoolId: string | null;
  uk: boolean;
}) {
  return (
    <div className="chess-scope" aria-label={uk ? "Спільнота гравців" : "Player community"}>
      {(["school", "site"] as const).map((s) => (
        <button
          type="button"
          key={s}
          aria-pressed={scope === s}
          disabled={s === "school" && !schoolId}
          onClick={() => onChange(s)}
          className={scope === s ? "is-active" : ""}
        >
          {s === "school" ? <Users className="size-4" /> : <Globe2 className="size-4" />}
          {s === "school" ? (uk ? "Моя школа" : "My school") : uk ? "Увесь сайт" : "Everyone"}
        </button>
      ))}
    </div>
  );
}
export function OnlineLobby({
  profile,
  api,
  onOpen,
  onAction,
  uk,
}: {
  profile: Profile;
  api: ChessApi;
  onOpen: (id: string) => void;
  onAction: (data: Record<string, unknown>) => Promise<{ id?: string } | undefined>;
  uk: boolean;
}) {
  const [scope, setScope] = useState<ChessScope>(profile.schoolId ? "school" : "site"),
    [games, setGames] = useState<ChessGame[]>([]),
    [mine, setMine] = useState<ChessGame[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [pending, setPending] = useState(false),
    [time, setTime] = useState(1),
    [color, setColor] = useState("w"),
    [code, setCode] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setLoading(true);
    setError(false);
    setGames([]);
    const fail = () => {
      setError(true);
      setLoading(false);
    };
    const a = api.lobby(
      scope,
      profile.schoolId,
      (v) => {
        setGames(v);
        setLoading(false);
      },
      fail,
    );
    const b = api.mine(profile.userId, setMine, fail);
    return () => {
      a();
      b();
    };
  }, [api, scope, profile.schoolId, profile.userId, retry]);
  async function act(data: Record<string, unknown>) {
    setPending(true);
    try {
      const result = await onAction(data);
      if (result?.id) onOpen(result.id);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="chess-online-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="chess-eyebrow">{uk ? "ЗУСТРІЧ ЗА ДОШКОЮ" : "MEET AT THE BOARD"}</p>
          <h2 className="text-2xl font-extrabold">
            {uk ? "Знайдіть суперника" : "Find an opponent"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {uk
              ? "Створіть відкриту партію або прийміть запрошення. Партії спільноти можна спостерігати."
              : "Create an open game or accept an invitation. Community games can be watched."}
          </p>
        </div>
        <ScopePicker scope={scope} onChange={setScope} schoolId={profile.schoolId} uk={uk} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="chess-card h-fit">
          <h3 className="font-extrabold">{uk ? "Нова партія" : "New game"}</h3>
          <label className="chess-field mt-4">
            {uk ? "Контроль часу" : "Time control"}
            <select value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {TIME_CONTROLS.map((t, i) => (
                <option key={i} value={i}>
                  {t.label} · {uk ? "хв + с/хід" : "min + sec/move"}
                </option>
              ))}
            </select>
          </label>
          <label className="chess-field mt-3">
            {uk ? "Ваш колір" : "Your colour"}
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="w">{uk ? "Білі" : "White"}</option>
              <option value="b">{uk ? "Чорні" : "Black"}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            className="chess-primary mt-4 w-full"
            onClick={() => void act({ action: "create", scope, color, timeControl: time })}
          >
            <Plus className="size-4" />
            {uk ? "Створити партію" : "Create game"}
          </button>
          <p className="mt-3 text-xs text-muted">
            {uk
              ? "Запрошення діє 15 хв. Час починається, щойно приєднається суперник."
              : "An invitation lasts 15 minutes. Clocks start when an opponent joins."}
          </p>
          <form
            className="mt-6 border-t border-hairline pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) onOpen(code.trim());
            }}
          >
            <label className="chess-field">
              {uk ? "Код партії" : "Game code"}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={100}
                pattern="[a-zA-Z0-9_-]+"
                placeholder={uk ? "Вставте код запрошення" : "Paste an invitation code"}
              />
            </label>
            <button className="chess-secondary mt-3 w-full" type="submit" disabled={!code.trim()}>
              {uk ? "Відкрити" : "Open"}
              <ArrowUpRight className="size-4" />
            </button>
          </form>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold">{uk ? "Відкриті запрошення" : "Open invitations"}</h3>
            <span className="chess-count">{games.filter((g) => g.expiresAt > now).length}</span>
          </div>
          {error ? (
            <div className="chess-empty">
              <p>
                {uk
                  ? "Онлайн-кімнати зараз недоступні. Ви можете зіграти з ботом або повторити підключення."
                  : "Online rooms are unavailable. Play the bot or retry the connection."}
              </p>
              <button className="chess-secondary mt-4" onClick={() => setRetry((n) => n + 1)}>
                <RefreshCw className="size-4" />
                {uk ? "Повторити" : "Retry"}
              </button>
            </div>
          ) : loading ? (
            <div className="chess-empty" role="status">
              {uk ? "Шукаємо відкриті партії…" : "Loading invitations…"}
            </div>
          ) : games.filter((g) => g.expiresAt > now).length === 0 ? (
            <div className="chess-empty">
              <Users className="mx-auto mb-4 size-8 text-forest-mid" />
              <p className="font-bold">
                {uk ? "Станьте першим за дошкою" : "Be the first at the board"}
              </p>
              <p className="mt-2 text-sm">
                {uk
                  ? "Створіть запрошення й поділіться посиланням із другом."
                  : "Create an invitation and share its link with a friend."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {games
                .filter((g) => g.expiresAt > now)
                .map((g) => (
                  <div className="chess-room" key={g.id}>
                    <span className="chess-avatar">{(g.white ?? g.black)?.name.charAt(0)}</span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate">{(g.white ?? g.black)?.name}</strong>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Clock3 className="size-3" />
                        {g.initialMs / 60000} + {g.incrementMs / 1000} ·{" "}
                        {g.white
                          ? uk
                            ? "вільні чорні"
                            : "Black available"
                          : uk
                            ? "вільні білі"
                            : "White available"}
                      </span>
                    </div>
                    <button
                      className="chess-secondary"
                      disabled={pending}
                      onClick={() =>
                        g.hostId === profile.userId
                          ? onOpen(g.id)
                          : void act({ action: "join", id: g.id })
                      }
                    >
                      {g.hostId === profile.userId
                        ? uk
                          ? "Відкрити"
                          : "Open"
                        : uk
                          ? "Грати"
                          : "Play"}
                    </button>
                  </div>
                ))}
            </div>
          )}
          {mine.length > 0 && (
            <>
              <h3 className="mb-3 mt-7 font-extrabold">
                {uk ? "Мої останні партії" : "My recent games"}
              </h3>
              <div className="space-y-2">
                {mine.map((g) => (
                  <button
                    type="button"
                    className="chess-room w-full text-left"
                    key={g.id}
                    onClick={() => onOpen(g.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">
                        {g.white?.name ?? "…"} — {g.black?.name ?? "…"}
                      </strong>
                      <span className="text-xs text-muted">
                        {g.status === "active"
                          ? uk
                            ? "Триває"
                            : "In progress"
                          : g.status === "waiting"
                            ? uk
                              ? "Запрошення"
                              : "Invitation"
                            : g.status === "cancelled"
                              ? uk
                                ? "Скасовано"
                                : "Cancelled"
                              : g.result}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
