import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Plus, Trophy, Users, RefreshCw } from "lucide-react";
import type { ChessApi } from "@/lib/chess/api";
import {
  standings,
  TIME_CONTROLS,
  type ChessGame,
  type ChessScope,
  type ChessTournament,
} from "@/lib/chess/model";
import type { Profile } from "@/lib/school/types";
import { ScopePicker } from "./online";
export function ChessTournaments({
  profile,
  api,
  selected,
  onSelect,
  onGame,
  onAction,
  uk,
}: {
  profile: Profile;
  api: ChessApi;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onGame: (id: string) => void;
  onAction: (data: Record<string, unknown>) => Promise<{ id?: string } | undefined>;
  uk: boolean;
}) {
  const [scope, setScope] = useState<ChessScope>(profile.schoolId ? "school" : "site"),
    [list, setList] = useState<ChessTournament[]>([]),
    [t, setT] = useState<ChessTournament | null>(null),
    [games, setGames] = useState<ChessGame[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [form, setForm] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [time, setTime] = useState(1),
    [pending, setPending] = useState(false);
  useEffect(() => {
    setError(false);
    setLoading(true);
    setT(null);
    setGames([]);
    const fail = () => {
      setError(true);
      setLoading(false);
    };
    if (selected) {
      const a = api.tournament(
          selected,
          (v) => {
            setT(v);
            setLoading(false);
          },
          fail,
        ),
        b = api.tournamentGames(selected, setGames, fail);
      return () => {
        a();
        b();
      };
    }
    return api.tournaments(
      scope,
      profile.schoolId,
      (v) => {
        setList(v);
        setLoading(false);
      },
      fail,
    );
  }, [selected, scope, profile.schoolId, api, retry]);
  async function act(data: Record<string, unknown>) {
    setPending(true);
    try {
      const result = await onAction(data);
      if (result?.id) {
        onSelect(result.id);
        setForm(false);
      }
    } finally {
      setPending(false);
    }
  }
  const labels = {
    registration: uk ? "Реєстрація" : "Registration",
    running: uk ? "Триває" : "In progress",
    finished: uk ? "Завершено" : "Finished",
    cancelled: uk ? "Скасовано" : "Cancelled",
  };
  if (selected)
    return (
      <section>
        <button className="chess-text-button mb-5" onClick={() => onSelect(null)}>
          <ArrowLeft className="size-4" />
          {uk ? "Усі турніри" : "All tournaments"}
        </button>
        {loading ? (
          <div className="chess-empty">{uk ? "Завантажуємо турнір…" : "Loading tournament…"}</div>
        ) : error ? (
          <div className="chess-empty">
            {uk ? "Не вдалося завантажити турнір." : "Unable to load the tournament."}
            <button className="chess-secondary mt-3" onClick={() => setRetry((n) => n + 1)}>
              {uk ? "Повторити" : "Retry"}
            </button>
          </div>
        ) : !t ? (
          <div className="chess-empty">
            {uk ? "Турнір не знайдено або недоступний." : "Tournament not found or unavailable."}
          </div>
        ) : (
          <>
            <div className="chess-tournament-heading">
              <Trophy className="size-10 text-[#cfaa65]" />
              <div className="min-w-0 flex-1">
                <span className="chess-count mb-2">{labels[t.status]}</span>
                <h2 className="break-words text-2xl font-extrabold">{t.title}</h2>
                <p className="mt-2 text-sm text-muted">{t.description}</p>
                <p className="mt-3 text-xs text-muted">
                  {uk ? "Організатор" : "Organizer"}: {t.organizer.name} ·{" "}
                  {TIME_CONTROLS[t.timeControl].label} · {t.players.length}/16{" "}
                  {uk ? "учасників" : "players"}
                </p>
              </div>
            </div>
            <div className="my-5 flex flex-wrap gap-2">
              {t.status === "registration" && (
                <>
                  <button
                    className={
                      t.players.some((p) => p.id === profile.userId)
                        ? "chess-secondary"
                        : "chess-primary"
                    }
                    disabled={
                      pending ||
                      (!t.players.some((p) => p.id === profile.userId) && t.players.length >= 16)
                    }
                    onClick={() =>
                      void act({
                        action: t.players.some((p) => p.id === profile.userId)
                          ? "leaveTournament"
                          : "joinTournament",
                        id: t.id,
                      })
                    }
                  >
                    {t.players.some((p) => p.id === profile.userId)
                      ? uk
                        ? "Вийти з турніру"
                        : "Leave tournament"
                      : uk
                        ? "Взяти участь"
                        : "Join tournament"}
                  </button>
                  {t.organizer.id === profile.userId && (
                    <>
                      <button
                        className="chess-primary"
                        disabled={pending || t.players.length < 2}
                        onClick={() => void act({ action: "startTournament", id: t.id })}
                      >
                        {uk ? "Почати турнір" : "Start tournament"}
                      </button>
                      <button
                        className="chess-text-button"
                        disabled={pending}
                        onClick={() => {
                          if (
                            confirm(
                              uk
                                ? "Скасувати реєстрацію на цей турнір?"
                                : "Cancel this tournament?",
                            )
                          )
                            void act({ action: "cancelTournament", id: t.id });
                        }}
                      >
                        {uk ? "Скасувати турнір" : "Cancel tournament"}
                      </button>
                    </>
                  )}
                </>
              )}
              {t.status === "running" && t.organizer.id === profile.userId && (
                <button
                  className="chess-primary"
                  disabled={pending}
                  onClick={() => void act({ action: "advanceTournament", id: t.id })}
                >
                  {t.round === t.rounds.length
                    ? uk
                      ? "Завершити турнір"
                      : "Finish tournament"
                    : uk
                      ? "Почати наступний тур"
                      : "Start next round"}
                </button>
              )}
            </div>
            {t.status === "registration" && (
              <p className="chess-notice mb-5">
                {uk
                  ? "Коловий формат: кожен грає з кожним один раз. Від 2 до 16 учасників. Після початку туру всі його годинники запускаються одразу — учасники мають бути готові."
                  : "Round robin: everyone plays everyone once. 2–16 players. All clocks start as soon as the organizer starts a round; players should be ready."}
              </p>
            )}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="chess-card">
                <h3 className="mb-4 font-extrabold">{uk ? "Турнірна таблиця" : "Standings"}</h3>
                {t.players.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    {uk
                      ? "Реєстрацію відкрито. Долучайтеся першими."
                      : "Registration is open. Be the first to join."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="chess-standings">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{uk ? "Гравець" : "Player"}</th>
                          <th>{uk ? "Ігри" : "P"}</th>
                          <th>{uk ? "Бали" : "Pts"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings(t, games).map((p, i) => (
                          <tr key={p.id}>
                            <td>{p.rank}</td>
                            <td className="max-w-48 break-words">
                              {p.name}
                              {p.id === profile.userId && (
                                <span className="ml-2 text-xs text-forest-mid">
                                  {uk ? "ви" : "you"}
                                </span>
                              )}
                            </td>
                            <td>{p.played}</td>
                            <td className="font-extrabold">{p.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-xs text-muted">
                  {uk
                    ? "Перемога — 1, нічия — ½, поразка — 0. За рівності балів — кількість перемог; однакові показники означають спільне місце. Шкільні бали не змінюються."
                    : "Win 1, draw ½, loss 0. Ties are broken by wins; equal scores and wins share a place. School points are unaffected."}
                </p>
              </div>
              <div className="chess-card">
                <h3 className="mb-4 font-extrabold">
                  {uk ? "Партії туру" : "Round games"}{" "}
                  {t.round > 0 ? `${t.round} / ${t.rounds.length}` : ""}
                </h3>
                {games
                  .filter((g) => g.round === t.round)
                  .map((g) => (
                    <div className="chess-round-game" key={g.id}>
                      <div className="min-w-0 flex-1">
                        <strong className="block break-words">
                          {g.white?.name} — {g.black?.name}
                        </strong>
                        <span className="text-xs text-muted">
                          {g.result ?? (uk ? "Триває" : "In progress")}
                        </span>
                      </div>
                      <button className="chess-secondary" onClick={() => onGame(g.id)}>
                        {g.playerIds.includes(profile.userId) && g.status === "active"
                          ? uk
                            ? "Грати"
                            : "Play"
                          : uk
                            ? "Дивитися"
                            : "Watch"}
                        <ArrowUpRight className="size-4" />
                      </button>
                    </div>
                  ))}
                {t.round > 0 &&
                  t.rounds[t.round - 1]?.pairs.every(
                    (p) => p.white !== profile.userId && p.black !== profile.userId,
                  ) &&
                  t.players.some((p) => p.id === profile.userId) && (
                    <p className="chess-notice mt-4">
                      {uk
                        ? "У цьому турі ви відпочиваєте. Автоматичні бали за пропуск туру не нараховуються."
                        : "You have a bye this round. No automatic points are awarded for a bye."}
                    </p>
                  )}
                {t.round === 0 && (
                  <p className="py-6 text-sm text-muted">
                    {uk
                      ? "Пари з’являться після завершення реєстрації."
                      : "Pairings appear when registration closes."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    );
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="chess-eyebrow">{uk ? "ЗІГРАЙМО РАЗОМ" : "PLAY TOGETHER"}</p>
          <h2 className="text-2xl font-extrabold">
            {uk ? "Турніри спільноти" : "Community tournaments"}
          </h2>
        </div>
        <ScopePicker scope={scope} onChange={setScope} schoolId={profile.schoolId} uk={uk} />
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {uk
            ? "Дружні змагання з автоматичними парами та підрахунком результатів."
            : "Friendly competitions with automatic pairings and standings."}
        </p>
        <button className="chess-primary" onClick={() => setForm(!form)}>
          <Plus className="size-4" />
          {uk ? "Організувати турнір" : "Organize a tournament"}
        </button>
      </div>
      {form && (
        <form
          className="chess-card mb-5"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "createTournament", scope, title, description, timeControl: time });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="chess-field">
              {uk ? "Назва турніру" : "Tournament name"}
              <input
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={uk ? "Наприклад, Кубок нашого класу" : "For example, Class Cup"}
              />
            </label>
            <label className="chess-field">
              {uk ? "Контроль часу" : "Time control"}
              <select value={time} onChange={(e) => setTime(Number(e.target.value))}>
                {TIME_CONTROLS.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="chess-field sm:col-span-2">
              {uk ? "Опис · необов’язково" : "Description · optional"}
              <textarea
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="chess-primary" disabled={pending || !title.trim()} type="submit">
              {uk ? "Відкрити реєстрацію" : "Open registration"}
            </button>
            <button className="chess-secondary" type="button" onClick={() => setForm(false)}>
              {uk ? "Скасувати" : "Cancel"}
            </button>
          </div>
        </form>
      )}
      {error ? (
        <div className="chess-empty">
          <p>
            {uk
              ? "Турніри зараз недоступні. Спробуйте підключитися ще раз."
              : "Tournaments are currently unavailable. Try reconnecting."}
          </p>
          <button className="chess-secondary mt-4" onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw className="size-4" />
            {uk ? "Повторити" : "Retry"}
          </button>
        </div>
      ) : loading ? (
        <div className="chess-empty" role="status">
          {uk ? "Завантажуємо турніри…" : "Loading tournaments…"}
        </div>
      ) : list.length === 0 ? (
        <div className="chess-empty">
          <Trophy className="mx-auto mb-4 size-9 text-[#b28b4e]" />
          <h3 className="font-extrabold">
            {uk ? "Перший кубок ще попереду" : "The first cup is yours to create"}
          </h3>
          <p className="mt-2 text-sm">
            {uk
              ? "Запросіть друзів і відкрийте реєстрацію на власний турнір."
              : "Invite your friends and open registration for your own tournament."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((item) => (
            <button
              type="button"
              className="chess-tournament-card text-left"
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <div className="flex items-center justify-between">
                <Trophy className="size-7 text-[#b28b4e]" />
                <span className="chess-count">{labels[item.status]}</span>
              </div>
              <h3 className="mt-5 break-words text-xl font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted line-clamp-2">
                {item.description || item.organizer.name}
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4 text-sm">
                <span className="flex items-center gap-2">
                  <Users className="size-4" />
                  {item.players.length}/16 · {TIME_CONTROLS[item.timeControl].label}
                </span>
                <ArrowUpRight className="size-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
