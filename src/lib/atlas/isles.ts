import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";

export const ISLES_MIN_YEAR = 395;
export const ISLES_MAX_YEAR = 1994;
export const ISLES_YEARS = [
  395, 500, 600, 800, 886, 927, 1014, 1066, 1171, 1284, 1472, 1542, 1603, 1707, 1801, 1922, 1994,
] as const;
export const ISLES_VIEWS = ["isles", "ireland", "scotland", "wales", "england"] as const;
export type IslesView = (typeof ISLES_VIEWS)[number];
export type IslesFrame = { year: number; note: string; collection: HistoricalCollection };
export type IslesData = Record<IslesView, IslesFrame[]>;

export function isBritishView(view: string): view is IslesView {
  return (ISLES_VIEWS as readonly string[]).includes(view);
}
export function clampIslesYear(value: number) {
  const year = Number.isFinite(value) ? Math.round(value) : 1000;
  return Math.max(ISLES_MIN_YEAR, Math.min(ISLES_MAX_YEAR, year));
}
export function islesSnapshot(year: number) {
  if (year < ISLES_MIN_YEAR || year > ISLES_MAX_YEAR) return undefined;
  return [...ISLES_YEARS].reverse().find((y) => y <= year);
}
export function validateIslesData(raw: unknown): IslesData {
  const data = raw as IslesData;
  for (const view of ISLES_VIEWS) {
    const frames = data?.[view];
    if (!frames || frames.length !== ISLES_YEARS.length) throw new Error("INVALID_ISLES_DATA");
    frames.forEach((frame, index) => {
      validateHistoricalCollection(frame.collection);
      if (frame.year !== ISLES_YEARS[index] || !frame.note) throw new Error("INVALID_ISLES_DATA");
      const ids = new Set<string>();
      for (const feature of frame.collection.features) {
        const id = String(feature.id ?? "");
        const p = feature.properties;
        if (
          !id ||
          ids.has(id) ||
          p.region !== "isles" ||
          p.sourceYear !== frame.year ||
          !p.description ||
          !p.color?.startsWith("#") ||
          !p.sourceUrl?.startsWith("https://") ||
          (p.control !== "direct" && p.control !== "relative")
        )
          throw new Error("INVALID_ISLES_DATA");
        ids.add(id);
      }
    });
  }
  return data;
}

export const ISLES_SOURCES: AtlasSource[] = [
  {
    id: "isles-eh",
    title: "English Heritage — Story of England",
    url: "https://www.english-heritage.org.uk/learn/story-of-england/",
    note: "Опора для римської Британії, англосаксонських королівств і Нормандського завоювання. Полігони атласу схематичні, не зняті з їхніх карт.",
  },
  {
    id: "isles-nmi",
    title: "National Museum of Ireland",
    url: "https://www.museum.ie/",
    note: "Орієнтир для ранньої Ірландії, вікінгів і пізнішого королівства. Межі п’ятин на мапі навчальні.",
  },
  {
    id: "isles-nms",
    title: "National Museums Scotland",
    url: "https://www.nms.ac.uk/",
    note: "Пікти, Альба, королівство Шотландія й острови. Внутрішні лінії не є щорічними кордонами.",
  },
  {
    id: "isles-mw",
    title: "Amgueddfa Cymru — Museum Wales",
    url: "https://museum.wales/",
    note: "Вельські королівства, марки й князівство після 1284 року.",
  },
  {
    id: "isles-parl",
    title: "UK Parliament — Acts of Union",
    url: "https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/",
    note: "Унії 1707 і 1801 років: Велика Британія, потім Сполучене Королівство з Ірландією.",
  },
  {
    id: "isles-tna",
    title: "The National Archives — Irish partition",
    url: "https://www.nationalarchives.gov.uk/education/resources/irish-partition/",
    note: "Поділ острова 1920–1922 років. Донегол лишається поза Північною Ірландією.",
  },
  {
    id: "isles-empire",
    title: "The National Archives — Colonies and dependencies from 1782",
    url: "https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/colonies-and-dependencies-from-1782/",
    note: "Орієнтир для колоній після 1782 року. Контури імперії в атласі схематичні, не зняті з архівної карти.",
  },
];

type Period = { from: number; to: number; title: string; description: string; sources: string[] };
const IRELAND_PERIODS: Period[] = [
  {
    from: 395,
    to: 599,
    title: "Ірландія поза Римом",
    description:
      "Острів не був римською провінцією. На ранніх зрізах його ще не розбито на п’ятини: наступна докладна мапа — 600 рік.",
    sources: ["isles-nmi"],
  },
  {
    from: 600,
    to: 840,
    title: "П’ятини й менші королівства",
    description:
      "Улад, Айлех, Айргіалла, Брейфне, Коннахт, Міде, Ленстер, Осрайге й Манстер. Це схема, не межа одного року.",
    sources: ["isles-nmi"],
  },
  {
    from: 841,
    to: 1168,
    title: "Королівства і скандинавські міста",
    description:
      "Дублін, Ватерфорд і Лімерик — окремі міста, не цілі провінції. Навіть за верховенства Браяна Бору сусіди на мапі лишаються.",
    sources: ["isles-nmi"],
  },
  {
    from: 1169,
    to: 1541,
    title: "Сеньйорія і гельські землі",
    description:
      "Після 1169–1171 років англійська влада тримає схід і частину півдня. Захід і північ Ольстеру ще в гельських володарів.",
    sources: ["isles-nmi", "isles-eh"],
  },
  {
    from: 1542,
    to: 1602,
    title: "Королівство без усього острова",
    description:
      "1542 року Ірландію проголошено королівством англійської корони. Гельські володарі на мапі ще окремо, до кінця Дев’ятилітньої війни.",
    sources: ["isles-nmi", "isles-parl"],
  },
  {
    from: 1603,
    to: 1800,
    title: "Окреме королівство в унії корон",
    description:
      "Королівство Ірландія лишається окремим від Англії і, з 1707 року, від Великої Британії. Плантації змінюють владу на місцях, але це не показано як новий кордон.",
    sources: ["isles-parl", "isles-nmi"],
  },
  {
    from: 1801,
    to: 1921,
    title: "В унії зі Сполученим Королівством",
    description: "Акт унії 1800 року приєднує королівство до Сполученого Королівства Великої Британії та Ірландії.",
    sources: ["isles-parl"],
  },
  {
    from: 1922,
    to: 1994,
    title: "Поділ острова",
    description:
      "З 1922 року південь — Ірландська Вільна держава, згодом Ірландія. Північна Ірландія лишається у Сполученому Королівстві. Донегол не входить до півночі.",
    sources: ["isles-tna"],
  },
];
const SCOTLAND_PERIODS: Period[] = [
  {
    from: 395,
    to: 599,
    title: "Північ за валом",
    description: "Землі на північ від валу Адріана ще не зведені в королівство Альба. Оркні й Шетланд показані окремо.",
    sources: ["isles-nms", "isles-eh"],
  },
  {
    from: 600,
    to: 842,
    title: "Пікти, Дал Ріада і Стратклайд",
    description: "Три осередки на північ від англійської Нортумбрії. Лоуленд коло Единбурга ще в Нортумбрії.",
    sources: ["isles-nms"],
  },
  {
    from: 843,
    to: 1030,
    title: "Альба",
    description:
      "Від середини IX століття пікти й скотти складають Альбу. Стратклайд тримається ще на зрізі 1014 року і зникає з мапи до 1066-го.",
    sources: ["isles-nms"],
  },
  {
    from: 1031,
    to: 1265,
    title: "Королівство без Гебрид",
    description: "Шотландія вже включає Стратклайд. Королівство Островів і Північні острови ще пов’язані з Норвегією.",
    sources: ["isles-nms"],
  },
  {
    from: 1266,
    to: 1471,
    title: "Гебриди шотландські",
    description: "Пертський договір 1266 року передає Гебриди Шотландії. Оркні й Шетланд лишаються норвезькими до 1468–1472 років.",
    sources: ["isles-nms"],
  },
  {
    from: 1472,
    to: 1706,
    title: "Королівство Шотландія",
    description: "Острови зібрані. З 1603 року корона спільна з Англією, але королівство на мапі ще окреме.",
    sources: ["isles-nms", "isles-parl"],
  },
  {
    from: 1707,
    to: 1994,
    title: "У Великій Британії",
    description: "Унія 1707 року. На мапі Шотландії далі видно її територію вже як частину Великої Британії, а з 1801-го — Сполученого Королівства.",
    sources: ["isles-parl"],
  },
];
const WALES_PERIODS: Period[] = [
  {
    from: 395,
    to: 409,
    title: "Римська Британія",
    description: "Вельс входить до провінції на південь від валу. Окремі королівства з’являться на зрізі 600 року.",
    sources: ["isles-eh", "isles-mw"],
  },
  {
    from: 410,
    to: 599,
    title: "Після Риму",
    description: "Адміністрація пішла. Цей зріз не малює Гвінед чи Повіс заднім числом.",
    sources: ["isles-mw"],
  },
  {
    from: 600,
    to: 1066,
    title: "Королівства Вельсу",
    description: "Гвінед, Повіс, Дівед, Кередігіон, пізніше Дехейбарт, Морганнуг і Гвент. Межі схематичні.",
    sources: ["isles-mw"],
  },
  {
    from: 1067,
    to: 1283,
    title: "Марки і незалежний Гвінед",
    description: "Нормандські лорди беруть південь і схід. Гвінед і частина Дехейбарта ще тримаються до завоювання 1282–1283 років.",
    sources: ["isles-mw", "isles-eh"],
  },
  {
    from: 1284,
    to: 1535,
    title: "Князівство англійської корони",
    description: "Статут Рудлана. Це вже не окреме королівство: штрих означає залежність від англійської корони.",
    sources: ["isles-mw"],
  },
  {
    from: 1536,
    to: 1994,
    title: "У королівстві Англії, потім Британії",
    description:
      "Закони 1536–1542 років включають Вельс до англійської системи. На мапі територія й далі окреслена, щоб її не губити серед більшої держави.",
    sources: ["isles-mw", "isles-parl"],
  },
];
const ENGLAND_PERIODS: Period[] = [
  {
    from: 395,
    to: 409,
    title: "Римська провінція",
    description: "Britannia на південь від валу Адріана. Вельс у цей момент ще частина тієї самої провінції, на англійській мапі показано лише її англійську частку.",
    sources: ["isles-eh"],
  },
  {
    from: 410,
    to: 599,
    title: "Після відходу адміністрації",
    description: "Королівства ще не розведені. Гептархія починається на зрізі 600 року.",
    sources: ["isles-eh"],
  },
  {
    from: 600,
    to: 865,
    title: "Гептархія",
    description: "Кент, Сассекс, Ессекс, Східна Англія, Вессекс, Мерсія, Нортумбрія і ще Думнонія на південному заході.",
    sources: ["isles-eh"],
  },
  {
    from: 866,
    to: 926,
    title: "Дейнло і Вессекс",
    description: "Після договору близько 886 року схід і північ — Дейнло, південь — Вессекс, західна Мерсія під його зверхністю. Корнуол ще окремо.",
    sources: ["isles-eh"],
  },
  {
    from: 927,
    to: 1065,
    title: "Королівство Англія",
    description: "Ательстан збирає королівство. Вельс, Шотландія й Ірландія до нього не входять.",
    sources: ["isles-eh"],
  },
  {
    from: 1066,
    to: 1706,
    title: "Королівство після Нормандії",
    description:
      "З 1066 року нова династія. Нормандські острови лишаються за короною. Шотландія до 1707 року — інше королівство, навіть за спільної корони з 1603-го.",
    sources: ["isles-eh", "isles-parl"],
  },
  {
    from: 1707,
    to: 1994,
    title: "Велика Британія і Сполучене Королівство",
    description: "Унія з Шотландією 1707 року, з Ірландією 1801-го. З 1922 року Ірландія на півдні знову окрема держава.",
    sources: ["isles-parl", "isles-tna"],
  },
];
const ALL_PERIODS: Period[] = [
  {
    from: 395,
    to: 409,
    title: "Рим і сусіди",
    description: "Південь острова — провінція, північ і Ірландія — ні. Мен і Нормандські острови показані окремо.",
    sources: ["isles-eh", "isles-nmi"],
  },
  {
    from: 410,
    to: 599,
    title: "Після Риму",
    description: "Один зріз на колишню провінцію. Королівства не вигадані раніше за 600 рік.",
    sources: ["isles-eh"],
  },
  {
    from: 600,
    to: 865,
    title: "Королівства островів",
    description: "Англійські, вельські, ірландські й північні держави одночасно. Це навчальна схема кількох традицій, не одна карта одного літописця.",
    sources: ["isles-eh", "isles-nmi", "isles-nms", "isles-mw"],
  },
  {
    from: 866,
    to: 926,
    title: "Дейнло, Альба, скандинавські міста",
    description: "Вессекс і Дейнло в Англії, Альба в Шотландії, Дублін, Ватерфорд і Лімерик в Ірландії.",
    sources: ["isles-eh", "isles-nmi", "isles-nms"],
  },
  {
    from: 927,
    to: 1065,
    title: "Англія зібрана, сусіди ні",
    description: "Королівство Англія не поглинає Вельс, Альбу чи ірландські королівства. Стратклайд ще окремий.",
    sources: ["isles-eh", "isles-nms"],
  },
  {
    from: 1066,
    to: 1168,
    title: "Після 1066 року",
    description: "Англія нормандська. Шотландія включає Стратклайд. Гебриди й Мен ще з Норвегією. Ірландські королівства на місці.",
    sources: ["isles-eh", "isles-nms", "isles-nmi"],
  },
  {
    from: 1169,
    to: 1283,
    title: "Сеньйорія і марки",
    description: "Англійська влада входить у Ірландію і південь Вельсу. Гвінед, Коннахт і Айлех ще читаються окремо.",
    sources: ["isles-eh", "isles-mw", "isles-nmi"],
  },
  {
    from: 1284,
    to: 1541,
    title: "Вельс під короною",
    description: "Князівство Вельсу залежне. Гебриди вже шотландські. Оркні переходять до Шотландії на зрізі 1472 року.",
    sources: ["isles-mw", "isles-nms", "isles-nmi"],
  },
  {
    from: 1542,
    to: 1602,
    title: "Три корони поруч",
    description: "Англія, Шотландія і нове королівство Ірландія. Гельські землі Ірландії ще заштриховані як неповний контроль.",
    sources: ["isles-parl", "isles-nmi"],
  },
  {
    from: 1603,
    to: 1706,
    title: "Спільна корона, різні королівства",
    description: "Яків VI і I не зливає держави. На мапі Англія, Шотландія й Ірландія лишаються трьома кольорами.",
    sources: ["isles-parl"],
  },
  {
    from: 1707,
    to: 1800,
    title: "Велика Британія",
    description: "Англія і Шотландія — одна держава. Ірландія ще окреме королівство. Мен — коронне володіння.",
    sources: ["isles-parl"],
  },
  {
    from: 1801,
    to: 1921,
    title: "Сполучене Королівство з Ірландією",
    description: "Унія 1801 року збирає Британію й Ірландію. Мен і Нормандські острови не стають графствами.",
    sources: ["isles-parl"],
  },
  {
    from: 1922,
    to: 1994,
    title: "Дві держави на островах",
    description: "Ірландія і Сполучене Королівство. Північна Ірландія лишається в королівстві.",
    sources: ["isles-tna"],
  },
];
const PERIODS: Record<IslesView, Period[]> = {
  ireland: IRELAND_PERIODS,
  scotland: SCOTLAND_PERIODS,
  wales: WALES_PERIODS,
  england: ENGLAND_PERIODS,
  isles: ALL_PERIODS,
};
export function islesPeriod(view: IslesView, year: number) {
  return PERIODS[view].find((p) => year >= p.from && year <= p.to) ?? PERIODS[view].at(-1)!;
}

const EVENT_ROWS: (AtlasEvent & { views: IslesView[] })[] = [
  {
    year: 410,
    title: "Кінець римської адміністрації",
    description: "Війська й уряд провінції більше не тримають південь. Королівства наступного зрізу ще попереду.",
    sources: ["isles-eh"],
    views: ["england", "wales", "isles"],
  },
  {
    year: 793,
    title: "Напад на Ліндісфарн",
    description: "Початок вікінгських походів. Окремі скандинавські держави на мапі з’являться зі зрізом 886 року.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 841,
    title: "Довговічний табір у Дубліні",
    description: "Скандинавське місто стає окремим осередком, не замість усього Ленстеру.",
    sources: ["isles-nmi"],
    views: ["ireland", "isles"],
  },
  {
    year: 843,
    title: "Альба",
    description: "Традиційна дата спілки піктів і скоттів. На мапі Альба змінює Піктленд зі зрізу 886 року.",
    sources: ["isles-nms"],
    views: ["scotland", "isles"],
  },
  {
    year: 886,
    title: "Договір Альфреда і Гутрума",
    description: "Орієнтир межі Дейнло. Лінія на мапі схематична.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 927,
    title: "Королівство Англія",
    description: "Ательстан. Вельс і Шотландія цим актом не поглинуті.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1014,
    title: "Клонтарф",
    description: "Браян Бору розбиває дублінсько-лейнстерську коаліцію і гине. Ірландія не стає однією державою.",
    sources: ["isles-nmi"],
    views: ["ireland", "isles"],
  },
  {
    year: 1066,
    title: "Нормандське завоювання",
    description: "Вільгельм бере Англію. Шотландія й ірландські королівства цим не скасовані.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1154,
    title: "Анжуйські володіння у Франції",
    description:
      "Генріх II тримає Нормандію, Мен, Анжу й Аквітанію разом з Англією. На спільній мапі це окремі землі, не одна пляма поверх Франції.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1204,
    title: "Втрата Нормандії",
    description:
      "Філіпп II забирає Нормандію, Мен і Анжу. Гасконь лишається англійським ф’єфом — на мапі вона заштрихована.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1453,
    title: "Кінець Столітньої війни",
    description: "Аквітанію втрачено. З континенту лишається Кале, до 1558 року.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1558,
    title: "Втрата Кале",
    description:
      "Останнє англійське місто у Франції переходить до Франції. До перших тривких колоній заморський шар порожній.",
    sources: ["isles-eh"],
    views: ["england", "isles"],
  },
  {
    year: 1655,
    title: "Колонії в Америці",
    description: "Тринадцять колоній і Вест-Індія. Це схема узбереж, не межа кожного поселення.",
    sources: ["isles-empire"],
    views: ["england", "isles"],
  },
  {
    year: 1763,
    title: "Після Семилітньої війни",
    description: "Канада, Флорида і Бенгалія. Флорида повернеться Іспанії після 1783 року.",
    sources: ["isles-empire"],
    views: ["england", "isles"],
  },
  {
    year: 1783,
    title: "Незалежність США",
    description: "Тринадцять колоній і Флорида зникають з британського шару. Канада й Бенгалія лишаються.",
    sources: ["isles-empire"],
    views: ["england", "isles"],
  },
  {
    year: 1858,
    title: "Британська Індія",
    description:
      "Після повстання 1857 року управління Індією переходить короні. На мапі це одна схема, не кожне князівство.",
    sources: ["isles-empire"],
    views: ["isles"],
  },
  {
    year: 1947,
    title: "Незалежність Індії",
    description:
      "Індія виходить з імперії. Канада, Австралія і Нова Зеландія на цьому зрізі вже не зафарбовані як колонії.",
    sources: ["isles-empire"],
    views: ["isles"],
  },
  {
    year: 1169,
    title: "Початок англійської Ірландії",
    description: "Спершу Ленстер і Дублін, не весь острів. Сеньйорія на зрізі 1171 року.",
    sources: ["isles-nmi", "isles-eh"],
    views: ["ireland", "isles"],
  },
  {
    year: 1266,
    title: "Пертський договір",
    description: "Гебриди переходять від Норвегії до Шотландії. На мапі це видно зі зрізу 1284 року.",
    sources: ["isles-nms"],
    views: ["scotland", "isles"],
  },
  {
    year: 1284,
    title: "Статут Рудлана",
    description: "Вельс стає князівством англійської корони.",
    sources: ["isles-mw"],
    views: ["wales", "england", "isles"],
  },
  {
    year: 1314,
    title: "Беннокберн",
    description: "Шотландія відбиває спробу англійського короля її підпорядкувати. Кордон королівства від цієї битви не перекроюється.",
    sources: ["isles-nms"],
    views: ["scotland", "isles"],
  },
  {
    year: 1472,
    title: "Оркні й Шетланд",
    description: "Північні острови входять до шотландської корони.",
    sources: ["isles-nms"],
    views: ["scotland", "isles"],
  },
  {
    year: 1542,
    title: "Королівство Ірландія",
    description: "Титул корони на весь острів. Реальний контроль гельського заходу на цьому зрізі ще окремий.",
    sources: ["isles-nmi", "isles-parl"],
    views: ["ireland", "isles"],
  },
  {
    year: 1603,
    title: "Особиста унія",
    description: "Один король в Англії і Шотландії. Дві держави на мапі не зливаються.",
    sources: ["isles-parl"],
    views: ["england", "scotland", "isles"],
  },
  {
    year: 1707,
    title: "Унія Англії і Шотландії",
    description: "Королівство Велика Британія. Ірландія ще осторонь.",
    sources: ["isles-parl"],
    views: ["england", "scotland", "wales", "isles"],
  },
  {
    year: 1801,
    title: "Унія з Ірландією",
    description: "Сполучене Королівство Великої Британії та Ірландії.",
    sources: ["isles-parl"],
    views: ["ireland", "england", "isles"],
  },
  {
    year: 1922,
    title: "Поділ Ірландії",
    description: "Вільна держава і Північна Ірландія. Донегол не входить до півночі.",
    sources: ["isles-tna"],
    views: ["ireland", "isles"],
  },
];
export function islesEventsFor(view: IslesView): AtlasEvent[] {
  return EVENT_ROWS.filter((e) => e.views.includes(view)).map(({ views: _views, ...event }) => event);
}

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
  flags: { irish?: boolean; scottish?: boolean; welsh?: boolean; english?: boolean },
  capital = false,
): AtlasPlace {
  return {
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
    isles: true,
    capital,
    ...flags,
  };
}
export const ISLES_PLACES: AtlasPlace[] = [
  place("london", "Лондон", 51.51, -0.13, 395, 1994, "від римського Londinium", "Орієнтир міста. У 600 році околиця ближче до Ессексу, з 886-го — до Вессексу, далі — столиця королівства.", ["isles-eh"], { english: true }, true),
  place("canterbury", "Кентербері", 51.28, 1.08, 597, 1994, "місія Августина з 597 року", "Осередок Кенту і пізнішої англійської церкви. Не позначає кордон королівства.", ["isles-eh"], { english: true }),
  place("york", "Йорк", 53.96, -1.08, 395, 1994, "Eboracum, потім столиця Нортумбрії", "Римське місто, далі Нортумбрія і Дейнло. Точка не є валом Адріана.", ["isles-eh"], { english: true }),
  place("winchester", "Вінчестер", 51.06, -1.31, 600, 1200, "осередок Вессексу", "Місто Вессексу. Не плутати з пізнішою столицею в Лондоні.", ["isles-eh"], { english: true }),
  place("dublin", "Дублін", 53.35, -6.26, 841, 1994, "скандинавське місто, потім столиця", "Спершу окреме місто вікінгів, з 1171 року в сеньйорії, далі столиця вільної держави й Ірландії.", ["isles-nmi"], { irish: true }, true),
  place("armagh", "Арма", 54.35, -6.65, 500, 1600, "церковний осередок", "Орієнтир Айргіалли й церковної традиції, не політична столиця всього острова.", ["isles-nmi"], { irish: true }),
  place("cashel", "Кашель", 52.52, -7.89, 600, 1170, "осередок Манстеру", "Королівський осередок Манстеру, зокрема за Браяна Бору.", ["isles-nmi"], { irish: true }),
  place("galway", "Голвей", 53.27, -9.05, 600, 1994, "Коннахт", "Орієнтир Коннахту. У 1171 році ще поза сеньйорією.", ["isles-nmi"], { irish: true }),
  place("belfast", "Белфаст", 54.6, -5.93, 1600, 1994, "пізніше — головне місто півночі", "На ранніх зрізах це земля Улада. Як місто Північної Ірландії читається після поділу.", ["isles-tna", "isles-nmi"], { irish: true }),
  place("edinburgh", "Единбург", 55.95, -3.19, 600, 1994, "спершу Нортумбрія, потім Альба", "У 600–886 роках ще в нортумбрійському Лоуленді. Зі зрізу 927 року — Альба, далі Шотландія.", ["isles-nms"], { scottish: true }, true),
  place("glasgow", "Глазго", 55.86, -4.25, 600, 1994, "Стратклайд", "Осередок Стратклайда, доки королівство не входить до Шотландії.", ["isles-nms"], { scottish: true }),
  place("inverness", "Інвернесс", 57.48, -4.22, 600, 1994, "північ", "Орієнтир земель піктів, потім Альби й Шотландії.", ["isles-nms"], { scottish: true }),
  place("kirkwall", "Керкволл", 58.98, -2.96, 600, 1994, "Оркні", "Осередок Північних островів до їхнього переходу Шотландії в 1468–1472 роках.", ["isles-nms"], { scottish: true }),
  place("bangor", "Бангор", 53.18, -4.06, 600, 1600, "Гвінед", "Орієнтир Гвінеду на північному узбережжі. Точку зсунуто на суходіл маски.", ["isles-mw"], { welsh: true }),
  place("cardiff", "Кардіфф", 51.48, -3.18, 600, 1994, "Морганнуг, потім марки", "У ранньому зрізі Морганнуг, з 1171 року — марки, далі князівство.", ["isles-mw"], { welsh: true }, true),
  place("st-davids", "Сент-Дейвідс", 51.88, -5.27, 600, 1284, "Дівед / Дехейбарт", "Церковний осередок південного заходу. Не є кордоном королівства.", ["isles-mw"], { welsh: true }),
  place("douglas", "Дуглас", 54.15, -4.48, 600, 1994, "острів Мен", "Мен то в Королівстві Островів, то окреме коронне володіння. Це не англійське графство.", ["isles-nms", "isles-eh"], { english: true, scottish: true }),
];

export const OVERSEAS_YEARS = [
  1066, 1154, 1204, 1360, 1375, 1420, 1453, 1655, 1707, 1763, 1783, 1858, 1922, 1947, 1968, 1994,
] as const;
export type OverseasFrame = { year: number; note: string; collection: HistoricalCollection };
export type OverseasData = { frames: OverseasFrame[] };

/** No English land in France between the loss of Calais and the first lasting colonies. */
export function overseasSnapshot(year: number) {
  if (year < 1066 || year > ISLES_MAX_YEAR) return undefined;
  if (year >= 1558 && year < 1655) return undefined;
  return [...OVERSEAS_YEARS].reverse().find((y) => y <= year);
}
export function validateOverseasData(raw: unknown): OverseasData {
  const data = raw as OverseasData;
  if (!data?.frames || data.frames.length !== OVERSEAS_YEARS.length)
    throw new Error("INVALID_OVERSEAS_DATA");
  data.frames.forEach((frame, index) => {
    validateHistoricalCollection(frame.collection);
    if (frame.year !== OVERSEAS_YEARS[index] || !frame.note) throw new Error("INVALID_OVERSEAS_DATA");
    for (const feature of frame.collection.features) {
      const p = feature.properties;
      if (
        p.region !== "isles" ||
        p.sourceYear !== frame.year ||
        !p.description ||
        !p.color?.startsWith("#") ||
        !p.sourceUrl?.startsWith("https://")
      )
        throw new Error("INVALID_OVERSEAS_DATA");
    }
  });
  return data;
}

const COARSE_BRITAIN = /^(England|Scotland|Anglo-Saxons|Scots|Angevin Empire|English territory)$/;

/** Draw the islands and overseas possessions on the shared map, instead of the coarse overview blobs. */
export function overlayBritishIsles(
  base: HistoricalCollection | undefined,
  islands: HistoricalCollection | undefined,
  overseas: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  const kept = (base?.features ?? []).filter((f) => !COARSE_BRITAIN.test(f.properties.name));
  const extra = [...(islands?.features ?? []), ...(overseas?.features ?? [])];
  if (!kept.length && !extra.length) return undefined;
  if (!extra.length) return base && kept.length === base.features.length ? base : { type: "FeatureCollection", features: kept };
  return { type: "FeatureCollection", features: [...kept, ...extra] };
}

