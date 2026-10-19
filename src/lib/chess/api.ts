import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase";
import { chessId, type ChessGame, type ChessScope, type ChessTournament } from "./model";
export async function chessAction(data: Record<string, unknown>) {
  const call = httpsCallable<Record<string, unknown>, { id?: string; serverNow: number }>(
    getFunctions(firebaseApp(), "europe-west1"),
    "chessAction",
  );
  return (await call(data)).data;
}
export function watchGame(
  id: string,
  next: (game: ChessGame | null) => void,
  error: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db(), "chessGames", chessId(id)),
    (snap) => next(snap.exists() ? ({ ...snap.data(), id: snap.id } as ChessGame) : null),
    error,
  );
}
export function watchTournament(
  id: string,
  next: (t: ChessTournament | null) => void,
  error: (e: Error) => void,
) {
  return onSnapshot(
    doc(db(), "chessTournaments", chessId(id)),
    (snap) => next(snap.exists() ? ({ ...snap.data(), id: snap.id } as ChessTournament) : null),
    error,
  );
}
export function watchLobby(
  scope: ChessScope,
  schoolId: string | null,
  next: (games: ChessGame[]) => void,
  error: (e: Error) => void,
) {
  const filters = [where("scope", "==", scope), where("status", "==", "waiting")];
  if (scope === "school") filters.push(where("schoolId", "==", schoolId));
  return onSnapshot(
    query(collection(db(), "chessGames"), ...filters, orderBy("createdAt", "desc"), limit(30)),
    (snap) => next(snap.docs.map((s) => ({ ...s.data(), id: s.id }) as ChessGame)),
    error,
  );
}
export function watchMine(
  uid: string,
  next: (games: ChessGame[]) => void,
  error: (e: Error) => void,
) {
  return onSnapshot(
    query(
      collection(db(), "chessGames"),
      where("playerIds", "array-contains", uid),
      orderBy("updatedAt", "desc"),
      limit(20),
    ),
    (snap) => next(snap.docs.map((s) => ({ ...s.data(), id: s.id }) as ChessGame)),
    error,
  );
}
export function watchTournaments(
  scope: ChessScope,
  schoolId: string | null,
  next: (items: ChessTournament[]) => void,
  error: (e: Error) => void,
) {
  const filters = [where("scope", "==", scope)];
  if (scope === "school") filters.push(where("schoolId", "==", schoolId));
  return onSnapshot(
    query(
      collection(db(), "chessTournaments"),
      ...filters,
      orderBy("createdAt", "desc"),
      limit(30),
    ),
    (snap) => next(snap.docs.map((s) => ({ ...s.data(), id: s.id }) as ChessTournament)),
    error,
  );
}
export function watchTournamentGames(
  id: string,
  next: (items: ChessGame[]) => void,
  error: (e: Error) => void,
) {
  return onSnapshot(
    query(collection(db(), "chessGames"), where("tournamentId", "==", chessId(id))),
    (snap) => next(snap.docs.map((s) => ({ ...s.data(), id: s.id }) as ChessGame)),
    error,
  );
}
export type ChessApi = {
  action: typeof chessAction;
  game: typeof watchGame;
  lobby: typeof watchLobby;
  mine: typeof watchMine;
  tournament: typeof watchTournament;
  tournaments: typeof watchTournaments;
  tournamentGames: typeof watchTournamentGames;
};
export const chessApi: ChessApi = {
  action: chessAction,
  game: watchGame,
  lobby: watchLobby,
  mine: watchMine,
  tournament: watchTournament,
  tournaments: watchTournaments,
  tournamentGames: watchTournamentGames,
};
