import { atlasDateKey, parseAtlasDate, type AtlasDate } from "./date.ts";
import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
  type AtlasView,
} from "./model.ts";
export const COMMONWEALTH_YEARS = [
  1000, 1100, 1200, 1279, 1300, 1387, 1492, 1500, 1503, 1508, 1514, 1526, 1530, 1536, 1537, 1569,
  1600, 1618, 1629, 1649, 1651, 1652, 1654, 1655, 1658, 1660, 1667, 1672, 1700, 1715, 1771, 1772,
  1783, 1793, 1795, 1807, 1920, 1930, 1938, 1945, 1960, 1994,
] as const;
export type CommonwealthFrame = {
  year: number;
  date?: string;
  note: string;
  collection: HistoricalCollection;
};
export type CommonwealthData = { frames: CommonwealthFrame[] };
export const isCommonwealthView = (view: AtlasView) =>
  ["poland", "lithuania", "commonwealth", "cossacks"].includes(view);
/** Numeric callers request the end-of-year overview; the interactive atlas passes a full date. */
export const COMMONWEALTH_TRANSITIONS: Record<number, string> = {
  1772: "1772-08-05",
  1793: "1793-01-23",
  1795: "1795-10-24",
};
export function commonwealthSnapshot(date: number | AtlasDate) {
  const year = typeof date === "number" ? date : date.year;
  if (year < 1000 || year > 1994 || (year >= 1939 && year <= 1944)) return undefined;
  const key = atlasDateKey(typeof date === "number" ? { year, month: 12, day: 31 } : date);
  return [...COMMONWEALTH_YEARS]
    .reverse()
    .find((y) => (COMMONWEALTH_TRANSITIONS[y] ?? `${y}-01-01`) <= key);
}
export function validateCommonwealthData(raw: unknown): CommonwealthData {
  const d = raw as CommonwealthData;
  if (!d || !Array.isArray(d.frames) || d.frames.length !== COMMONWEALTH_YEARS.length)
    throw new Error("INVALID_COMMONWEALTH_DATA");
  d.frames.forEach((f, i) => {
    if (
      f.year !== COMMONWEALTH_YEARS[i] ||
      typeof f.note !== "string" ||
      f.collection?.type !== "FeatureCollection" ||
      !Array.isArray(f.collection.features)
    )
      throw new Error("INVALID_COMMONWEALTH_DATA");
    if (
      f.date !== COMMONWEALTH_TRANSITIONS[f.year] ||
      (f.date && (!parseAtlasDate(f.date) || Number(f.date.slice(0, 4)) !== f.year))
    )
      throw new Error("INVALID_COMMONWEALTH_DATA");
    if (f.year === 1807) {
      if (f.collection.features.length) throw new Error("INVALID_COMMONWEALTH_DATA");
      return;
    }
    validateHistoricalCollection(f.collection);
    const ids = new Set<string>();
    for (const p of f.collection.features) {
      if (
        p.properties.region !== "commonwealth" ||
        !p.id ||
        ids.has(String(p.id)) ||
        !p.properties.sourceId ||
        !p.properties.sourceUrl?.startsWith("https://") ||
        !["state", "land", "dependency", "occupation", "cossack"].includes(p.properties.layer ?? "")
      )
        throw new Error("INVALID_COMMONWEALTH_DATA");
      ids.add(String(p.id));
    }
  });
  return d;
}
export function commonwealthFrameAt(
  data: CommonwealthData | undefined,
  date: number | AtlasDate,
  options = { lands: true, occupations: true, cossacks: true },
): CommonwealthFrame | undefined {
  const year = typeof date === "number" ? date : date.year;
  const snapshot = commonwealthSnapshot(date);
  if (snapshot === undefined) return undefined;
  const f = data?.frames.find((f) => f.year === snapshot);
  if (!f) return undefined;
  return {
    ...f,
    collection: {
      ...f.collection,
      features: f.collection.features.filter(
        (p) =>
          (p.properties.validFrom === undefined || year >= p.properties.validFrom) &&
          (p.properties.validTo === undefined || year <= p.properties.validTo) &&
          (p.properties.layer !== "land" || options.lands) &&
          (p.properties.layer !== "occupation" || options.occupations) &&
          (p.properties.layer !== "cossack" || options.cossacks),
      ),
    },
  };
}
/** Replace only these polities; all existing atlas layers and custom edits survive. */
export function addCommonwealthLayer(
  base: HistoricalCollection | undefined,
  frame: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  if (!frame) return base;
  return {
    type: "FeatureCollection",
    features: [
      ...(base?.features ?? []).filter((f) => !isCoarseCommonwealth(f.properties.name)),
      ...frame.features,
    ],
  };
}
export const isCoarseCommonwealth = (name: string) =>
  /^(Poland|Kingdom of Poland|Lithuania|Grand Duchy of Lithuania|Poland-Lithuania|Polish[–-]Lithuanian Commonwealth)$/.test(
    name,
  );
export const COMMONWEALTH_SOURCES: AtlasSource[] = [
  {
    id: "pllt-second-partition",
    title: "ZPE — II rozbiór Polski",
    url: "https://zpe.gov.pl/a/przeczytaj/D9zrapLSC",
    note: "Конвенція 23 січня 1793 р.; наступне затвердження Гродненським сеймом — окрема подія.",
  },
  {
    id: "pllt-partitions",
    title: "Sneecs, Rowanwindwhistler — три поділи (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:ReparticionesDePolonia.svg",
    note: "Єдині контури восьми областей анексій 1772, 1793, 1795 рр.; рештки держави отримано відніманням уже анексованих земель. Геоприв’язка перевірена незалежними містами. Для Гданська, Торуня й Кракова виправлено локальну належність; 12-км міські ареали наближені, не точні округи.",
  },
  {
    id: "pllt-partition-history",
    title: "German Historical Institute — The Partitions of Poland, 1772–1795",
    url: "https://germanhistorydocs.org/en/the-holy-roman-empire-1648-1815/the-partitions-of-poland-1772-1795",
    note: "Перевірка розподілу земель та хронології конвенцій; Гданськ і Торунь лишилися в Речі Посполитій після першого поділу. Австрія не брала участі у другому.",
  },
  {
    id: "pllt-1490",
    title: "Mathiasrex, Halibutt, Rowanwindwhistler — Польща і ВКЛ 1490 (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:PJagiellon_countries_1490-es.svg",
    note: "Окремі політичні SVG-контури Корони, ВКЛ та ленників. Враховано порядок накладання; Молдавія не включена до Польщі.",
  },
  {
    id: "pllt-eastern-wars",
    title: "Grandiose, Rowanwindwhistler — східні зміни 1450–1600 (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:Polish-Lithuania_map_(1450-1600)-es.svg",
    note: "Датовані втрати ВКЛ 1494, 1503, 1514, 1536 та повернення Любеча 1508 і Гомеля 1537. Маски обрізані контуром ВКЛ 1490 р.; це не повна реконструкція південного степового контролю.",
  },

  {
    id: "pllt-garrisons",
    title: "Muzeum Podlaskie — шведська окупація Ельблонга",
    url: "https://muzeumpodlaskie.pl/nasze-muzeum/muzeum-cyfrowe/kolekcje-numizmatyczne/skarb-z-suchowolcow/",
    note: "Окупація Ельблонга 1655–1660 рр. На пізньому етапі Потопу гарнізони показані точками, без перенесення максимального ареалу окупації на всі наступні роки.",
  },
  {
    id: "pllt-torun",
    title: "TorunTour — Potop szwedzki w Toruniu 1655–1658",
    url: "https://toruntour.pl/5461/potopszwedzki-w-toruniu-1655-1658",
    note: "Шведський гарнізон залишив Торунь 30 грудня 1658 р.; позначка не переноситься на 1659 р.",
  },
  ...(
    [
      [
        "pllt-kosynsky",
        "Косинський",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CO%5CKosynskyKryshtof.htm",
      ],
      [
        "pllt-nalyvaiko",
        "Наливайко",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CN%5CA%5CNalyvaikoSeveryn.htm",
      ],
      [
        "pllt-zhmailo",
        "Жмайло",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CZ%5CH%5CZhmailoMarko.htm",
      ],
      [
        "pllt-fedorovych",
        "Тарас Федорович",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CF%5CE%5CFedorovychTaras.htm",
      ],
      [
        "pllt-sulyma",
        "Сулима",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CS%5CU%5CSulymaIvan.htm",
      ],
      [
        "pllt-pavliuk",
        "Павлюк",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CP%5CA%5CPavliukPavlo.htm",
      ],
      [
        "pllt-ostrianin",
        "Острянин",
        "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CO%5CS%5COstrianynYakiv.htm",
      ],
      [
        "pllt-bilatserkva",
        "Білоцерківська угода",
        "https://www.encyclopediaofukraine.com/pages/B/I/BilaTserkvaTreatyof.htm",
      ],
    ] as const
  ).map(([id, name, url]) => ({
    id,
    title: `Canadian Institute of Ukrainian Studies — ${name}`,
    url,
    note: "Біографія, датування й осередки відповідного козацького виступу або угоди.",
  })),

  {
    id: "pllt-basemaps",
    title: "André Ourednik — Historical Basemaps (GPL-3.0)",
    url: "https://github.com/aourednik/historical-basemaps/tree/da7a4b735ecef70aebdc9c73e409d8a2500d50f3",
    note: "Датовані зовнішні політичні контури; рання роздробленість і склад держав можуть бути узагальнені.",
  },
  {
    id: "pllt-1387",
    title: "Mathiasrex — Poland and Lithuania 1387 (CC BY 2.5)",
    url: "https://commons.wikimedia.org/wiki/File:Poland_and_Lithuania_1387.PNG",
    note: "Оцифрування кольорових контурів і геоприв’язка за містами; прямі володіння відокремлено від залежних.",
  },
  {
    id: "pllt-1569",
    title: "Halibutt, Mathiasrex, Rowanwindwhistler — Річ Посполита 1569 (CC BY-SA 3.0)",
    url: "https://commons.wikimedia.org/wiki/File:Rep%C3%BAblicaDeLasDosNaciones1569-es.svg",
    note: "Перенесення політичних SVG-контурів. Українські історичні землі — оглядові ареали, не точні воєводські або етнічні кордони. Авторів збережено в маніфесті.",
  },
  {
    id: "pllt-1618",
    title: "Grandiose, Rowanwindwhistler — Poland and Lithuania 1618–1667 (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:Map_of_Poland_and_Lithuania_(1618-1667)-es.svg",
    note: "Довоєнний юридичний контур і ленники; не карта щорічного фактичного контролю.",
  },
  {
    id: "pllt-deluge",
    title: "NordNordWest, Rowanwindwhistler — Swedish Deluge (CC BY-SA 4.0)",
    url: "https://commons.wikimedia.org/wiki/File:Territorial_changes_of_Poland_1655-es.svg",
    note: "Адаптований основний ареал окупації 1655–1657 рр.; попередні шведські володіння й українські ареали вилучені. Незахоплені фортеці виключено. Це сукупний ареал, не одночасний контроль.",
  },
  {
    id: "pllt-andrusovo",
    title: "Mathiasrex, Rowanwindwhistler — Андрусівське перемир’я 1667 (CC BY-SA 3.0)",
    url: "https://commons.wikimedia.org/wiki/File:Truce_of_Andrusovo_1667-es.svg",
    note: "Східні територіальні втрати та спільне польсько-московське підпорядкування Запорожжя до 1686 р.",
  },
  {
    id: "pllt-podolia",
    title: "Mathiasrex, Rowanwindwhistler — територіальні зміни 1672–1676 (CC BY-SA 3.0)",
    url: "https://commons.wikimedia.org/wiki/File:Polish%E2%80%93Lithuanian_Commonwealth_as_a_fief_of_the_Ottoman_Empire_1672-1676-es.svg",
    note: "Використано територіальний контур та втрату Поділля. Назва оригіналу не означає, що вся Річ Посполита тут показана як реалізований османський васал.",
  },
  {
    id: "pllt-lublin",
    title: "Visuotinė lietuvių enciklopedija — Liublino unija",
    url: "https://www.vle.lt/straipsnis/liublino-unija/",
    note: "Унія 1569 р., передання Волині, Київщини, Брацлавщини та Підляшшя Короні; збереження інституцій ВКЛ.",
  },
  {
    id: "pllt-history",
    title: "Canadian Institute of Ukrainian Studies — History of Ukraine",
    url: "https://www.encyclopediaofukraine.com/History.asp",
    note: "Литовсько-польський період, козацька держава, Руїна та поділи українських земель.",
  },
  {
    id: "pllt-cossacks",
    title: "Canadian Institute of Ukrainian Studies — Cossacks",
    url: "https://www.encyclopediaofukraine.com/pages/C/O/Cossacks.htm",
    note: "Хронологія повстань 1591–1638 рр., Хмельниччина та козацький устрій. Позначки означають осередки подій, не державні кордони.",
  },
  {
    id: "pllt-zboriv",
    title: "НаУКМА — Утвердження політичного статусу Гетьманщини",
    url: "https://ekmair.ukma.edu.ua/items/034b5e89-32c0-455f-ab27-e2bab5184ab3",
    note: "Зборівська угода 1649 р. — автономія в Київському, Чернігівському та Брацлавському воєводствах; зміна статусу 1654 р.",
  },
  {
    id: "pllt-zpe",
    title: "Zintegrowana Platforma Edukacyjna — Potop szwedzki",
    url: "https://zpe.gov.pl/a/potop-szwedzki/D195SQOlB",
    note: "Війна 1655–1660, захоплені міста, оборона нездобутих фортець і Олівський мир. Межі окупації не тотожні маршрутам військ.",
  },
];
const eventRows: [number, string, string, string][] = [
  [
    1000,
    "Польща за П’ястів",
    "Показано датований оглядовий зріз. Уділи й мінливий середньовічний контроль не є сучасними кордонами.",
    "pllt-basemaps",
  ],
  [
    1253,
    "Коронація Міндовга",
    "Формування Литовської держави; перший доступний географічний зріз цього шару — 1279 р.",
    "pllt-history",
  ],
  [
    1362,
    "Сині Води та розширення ВКЛ",
    "У другій половині XIV ст. Київщина, Поділля й інші руські землі опинилися під владою ВКЛ; дати й характер підпорядкування різнилися.",
    "pllt-history",
  ],
  [
    1385,
    "Кревська унія",
    "Династичний союз Польщі й Литви. Це ще не Річ Посполита 1569 р.; держави показані окремо.",
    "pllt-history",
  ],
  [
    1387,
    "Галичина під польською короною",
    "Закріплення польської влади в Галичині. На карті окремо показано Корону, ВКЛ і залежні землі за зрізом 1387 р.",
    "pllt-1387",
  ],
  [
    1569,
    "Люблінська унія",
    "Корона й ВКЛ утворили Річ Посполиту. Волинь, Київщина та Брацлавщина перейшли до Корони; Берестейщина й Пінщина лишилися у ВКЛ.",
    "pllt-lublin",
  ],
  [
    1591,
    "Повстання Криштофа Косинського",
    "1591–1593: один із перших великих козацьких виступів. Позначки прив’язані до років подій.",
    "pllt-cossacks",
  ],
  [
    1594,
    "Повстання Северина Наливайка",
    "1594–1596: Брацлавщина, Правобережжя та похід у білоруські землі; завершення боротьби біля Лубен.",
    "pllt-cossacks",
  ],
  [1625, "Повстання Марка Жмайла", "Козацький виступ і Куруківська угода 1625 р.", "pllt-cossacks"],
  [
    1630,
    "Повстання Тараса Федоровича",
    "Бої під Корсунем і Переяславом; Переяславська угода 1630 р.",
    "pllt-cossacks",
  ],
  [
    1635,
    "Виступ Івана Сулими",
    "Зруйнування щойно зведеної фортеці Кодак; виступ придушено.",
    "pllt-cossacks",
  ],
  [
    1637,
    "Повстання Павлюка",
    "Виступ 1637 р.; головні бої біля Кумейок і Боровиці.",
    "pllt-cossacks",
  ],
  [
    1638,
    "Повстання Острянина й Гуні",
    "Козацький виступ 1638 р., бої на Лівобережжі та наступне обмеження козацького самоврядування.",
    "pllt-cossacks",
  ],
  [
    1648,
    "Хмельниччина",
    "Початок козацько-польської війни. Жовті Води, Корсунь, Пилявці й походи до Львова та Замостя показані як події 1648 р.",
    "pllt-cossacks",
  ],
  [
    1649,
    "Зборівська угода й Гетьманщина",
    "Автономія охоплювала Київське, Брацлавське й Чернігівське воєводства; оглядову територію позначено окремим штрихом.",
    "pllt-zboriv",
  ],
  [
    1651,
    "Берестечко й Білоцерківська угода",
    "Після поразки договірна територія козацької автономії звузилася до Київського воєводства; це не стабільний фронт на весь рік.",
    "pllt-history",
  ],
  [
    1652,
    "Батіг",
    "Перемога козацького війська змінила становище після Білоцерківської угоди; оглядова територія автономії відновлена в окремому зрізі.",
    "pllt-history",
  ],
  [
    1654,
    "Переяславська рада й московська протекція",
    "Зміна зовнішньополітичної орієнтації Гетьманщини та початок московсько-польської війни. Не вся українська територія стала безпосередньо керованою Москвою.",
    "pllt-history",
  ],
  [
    1655,
    "Шведський потоп",
    "Шведську окупацію позначено синім штрихуванням. Основний сукупний ареал 1655–1657 не є картою одночасного контролю кожного міста.",
    "pllt-zpe",
  ],
  [
    1658,
    "Гадяцька угода",
    "Проєкт Великого князівства Руського в оновленій федерації не реалізувався в повному обсязі; запроєктовані землі не показані як завершена держава.",
    "pllt-history",
  ],
  [
    1660,
    "Олівський мир",
    "Завершення війни Речі Посполитої зі Швецією. Максимальний окупаційний ареал приховано; залишковий гарнізон в Ельблонгу позначено точкою як епізод 1660 р.",
    "pllt-zpe",
  ],
  [
    1667,
    "Андрусівське перемир’я",
    "Поділ українських земель між Річчю Посполитою та Московією; Лівобережжя й Київ відійшли під владу царя. Запорожжя — під спільне підпорядкування.",
    "pllt-andrusovo",
  ],
  [
    1672,
    "Османське завоювання Поділля",
    "Кам’янець і Поділля перейшли під османське управління; це окремий окупаційний ареал, не вся Річ Посполита.",
    "pllt-podolia",
  ],
  [
    1686,
    "Вічний мир",
    "Закріплення поділу й московського підпорядкування Запорожжя; попереднє спільне підпорядкування припинилося.",
    "pllt-history",
  ],
  [
    1699,
    "Карловицький мир",
    "Поділля повернулося Речі Посполитій; наступний наявний зовнішній географічний зріз — 1700 р.",
    "pllt-history",
  ],
  [
    1702,
    "Повстання Семена Палія",
    "Козацьке повстання на Правобережжі 1702–1704 рр. і короткочасне об’єднання з Лівобережжям під владою Івана Мазепи.",
    "pllt-cossacks",
  ],
  [
    1768,
    "Коліївщина",
    "Гайдамацьке повстання на Правобережжі. Осередок в Умані не є кордоном окремої держави.",
    "pllt-history",
  ],
  [
    1772,
    "Перший поділ Речі Посполитої",
    "Галичину анексували Габсбурги, північно-східні землі — Росія, Королівську Пруссію без Гданська й Торуня — Пруссія. Мапа змінюється від конвенції 5 серпня 1772 р.",
    "pllt-partition-history",
  ],
  [
    1793,
    "Другий поділ",
    "Росія анексувала більшість Правобережжя й центральні білоруські землі; Пруссія — Велику Польщу, Гданськ і Торунь. Габсбурги в цьому поділі участі не брали. Конвенція 23 січня 1793 р.",
    "pllt-partition-history",
  ],
  [
    1795,
    "Третій поділ",
    "Рештки держави поділили Росія, Пруссія та Габсбурги. Від конвенції 24 жовтня 1795 р. на мапі показано анексовані землі; контуру Речі Посполитої вже немає.",
    "pllt-partition-history",
  ],
  [
    1920,
    "Міжвоєнні держави й українські землі",
    "Польща й Литва знову показані як окремі держави. Зріз 1920 р. є оглядовим і не відтворює щоденні фронти воєн 1918–1921 рр.",
    "pllt-basemaps",
  ],
  [
    1939,
    "Початок Другої світової війни",
    "Зріз 1938 р. приховано для 1939–1944: окупаційні зони цього часу тут не реконструйовані.",
    "pllt-history",
  ],
  [
    1991,
    "Відновлення незалежності України й Литви",
    "Сучасні держави не переносяться в середньовічні епохи; останній наявний географічний зріз — 1994 р.",
    "pllt-history",
  ],
];
export const COMMONWEALTH_EVENTS: AtlasEvent[] = eventRows.map(
  ([year, title, description, source]) => ({
    year,
    ...(COMMONWEALTH_TRANSITIONS[year]
      ? {
          month: Number(COMMONWEALTH_TRANSITIONS[year].slice(5, 7)),
          day: Number(COMMONWEALTH_TRANSITIONS[year].slice(8, 10)),
        }
      : {}),
    title,
    description,
    sources: [source],
    europe: true,
    ruthenian: true,
  }),
);
export const COMMONWEALTH_PERIODS = [
  {
    from: 395,
    to: 999,
    title: "Перед доступними зрізами Польщі й Литви",
    description:
      "Перший оглядовий політичний контур Польщі — 1000 р.; ВКЛ ще не показано як сучасну Литву.",
    sources: ["pllt-basemaps"],
  },
  {
    from: 1000,
    to: 1384,
    title: "П’ястівська Польща й формування Литви",
    description:
      "Зрізи 1000, 1100, 1200, 1279 і 1300. Роздробленість та межі впливу узагальнені; передбачених майбутніх завоювань немає.",
    sources: ["pllt-basemaps", "pllt-history"],
  },
  {
    from: 1385,
    to: 1568,
    title: "Польща й ВКЛ у династичній унії",
    description:
      "Це окремі держави. Галичина пов’язана з Короною, Волинь, Київщина й Брацлавщина — з ВКЛ. Дата останнього зрізу вказана окремо; не кожен рік має нову геометрію.",
    sources: ["pllt-1490", "pllt-eastern-wars", "pllt-lublin"],
  },
  {
    from: 1569,
    to: 1590,
    title: "Річ Посполита після Люблінської унії",
    description:
      "Федерація Корони й ВКЛ зі збереженням окремих установ. Основні українські землі перейшли до Корони; історичні ареали позначено окремо.",
    sources: ["pllt-lublin", "pllt-1569"],
  },
  {
    from: 1591,
    to: 1647,
    title: "Козацькі повстання кінця XVI — першої половини XVII ст.",
    description:
      "Косинський, Наливайко, Жмайло, Федорович, Сулима, Павлюк, Острянин і Гуня. Осередки показуються лише в роки відповідного виступу.",
    sources: ["pllt-cossacks"],
  },
  {
    from: 1648,
    to: 1653,
    title: "Хмельниччина та постання Гетьманщини",
    description:
      "Війна, Зборівська автономія, звуження договірної території 1651 р. й відновлення козацьких позицій. Штрихування автономії не є точною лінією фронту.",
    sources: ["pllt-zboriv", "pllt-history"],
  },
  {
    from: 1654,
    to: 1659,
    title: "Козацька держава, московсько-польська війна й Потоп",
    description:
      "Різні форми підпорядкування не зливаються. Синій штрих — основний сукупний ареал шведської окупації 1655–1657; бірюзовий — козацька автономія. У 1658–1659 сукупний шведський ареал уже приховано; залишкові гарнізони показані точками.",
    sources: ["pllt-zpe", "pllt-zboriv", "pllt-history"],
  },
  {
    from: 1660,
    to: 1666,
    title: "Після Потопу та перед Андрусівським перемир’ям",
    description:
      "Війну зі Швецією завершено, проте козацькі й московсько-польські війни тривали. Правовий контур не означає прямого контролю Корони над Гетьманщиною.",
    sources: ["pllt-zpe", "pllt-history"],
  },
  {
    from: 1667,
    to: 1699,
    title: "Поділ українських земель і османське Поділля",
    description:
      "Андрусівський поділ 1667 р.; Поділля під османським управлінням 1672–1699. Спільне підпорядкування Запорожжя припинилося 1686 р.",
    sources: ["pllt-andrusovo", "pllt-podolia", "pllt-history"],
  },
  {
    from: 1700,
    to: 1771,
    title: "Річ Посполита XVIII ст. та Правобережжя",
    description:
      "Оглядові зрізи 1700 і 1715; повстання Палія та гайдамацькі виступи позначені як події. Їхні осередки не є самостійними державними кордонами.",
    sources: ["pllt-cossacks", "pllt-history"],
  },
  {
    from: 1772,
    to: 1794,
    title: "Поділи Речі Посполитої",
    description:
      "Окремі зрізи показують Перший і Другий поділи. Переходи відбуваються 05.08.1772 та 23.01.1793 — за датами конвенцій; зайняття й ратифікації тривали довше.",
    sources: ["pllt-partitions", "pllt-partition-history"],
  },
  {
    from: 1795,
    to: 1919,
    title: "Після поділів",
    description:
      "До 24.10.1795 показано стан після Другого поділу, від цієї дати — розподіл решток держави. Цей зріз діє до 1806 р.; з 1807 р. детальний шар вимкнено, щоб не переносити межі поділів на всі зміни XIX ст.",
    sources: ["pllt-history"],
  },
  {
    from: 1920,
    to: 1938,
    title: "Міжвоєнні Польща й Литва",
    description:
      "Окремі держави та українські землі у складі міжвоєнної Польщі. Зрізи 1920, 1930, 1938; фронти й спірні статуси 1920 р. узагальнені.",
    sources: ["pllt-basemaps"],
  },
  {
    from: 1939,
    to: 1944,
    title: "Друга світова війна",
    description:
      "Довоєнні контури приховано: вони не відтворюють німецьку й радянську окупаційні зони.",
    sources: ["pllt-history"],
  },
  {
    from: 1945,
    to: 1994,
    title: "Повоєнний період і відновлена незалежність",
    description:
      "Зрізи 1945, 1960 і 1994. Литовська РСР може не бути виділена окремо в оглядовому радянському контурі. Вільна Литва знову представлена зрізом 1994.",
    sources: ["pllt-basemaps"],
  },
];
const cityRows: [string, string, number, number, number, number, boolean, boolean, boolean][] = [
  ["krakow", "Краків", 19.9445, 50.0647, 1000, 1994, true, false, false],
  ["warsaw", "Варшава", 21.0122, 52.2297, 1279, 1994, true, false, false],
  ["vilnius", "Вільнюс / Вільно", 25.2797, 54.6872, 1279, 1994, false, true, false],
  ["trakai", "Тракай", 24.934, 54.639, 1279, 1795, false, true, false],
  ["kaunas", "Каунас", 23.904, 54.898, 1279, 1994, false, true, false],
  ["lublin", "Люблін", 22.5684, 51.2465, 1100, 1994, true, false, false],
  ["lviv", "Львів", 24.0316, 49.8429, 1387, 1938, true, false, true],
  ["lutsk", "Луцьк · Волинь", 25.3254, 50.7472, 1279, 1994, false, true, true],
  ["kyiv", "Київ · Київщина", 30.523, 50.45, 1279, 1994, false, true, true],
  ["bratslav", "Брацлав · Брацлавщина", 28.941, 48.821, 1387, 1994, false, true, true],
  ["kamianets", "Кам’янець · Поділля", 26.583, 48.684, 1387, 1994, true, false, true],
  ["chernihiv", "Чернігів · Сіверщина", 31.3, 51.498, 1279, 1994, false, true, true],
  ["chigirin", "Чигирин · гетьманська столиця", 32.649, 49.083, 1648, 1676, false, false, true],
  ["brest", "Берестя · ВКЛ після 1569", 23.6877, 52.0976, 1387, 1794, false, true, true],
  ["pinsk", "Пінськ · ВКЛ після 1569", 26.0951, 52.1229, 1387, 1794, false, true, true],
];
export const COMMONWEALTH_PLACES: AtlasPlace[] = cityRows.map(
  ([id, name, lng, lat, from, to, polish, lithuanian, ruthenian]) => ({
    id: `pllt-city-${id}`,
    name,
    lng,
    lat,
    from,
    to,
    type: "city",
    dateLabel: "Історичний осередок; належність залежить від обраного року",
    description:
      "Позначка міста й історичної землі. Політичну належність дивіться за датованим територіальним шаром; ця позначка не задає кордонів.",
    sources: ["pllt-history"],
    europe: true,
    commonwealth: true,
    polish,
    lithuanian,
    ruthenian,
  }),
);
type Uprising = {
  id: string;
  name: string;
  from: number;
  to: number;
  points: [string, number, number, number?, number?][];
  source?: string;
};
export const COSSACK_UPRISINGS: Uprising[] = [
  {
    id: "kosynsky",
    name: "Повстання Косинського",
    from: 1591,
    to: 1593,
    points: [
      ["Біла Церква", 30.112, 49.796, 1591, 1592],
      ["Черкаси", 32.06, 49.444, 1593, 1593],
    ],
  },
  {
    id: "nalyvaiko",
    name: "Повстання Наливайка",
    from: 1594,
    to: 1596,
    points: [
      ["Брацлав", 28.941, 48.821, 1594, 1594],
      ["Луцьк", 25.3254, 50.7472, 1595, 1595],
      ["Слуцьк", 27.559, 53.027, 1595, 1595],
      ["Лубни / Солониця", 33.01, 50.0, 1596, 1596],
    ],
  },
  {
    id: "zhmailo",
    name: "Повстання Жмайла",
    from: 1625,
    to: 1625,
    points: [["Курукове озеро — район подій", 33.45, 49.04]],
  },
  {
    id: "fedorovych",
    name: "Повстання Тараса Федоровича",
    from: 1630,
    to: 1630,
    points: [
      ["Корсунь", 31.28, 49.42],
      ["Переяслав", 31.459, 50.065],
    ],
  },
  {
    id: "sulyma",
    name: "Виступ Івана Сулими",
    from: 1635,
    to: 1635,
    points: [["Кодак", 35.137, 48.381]],
  },
  {
    id: "pavliuk",
    name: "Повстання Павлюка",
    from: 1637,
    to: 1637,
    points: [
      ["Кумейки", 31.76, 49.6],
      ["Боровиця — район подій", 32.59, 49.21],
    ],
  },
  {
    id: "ostrianin",
    name: "Повстання Острянина й Гуні",
    from: 1638,
    to: 1638,
    points: [
      ["Говтва", 33.8, 49.41],
      ["Жовнин", 32.69, 49.39],
    ],
  },
  {
    id: "khmelnytsky",
    name: "Хмельниччина",
    from: 1648,
    to: 1648,
    points: [
      ["Жовті Води — район битви", 33.5, 48.347],
      ["Корсунь", 31.28, 49.42],
      ["Пилявці", 27.48, 49.58],
      ["Львів — облога", 24.0316, 49.8429],
      ["Замостя — облога", 23.251, 50.723],
    ],
  },
  {
    id: "zboriv",
    name: "Кампанія 1649 р.",
    from: 1649,
    to: 1649,
    points: [
      ["Збараж", 25.778, 49.665],
      ["Зборів", 25.148, 49.663],
    ],
  },
  {
    id: "berestechko",
    name: "Кампанія 1651 р.",
    from: 1651,
    to: 1651,
    points: [
      ["Берестечко", 25.11, 50.35],
      ["Біла Церква — угода", 30.112, 49.796],
    ],
  },
  {
    id: "batih",
    name: "Битва під Батогом",
    from: 1652,
    to: 1652,
    points: [["Батіг — район битви", 29.113, 48.574]],
  },
  {
    id: "palii",
    name: "Повстання Палія",
    from: 1702,
    to: 1704,
    points: [
      ["Фастів", 29.918, 50.078],
      ["Біла Церква", 30.112, 49.796],
      ["Немирів", 28.843, 48.97],
    ],
  },
  {
    id: "koliivshchyna",
    name: "Коліївщина",
    from: 1768,
    to: 1768,
    points: [["Умань", 30.221, 48.75]],
    source: "pllt-history",
  },
];
export function cossackPlacesAt(year: number): AtlasPlace[] {
  return COSSACK_UPRISINGS.filter((u) => year >= u.from && year <= u.to).flatMap((u) =>
    u.points
      .map<AtlasPlace>(([name, lng, lat, from = u.from, to = u.to], i) => ({
        id: `pllt-uprising-${u.id}-${i}`,
        name: `${name} · ${u.name}`,
        type: "area",
        from,
        to,
        lat,
        lng,
        dateLabel: from === to ? String(from) : `${from}–${to}`,
        description:
          "Осередок повстання або кампанії в зазначений проміжок. Координати історичного району приблизні; кілька позначок не означають одночасного контролю чи точного маршруту.",
        sources: [
          u.source ??
            ([
              "kosynsky",
              "nalyvaiko",
              "zhmailo",
              "fedorovych",
              "sulyma",
              "pavliuk",
              "ostrianin",
            ].includes(u.id)
              ? `pllt-${u.id}`
              : "pllt-cossacks"),
        ],
        europe: true,
        ruthenian: true,
        commonwealth: true,
        polish: true,
        cossack: true,
        campaign: "battle",
      }))
      .filter((p) => year >= p.from && year <= p.to),
  );
}

export function occupationPlacesAt(year: number): AtlasPlace[] {
  return [
    {
      id: "torun",
      name: "Торунь",
      lng: 18.5984,
      lat: 53.0138,
      from: 1655,
      to: 1658,
      source: "pllt-torun",
    },
    {
      id: "elblag",
      name: "Ельблонг",
      lng: 19.4088,
      lat: 54.1561,
      from: 1655,
      to: 1660,
      source: "pllt-garrisons",
    },
  ]
    .filter((p) => year >= p.from && year <= p.to)
    .map((p) => ({
      id: `pllt-garrison-${p.id}`,
      name: `${p.name} · шведський гарнізон`,
      type: "area",
      lng: p.lng,
      lat: p.lat,
      from: p.from,
      to: p.to,
      dateLabel: `${p.from}–${p.to}`,
      description:
        "Окремий шведський гарнізон протягом зазначених років або частини останнього року. Точка не означає окупацію всієї довколишньої землі.",
      sources: [p.source],
      europe: true,
      commonwealth: true,
      polish: true,
      occupation: true,
    }));
}
