import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";
export const FRANCE_YEARS = [
  843, 870, 881, 888, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715,
  1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994,
] as const;
export type FranceData = {
  frames: { year: number; sourceUrl: string; sourceId: string; collection: HistoricalCollection }[];
};
export function franceSnapshot(year: number) {
  if (year < 843 || year > 1994) return undefined;
  return [...FRANCE_YEARS].reverse().find((y) => y <= year);
}
export function validateFranceData(raw: unknown): FranceData {
  const d = raw as FranceData;
  if (!d?.frames || d.frames.length !== FRANCE_YEARS.length) throw new Error("INVALID_FRANCE_DATA");
  d.frames.forEach((f, i) => {
    validateHistoricalCollection(f.collection);
    if (
      f.year !== FRANCE_YEARS[i] ||
      !f.collection.features.length ||
      f.collection.features.some(
        (p) => p.properties.region !== "france" || p.properties.sourceYear !== f.year,
      )
    )
      throw new Error("INVALID_FRANCE_DATA");
  });
  return d;
}
export function addFranceLayer(
  base: HistoricalCollection | undefined,
  frame: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  if (!frame) return base;
  return {
    type: "FeatureCollection",
    features: [
      ...(base?.features ?? []).filter(
        (f) =>
          !["France", "Kingdom of France"].includes(f.properties.name) &&
          !(
            f.properties.region === "franks" &&
            (f.properties.name.startsWith("West Francia") ||
              f.properties.name === "Disputed Aquitaine")
          ),
      ),
      ...frame.features,
    ],
  };
}
export const FRANCE_SOURCES: AtlasSource[] = [
  {
    id: "france-capet",
    title: "BnF — Hugues Capet (987–996)",
    url: "https://catalogue.bnf.fr/ark:/12148/cb12049595b",
    note: "Датування правління Гуго Капета.",
  },
  {
    id: "france-hundred-years",
    title: "BnF — La guerre de Cent Ans",
    url: "https://essentiels.bnf.fr/fr/article/6e6e48ab-6af5-4e58-8167-e2914a0b0098-guerre-cent-ans",
    note: "Англо-французькі війни 1337–1453.",
  },
  {
    id: "france-basemaps",
    title: "France — Historical Basemaps (GPL-3.0)",
    url: "https://github.com/aourednik/historical-basemaps",
    note: "Датовані оглядові полігони, Європа без колоній. У ранніх зрізах не відокремлено королівський домен від усіх васальних володінь. Дати й незмінні посилання на джерела наведено в маніфесті.",
  },
  {
    id: "france-verdun",
    title: "Grand Verdun — Le Traité de Verdun",
    url: "https://www.verdun.fr/connaitre-ma-ville-et-mon-agglo/ville/les-archives-municipales/terre-dhistoire/le-traite-de-verdun/",
    note: "Верденський поділ 843 року та Західна Франкія.",
  },
  {
    id: "france-regimes",
    title: "Assemblée nationale — Les régimes politiques depuis 1789",
    url: "https://www.assemblee-nationale.fr/gouv_parl/regimes.asp",
    note: "Хронологія революції, республік, імперій та реставрацій.",
  },
  {
    id: "france-constitutions",
    title: "Élysée — Les textes fondateurs",
    url: "https://www.elysee.fr/la-presidence/les-textes-fondateurs",
    note: "Установчі тексти та Конституція 1958 року.",
  },
  {
    id: "france-treaties",
    title: "France Diplomatie — Traités et accords",
    url: "https://www.diplomatie.gouv.fr/fr/archives-bibliotheque/s-orienter-dans-les-fonds-et-collections/traites-et-accords",
    note: "Архів договорів, зокрема Утрехтського миру й Віденського конгресу.",
  },
  {
    id: "france-alsace",
    title: "Archives d’Alsace — L’annexion par l’Allemagne (1871–1918)",
    url: "https://archives.alsace.eu/votre-recherche/histoire-de-lalsace/histoire-de-lalsace-en-videos/lannexion-par-lallemagne-1871-1918/",
    note: "Ельзас і частина Лотарингії: анексія та повернення.",
  },
];
export const FRANCE_EVENTS: AtlasEvent[] = [
  [
    843,
    "Західна Франкія",
    "Верденський договір розділив Каролінзьку імперію; західне королівство стало попередником Франції.",
    "france-verdun",
  ],
  [
    987,
    "Початок династії Капетингів",
    "Обрання Гуго Капета. Королівська влада ще не означала прямого управління всім королівством.",
    "france-capet",
  ],
  [
    1337,
    "Початок Столітньої війни",
    "Династичний конфлікт Франції й Англії; лінії фактичного контролю змінювалися.",
    "france-hundred-years",
  ],
  [
    1453,
    "Завершення Столітньої війни",
    "Французька корона відновила контроль над більшістю англійських володінь у Франції. Кале залишалося англійським.",
    "france-hundred-years",
  ],
  [
    1713,
    "Утрехтський мир",
    "Договори завершили основну частину війни за іспанську спадщину.",
    "france-treaties",
  ],
  [1789, "Французька революція", "Революція змінила політичний устрій країни.", "france-regimes"],
  [1792, "Перша республіка", "Скасування монархії та республіканський період.", "france-regimes"],
  [
    1804,
    "Перша імперія",
    "Наполеон Бонапарт став імператором; на мапі показані лише наявні датовані джерела.",
    "france-regimes",
  ],
  [
    1815,
    "Після Наполеона",
    "Віденське врегулювання й реставрація Бурбонів; територія імперії не переноситься в наступні епохи.",
    "france-treaties",
  ],
  [1848, "Друга республіка", "Лютнева революція повалила Липневу монархію.", "france-regimes"],
  [1852, "Друга імперія", "Луї-Наполеон став імператором Наполеоном III.", "france-regimes"],
  [1870, "Третя республіка", "Падіння Другої імперії під час війни з Пруссією.", "france-regimes"],
  [
    1871,
    "Втрата Ельзасу й частини Лотарингії",
    "Анексовані Німеччиною території повернулися до Франції після Першої світової війни.",
    "france-alsace",
  ],
  [
    1918,
    "Повернення Ельзасу й Лотарингії",
    "Завершився період німецької анексії 1871–1918 років.",
    "france-alsace",
  ],
  [
    1940,
    "Поразка й окупація",
    "Окупація та режим Віші. Динамічні окупаційні зони 1940–1944 тут не реконструйовані; зріз 1938 не є картою контролю воєнного часу.",
    "france-regimes",
  ],
  [
    1946,
    "Четверта республіка",
    "Повоєнне відновлення республіканських інституцій і нова конституція.",
    "france-constitutions",
  ],
  [
    1958,
    "П’ята республіка",
    "Нова конституція встановила інституції П’ятої республіки.",
    "france-constitutions",
  ],
].map(([year, title, description, source]) => ({
  year: Number(year),
  title: String(title),
  description: String(description),
  sources: [String(source)],
  europe: true,
}));
export const FRANCE_PERIODS = [
  {
    from: 395,
    to: 842,
    title: "Перед Західною Франкією",
    description:
      "Для раннішого періоду використовуйте франкський шар спільної мапи. Франція не показана в сучасних межах.",
    sources: ["fr-dhs"],
  },
  {
    from: 843,
    to: 986,
    title: "Західна Франкія",
    description:
      "Західне королівство після Верденського поділу. Джерельні зрізи 843, 870, 881, 888; зміни між ними не інтерполюються.",
    sources: ["france-verdun", "fr-843"],
  },
  {
    from: 987,
    to: 1336,
    title: "Капетинзька Франція",
    description:
      "Феодальне королівство та посилення корони. Оглядовий полігон не є картою лише королівського домену: васалітет і прямий контроль можуть поєднуватися.",
    sources: ["france-basemaps", "fr-dhs"],
  },
  {
    from: 1337,
    to: 1453,
    title: "Столітня війна",
    description:
      "Кордони та англійські володіння показані за наявним зрізом, не як щорічний фронт війни.",
    sources: ["france-basemaps"],
  },
  {
    from: 1454,
    to: 1788,
    title: "Французьке королівство",
    description:
      "Територіальне зростання монархії. Європейські володіння показано без колоній; кожна геометрія має власну дату джерела.",
    sources: ["france-basemaps", "france-treaties"],
  },
  {
    from: 1789,
    to: 1814,
    title: "Революція та Наполеон",
    description:
      "Зміни режимів і війни. Зріз 1800 року не показує максимального розширення імперії 1812 року.",
    sources: ["france-regimes", "france-basemaps"],
  },
  {
    from: 1815,
    to: 1870,
    title: "Реставрація, республіка й Друга імперія",
    description:
      "Режими змінювалися; контури оновлюються лише на датах наявних джерел. Найближчий пізніший зріз — 1878.",
    sources: ["france-regimes", "france-treaties"],
  },
  {
    from: 1871,
    to: 1918,
    title: "Франція після Франкфуртського миру",
    description:
      "Ельзас і частина Лотарингії анексовані Німеччиною. Перший наявний післявоєнний зріз — 1920.",
    sources: ["france-alsace"],
  },
  {
    from: 1919,
    to: 1939,
    title: "Міжвоєнна Франція",
    description: "Повернення Ельзасу й Лотарингії та міжвоєнні зрізи 1920, 1930, 1938.",
    sources: ["france-alsace", "france-basemaps"],
  },
  {
    from: 1940,
    to: 1944,
    title: "Окупація та Віші",
    description:
      "Детальний шар Франції приховано: доступний зріз 1938 не описує окупаційні зони й фактичний контроль під час війни.",
    sources: ["france-regimes"],
  },
  {
    from: 1945,
    to: 1994,
    title: "Повоєнна Франція",
    description:
      "Зрізи 1945, 1960, 1994; Четверта й П’ята республіки. Європейська територія без заморських володінь.",
    sources: ["france-constitutions", "france-basemaps"],
  },
];
export const FRANCE_PLACES: AtlasPlace[] = [
  {
    id: "france-paris",
    name: "Париж",
    type: "city",
    from: 843,
    to: 1994,
    lat: 48.857,
    lng: 2.352,
    dateLabel: "Історичний осередок Франції",
    description:
      "Королівський і республіканський політичний осередок; позначка міста не задає кордонів держави.",
    sources: ["france-regimes"],
    europe: true,
    french: true,
    capital: true,
  },
];
