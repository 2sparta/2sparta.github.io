import {
  createGame,
  joinGame,
  moveGame,
  resignGame,
  drawGame,
  flagGame,
  colorOf,
  chessId,
  control,
  roundRobin,
  type ChessGame,
  type ChessPlayer,
  type ChessScope,
  type ChessTournament,
} from "../../src/lib/chess/model.ts";
export interface ChessTransaction {
  get<T>(collection: string, id: string): Promise<T | null>;
  set(collection: string, id: string, value: unknown): void;
}
export interface ChessStore {
  transaction<T>(work: (tx: ChessTransaction) => Promise<T>): Promise<T>;
}
type User = { displayName?: string; schoolId?: string | null; role?: string };
export function chessService(
  store: ChessStore,
  now: () => number = Date.now,
  newId: () => string = () => crypto.randomUUID().replaceAll("-", ""),
) {
  return async (uid: string | undefined, raw: unknown) => {
    if (!uid) throw new Error("UNAUTHENTICATED");
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || JSON.stringify(raw).length > 4000)
      throw new Error("INVALID_INPUT");
    const input = raw as Record<string, unknown>;
    return store.transaction(async (tx) => {
      const user = await tx.get<User>("users", uid);
      if (!user) throw new Error("NO_PROFILE");
      const schoolId = typeof user.schoolId === "string" ? user.schoolId : null;
      const player: ChessPlayer = {
        id: uid,
        name: (user.displayName?.trim() || "Гравець").slice(0, 60),
      };
      const time = now(),
        writes: { c: string; id: string; v: unknown }[] = [];
      const set = (c: string, id: string, v: unknown) => writes.push({ c, id, v });
      const access = (o: { scope: ChessScope; schoolId: string | null }) => {
        if (o.scope !== "site" && (!schoolId || o.schoolId !== schoolId))
          throw new Error("FORBIDDEN");
      };
      const scope = () => {
        if (input.scope !== "site" && input.scope !== "school") throw new Error("INVALID_SCOPE");
        if (input.scope === "school" && !schoolId) throw new Error("NO_SCHOOL");
        return input.scope;
      };
      const game = async () => {
        const id = chessId(input.id),
          g = await tx.get<ChessGame>("chessGames", id);
        if (!g) throw new Error("NOT_FOUND");
        access(g);
        return g;
      };
      const tournament = async () => {
        const id = chessId(input.id),
          t = await tx.get<ChessTournament>("chessTournaments", id);
        if (!t) throw new Error("NOT_FOUND");
        access(t);
        return t;
      };
      const organizer = (t: ChessTournament) => {
        if (t.organizer.id !== uid) throw new Error("FORBIDDEN");
      };
      const rate = async (key: string, ms: number) => {
        const old = (await tx.get<Record<string, number>>("chessLimits", uid)) ?? {};
        if (old[key] !== undefined && time - old[key] < ms) throw new Error("RATE_LIMIT");
        set("chessLimits", uid, { ...old, [key]: time });
      };
      let result: { id?: string } = {};
      switch (input.action) {
        case "ping":
          break;
        case "create": {
          const s = scope();
          control(input.timeControl);
          if (input.color !== "w" && input.color !== "b") throw new Error("INVALID_COLOR");
          await rate("room", 5000);
          const id = newId();
          set(
            "chessGames",
            id,
            createGame(id, player, s, schoolId, input.color, input.timeControl as number, time),
          );
          result = { id };
          break;
        }
        case "join": {
          const g = await game();
          if (g.tournamentId) throw new Error("ROOM_CLOSED");
          set("chessGames", g.id, joinGame(g, player, schoolId, time));
          result = { id: g.id };
          break;
        }
        case "move": {
          const g = await game();
          set("chessGames", g.id, moveGame(g, uid, input.move, input.revision, time));
          break;
        }
        case "resign": {
          const g = await game();
          set("chessGames", g.id, resignGame(g, uid, time));
          break;
        }
        case "offer":
        case "accept":
        case "decline": {
          const g = await game();
          set("chessGames", g.id, drawGame(g, uid, input.action, time));
          break;
        }
        case "cancel": {
          const g = await game();
          if (g.hostId !== uid) throw new Error("FORBIDDEN");
          if (g.status !== "waiting" || g.tournamentId) throw new Error("ROOM_CLOSED");
          set("chessGames", g.id, {
            ...g,
            status: "cancelled",
            updatedAt: time,
            revision: g.revision + 1,
          });
          break;
        }
        case "timeout": {
          const g = await game();
          let permitted = Boolean(colorOf(g, uid));
          if (!permitted && g.tournamentId) {
            const t = await tx.get<ChessTournament>("chessTournaments", g.tournamentId);
            permitted = t?.organizer.id === uid;
          }
          if (!permitted) throw new Error("FORBIDDEN");
          const ended = flagGame(g, time);
          if (!ended) throw new Error("CLOCK_RUNNING");
          set("chessGames", g.id, ended);
          break;
        }
        case "createTournament": {
          const s = scope();
          control(input.timeControl);
          const title = typeof input.title === "string" ? input.title.trim() : "",
            description = typeof input.description === "string" ? input.description.trim() : "";
          if (!title || title.length > 100 || description.length > 500)
            throw new Error("INVALID_TOURNAMENT");
          await rate("tournament", 60_000);
          const id = newId();
          const t: ChessTournament = {
            id,
            title,
            description,
            scope: s,
            schoolId: s === "school" ? schoolId : null,
            organizer: player,
            players: [],
            status: "registration",
            timeControl: input.timeControl as number,
            rounds: [],
            round: 0,
            gameIds: [],
            createdAt: time,
            updatedAt: time,
            revision: 0,
          };
          set("chessTournaments", id, t);
          result = { id };
          break;
        }
        case "joinTournament":
        case "leaveTournament": {
          const t = await tournament();
          if (t.status !== "registration") throw new Error("REGISTRATION_CLOSED");
          const inList = t.players.some((p) => p.id === uid);
          let players = t.players;
          if (input.action === "joinTournament") {
            if (inList) throw new Error("ALREADY_JOINED");
            if (players.length >= 16) throw new Error("TOURNAMENT_FULL");
            players = [...players, player];
          } else {
            if (!inList) throw new Error("NOT_JOINED");
            players = players.filter((p) => p.id !== uid);
          }
          set("chessTournaments", t.id, {
            ...t,
            players,
            updatedAt: time,
            revision: t.revision + 1,
          });
          break;
        }
        case "cancelTournament": {
          const t = await tournament();
          organizer(t);
          if (t.status !== "registration") throw new Error("REGISTRATION_CLOSED");
          set("chessTournaments", t.id, {
            ...t,
            status: "cancelled",
            updatedAt: time,
            revision: t.revision + 1,
          });
          break;
        }
        case "startTournament":
        case "advanceTournament": {
          const t = await tournament();
          organizer(t);
          let rounds = t.rounds,
            round = t.round;
          if (input.action === "startTournament") {
            if (t.status !== "registration") throw new Error("REGISTRATION_CLOSED");
            rounds = roundRobin(t.players.map((p) => p.id)).map((pairs) => ({
              pairs: pairs.map(([white, black]) => ({ white, black })),
            }));
            round = 1;
          } else {
            if (t.status !== "running") throw new Error("TOURNAMENT_CLOSED");
            const currentIds = t.gameIds.slice(-t.rounds[round - 1].pairs.length);
            const current = await Promise.all(
              currentIds.map((id) => tx.get<ChessGame>("chessGames", id)),
            );
            if (current.some((g) => !g)) throw new Error("MISSING_GAME");
            for (const old of current.filter(
              (g): g is ChessGame => Boolean(g) && g!.round === round,
            )) {
              const g = flagGame(old, time) ?? old;
              if (g.status !== "finished") throw new Error("ROUND_NOT_FINISHED");
              if (g !== old) set("chessGames", g.id, g);
            }
            round++;
          }
          if (round > rounds.length) {
            set("chessTournaments", t.id, {
              ...t,
              status: "finished",
              updatedAt: time,
              revision: t.revision + 1,
            });
            break;
          }
          const ids: string[] = [];
          for (const { white: w, black: b } of rounds[round - 1].pairs) {
            const white = t.players.find((p) => p.id === w)!,
              black = t.players.find((p) => p.id === b)!,
              id = newId();
            const g = joinGame(
              createGame(id, white, t.scope, t.schoolId, "w", t.timeControl, time),
              black,
              t.schoolId,
              time,
            );
            set("chessGames", id, { ...g, tournamentId: t.id, round });
            ids.push(id);
          }
          set("chessTournaments", t.id, {
            ...t,
            rounds,
            round,
            status: "running",
            gameIds: [...t.gameIds, ...ids],
            updatedAt: time,
            revision: t.revision + 1,
          });
          break;
        }
        default:
          throw new Error("INVALID_ACTION");
      }
      for (const w of writes) tx.set(w.c, w.id, w.v);
      return { ...result, serverNow: time };
    });
  };
}
