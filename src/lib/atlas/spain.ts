import {
  validateHistoricalCollection,
  type HistoricalCollection,
  type AtlasView,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
} from "./model.ts";
import { atlasDateKey, parseAtlasDate, type AtlasDate } from "./date.ts";

export type SpainFrame = {
  date: string;
  precision: "year" | "month" | "day";
  note: string;
  politicalDate?: string;
  reconquistaDate?: string;
  collection: HistoricalCollection;
};
export type SpainData = { frames: SpainFrame[]; reconquista: SpainFrame[]; civil: SpainFrame[] };
export const isSpainView = (view: AtlasView) => view === "spain" || view === "spanish-empire";
export function validateSpainData(raw: unknown): SpainData {
  const d = raw as SpainData;
  for (const [key, count] of [
    ["frames", 32],
    ["reconquista", 6],
    ["civil", 6],
  ] as const) {
    if (!d || !Array.isArray(d[key]) || d[key].length !== count)
      throw new Error("INVALID_SPAIN_DATA");
    let previous = "";
    for (const f of d[key]) {
      if (
        !parseAtlasDate(f.date) ||
        f.date <= previous ||
        typeof f.note !== "string" ||
        !["year", "month", "day"].includes(f.precision) ||
        f.collection?.type !== "FeatureCollection" ||
        !Array.isArray(f.collection.features)
      )
        throw new Error("INVALID_SPAIN_DATA");
      previous = f.date;
      if (f.collection.features.length) validateHistoricalCollection(f.collection);
      const ids = new Set<string>();
      for (const p of f.collection.features) {
        if (
          !p.id ||
          ids.has(String(p.id)) ||
          p.properties.region !== "spain" ||
          !p.properties.sourceId ||
          !p.properties.sourceUrl?.startsWith("https://") ||
          !["state", "colony", "dependency", "land", "front"].includes(p.properties.layer ?? "")
        )
          throw new Error("INVALID_SPAIN_DATA");
        ids.add(String(p.id));
      }
    }
  }
  return d;
}
const latest = (frames: SpainFrame[], date: string) =>
  [...frames].reverse().find((f) => f.date <= date);
export function spainFrameAt(
  data: SpainData | undefined,
  date: AtlasDate,
  options = { reconquista: true, colonies: true, fronts: true },
): SpainFrame | undefined {
  if (!data || date.year < 700 || date.year > 1994) return undefined;
  const key = atlasDateKey(date),
    political = latest(data.frames, key);
  if (!political) return undefined;
  const recon =
    options.reconquista && date.year >= 718 && key < "1492-01-02"
      ? latest(data.reconquista, key)
      : undefined;
  const war =
    options.fronts && key >= "1936-07-17" && key <= "1939-12-31"
      ? latest(data.civil, key)
      : undefined;
  const features = political.collection.features.filter(
    (f) =>
      (options.colonies || f.properties.layer !== "colony") &&
      (!war || f.properties.layer !== "state") &&
      (!f.properties.validUntilDate || key <= f.properties.validUntilDate),
  );
  return {
    ...(war ?? (recon && recon.date > political.date ? recon : political)),
    politicalDate: political.date,
    reconquistaDate: recon?.date,
    note: `${war?.note ?? political.note}${recon ? ` ${recon.note}` : ""}${key >= "1936-07-17" && key < "1936-07-31" ? " Переворот уже почався, але перший місячний зріз фронту доступний 31.07.1936; суцільний контур держави не означає контроль республіканців над усією країною." : ""}`,
    collection: {
      type: "FeatureCollection",
      features: [
        ...features,
        ...(recon?.collection.features ?? []),
        ...(war?.collection.features ?? []),
      ],
    },
  };
}
export const isCoarseSpanish = (name: string) =>
  [
    "Spain",
    "Visigothic Kingdom",
    "Asturias",
    "Emirate of Córdoba",
    "Caliphate of Córdoba",
    "Navarre",
    "León",
    "Castilla",
    "Castile",
    "Castille",
    "Aragón",
    "Granada",
    "Almoravid dynasty",
    "Almohad Caliphate",
    "Spanish Sahara",
    "Spanish Guinea",
    "Cuba (Spain)",
    "Hispaniola (Spain)",
    "Santo Domingo (Spain)",
    "Viceroyalty of New Spain",
  ].includes(name);
export function addSpainLayer(
  base: HistoricalCollection | undefined,
  frame: HistoricalCollection | undefined,
) {
  if (!frame) return base;
  const replacesPortugal = frame.features.some((f) =>
    ["Portugal", "Portugal — Iberian Union"].includes(f.properties.name),
  );
  return {
    type: "FeatureCollection" as const,
    features: [
      ...(base?.features ?? []).filter(
        (f) =>
          !isCoarseSpanish(f.properties.name) &&
          !(replacesPortugal && f.properties.name === "Portugal"),
      ),
      ...frame.features,
    ],
  };
}
export const SPAIN_SOURCES: AtlasSource[] = [
  {
    id: "spain-navas",
    title: "Museo Nacional del Prado — Las Navas de Tolosa",
    url: "https://www.museodelprado.es/coleccion/obra-de-arte/la-batalla-de-las-navas/13fee1ea-1cad-445e-88e4-f8480b20f8f9",
    note: "Датування битви 16 липня 1212 р.",
  },
  {
    id: "spain-guinea",
    title: "United Nations — Equatorial Guinea independence",
    url: "https://www.un.org/en/node/238894",
    note: "Незалежність Екваторіальної Гвінеї 12 жовтня 1968 р.",
  },
  {
    id: "spain-1808",
    title: "Ministerio de Cultura — 2 de mayo de 1808",
    url: "https://www.cultura.gob.es/cultura/areas/archivos/mc/centros/cida/4-difusion-cooperacion/4-1-guias-de-lectura/guerra-independencia/dia-2-de-mayo-1808.html",
    note: "Архівні матеріали повстання в Мадриді 2 травня 1808 р.",
  },
  {
    id: "spain-basemaps",
    title: "André Ourednik — Historical Basemaps (GPL-3.0)",
    url: "https://github.com/aourednik/historical-basemaps/tree/da7a4b735ecef70aebdc9c73e409d8a2500d50f3",
    note: "Датовані оглядові політичні й колоніальні контури. Імперські претензії не дорівнюють суцільному фактичному контролю; деякі ранні зрізи неповні.",
  },
  {
    id: "spain-reconquista",
    title: "Kaidor, Rowanwindwhistler — Progress of the Reconquista (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:Progress_of_the_Reconquista_(718%E2%80%931492)_-_es.svg",
    note: "Геоприв’язані оглядові ареали 718, 750, 1050, 1090, 1220 та кінця XIII ст. Не одна християнська держава й не щоденні фронти.",
  },
  {
    id: "spain-civil-map",
    title: "FDRMRZUSA та співавтори — Spanish Civil War map (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:General_map_of_the_Spanish_Civil_War_(1936%E2%80%9339).svg",
    note: "Зрізи липня/вересня 1936, жовтня 1937, листопада 1938, лютого 1939. Місячні контури доступні від кінця місяця, без вигаданого щоденного пересування фронту.",
  },
  {
    id: "spain-andalus",
    title: "Junta de Andalucía — Al-Ándalus",
    url: "https://edea.juntadeandalucia.es/bancorecursos/file/ebaa0cd7-0597-4d96-9ba2-2693d8b13056/1/es-an_2021062812_9125646.zip/5_alndalus.html",
    note: "Завоювання від 711 р., емірат, халіфат, тайфи й мусульманські держави півострова.",
  },
  {
    id: "spain-granada",
    title: "Patronato de la Alhambra — Los Reyes Católicos",
    url: "https://www.alhambra-patronato.es/recomendacion-lectura/los-reyes-catolicos-en-la-alhambra-1492-1500",
    note: "Передання Гранади 2 січня 1492 р.",
  },
  {
    id: "spain-columbus",
    title: "Biblioteca Virtual Miguel de Cervantes — Cristóbal Colón",
    url: "https://www.cervantesvirtual.com/portales/cristobal_colon/presentacion/",
    note: "Вихід експедиції 3 серпня та прибуття до Карибів 12 жовтня 1492 р.; подорож не означає миттєвого завоювання континенту.",
  },
  {
    id: "spain-paris",
    title: "US Office of the Historian — Treaty of Paris, 1898",
    url: "https://history.state.gov/historicaldocuments/frus1898/d712a",
    note: "Підписання 10.12.1898, обмін ратифікаціями 11.04.1899; Куба, Пуерто-Рико, Гуам і Філіппіни.",
  },
  {
    id: "spain-republic",
    title: "Congreso de los Diputados — II República Española",
    url: "https://www.congreso.es/cem/iirepesp",
    note: "Друга республіка 1931–1939, вибори, Конституція й громадянська війна.",
  },
  {
    id: "spain-civil",
    title: "Ministerio de Cultura — Guerra civil y posguerra",
    url: "https://www.cultura.gob.es/cultura/mc/incautaciones-guerra-civil/guerra-civil.html",
    note: "Військовий заколот почався 17 липня 1936 р.; громадянська війна й повоєнна диктатура.",
  },
  {
    id: "spain-sahara",
    title: "United Nations — Western Sahara",
    url: "https://www.un.org/dppa/decolonization/en/nsgt/western-sahara",
    note: "Іспанське повідомлення про припинення присутності 26.02.1976. Деколонізація території залишається окремим питанням.",
  },
];
const events: [number, number | undefined, number | undefined, string, string, string][] = [
  [
    711,
    undefined,
    undefined,
    "Мусульманське завоювання",
    "Арабо-берберські війська почали завоювання Вестготського королівства. Карта показує осередки кампаній, а не миттєвий контроль усього півострова.",
    "spain-andalus",
  ],
  [
    718,
    undefined,
    undefined,
    "Північні християнські осередки",
    "Оглядова карта починає просування від осередку в Астурії; датування Ковадонги 718/722 рр. дискусійне.",
    "spain-reconquista",
  ],
  [
    756,
    undefined,
    undefined,
    "Кордовський емірат",
    "Аль-Андалус став незалежним еміратом Омейядів.",
    "spain-andalus",
  ],
  [
    929,
    undefined,
    undefined,
    "Кордовський халіфат",
    "Проголошення халіфату; мусульманські території не тотожні сучасній Іспанії.",
    "spain-andalus",
  ],
  [
    1031,
    undefined,
    undefined,
    "Розпад халіфату на тайфи",
    "Кілька мусульманських держав замінили єдиний кордовський центр. Оглядовий шар не відокремлює всі тайфи.",
    "spain-andalus",
  ],
  [
    1085,
    undefined,
    undefined,
    "Здобуття Толедо",
    "Просування Кастилії; відвоювання міст не означало незворотного лінійного пересування єдиного фронту.",
    "spain-reconquista",
  ],
  [
    1212,
    7,
    16,
    "Лас-Навас-де-Толоса",
    "Перемога коаліції християнських королівств над Альмохадами. Наступний оглядовий ареал карти — 1220 р.",
    "spain-navas",
  ],
  [
    1238,
    undefined,
    undefined,
    "Валенсія та Гранадський емірат",
    "Кастилія й Арагон розширювали володіння; Гранада збереглася як окрема мусульманська держава.",
    "spain-reconquista",
  ],
  [
    1479,
    undefined,
    undefined,
    "Династична унія Кастилії та Арагону",
    "Спільні монархи не скасували окремі установи й правові порядки корон. Португалія залишилася окремою державою.",
    "spain-basemaps",
  ],
  [
    1492,
    1,
    2,
    "Передання Гранади",
    "Завершення завоювання Гранадського емірату. Це не означає закінчення історії мусульманських спільнот півострова.",
    "spain-granada",
  ],
  [
    1492,
    10,
    12,
    "Експедиція Колумба в Карибах",
    "Початок трансатлантичної колоніальної експансії. Америка вже була населена; карта не зафарбовує весь континент від дати висадки.",
    "spain-columbus",
  ],
  [
    1530,
    undefined,
    undefined,
    "Завоювання в Америці",
    "Показані опорні іспанські володіння в Карибах і Новій Іспанії. Віце-королівство Нової Іспанії засноване 1535 р.; ранній ареал не є його точним адміністративним кордоном.",
    "spain-basemaps",
  ],
  [
    1580,
    undefined,
    undefined,
    "Іберійська унія",
    "Португальська та іспанські корони мали спільного монарха, але окремі колоніальні системи. Португальські колонії не видаються за іспанські.",
    "spain-basemaps",
  ],
  [
    1640,
    12,
    1,
    "Відновлення незалежності Португалії",
    "Португальський шар династичної унії закінчується; спільна монархія не переноситься на наступні роки.",
    "spain-basemaps",
  ],
  [
    1650,
    undefined,
    undefined,
    "Глобальна іспанська монархія",
    "Американські володіння, Філіппіни та європейські залежні території. Штрихування колоніальних ареалів відокремлює їх від метрополії.",
    "spain-basemaps",
  ],
  [
    1713,
    undefined,
    undefined,
    "Утрехтський мир",
    "Втрата більшості європейських володінь; наступний територіальний зріз — 1715 р.",
    "spain-basemaps",
  ],
  [
    1783,
    undefined,
    undefined,
    "Пізня колоніальна імперія",
    "Огляд віце-королівств і колоніальних претензій перед хвилею незалежності. Суцільний ареал не означає однакової глибини колоніального управління.",
    "spain-basemaps",
  ],
  [
    1808,
    5,
    2,
    "Війна на півострові",
    "Наполеонівське втручання й повстання в Мадриді посилили кризу монархії. Щоденні зони наполеонівського контролю тут не реконструйовані.",
    "spain-1808",
  ],
  [
    1825,
    undefined,
    undefined,
    "Розпад материкової імперії в Америці",
    "Після воєн за незалежність головними збереженими володіннями стали Куба, Пуерто-Рико та Філіппіни. Залишкові гарнізони не означають контролю цілих колишніх віце-королівств.",
    "spain-basemaps",
  ],
  [
    1898,
    12,
    10,
    "Паризький договір",
    "Договір про відмову від Куби й передання Пуерто-Рико, Гуаму та Філіппін. Юридичне набуття чинності — 11 квітня 1899 р.; місцеві передачі влади мали інші дати.",
    "spain-paris",
  ],
  [
    1899,
    4,
    11,
    "Набуття чинності Паризьким договором",
    "Попередні карибські й філіппінські колоніальні ареали вилучено з іспанського шару.",
    "spain-paris",
  ],
  [
    1931,
    4,
    14,
    "Друга Іспанська республіка",
    "Проголошення республіки; конституційний і політичний період перед громадянською війною.",
    "spain-republic",
  ],
  [
    1936,
    7,
    17,
    "Військовий заколот",
    "Заколот почався в іспанській Північній Африці й поширився на півострів. Перший огляд фронту датований липнем і доступний на шкалі від 31 липня.",
    "spain-civil",
  ],
  [
    1936,
    7,
    31,
    "Фронти · липень 1936",
    "Початкові зони республіканців і заколотників. Дата означає кінець місячного огляду, а не точність джерела до дня.",
    "spain-civil-map",
  ],
  [
    1936,
    9,
    30,
    "Фронти · вересень 1936",
    "Розширення зони заколотників; Мадрид і Барселона залишаються республіканськими.",
    "spain-civil-map",
  ],
  [
    1937,
    10,
    31,
    "Фронти · жовтень 1937",
    "Втрата республіканського північного поясу. Огляд не реконструює всі проміжні бої й локальні анклави.",
    "spain-civil-map",
  ],
  [
    1938,
    11,
    30,
    "Фронти · листопад 1938",
    "Оглядовий етап після кампанії на Ебро; республіканські території розділені.",
    "spain-civil-map",
  ],
  [
    1939,
    2,
    28,
    "Фронти · лютий 1939",
    "Каталонія переходить під контроль військ Франко; центрально-східна республіканська зона ще існує.",
    "spain-civil-map",
  ],
  [
    1939,
    4,
    1,
    "Завершення громадянської війни",
    "Оголошення перемоги Франко. Війна змінилася диктатурою, репресіями й еміграцією; залишковий опір не показаний як державний фронт.",
    "spain-civil",
  ],
  [
    1968,
    10,
    12,
    "Незалежність Екваторіальної Гвінеї",
    "Колишня Іспанська Гвінея вилучена з колоніального шару.",
    "spain-guinea",
  ],
  [
    1976,
    2,
    26,
    "Припинення іспанської присутності в Сахарі",
    "Повідомлення Іспанії ООН. Цей перехід не означає вирішення питання самовизначення Західної Сахари.",
    "spain-sahara",
  ],
];
export const SPAIN_EVENTS: AtlasEvent[] = events.map(
  ([year, month, day, title, description, source]) => ({
    year,
    ...(month ? { month } : {}),
    ...(day ? { day } : {}),
    title,
    description,
    sources: [source],
    ...(year === 718 ? { approximate: true } : {}),
  }),
);
export const SPAIN_PERIODS = [
  [
    395,
    710,
    "Іберія перед завоюванням",
    "Пізньоантичні й вестготські держави; перший політичний зріз цього шару — 700 р.",
  ],
  [
    711,
    755,
    "Завоювання й ранній Аль-Андалус",
    "Кампанії арабо-берберських військ і північні християнські осередки. Контури завоювання не пересуваються щодня.",
  ],
  [
    756,
    1030,
    "Емірат і халіфат Кордови",
    "Аль-Андалус і християнські королівства півночі; дата подій відокремлена від дати оглядового контуру.",
  ],
  [
    1031,
    1211,
    "Тайфи, Альморавіди та Альмохади",
    "Політична роздробленість, союзи та війни. Реконкіста показана оглядовими ареалами кількох держав.",
  ],
  [
    1212,
    1491,
    "Просування королівств і Гранада",
    "Кастилія, Арагон, Португалія, Наварра й Гранадський емірат. Старі оглядові контури не є точним фронтом кожного року.",
  ],
  [
    1492,
    1579,
    "Об’єднані корони й океанська експансія",
    "Кастилія та Арагон зберігали окремі установи. Колонізація супроводжувалася завоюваннями й насильством щодо корінних народів.",
  ],
  [
    1580,
    1640,
    "Іберійська унія та глобальна монархія",
    "Спільний монарх з Португалією, окремі імперії. Не всі ранні колоніальні ареали мають повний контур у кожному зрізі.",
  ],
  [
    1641,
    1807,
    "Іспанська колоніальна імперія",
    "Америка, Філіппіни й європейські володіння до територіальних втрат. Колоніальні претензії та фактичний контроль розрізняються.",
  ],
  [
    1808,
    1899,
    "Криза й розпад американської імперії",
    "Наполеонівські війни, незалежність материкової Америки та втрата карибських і філіппінських володінь.",
  ],
  [
    1900,
    1935,
    "Африканські володіння та Друга республіка",
    "Колоніальна присутність в Африці й політичні зміни в метрополії. Не всі дрібні анклави реконструйовані.",
  ],
  [
    1936,
    1939,
    "Громадянська війна",
    "Республіканська й заколотницька/франкістська зони. Користуйтеся днем і місяцем та місячними зрізами; фронт між ними не інтерполюється.",
  ],
  [
    1940,
    1975,
    "Диктатура й африканська деколонізація",
    "Повоєнна Іспанія, незалежність Екваторіальної Гвінеї та завершення колоніальної присутності в Сахарі.",
  ],
  [
    1976,
    1994,
    "Після колоніальної імперії",
    "Демократичний перехід. Західна Сахара не позначається іспанською; її міжнародний статус не визначається цим шаром.",
  ],
].map(([from, to, title, description]) => ({
  from: Number(from),
  to: Number(to),
  title: String(title),
  description: String(description),
  sources: [Number(from) === 1936 ? "spain-civil" : "spain-basemaps"],
}));
const cities: [string, string, number, number, number, number, boolean?][] = [
  ["cordoba", "Кордова", -4.7794, 37.8882, 700, 1994],
  ["toledo", "Толедо", -4.0273, 39.8628, 700, 1994],
  ["oviedo", "Ов’єдо", -5.8494, 43.3614, 750, 1994],
  ["granada", "Гранада", -3.5986, 37.1773, 1000, 1994],
  ["seville", "Севілья", -5.9845, 37.3891, 700, 1994],
  ["barcelona", "Барселона", 2.1734, 41.3851, 700, 1994],
  ["madrid", "Мадрид", -3.7038, 40.4168, 1000, 1994],
  ["valencia", "Валенсія", -0.3763, 39.4699, 700, 1994],
  ["lisbon", "Лісабон · Португалія", -9.1393, 38.7223, 700, 1994],
  ["bilbao", "Більбао", -2.935, 43.263, 1300, 1994],
  ["havana", "Гавана · Куба", -82.3666, 23.1136, 1519, 1898, true],
  ["mexico", "Мехіко · Нова Іспанія", -99.1332, 19.4326, 1521, 1821, true],
  ["lima", "Ліма · Перу", -77.0428, -12.0464, 1535, 1824, true],
  ["manila", "Маніла · Філіппіни", 120.9842, 14.5995, 1571, 1898, true],
  ["san-juan", "Сан-Хуан · Пуерто-Рико", -66.1057, 18.4655, 1521, 1898, true],
  ["malabo", "Санта-Ісабель · нині Малабо", 8.7371, 3.7504, 1900, 1968, true],
];
export const SPAIN_PLACES: AtlasPlace[] = cities.map(
  ([id, name, lng, lat, from, to, colonial]) => ({
    id: `es-city-${id}`,
    name,
    lng,
    lat,
    from,
    to,
    type: "city",
    spanish: true,
    colonial,
    dateLabel: `${from}–${to} · у цьому огляді`,
    description:
      "Місто як орієнтир відповідного історичного періоду; межі показу позначки не є датою заснування. Колоніальний осередок не означає безперервного фактичного контролю над усім навколишнім ареалом.",
    sources: ["spain-basemaps"],
  }),
);
export function spanishCampaignPlaces(date: AtlasDate): AtlasPlace[] {
  const key = atlasDateKey(date);
  const rows: [string, string, number, number, string, string, string][] = [
    [
      "guadalete",
      "Завоювання · район Гвадалете",
      -5.95,
      36.7,
      "0711-01-01",
      "0712-12-31",
      "spain-andalus",
    ],
    [
      "toledo",
      "Завоювання · Толедо",
      -4.0273,
      39.8628,
      "0712-01-01",
      "0718-12-31",
      "spain-andalus",
    ],
    [
      "covadonga",
      "Ковадонга · умовне датування 718–722",
      -5.055,
      43.308,
      "0718-01-01",
      "0722-12-31",
      "spain-reconquista",
    ],
    [
      "columbus",
      "Кариби · експедиція Колумба 1492",
      -74.5,
      24,
      "1492-10-12",
      "1492-12-31",
      "spain-columbus",
    ],
    [
      "melilla",
      "Мелілья · початок заколоту",
      -2.9381,
      35.2923,
      "1936-07-17",
      "1936-07-31",
      "spain-civil",
    ],
  ];
  return rows
    .filter(([, , , , from, to]) => key >= from && key <= to)
    .map(([id, name, lng, lat, from, to, source]) => ({
      id: `es-campaign-${id}`,
      name,
      lng,
      lat,
      from: Number(from.slice(0, 4)),
      to: Number(to.slice(0, 4)),
      type: "area",
      spanish: true,
      campaign: "battle",
      dateLabel: `${from} — ${to}`,
      description: "Осередок події, не контур держави або щоденного фактичного контролю.",
      sources: [source],
    }));
}
