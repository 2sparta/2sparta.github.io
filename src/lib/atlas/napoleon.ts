import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";

export const NAPOLEON_MIN_YEAR = 1792;
export const NAPOLEON_MAX_YEAR = 1815;
export const NAPOLEON_YEARS = [1792, 1797, 1801, 1806, 1807, 1810, 1812, 1813, 1814, 1815] as const;
export type NapoleonFrame = { year: number; note: string; collection: HistoricalCollection };
export type NapoleonData = { frames: NapoleonFrame[] };

/** Last war frame at or before the year. The layer stops after the Hundred Days. */
export function napoleonSnapshot(year: number) {
  if (year < NAPOLEON_MIN_YEAR || year > NAPOLEON_MAX_YEAR) return undefined;
  return [...NAPOLEON_YEARS].reverse().find((y) => y <= year);
}
export function validateNapoleonData(raw: unknown): NapoleonData {
  const data = raw as NapoleonData;
  if (!data?.frames || data.frames.length !== NAPOLEON_YEARS.length) throw new Error("INVALID_NAPOLEON_DATA");
  data.frames.forEach((frame, index) => {
    validateHistoricalCollection(frame.collection);
    if (frame.year !== NAPOLEON_YEARS[index] || !frame.note) throw new Error("INVALID_NAPOLEON_DATA");
    const ids = new Set<string>();
    for (const feature of frame.collection.features) {
      const id = String(feature.id ?? "");
      const p = feature.properties;
      if (
        !id ||
        ids.has(id) ||
        p.region !== "napoleon" ||
        p.sourceYear !== frame.year ||
        !p.description ||
        !p.color?.startsWith("#") ||
        !p.sourceUrl?.startsWith("https://") ||
        (p.control !== "direct" && p.control !== "relative")
      )
        throw new Error("INVALID_NAPOLEON_DATA");
      ids.add(id);
    }
  });
  return data;
}

/** The war map replaces the coarser German snapshot for 1792–1815. */
export function overlayNapoleon(
  base: HistoricalCollection | undefined,
  extra: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  if (!extra?.features.length) return base;
  const kept = (base?.features ?? []).filter(
    (f) => f.properties.region !== "germany" && f.properties.name !== "Holy Roman Empire",
  );
  return { type: "FeatureCollection", features: [...kept, ...extra.features] };
}

export const NAPOLEON_SOURCES: AtlasSource[] = [
  {
    id: "napoleon-wars",
    title: "Encyclopaedia Britannica — Napoleonic Wars",
    url: "https://www.britannica.com/event/Napoleonic-Wars",
    note: "Каркас війни 1803–1815 років і революційних кампаній перед нею. Полігони атласу схематичні.",
  },
  {
    id: "napoleon-campo",
    title: "Encyclopaedia Britannica — Treaty of Campo Formio",
    url: "https://www.britannica.com/event/Treaty-of-Campo-Formio",
    note: "1797 рік: сестри-республіки і кінець Венеції.",
  },
  {
    id: "napoleon-tilsit",
    title: "Encyclopaedia Britannica — Treaties of Tilsit",
    url: "https://www.britannica.com/event/Treaties-of-Tilsit",
    note: "1807 рік: урізана Пруссія, Варшавське герцогство, Вестфалія.",
  },
  {
    id: "napoleon-leipzig",
    title: "Encyclopaedia Britannica — Battle of Leipzig",
    url: "https://www.britannica.com/event/Battle-of-Leipzig",
    note: "1813 рік: розпад Рейнського союзу. Зріз не малює кожен день кампанії.",
  },
  {
    id: "napoleon-vienna",
    title: "Encyclopaedia Britannica — Congress of Vienna",
    url: "https://www.britannica.com/event/Congress-of-Vienna",
    note: "1814–1815 роки: Франція близько меж 1792-го і новий устрій решти Європи.",
  },
];

type Period = { from: number; to: number; title: string; description: string; sources: string[] };
const PERIODS: Period[] = [
  {
    from: -500,
    to: 1791,
    title: "До революційних війн",
    description: "Цей шар починається 1792 року. Ранішу Священну Римську імперію дивіться на мапі Німеччини.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1792,
    to: 1796,
    title: "Війна першої коаліції",
    description: "Франція ще в межах 1792 року. Річ Посполита й Венеція доживають останні роки.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1797,
    to: 1800,
    title: "Сестри-республіки",
    description: "Кампо-Форміо. Бельгія і лівий берег Рейну французькі, Венеція віддана Австрії, Польщі вже немає.",
    sources: ["napoleon-campo"],
  },
  {
    from: 1801,
    to: 1805,
    title: "Мир і новий кордон по Рейну",
    description: "Люневіль визнає Рейн межею. П’ємонт стане французьким 1802 року, цей зріз ще лишає його Савойї.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1806,
    to: 1806,
    title: "Кінець старої імперії",
    description: "Рейнський союз замість Священної Римської імперії. Пруссія ще велика: Тільзит попереду.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1807,
    to: 1809,
    title: "Тільзит",
    description: "Пруссію урізано. Варшавське герцогство і Вестфалія — сателіти, не французькі департаменти. Іспанія ще бурбонська.",
    sources: ["napoleon-tilsit"],
  },
  {
    from: 1810,
    to: 1811,
    title: "Найширша імперія",
    description: "Голландія, римський берег, північне узбережжя й Іллірія приєднані прямо. Іспанія Жозефа заштрихована, бо країна у війні.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1812,
    to: 1812,
    title: "Похід на Москву",
    description: "Штрих до Москви — маршрут війни. Росія під ним лишається Росією.",
    sources: ["napoleon-wars"],
  },
  {
    from: 1813,
    to: 1813,
    title: "Після Лейпцига",
    description: "Рейнський союз розпадається. Франція відступає до Рейну, Варшава під Росією.",
    sources: ["napoleon-leipzig"],
  },
  {
    from: 1814,
    to: 1814,
    title: "Перший Паризький мир",
    description: "Франція знову близько меж 1792 року. Мюрат ще тримає Неаполь, Сицилія весь час була в Бурбонів.",
    sources: ["napoleon-vienna"],
  },
  {
    from: 1815,
    to: 1815,
    title: "Сто днів і Відень",
    description: "Наполеон знову у Франції 1792 року, решту Європи вже розклав конгрес. Після Ватерлоо Франція лишається приблизно в цих межах.",
    sources: ["napoleon-vienna"],
  },
  {
    from: 1816,
    to: 1994,
    title: "Після війни",
    description: "Шар наполеонівських війн закінчується 1815 роком. Далі німецькі межі дає мапа Німеччини.",
    sources: ["napoleon-vienna"],
  },
];
export function napoleonPeriod(year: number) {
  return PERIODS.find((p) => year >= p.from && year <= p.to) ?? PERIODS[0]!;
}

export const NAPOLEON_EVENTS: AtlasEvent[] = [
  { year: 1792, title: "Війна проти республіки", description: "Перша коаліція. Франція на мапі ще не вийшла за межі 1792 року.", sources: ["napoleon-wars"] },
  { year: 1797, title: "Кампо-Форміо", description: "Венеційська республіка зникає. Австрія забирає Венецію, Франція закріплюється в Бельгії.", sources: ["napoleon-campo"] },
  { year: 1804, title: "Імператорський титул", description: "Республіка стає імперією. На мапі назва змінюється зі зрізом 1806 року.", sources: ["napoleon-wars"] },
  { year: 1805, title: "Аустерліц", description: "Австрія втрачає Венецію і Тироль. Це видно на зрізі 1806 року, не окремим кадром битви.", sources: ["napoleon-wars"] },
  { year: 1806, title: "Кінець Священної Римської імперії", description: "Рейнський союз не є продовженням імперії. Пруссію розіб’ють восени, кордон змінить Тільзит.", sources: ["napoleon-wars"] },
  { year: 1807, title: "Тільзит", description: "Пруссія втрачає землі на захід від Ельби і польські провінції. Данциг стає вільним містом під французьким контролем.", sources: ["napoleon-tilsit"] },
  { year: 1808, title: "Іспанія", description: "Жозеф Бонапарт — король, але влада не суцільна. Штрих на зрізах 1810 і 1812 років це і показує.", sources: ["napoleon-wars"] },
  { year: 1812, title: "Похід і відступ", description: "Москва не стає французькою. Штрих лишається на одному зрізі 1812 року.", sources: ["napoleon-wars"] },
  { year: 1813, title: "Лейпциг", description: "Союзники ламають Рейнський союз. Баварія переходить на їхній бік.", sources: ["napoleon-leipzig"] },
  { year: 1814, title: "Зречення", description: "Перший Паризький мир повертає Францію близько до меж 1792 року.", sources: ["napoleon-vienna"] },
  { year: 1815, title: "Ватерлоо", description: "Сто днів закінчуються. Віденський устрій решти Європи вже на цьому зрізі, Франція ще наполеонівська до червня.", sources: ["napoleon-vienna"] },
];

function place(
  id: string,
  name: string,
  lat: number,
  lng: number,
  from: number,
  to: number,
  dateLabel: string,
  description: string,
  sources: string[],
  capital = false,
): AtlasPlace {
  return { id, name, type: "city", from, to, lat, lng, dateLabel, description, sources, capital };
}
export const NAPOLEON_PLACES: AtlasPlace[] = [
  place("napoleon-paris", "Париж", 48.86, 2.35, 1792, 1815, "столиця", "Орієнтир Франції, не її кордон.", ["napoleon-wars"], true),
  place("napoleon-milan", "Мілан", 45.46, 9.19, 1796, 1814, "Італія Наполеона", "Спочатку австрійський, потім центр Цизальпійської республіки і Королівства Італія.", ["napoleon-wars"], true),
  place("napoleon-vienna", "Відень", 48.21, 16.37, 1792, 1815, "Австрія", "Столиця Габсбургів. Її двічі займали, на схемі кордонів окупація міста не намальована.", ["napoleon-wars"], true),
  place("napoleon-berlin", "Берлін", 52.52, 13.4, 1792, 1815, "Пруссія", "Після Тільзита Пруссія різко менша, але Берлін лишається її.", ["napoleon-tilsit"], true),
  place("napoleon-warsaw", "Варшава", 52.23, 21.01, 1792, 1815, "Польща, потім герцогство", "До 1795 року це Річ Посполита, у 1807–1813 — Варшавське герцогство, з 1815 — царство в унії з Росією.", ["napoleon-tilsit"], true),
  place("napoleon-madrid", "Мадрид", 40.42, -3.7, 1808, 1813, "війна в Іспанії", "Місто Жозефа не означає контролю над усією Іспанією.", ["napoleon-wars"], true),
  place("napoleon-moscow", "Москва", 55.75, 37.62, 1812, 1812, "похід 1812", "Кінець намальованого маршруту. Це не анексія.", ["napoleon-wars"]),
  place("napoleon-austerlitz", "Аустерліц", 49.16, 16.87, 1805, 1806, "битва 1805", "Славков. Окремого зрізу битви немає: наслідки видно 1806 року.", ["napoleon-wars"]),
  place("napoleon-leipzig", "Лейпциг", 51.34, 12.37, 1813, 1813, "битва народів", "Після неї розпадається Рейнський союз.", ["napoleon-leipzig"]),
  place("napoleon-waterloo", "Ватерлоо", 50.68, 4.41, 1815, 1815, "18 червня 1815", "Поле бою в Бельгії, вже в Нідерландському королівстві Відня.", ["napoleon-vienna"]),
];
