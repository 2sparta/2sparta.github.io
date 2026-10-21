import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";

export const GERMANY_MIN_YEAR = 962;
export const GERMANY_YEARS = [962, 1190, 1356, 1648, 1763, 1806, 1815, 1867, 1871, 1919, 1937, 1949, 1990] as const;
export type GermanyFrame = { year: number; note: string; collection: HistoricalCollection };
export type GermanyData = { frames: GermanyFrame[] };

/** Last German frame at or before the year. Nothing is drawn before Otto’s coronation. */
export function germanySnapshot(year: number) {
  if (year < GERMANY_MIN_YEAR || year > 1994) return undefined;
  return [...GERMANY_YEARS].reverse().find((y) => y <= year);
}
export function validateGermanyData(raw: unknown): GermanyData {
  const data = raw as GermanyData;
  if (!data?.frames || data.frames.length !== GERMANY_YEARS.length) throw new Error("INVALID_GERMANY_DATA");
  data.frames.forEach((frame, index) => {
    validateHistoricalCollection(frame.collection);
    if (frame.year !== GERMANY_YEARS[index] || !frame.note) throw new Error("INVALID_GERMANY_DATA");
    const ids = new Set<string>();
    for (const feature of frame.collection.features) {
      const id = String(feature.id ?? "");
      const p = feature.properties;
      if (
        !id ||
        ids.has(id) ||
        p.region !== "germany" ||
        p.sourceYear !== frame.year ||
        !p.description ||
        !p.color?.startsWith("#") ||
        !p.sourceUrl?.startsWith("https://") ||
        (p.control !== "direct" && p.control !== "relative")
      )
        throw new Error("INVALID_GERMANY_DATA");
      ids.add(id);
    }
  });
  return data;
}
const COARSE_GERMANY = /^(Holy Roman Empire|Duchy of Swabia)$/;
/** Replace the overview blob with the dated German states. Old Prussians on the Baltic coast stay. */
export function overlayGermany(
  base: HistoricalCollection | undefined,
  extra: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  if (!extra?.features.length) return base;
  const kept = (base?.features ?? []).filter((f) => !COARSE_GERMANY.test(f.properties.name));
  return { type: "FeatureCollection", features: [...kept, ...extra.features] };
}

export const GERMANY_SOURCES: AtlasSource[] = [
  {
    id: "germany-hre",
    title: "Encyclopaedia Britannica — Holy Roman Empire",
    url: "https://www.britannica.com/place/Holy-Roman-Empire",
    note: "Опора для імперії від Оттона до розпуску. Полігони атласу схематичні, не контур Britannica.",
  },
  {
    id: "germany-westphalia",
    title: "Encyclopaedia Britannica — Peace of Westphalia",
    url: "https://www.britannica.com/event/Peace-of-Westphalia",
    note: "1648 рік: Нідерланди й Швейцарія поза імперією. Сілезія на мапі зміниться лише зрізом 1763 року.",
  },
  {
    id: "germany-empire",
    title: "Encyclopaedia Britannica — German Empire",
    url: "https://www.britannica.com/place/German-Empire",
    note: "Імперія 1871 року без Австрії. Ельзас-Лотарингія показана окремо від Пруссії.",
  },
  {
    id: "germany-weimar",
    title: "Encyclopaedia Britannica — Weimar Republic",
    url: "https://www.britannica.com/place/Weimar-Republic",
    note: "Кордони після Версаля. Плебісцити 1920–1921 років зріз не пересуває.",
  },
  {
    id: "germany-1937",
    title: "United States Holocaust Memorial Museum — Third Reich",
    url: "https://encyclopedia.ushmm.org/content/en/article/third-reich",
    note: "Зріз 1937 року навмисно без аншлюсу, Судетів і окупацій. Це не карта завоювань і не виправдання режиму.",
  },
  {
    id: "germany-modern",
    title: "Encyclopaedia Britannica — Germany",
    url: "https://www.britannica.com/place/Germany",
    note: "Союзи XIX століття, дві німецькі держави й об’єднання 1990 року.",
  },
];

type Period = { from: number; to: number; title: string; description: string; sources: string[] };
const PERIODS: Period[] = [
  {
    from: -500,
    to: 961,
    title: "До Священної Римської імперії",
    description: "Цей шар починається з коронації Оттона I. Раніші східнофранкські землі дивіться на мапі франків.",
    sources: ["germany-hre"],
  },
  {
    from: 962,
    to: 1189,
    title: "Рання імперія",
    description: "Племінні герцогства й північна Італія. Чехія залежна. Берлін ще поза контуром, Угорщина й Рим теж.",
    sources: ["germany-hre"],
  },
  {
    from: 1190,
    to: 1355,
    title: "Гогенштауфени",
    description: "Бургундія, Австрія й Бранденбург уже в імперії. Сицилія імператора — окреме королівство, його тут немає.",
    sources: ["germany-hre"],
  },
  {
    from: 1356,
    to: 1647,
    title: "Курфюрсти",
    description: "Золота булла. Крупні світські князівства намальовані, церковні курфюрсти — ні. Італія лише заштрихована.",
    sources: ["germany-hre"],
  },
  {
    from: 1648,
    to: 1762,
    title: "Після Вестфаля",
    description: "Нідерланди й Швейцарія вийшли. Східна Пруссія ще лен Польщі. Сілезія стане прусською 1742 року, мапа зміниться 1763-го.",
    sources: ["germany-westphalia"],
  },
  {
    from: 1763,
    to: 1805,
    title: "Австрія і Пруссія",
    description: "Сілезія вже прусська. Імперія ще є, але це дві сильні монархії, а не одна суцільна держава.",
    sources: ["germany-hre", "germany-modern"],
  },
  {
    from: 1806,
    to: 1814,
    title: "Кінець імперії",
    description: "Імперію розпущено. Рейнський союз заштриховано як французький протекторат. Австрія і Пруссія поза ним.",
    sources: ["germany-modern"],
  },
  {
    from: 1815,
    to: 1866,
    title: "Німецький союз",
    description: "Союз після Віденського конгресу включає Австрію й німецькі землі Пруссії. Східна Пруссія намальована окремо, бо до союзу не входить.",
    sources: ["germany-modern"],
  },
  {
    from: 1867,
    to: 1870,
    title: "Поділ на північ і південь",
    description: "Північнонімецький союз без Австрії. Баварія, Вюртемберг і Баден ще окремі.",
    sources: ["germany-modern"],
  },
  {
    from: 1871,
    to: 1918,
    title: "Німецька імперія",
    description: "Імперія без Австрії. Ельзас-Лотарингія входить окремою імперською землею. Пруссія найбільша, але не єдина держава.",
    sources: ["germany-empire"],
  },
  {
    from: 1919,
    to: 1936,
    title: "Веймарські кордони",
    description: "Без Ельзасу, Познані й коридору. Східна Пруссія відрізана. Саар заштриховано до повернення 1935 року.",
    sources: ["germany-weimar"],
  },
  {
    from: 1937,
    to: 1948,
    title: "Кордони 1937 року",
    description: "Саар уже в державі, Австрії ще немає. Аншлюс, Судети й окупації 1938–1945 не зафарбовані.",
    sources: ["germany-1937"],
  },
  {
    from: 1949,
    to: 1989,
    title: "Дві німецькі держави",
    description: "ФРН і НДР. Східний край — Одер і Ниса. Західний Берлін був анклавом ФРН і на схемі не вирізаний.",
    sources: ["germany-modern"],
  },
  {
    from: 1990,
    to: 1994,
    title: "Об’єднана Німеччина",
    description: "Кордон 1990 року. Сілезія, Померанія й Східна Пруссія до нього не входять.",
    sources: ["germany-modern"],
  },
];
export function germanyPeriod(year: number) {
  return PERIODS.find((p) => year >= p.from && year <= p.to) ?? PERIODS[0]!;
}

export const GERMANY_EVENTS: AtlasEvent[] = [
  { year: 962, title: "Коронація Оттона I", description: "Початок Священної Римської імперії на цій мапі. Це ще не національна держава німців.", sources: ["germany-hre"] },
  { year: 1356, title: "Золота булла", description: "Сім курфюрстів обирають імператора. На мапі лишені великі світські князівства.", sources: ["germany-hre"] },
  { year: 1555, title: "Аугсбурзький мир", description: "Князь визначає віру своєї землі. Кордони зріз через це не перемальовує.", sources: ["germany-hre"], approximate: true },
  { year: 1648, title: "Вестфальський мир", description: "Кінець Тридцятилітньої війни. Нідерланди й Швейцарія більше не в імперії.", sources: ["germany-westphalia"] },
  { year: 1701, title: "Королівство Пруссія", description: "Королівський титул іде від Пруссії поза імперією. На мапі суверенна Пруссія з’являється зрізом 1763 року.", sources: ["germany-modern"] },
  { year: 1806, title: "Розпуск імперії", description: "Франц II складає римську корону. Рейнський союз не є продовженням імперії.", sources: ["germany-hre"] },
  { year: 1815, title: "Німецький союз", description: "39 держав, серед них Австрія. Східна Пруссія поза союзом.", sources: ["germany-modern"] },
  { year: 1867, title: "Північнонімецький союз", description: "Після війни 1866 року Австрія виходить з німецького об’єднання.", sources: ["germany-modern"] },
  { year: 1871, title: "Німецька імперія", description: "Південні королівства входять. Австрія лишається поза імперією.", sources: ["germany-empire"] },
  { year: 1919, title: "Веймарська республіка", description: "Втрати Версаля. Данциг і коридор не зафарбовані як Німеччина.", sources: ["germany-weimar"] },
  { year: 1938, title: "Аншлюс на мапі немає", description: "Австрію приєднано 1938 року. Атлас лишає кордон 1937 року й не малює подальші окупації.", sources: ["germany-1937"] },
  { year: 1949, title: "ФРН і НДР", description: "Дві держави на захід і схід від внутрішнього кордону. Одер — Ниса вже східний край.", sources: ["germany-modern"] },
  { year: 1990, title: "Об’єднання", description: "НДР входить до Федеративної Республіки. Кордон 1945/1990 року не повертає землі на схід від Одеру.", sources: ["germany-modern"] },
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
export const GERMANY_PLACES: AtlasPlace[] = [
  place("germany-aachen", "Аахен", 50.78, 6.08, 962, 1806, "місце коронацій", "Орієнтир ранньої імперії, не межа Лотарингії.", ["germany-hre"], true),
  place("germany-frankfurt", "Франкфурт", 50.11, 8.68, 962, 1994, "вибори імператорів, потім місто ФРН", "Точка міста. Вільне імперське місто на схемі не вирізане з Франконії.", ["germany-hre"]),
  place("germany-vienna", "Відень", 48.21, 16.37, 962, 1866, "в імперії, потім поза німецькою державою", "Столиця австрійських земель. З 1867 року Австрія вже не в німецькому об’єднанні.", ["germany-hre"], true),
  place("germany-prague", "Прага", 50.08, 14.44, 962, 1866, "Чехія в імперії", "Чеська столиця. До Німецької імперії 1871 року не входить.", ["germany-hre"], true),
  place("germany-berlin", "Берлін", 52.52, 13.4, 1190, 1994, "Бранденбург, Пруссія, потім столиця", "На зрізі 962 року міста ще немає в шарі. Західний Берлін після 1949 року окремо не позначений.", ["germany-modern"], true),
  place("germany-munich", "Мюнхен", 48.14, 11.58, 962, 1994, "Баварія", "Орієнтир Баварії, не її кордон.", ["germany-empire"]),
  place("germany-strasbourg", "Страсбург", 48.57, 7.75, 1871, 1918, "імперська земля", "У Рейху 1871–1918 років. До і після цього зрізу місто французьке.", ["germany-empire"]),
  place("germany-konigsberg", "Кенігсберг", 54.71, 20.51, 1701, 1945, "Пруссія поза імперією", "Східна Пруссія. Після 1945 року це вже не німецьке місто.", ["germany-modern"]),
];
