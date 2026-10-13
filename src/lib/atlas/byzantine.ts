import type { AtlasEvent, AtlasPlace, AtlasSource, HistoricalCollection } from "./model";

export type ByzantineFrame = {
  year: number;
  sourceFilename: string;
  sourceUrl: string;
  collection: HistoricalCollection;
  raster: {
    path: string;
    bounds: [[number, number], [number, number]];
    width: number;
    height: number;
  };
};
export type ByzantineData = { frames: ByzantineFrame[] };
export const BYZANTINE_SOURCES: AtlasSource[] = [
  {
    id: "lucius",
    title: "Lucius — Historical maps of the Byzantine Empire",
    url: "https://lucius-note.net/byzantium/",
    note: "Джерело завантажених PNG. Контури оцифровані через градусну сітку; авторські підписи збережені в растровому шарі. ©Lucius; окремої відкритої ліцензії не заявлено.",
  },
  {
    id: "tib",
    title: "Tabula Imperii Byzantini — Austrian Academy of Sciences",
    url: "https://tib.oeaw.ac.at/digtib",
    note: "Академічна топографія Візантії для подальшого звіряння місць; не джерело готових полігонів цього шару.",
  },
  {
    id: "byz-early",
    title: "University of Vienna — Europe around 450",
    url: "https://data1.geo.univie.ac.at/projects/dasantlitzdesfremden/maps/map2%3Flanguage=en.html",
    note: "Контекст поділу імперії та гунського об’єднання у V столітті.",
  },
  {
    id: "byz-justinian",
    title: "Metropolitan Museum — The Byzantine State under Justinian I",
    url: "https://www.metmuseum.org/essays/the-byzantine-state-under-justinian-i-justinian-the-great",
    note: "Відвоювання Юстиніана та середземноморський контекст VI століття.",
  },
  {
    id: "byz-siege",
    title: "Ivan Marić — When was Constantine V born? (2021)",
    url: "https://doiserbia.nb.rs/Article.aspx?id=0584-98882158007M",
    note: "Дослідження наративних джерел і контексту облоги Константинополя 717–718 років.",
  },
  {
    id: "byz-basil",
    title: "Predrag Komatina — Archbishopric of Ohrid in the charters of Basil II (2023)",
    url: "https://doiserbia.nb.rs/Article.aspx?id=0584-98882302789K",
    note: "Грамоти 1019–1025 років і церковна організація підкорених болгарських земель.",
  },
  {
    id: "byz-restoration",
    title: "Metropolitan Museum — Byzantium: Faith and Power",
    url: "https://www.metmuseum.org/exhibitions/listings/2004/byzantium-faith-and-power",
    note: "Повернення Константинополя 1261 року та пізньовізантійський культурний контекст.",
  },
  {
    id: "byz-1453",
    title: "Panorama 1453 History Museum",
    url: "https://www.panoramikmuze.com/Eng/Index",
    note: "Офіційний музей: захоплення Константинополя 29 травня 1453 року.",
  },
];
export const BYZANTINE_PERIODS = [
  {
    from: 395,
    to: 564,
    title: "Східна Римська імперія",
    description:
      "Східна частина зберігає імперську владу після поділу 395 року та розпаду західного імперського уряду. Карти раннього періоду розрізняють східне і західне управління.",
    sources: ["lucius", "byz-early"],
  },
  {
    from: 565,
    to: 716,
    title: "Від Юстиніана до арабських завоювань",
    description:
      "Зріз 565 року відображає відвоювання Юстиніана. Війни з Персією та подальші арабські завоювання змінюють території в Африці й на Сході; показано лише датовані стани джерела.",
    sources: ["lucius", "byz-justinian"],
  },
  {
    from: 717,
    to: 1024,
    title: "Феми та відновлення імперії",
    description:
      "Константинополь витримав облогу 717–718 років. Авторські карти показують адміністративні осередки, провінції та феми; ці різні рівні управління не слід ототожнювати з кордонами держав.",
    sources: ["lucius", "byz-siege"],
  },
  {
    from: 1025,
    to: 1203,
    title: "Василій II та доба Комнінів",
    description:
      "Зріз 1025 року — кінець правління Василія II, після підкорення Болгарського царства. Пізніші зрізи відображають втрату й часткове повернення володінь. Докладні феми та міста доступні в авторському шарі.",
    sources: ["lucius", "byz-basil"],
  },
  {
    from: 1204,
    to: 1261,
    title: "Держави після Четвертого хрестового походу",
    description:
      "Після захоплення Константинополя 1204 року Нікея, Епір і Трапезунд є окремими центрами влади. На карті 1230 року жовтим позначена Фессалонікійська імперія, а не єдина Візантія.",
    sources: ["lucius", "met-byzantium"],
  },
  {
    from: 1262,
    to: 1453,
    title: "Палеологи та пізні візантійські держави",
    description:
      "Константинополь повернуто 1261 року, проте Трапезунд та інші утворення зберігають окрему політичну історію. Зріз 1453 року показує володіння до захоплення столиці 29 травня, а не стан після падіння імперії.",
    sources: ["lucius", "byz-restoration", "byz-1453"],
  },
];
export const BYZANTINE_EVENTS: AtlasEvent[] = [
  {
    year: 395,
    title: "Поділ імперського управління",
    description:
      "Після смерті Феодосія I управління переходить до східної та західної імперських частин.",
    sources: ["byz-early", "lucius"],
    europe: true,
  },
  {
    year: 565,
    title: "Кінець правління Юстиніана I",
    description:
      "Карта відображає відвоювання в Італії, Північній Африці та західному Середземномор’ї.",
    sources: ["byz-justinian", "lucius"],
    europe: true,
  },
  {
    year: 718,
    title: "Завершення облоги Константинополя",
    description:
      "Після приблизно річної облоги арабські війська відступають; місто залишається імперським центром.",
    sources: ["byz-siege"],
    europe: true,
  },
  {
    year: 1025,
    title: "Зріз кінця правління Василія II",
    description:
      "Болгарські землі під імперською владою; грамоти Василія II визначають церковну організацію навколо Охрида.",
    sources: ["byz-basil", "lucius"],
    europe: true,
  },
  {
    year: 1453,
    title: "Захоплення Константинополя",
    description:
      "29 травня османські війська захоплюють столицю. Векторний зріз 1453 у цьому атласі відповідає стану до цієї події.",
    sources: ["byz-1453", "lucius"],
    europe: true,
  },
];
// Reference locations, NOT automatically classified as Byzantine possessions.
export const BYZANTINE_PLACES: AtlasPlace[] = [
  ["constantinople", "Константинополь", 41.0082, 28.9784, true],
  ["thessalonica", "Фессалоніка", 40.6401, 22.9444, false],
  ["nicaea", "Нікея", 40.4292, 29.7211, false],
  ["trebizond", "Трапезунд", 41.0027, 39.7168, false],
  ["antioch", "Антіохія", 36.2028, 36.1604, false],
  ["alexandria", "Александрія", 31.2001, 29.9187, false],
  ["ravenna", "Равенна", 44.4184, 12.2035, false],
  ["carthage", "Карфаген", 36.8528, 10.3233, false],
  ["dyrrhachium", "Диррахій", 41.3236, 19.4542, false],
  ["ani", "Ані", 40.5075, 43.5726, false],
  ["athens", "Афіни", 37.9838, 23.7275, false],
  ["heraklion", "Кандія / Іракліон", 35.3387, 25.1442, false],
].map(([id, name, lat, lng, capital]) => ({
  id: `byz-${id}`,
  name: String(name),
  lat: Number(lat),
  lng: Number(lng),
  capital: Boolean(capital),
  type: "city",
  from: 395,
  to: 1453,
  europe: true,
  byzantine: true,
  dateLabel: "Географічний орієнтир у серії карт 395–1453",
  description:
    "Місто позначене як історичний географічний орієнтир. Його наявність у цьому шарі не означає належність до імперії протягом усього періоду; конкретний стан звіряйте з датованим контуром та оригіналом карти.",
  sources: ["lucius", "tib"],
}));
