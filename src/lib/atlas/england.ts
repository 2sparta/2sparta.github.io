import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";

export const ENGLAND_MIN_YEAR = 43;
export const ENGLAND_YEARS = [
  43, 600, 802, 886, 927, 1066, 1171, 1284, 1472, 1542, 1603, 1654, 1660, 1707, 1801, 1922, 1994,
] as const;
export type EnglandFrame = { year: number; note: string; collection: HistoricalCollection };
export type EnglandData = { frames: EnglandFrame[] };

export function clampEnglandYear(value: number) {
  const year = Number.isFinite(value) ? Math.round(value) : 1000;
  return Math.max(ENGLAND_MIN_YEAR, Math.min(1994, year));
}
export function englandDate(year: number, month = 1, day = 1) {
  year = clampEnglandYear(year);
  month = Math.max(1, Math.min(12, Math.trunc(month) || 1));
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  day = Math.max(1, Math.min(dim, Math.trunc(day) || 1));
  return { year, month, day };
}
export function englandDateKey(date: { year: number; month: number; day: number }) {
  const d = englandDate(date.year, date.month, date.day);
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
export function formatEnglandDate(date: { year: number; month: number; day: number }) {
  const d = englandDate(date.year, date.month, date.day);
  return `${String(d.day).padStart(2, "0")}.${String(d.month).padStart(2, "0")}.${d.year}`;
}
export function shiftEnglandDay(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const d = englandDate(date.year, date.month, date.day);
  const next = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  const shifted = englandDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  if (shifted.year !== next.getUTCFullYear()) return d;
  return shifted;
}
export function englandSnapshot(year: number) {
  if (year < ENGLAND_MIN_YEAR || year > 1994) return undefined;
  return [...ENGLAND_YEARS].reverse().find((y) => y <= year);
}
export function validateEnglandData(raw: unknown): EnglandData {
  const d = raw as EnglandData;
  if (!d?.frames || d.frames.length !== ENGLAND_YEARS.length) throw new Error("INVALID_ENGLAND_DATA");
  d.frames.forEach((frame, index) => {
    validateHistoricalCollection(frame.collection);
    if (frame.year !== ENGLAND_YEARS[index] || typeof frame.note !== "string" || !frame.note)
      throw new Error("INVALID_ENGLAND_DATA");
    const ids = new Set<string>();
    for (const feature of frame.collection.features) {
      const id = String(feature.id ?? "");
      if (
        !id ||
        ids.has(id) ||
        feature.properties.region !== "england" ||
        feature.properties.sourceYear !== frame.year ||
        !feature.properties.sourceUrl?.startsWith("https://") ||
        !feature.properties.color ||
        !feature.properties.description ||
        !["state", "dependency"].includes(feature.properties.layer ?? "")
      )
        throw new Error("INVALID_ENGLAND_DATA");
      ids.add(id);
    }
  });
  return d;
}

export const ENGLAND_SOURCES: AtlasSource[] = [
  {
    id: "england-romans",
    title: "English Heritage — Romans in England",
    url: "https://www.english-heritage.org.uk/learn/story-of-england/romans/",
    note: "Римська провінція Британія. Північний край на мапі — Адріанів вал II ст., не маршрут 43 року.",
  },
  {
    id: "england-anglo",
    title: "British Museum — Who were the Anglo-Saxons?",
    url: "https://www.britishmuseum.org/blog/who-were-anglo-saxons",
    note: "Англосаксонські королівства. Межі на мапі схематичні.",
  },
  {
    id: "england-alfred",
    title: "The National Archives — Anglo-Saxons",
    url: "https://www.nationalarchives.gov.uk/education/resources/anglo-saxons/",
    note: "Альфред, Данелаг і формування Англійського королівства.",
  },
  {
    id: "england-england",
    title: "The National Archives — Anglo-Saxons",
    url: "https://www.nationalarchives.gov.uk/education/resources/anglo-saxons/",
    note: "Королівство Англія від Ательстана. Валлія й Шотландія тут ще окремі.",
  },
  {
    id: "england-norman",
    title: "English Heritage — 1066 and the Norman Conquest",
    url: "https://www.english-heritage.org.uk/learn/histories/1066-and-the-norman-conquest/",
    note: "Нормандське завоювання змінює династію, але не зливає сусідні королівства.",
  },
  {
    id: "england-wales",
    title: "UK Parliament — Acts of Union",
    url: "https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/acts-of-union/",
    note: "Валлія в складі Англії після завоювання Едуарда I та актів XVI ст.; унія з Шотландією — 1707.",
  },
  {
    id: "england-ireland",
    title: "UK Parliament — Parliament and Ireland",
    url: "https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/parliamentandireland/",
    note: "Лордство, окреме Ірландське королівство й унія 1801 р. Суцільний контур не означає повного управління.",
  },
  {
    id: "england-scotland",
    title: "UK Parliament — Acts of Union",
    url: "https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/acts-of-union/",
    note: "Шотландія окремо до 1707 р. Оркнейські й Шетландські острови — у шотландській короні від 1468–1472 рр.",
  },
  {
    id: "england-union",
    title: "The Royal Household — James VI and I",
    url: "https://www.royal.uk/james-vi-and-i",
    note: "Особиста унія 1603 р. ще не скасовує окремих королівств.",
  },
  {
    id: "england-civil",
    title: "UK Parliament — Civil War",
    url: "https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/civilwar/",
    note: "Війни трьох королівств, Співдружність і реставрація 1660 р.",
  },
  {
    id: "england-1922",
    title: "The National Archives — Irish partition",
    url: "https://www.nationalarchives.gov.uk/education/resources/irish-partition/",
    note: "Поділ 1921–1922 рр.: Вільна держава й Північна Ірландія в складі Сполученого Королівства.",
  },
];

export const ENGLAND_EVENTS: AtlasEvent[] = [
  [43, "Римське завоювання", "Клавдій починає завоювання Британії. Північний кордон провінції ще не є Адріановим валом.", "england-romans"],
  [122, "Адріанів вал", "Північний рубіж провінції закріплюють валом. Саме ця лінія показана на римському зрізі.", "england-romans"],
  [410, "Кінець римського управління", "Імперська адміністрація на острові згортається. Наступний політичний зріз мапи — 600 рік.", "england-romans"],
  [597, "Місія Августина", "Кентербері стає осередком римської місії серед англосаксів.", "england-anglo"],
  [802, "Зростання Вессексу", "Егберт зміцнює Вессекс. Корнуол на мапі вже не показаний окремим королівством Думнонії.", "england-anglo"],
  [866, "Велике поганське військо", "Скандинавські війська захоплюють Нортумбрію, Східну Англію й частину Мерсії.", "england-alfred"],
  [886, "Альфред і Гутрум", "Договір відділяє англійські землі від Данелагу. Це не щорічна лінія фронту.", "england-alfred"],
  [927, "Королівство Англія", "Ательстан збирає англійські землі, включно з колишньою Нортумбрією. Валлія й Алба окремі.", "england-england"],
  [1066, "Нормандське завоювання", "Після Гастінгса змінюється династія Англії. Валлія, Шотландія й Ірландія не стають Англією.", "england-norman"],
  [1171, "Лордство Ірландії", "Генріх II претендує на лордство. На мапі це спершу Пейл, а не весь острів.", "england-ireland"],
  [1284, "Статут Рудлана", "Завойована Валлія входить до королівства Англія. Шотландія лишається окремою.", "england-wales"],
  [1472, "Оркней і Шетланд", "Північні острови переходять від Норвегії до шотландської корони.", "england-scotland"],
  [1542, "Корона Ірландії", "Ірландію проголошено окремим королівством під англійським монархом.", "england-ireland"],
  [1603, "Унія корон", "Яків VI Шотландський стає королем Англії. Три королівства ще не злиті.", "england-union"],
  [1649, "Республіка", "Страта Карла I. Спільний контур Співдружності на мапі з’являється 1654 р., після підкорення сусідів.", "england-civil"],
  [1660, "Реставрація", "Повертаються три окремі корони.", "england-civil"],
  [1707, "Королівство Великої Британії", "Англія і Шотландія утворюють одну державу. Ірландія входить лише 1801 р.", "england-wales"],
  [1801, "Унія з Ірландією", "Постає Сполучене Королівство Великої Британії та Ірландії.", "england-ireland"],
  [1922, "Поділ Ірландії", "Ірландська Вільна держава й Північна Ірландія в складі Сполученого Королівства.", "england-1922"],
].map(([year, title, description, source]) => ({
  year: Number(year),
  title: String(title),
  description: String(description),
  sources: [String(source)],
  europe: true,
}));

export const ENGLAND_PERIODS = [
  {
    from: 43,
    to: 409,
    title: "Римська Британія",
    description:
      "Провінція на південь від Адріанового валу, разом із Валлією. Вал — кордон II ст.; для років одразу після 43-го це не лінія першого походу. Каледонія й Ірландія до провінції не входять.",
    sources: ["england-romans"],
  },
  {
    from: 410,
    to: 599,
    title: "Після римського управління",
    description:
      "Окремого зрізу для кожного десятиліття немає. До 600 року лишається останній римський контур: він не є картою англосаксонського розселення.",
    sources: ["england-romans", "england-anglo"],
  },
  {
    from: 600,
    to: 801,
    title: "Королівства гептархії",
    description:
      "Кент, Сассекс, Ессекс, Східна Англія, Вессекс, Мерсія, Нортумбрія, а також Думнонія, валлійські землі й Піктландія. Межі схематичні й не інтерполюються між зрізами.",
    sources: ["england-anglo"],
  },
  {
    from: 802,
    to: 885,
    title: "Мерсія і Вессекс",
    description:
      "Думнонія вже в орбіті Вессексу. Мерсія ще сильна, але мапа не показує гегемонію окремим кольором чужих королівств.",
    sources: ["england-anglo"],
  },
  {
    from: 886,
    to: 926,
    title: "Альфред і Данелаг",
    description:
      "Англійські землі Вессексу й західної Мерсії проти Данелагу. Йорк у Данелагу, Бамбург — в англійській Нортумбрії.",
    sources: ["england-alfred"],
  },
  {
    from: 927,
    to: 1065,
    title: "Королівство Англія",
    description:
      "Єдине англійське королівство від Ательстана. Валлія, Алба й Ірландія показані окремо.",
    sources: ["england-england"],
  },
  {
    from: 1066,
    to: 1170,
    title: "Нормандська Англія",
    description:
      "Нова династія не поглинає Валлію, Шотландію чи Ірландію. Гебриди й Мен — Королівство островів, Оркней ще норвезький.",
    sources: ["england-norman"],
  },
  {
    from: 1171,
    to: 1283,
    title: "Лордство Ірландії",
    description:
      "Англійська влада в Ірландії починається з Пейла. Решта острова — гельські землі, не порожнє місце і не Англія.",
    sources: ["england-ireland"],
  },
  {
    from: 1284,
    to: 1541,
    title: "Англія і Валлія",
    description:
      "Валлія входить до королівства Англія. Шотландія окрема; від 1472 р. з Оркнейськими й Шетландськими островами. Лордство Ірландії ширше за Пейл, але не покриває весь острів.",
    sources: ["england-wales", "england-scotland"],
  },
  {
    from: 1542,
    to: 1602,
    title: "Три корони",
    description:
      "Англія з Валлією, Шотландія й Ірландське королівство. Спільний монарх Ірландії не скасовує окремої корони і не означає прямого управління кожним районом.",
    sources: ["england-ireland"],
  },
  {
    from: 1603,
    to: 1653,
    title: "Особиста унія",
    description:
      "Один монарх, три держави. Республіку проголошено 1649 р., але спільний контур Співдружності на мапі — лише з 1654 р.",
    sources: ["england-union", "england-civil"],
  },
  {
    from: 1654,
    to: 1659,
    title: "Співдружність",
    description:
      "Англія, Шотландія й Ірландія показані одним контуром воєнного об’єднання. Острів Мен лишається окремим лордством.",
    sources: ["england-civil"],
  },
  {
    from: 1660,
    to: 1706,
    title: "Реставрація",
    description: "Знову три окремі корони. Унія королівств ще попереду.",
    sources: ["england-civil"],
  },
  {
    from: 1707,
    to: 1800,
    title: "Велика Британія",
    description:
      "Англія і Шотландія — одна держава. Ірландія залишається окремим королівством.",
    sources: ["england-wales", "england-ireland"],
  },
  {
    from: 1801,
    to: 1921,
    title: "Сполучене Королівство та Ірландія",
    description:
      "Унія 1801 р. включає весь острів Ірландія. Мен і Нормандські острови — коронні володіння, не англійські графства.",
    sources: ["england-ireland"],
  },
  {
    from: 1922,
    to: 1994,
    title: "Поділ острова",
    description:
      "Ірландська Вільна держава, згодом Республіка Ірландія, і Сполучене Королівство Великої Британії та Північної Ірландії. Кордон Північної Ірландії оглядовий.",
    sources: ["england-1922"],
  },
];

const place = (
  id: string,
  name: string,
  from: number,
  to: number,
  lat: number,
  lng: number,
  dateLabel: string,
  description: string,
  sources: string[],
  capital = false,
): AtlasPlace => ({
  id,
  name,
  type: "city",
  from,
  to,
  lat,
  lng,
  dateLabel,
  description,
  sources,
  europe: true,
  english: true,
  capital,
});

export const ENGLAND_PLACES: AtlasPlace[] = [
  place("en-london", "Лондон", 43, 1994, 51.507, -0.128, "Лондіній, потім головний осередок Англії", "Місто на Темзі. Позначка не задає меж королівства.", ["england-romans"], true),
  place("en-canterbury", "Кентербері", 597, 1994, 51.28, 1.08, "Осередок місії з 597 р.", "Кентський осередок. Не столиця всієї Англії.", ["england-anglo"]),
  place("en-winchester", "Вінчестер", 600, 1994, 51.063, -1.31, "Осередок Вессексу", "Королівський осередок західних саксів до нормандського часу.", ["england-anglo"]),
  place("en-york", "Йорк", 71, 1994, 53.96, -1.08, "Еборакум, потім Йорк", "Римське місто, столиця Нортумбрії й осередок Данелагу.", ["england-romans", "england-alfred"]),
  place("en-cardiff", "Кардіфф", 600, 1994, 51.482, -3.179, "Валлійський осередок", "До 1284 р. поза королівством Англія, далі в його складі.", ["england-wales"]),
  place("en-edinburgh", "Единбург", 600, 1994, 55.953, -3.188, "Осередок півночі, потім Шотландії", "У ранньому зрізі ще в зоні Нортумбрії; від 927 р. — Алба / Шотландія.", ["england-scotland"], true),
  place("en-dublin", "Дублін", 43, 1994, 53.35, -6.26, "Ірландський осередок", "Поза Римською Британією. Від 1171 р. — центр лордства, не англійське графство.", ["england-ireland"], true),
  place("en-belfast", "Белфаст", 1171, 1994, 54.597, -5.93, "Осередок східного Ольстера", "Від 1922 р. — у складі Сполученого Королівства, не Вільної держави.", ["england-1922"]),
];
