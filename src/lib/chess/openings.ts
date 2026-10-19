import { Chess } from "chess.js";
export type Opening = { eco: string; name: string; pgn: string; uci: string[]; fen: string };
export const OPENING_GUIDES = [
  {
    name: "Італійська партія",
    en: "Italian Game",
    eco: "C50",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    text: "Розвивайте фігури, готуйте рокіровку та боріться за центр. Слон на c4 тисне на f7.",
    english: "Develop your pieces, castle and contest the centre. The bishop on c4 targets f7.",
  },
  {
    name: "Іспанська партія",
    en: "Ruy Lopez",
    eco: "C60",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    text: "Тиск на коня c6 посилює боротьбу за e5. Не поспішайте забирати пішака: спочатку завершіть розвиток.",
    english:
      "Pressure on the c6 knight strengthens the fight for e5. Finish development before grabbing pawns.",
  },
  {
    name: "Сицилійський захист",
    en: "Sicilian Defense",
    eco: "B20",
    pgn: "1. e4 c5",
    text: "Чорні відповідають на центр фланговим пішаком. Часто гра стає асиметричною, з активною боротьбою обох сторін.",
    english:
      "Black challenges the centre from the flank, creating an unbalanced position and active play.",
  },
  {
    name: "Ферзевий гамбіт",
    en: "Queen's Gambit",
    eco: "D06",
    pgn: "1. d4 d5 2. c4",
    text: "Білі пропонують пішака c4, щоб відволікти пішака d5 і посилити контроль над центром.",
    english: "White offers c4 to draw the d5 pawn away and improve central control.",
  },
  {
    name: "Захист Каро—Канн",
    en: "Caro-Kann Defense",
    eco: "B10",
    pgn: "1. e4 c6 2. d4 d5",
    text: "Надійна пішакова структура та удар по e4. Світлопольного слона часто встигають розвинути перед e6.",
    english:
      "A solid pawn structure with pressure on e4. Develop the light-squared bishop before playing e6 when possible.",
  },
  {
    name: "Французький захист",
    en: "French Defense",
    eco: "C00",
    pgn: "1. e4 e6 2. d4 d5",
    text: "Чорні атакують центр d4. У закритих позиціях важливі підриви c5 і f6 та доля слона c8.",
    english:
      "Black challenges d4. In closed positions, the c5 and f6 breaks and the c8 bishop matter.",
  },
  {
    name: "Лондонська система",
    en: "London System",
    eco: "D02",
    pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4",
    text: "Послідовний розвиток: Bf4, e3, Nf3, Bd3 і рокіровка. План змінюється залежно від відповіді чорних.",
    english:
      "A consistent setup with Bf4, e3, Nf3, Bd3 and castling. Adapt your plan to Black's replies.",
  },
  {
    name: "Староіндійський захист",
    en: "King's Indian Defense",
    eco: "E60",
    pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7",
    text: "Чорні допускають широкий центр білих, а потім атакують його. Спочатку безпека короля, далі підриви e5 або c5.",
    english:
      "Black allows a broad white centre, then challenges it with e5 or c5 after securing the king.",
  },
  {
    name: "Російська партія",
    en: "Petrov's Defense",
    eco: "C42",
    pgn: "1. e4 e5 2. Nf3 Nf6",
    text: "Замість захисту e5 чорні атакують e4. Важливі точність розрахунку й своєчасне повернення матеріалу.",
    english:
      "Instead of defending e5, Black attacks e4. Accurate calculation and timely returns of material matter.",
  },
  {
    name: "Шотландська партія",
    en: "Scotch Game",
    eco: "C45",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. d4",
    text: "Раннє відкриття центру створює простір для фігур. Пильнуйте темпи розвитку й тактичні удари.",
    english:
      "Opening the centre early creates space for the pieces. Watch development tempi and tactical threats.",
  },
  {
    name: "Захист двох коней",
    en: "Two Knights Defense",
    eco: "C55",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6",
    text: "Чорні розвивають обох коней і атакують e4. Після Ng5 обов’язково рахуйте конкретні варіанти.",
    english:
      "Black develops both knights and attacks e4. After Ng5, concrete calculation is essential.",
  },
  {
    name: "Англійський початок",
    en: "English Opening",
    eco: "A10",
    pgn: "1. c4",
    text: "Боротьба за d5 з флангу. Побудова гнучка й часто переходить до інших дебютів.",
    english:
      "White contests d5 from the flank. The flexible setup often transposes to other openings.",
  },
];
export function lineMoves(pgn: string) {
  const b = new Chess();
  b.loadPgn(pgn);
  return b.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
}
export function openingLabel(o: { name: string }, uk: boolean) {
  const guide = OPENING_GUIDES.find((g) => o.name.startsWith(g.en));
  return uk && guide ? o.name.replace(guide.en, guide.name) : o.name;
}
export function findOpening(openings: Opening[], moves: string[]) {
  let best: Opening | undefined;
  for (const o of openings)
    if (
      o.uci.length <= moves.length &&
      (!best || o.uci.length > best.uci.length) &&
      o.uci.every((m, i) => moves[i] === m)
    )
      best = o;
  return best;
}
