import type { AtlasDate } from "./date.ts";
import { compareWorldDates, formatWorldDate } from "./world.ts";
export type MapEvent = {
  id: string;
  date: AtlasDate;
  precision: "day" | "year";
  kind: "battle" | "treaty" | "uprising";
  title: string;
  place: string;
  lat: number;
  lng: number;
  description: string;
  consequences: string;
  sources: string[];
  locationNote: string;
};
export const EVENT_SOURCES = {
  partitions: {
    title: "German Historical Institute — The Partitions of Poland",
    url: "https://germanhistorydocs.org/en/the-holy-roman-empire-1648-1815/the-partitions-of-poland-1772-1795",
  },
  secondPartition: {
    title: "Музей історії Польщі — другий поділ, 23 січня 1793",
    url: "https://muzhp.pl/en/calendar/drugi-rozbior-polski-en",
  },
  fallDate: {
    title: "Fall of Constantinople — дата облоги та захоплення",
    url: "https://en.wikipedia.org/wiki/Fall_of_Constantinople",
  },
  kosciuszko: {
    title: "Музей історії Польщі — присяга Костюшка в Кракові",
    url: "https://muzhp.pl/wiedza-on-line/przysiega-kosciuszki-na-rynku-w-krakowie",
  },
  cossacks: {
    title: "Велика українська енциклопедія — ранній Новий час",
    url: "https://vue.gov.ua/Історія_України:_Ранній_Новий_час._До_середини_17_ст.",
  },
  nalyvaiko: {
    title: "Інститут історії України НАН України — Наливайка повстання",
    url: "https://resource.history.org.ua/?termin=Nalyvajka_povstannia_1594",
  },
  byzantium: {
    title: "The Metropolitan Museum of Art — Constantinople after 1261",
    url: "https://www.metmuseum.org/essays/constantinople-after-1261",
  },
} satisfies Record<string, { title: string; url: string }>;
type SourceId = keyof typeof EVENT_SOURCES;
const event = (
  id: string,
  year: number,
  kind: MapEvent["kind"],
  title: string,
  place: string,
  lat: number,
  lng: number,
  description: string,
  consequences: string,
  source: SourceId,
  month?: number,
  day?: number,
): MapEvent => ({
  id,
  date: { year, month: month ?? 1, day: day ?? 1 },
  precision: month && day ? "day" : "year",
  kind,
  title,
  place,
  lat,
  lng,
  description,
  consequences,
  sources: [source],
  locationNote:
    kind === "treaty"
      ? "Позначено місто укладення договору, а не всю територію його дії."
      : "Позначка вказує на населений пункт або район події; це не точний контур бойових дій.",
});
/** Curated teaching set; year-only records do not claim an exact day. */
export const MAP_EVENTS: MapEvent[] = [
  event(
    "partition-1772",
    1772,
    "treaty",
    "Перший поділ Речі Посполитої",
    "Санкт-Петербург",
    59.94,
    30.32,
    "Росія, Пруссія та Габсбурзька монархія погодили перший поділ земель Речі Посполитої.",
    "Держава втратила значну частину території, але продовжувала існувати. Гданськ і Торунь тоді ще залишилися в її складі.",
    "partitions",
    8,
    5,
  ),
  event(
    "partition-1793",
    1793,
    "treaty",
    "Другий поділ Речі Посполитої",
    "Санкт-Петербург",
    59.94,
    30.32,
    "Росія та Пруссія домовилися про нові анексії. Австрія участі в другому поділі не брала.",
    "Річ Посполита різко зменшилася; Пруссія отримала також Гданськ і Торунь. Договір і подальше затвердження сеймом — різні події.",
    "secondPartition",
    1,
    23,
  ),
  event(
    "kosciuszko-1794",
    1794,
    "uprising",
    "Початок повстання Костюшка",
    "Краків · Ринкова площа",
    50.0617,
    19.9373,
    "Тадеуш Костюшко склав присягу та очолив повстання проти поділів і втрати незалежності.",
    "Рух став спробою відновити самостійність держави. Його поразка передувала третьому поділу.",
    "kosciuszko",
    3,
    24,
  ),
  event(
    "partition-1795",
    1795,
    "treaty",
    "Третій поділ Речі Посполитої",
    "Санкт-Петербург",
    59.94,
    30.32,
    "Після придушення повстання Росія, Пруссія й Австрія погодили розподіл решти держави.",
    "Річ Посполита припинила існування як незалежна держава. Усі три держави взяли участь у завершальному поділі.",
    "partitions",
    10,
    24,
  ),
  event(
    "kosynsky-1591",
    1591,
    "uprising",
    "Повстання Криштофа Косинського · 1591–1593",
    "Біла Церква",
    49.7968,
    30.1157,
    "Козацький виступ поширився на Київщину й Волинь на тлі суперечностей між козацтвом і магнатами.",
    "Повстанці зазнали поразки під П’яткою. Виступ став одним із перших великих козацьких повстань.",
    "cossacks",
  ),
  event(
    "nalyvaiko-1594",
    1594,
    "uprising",
    "Повстання Наливайка · 1594–1596",
    "Брацлав",
    48.817,
    28.947,
    "Традиційна назва об’єднує походи та кілька етапів козацьких воєн. Власне антиурядова боротьба особливо розгорнулася восени 1595 року.",
    "Рух охопив Поділля, Волинь, Київщину й частину Білорусі; до козаків приєднувалися міщани та селяни.",
    "nalyvaiko",
  ),
  event(
    "solonytsia-1596",
    1596,
    "battle",
    "Солоницька оборона",
    "Район Лубен · Солониця",
    50,
    33.02,
    "Коронне військо оточило козацький табір поблизу Лубен під час придушення виступу Наливайка.",
    "Оборона завершилася поразкою; полонених ватажків відвезли до Варшави. Місце табору показано приблизно.",
    "nalyvaiko",
  ),
  event(
    "fedorovych-1630",
    1630,
    "uprising",
    "Повстання Тараса Федоровича",
    "Переяслав",
    50.065,
    31.459,
    "Козацьке військо Тараса Федоровича виступило проти коронної влади; ключові бої відбулися біля Переяслава.",
    "Переяславська угода збільшила козацький реєстр до восьми тисяч, але не усунула головних суперечностей.",
    "cossacks",
  ),
  event(
    "sulyma-1635",
    1635,
    "uprising",
    "Виступ Івана Сулими",
    "Кодак · район сучасного Дніпра",
    48.384,
    35.139,
    "Запорожці на чолі з Іваном Сулимою здобули й зруйнували новозбудовану фортецю Кодак.",
    "Виступ придушили, а Сулиму стратили. Конфлікт навколо контролю над Запорожжям тривав.",
    "cossacks",
  ),
  event(
    "kumeiky-1637",
    1637,
    "battle",
    "Повстання Павлюка · битва під Кумейками",
    "Район Кумейок",
    49.6,
    31.76,
    "Повстанське військо Павла Бута, відомого як Павлюк, зіткнулося з коронною армією під Кумейками.",
    "Поразка послабила повстанців. Наступного року боротьбу продовжили загони Острянина й Гуні.",
    "cossacks",
  ),
  event(
    "ostrianyn-1638",
    1638,
    "uprising",
    "Повстання Острянина й Гуні",
    "Район історичного Жовнина",
    49.39,
    32.69,
    "Козаки продовжили виступи проти обмеження своїх прав; важливим осередком боїв був Жовнин.",
    "Поразка супроводжувалася посиленням контролю над реєстровим козацтвом. Позначка приблизна: історичний ландшафт змінило водосховище.",
    "cossacks",
  ),
  event(
    "constantinople-1204",
    1204,
    "battle",
    "Захоплення Константинополя хрестоносцями",
    "Константинополь",
    41.008,
    28.978,
    "Учасники Четвертого хрестового походу захопили й пограбували столицю Візантії.",
    "Постала Латинська імперія, а візантійські держави продовжили існування за межами столиці.",
    "byzantium",
  ),
  event(
    "constantinople-1261",
    1261,
    "battle",
    "Повернення Константинополя",
    "Константинополь",
    41.008,
    28.978,
    "Грецькі війська повернули контроль над містом, яке від 1204 року перебувало під владою латинян.",
    "Візантійську імперію відновили зі столицею в Константинополі, проте її ресурси залишалися обмеженими.",
    "byzantium",
  ),
  event(
    "constantinople-1453",
    1453,
    "battle",
    "Падіння Константинополя",
    "Константинополь",
    41.008,
    28.978,
    "Османське військо Мехмеда II захопило столицю Візантійської імперії після облоги.",
    "Імперія зі столицею в Константинополі припинила існування; місто стало османським політичним центром.",
    "fallDate",
    5,
    29,
  ),
].sort((a, b) => compareWorldDates(a.date, b.date));
export const LEARNING_ROUTES = [
  {
    id: "partitions",
    title: "Поділи Речі Посполитої",
    titleEn: "Partitions of the Commonwealth",
    events: ["partition-1772", "partition-1793", "kosciuszko-1794", "partition-1795"],
  },
  {
    id: "cossacks",
    title: "Козацькі повстання",
    titleEn: "Cossack uprisings",
    events: [
      "kosynsky-1591",
      "nalyvaiko-1594",
      "solonytsia-1596",
      "fedorovych-1630",
      "sulyma-1635",
      "kumeiky-1637",
      "ostrianyn-1638",
    ],
  },
  {
    id: "byzantium",
    title: "Падіння Візантії",
    titleEn: "The fall of Byzantium",
    events: ["constantinople-1204", "constantinople-1261", "constantinople-1453"],
  },
] as const;
export function routeEvents(id: string) {
  return (
    LEARNING_ROUTES.find((r) => r.id === id)?.events.map((id) =>
      MAP_EVENTS.find((e) => e.id === id)!,
    ) ?? []
  );
}
export function eventsInPeriod(from: number, to: number) {
  const low = Math.min(from, to),
    high = Math.max(from, to);
  return MAP_EVENTS.filter((e) => e.date.year >= low && e.date.year <= high);
}
export function eventsBetweenDates(from: AtlasDate, to: AtlasDate) {
  const [low, high] = compareWorldDates(from, to) <= 0 ? [from, to] : [to, from];
  return MAP_EVENTS.filter(
    (e) =>
      compareWorldDates(e.date, high) <= 0 &&
      compareWorldDates(
        e.precision === "year" ? { year: e.date.year, month: 12, day: 31 } : e.date,
        low,
      ) >= 0,
  );
}
export function formatMapEventDate(e: MapEvent, uk = true) {
  return e.precision === "day"
    ? formatWorldDate(e.date, uk)
    : `${e.date.year} (${uk ? "рік; день не уточнено" : "year; day unspecified"})`;
}
