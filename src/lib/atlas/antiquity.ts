import {
  validateHistoricalCollection,
  type AtlasEvent,
  type AtlasPlace,
  type AtlasSource,
  type HistoricalCollection,
} from "./model.ts";

export const ANTIQUITY_MIN_YEAR = -500;
export const ANTIQUITY_YEARS = [-500, -323, -270, -201, -146, -27, 117, 285] as const;
export type AntiquityFrame = { year: number; note: string; collection: HistoricalCollection };
export type AntiquityData = { frames: AntiquityFrame[] };

export function clampSharedYear(value: number) {
  const year = Number.isFinite(value) ? Math.round(value) : 117;
  return Math.max(ANTIQUITY_MIN_YEAR, Math.min(1994, year));
}
export function formatAtlasYear(year: number, uk = true) {
  if (year < 0) return uk ? `${-year} до н. е.` : `${-year} BCE`;
  return String(year);
}
/** Last antiquity frame at or before the year. The layer stops where the existing atlas begins. */
export function antiquitySnapshot(year: number) {
  if (year < ANTIQUITY_MIN_YEAR || year >= 395) return undefined;
  return [...ANTIQUITY_YEARS].reverse().find((y) => y <= year);
}
export function validateAntiquityData(raw: unknown): AntiquityData {
  const data = raw as AntiquityData;
  if (!data?.frames || data.frames.length !== ANTIQUITY_YEARS.length) throw new Error("INVALID_ANTIQUITY_DATA");
  data.frames.forEach((frame, index) => {
    validateHistoricalCollection(frame.collection);
    if (frame.year !== ANTIQUITY_YEARS[index] || !frame.note) throw new Error("INVALID_ANTIQUITY_DATA");
    const ids = new Set<string>();
    for (const feature of frame.collection.features) {
      const id = String(feature.id ?? "");
      const p = feature.properties;
      if (
        !id ||
        ids.has(id) ||
        p.region !== "antiquity" ||
        p.sourceYear !== frame.year ||
        !p.description ||
        !p.color?.startsWith("#") ||
        !p.sourceUrl?.startsWith("https://") ||
        (p.control !== "direct" && p.control !== "relative")
      )
        throw new Error("INVALID_ANTIQUITY_DATA");
      ids.add(id);
    }
  });
  return data;
}
export function overlayAntiquity(
  base: HistoricalCollection | undefined,
  extra: HistoricalCollection | undefined,
): HistoricalCollection | undefined {
  if (!extra?.features.length) return base;
  return { type: "FeatureCollection", features: [...(base?.features ?? []), ...extra.features] };
}

export const ANTIQUITY_SOURCES: AtlasSource[] = [
  {
    id: "antiquity-republic",
    title: "The Metropolitan Museum of Art — The Roman Republic",
    url: "https://www.metmuseum.org/essays/the-roman-republic",
    note: "Опора для республіки: від малого міста до провінцій. Полігони атласу схематичні.",
  },
  {
    id: "antiquity-empire",
    title: "The Metropolitan Museum of Art — The Roman Empire (27 B.C.–393 A.D.)",
    url: "https://www.metmuseum.org/essays/the-roman-empire-27-b-c-393-a-d",
    note: "Принципат і пізня єдина імперія. Межі не зняті з музейної карти.",
  },
  {
    id: "antiquity-persia",
    title: "The Metropolitan Museum of Art — The Achaemenid Persian Empire",
    url: "https://www.metmuseum.org/essays/the-achaemenid-persian-empire-550-330-b-c",
    note: "Ахеменіди й кінець їхньої держави за Александра. Парфія і Сасаніди на пізніших зрізах лише сусіди Риму.",
  },
  {
    id: "antiquity-carthage",
    title: "The Metropolitan Museum of Art — Western North Africa, 1000 B.C.–1 A.D.",
    url: "https://www.metmuseum.org/toah/ht/04/afw.html",
    note: "Карфаген, Нумідія і клієнтська Мавретанія. 146 рік до н. е. прибирає Карфаген з мапи.",
  },
];

type Period = { from: number; to: number; title: string; description: string; sources: string[] };
const PERIODS: Period[] = [
  {
    from: -500,
    to: -324,
    title: "Класичні держави",
    description:
      "Ахеменіди тримають Анатолію, Єгипет і Іран. Карфаген — захід Середземного моря. Рим ще майже Лаціум, Афіни і Спарта не злиті в одну Грецію.",
    sources: ["antiquity-persia", "antiquity-carthage", "antiquity-republic"],
  },
  {
    from: -323,
    to: -271,
    title: "Імперія Александра",
    description:
      "На рік смерті Александра завойоване ще показане разом. Рим і Карфаген лишаються поза цим контуром. Наступний зріз уже розділяє діадохів.",
    sources: ["antiquity-persia", "antiquity-republic"],
  },
  {
    from: -270,
    to: -202,
    title: "Діадохи і Карфаген",
    description:
      "Македонія, Птолемеї й Селевкіди. Рим тримає Італію, але ще не Сицилію. Карфаген має Африку, Сардинію, захід Сицилії й південь Іспанії.",
    sources: ["antiquity-republic", "antiquity-carthage"],
  },
  {
    from: -201,
    to: -147,
    title: "Після Зами",
    description:
      "Карфаген втратив острови й Іспанію. Нумідія окрема. Греція ще македонська, Єгипет птолемеївський.",
    sources: ["antiquity-republic", "antiquity-carthage"],
  },
  {
    from: -146,
    to: -28,
    title: "Республіка після Карфагена",
    description:
      "146 рік знищує Карфаген і підкоряє Грецію. Єгипет, Пергам і Парфія ще не римські. Галлії на цьому зрізі немає.",
    sources: ["antiquity-republic", "antiquity-persia"],
  },
  {
    from: -27,
    to: 116,
    title: "Імперія Августа",
    description:
      "Єгипет, Галлія й Анатолія вже в імперії. Британія, Дакія і Месопотамія з’являться на зрізі 117 року. Мавретанія заштрихована як залежне царство.",
    sources: ["antiquity-empire", "antiquity-carthage"],
  },
  {
    from: 117,
    to: 284,
    title: "Найбільший Рим",
    description:
      "Траян: Британія до межі Шотландії, Дакія і короткий клин у Месопотамії. Ірландія не входить. Цей обрис тримається до зрізу Діоклетіана, без щорічних втрат.",
    sources: ["antiquity-empire"],
  },
  {
    from: 285,
    to: 394,
    title: "Єдина імперія перед поділом",
    description:
      "Дакію вже залишено, на сході Сасаніди. З 395 року мапу продовжує шар Візантії й огляд пізньої античності, а не цей зріз.",
    sources: ["antiquity-empire", "antiquity-persia"],
  },
];
export function antiquityPeriod(year: number) {
  return PERIODS.find((p) => year >= p.from && year <= p.to) ?? PERIODS[0]!;
}

export const ANTIQUITY_EVENTS: AtlasEvent[] = [
  {
    year: -490,
    title: "Греко-перські війни",
    description: "Персія не забирає Афіни. На мапі поліси лишаються поза ахеменідським контуром.",
    sources: ["antiquity-persia"],
    approximate: true,
  },
  {
    year: -323,
    title: "Смерть Александра",
    description: "Імперія ще ціла на цьому зрізі. Царства спадкоємців показані з -270 року.",
    sources: ["antiquity-persia"],
  },
  {
    year: -264,
    title: "Перша Пунічна війна",
    description: "Суперечка за Сицилію. На мапі острів ще поділений, доки зріз -201 не віддасть його Риму.",
    sources: ["antiquity-republic", "antiquity-carthage"],
  },
  {
    year: -202,
    title: "Зама",
    description: "Ганнібала розбито в Африці. Карфаген втрачає заморські землі.",
    sources: ["antiquity-carthage"],
  },
  {
    year: -146,
    title: "Кінець Карфагена",
    description: "Місто знищене. Того ж року Рим підкоряє Ахейський союз. Єгипет це не зачіпає.",
    sources: ["antiquity-carthage", "antiquity-republic"],
  },
  {
    year: -31,
    title: "Акцій",
    description: "Єгипет Клеопатри доживає останні місяці. На імперському зрізі -27 року він уже римський.",
    sources: ["antiquity-empire"],
  },
  {
    year: -27,
    title: "Август",
    description: "Початок принципату. Британії в цих кордонах ще немає.",
    sources: ["antiquity-empire"],
  },
  {
    year: 117,
    title: "Межа Траяна",
    description: "Найширший контур імперії. Месопотамію Адріан незабаром лишає, але зріз тримає обрис 117 року до Діоклетіана.",
    sources: ["antiquity-empire"],
  },
  {
    year: 285,
    title: "Діоклетіан",
    description: "Імперія ще одна, без Дакії. Поділ на Схід і Захід мапа показує вже з 395 року в шарі Візантії.",
    sources: ["antiquity-empire"],
  },
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
export const ANTIQUITY_PLACES: AtlasPlace[] = [
  place("antiquity-rome", "Рим", 41.89, 12.48, -500, 394, "від республіки до пізньої імперії", "Орієнтир міста. Контур держави навколо нього змінюється від Лаціума до імперії.", ["antiquity-republic", "antiquity-empire"], true),
  place("antiquity-carthage", "Карфаген", 36.85, 10.32, -500, -147, "до зруйнування 146 року до н. е.", "Центр карфагенської держави. Після 146 року це вже римська Африка, не Карфаген.", ["antiquity-carthage"], true),
  place("antiquity-athens", "Афіни", 37.97, 23.73, -500, 394, "поліс, далі в македонській і римській Греції", "Точка міста, не межа Делоського союзу.", ["antiquity-republic"]),
  place("antiquity-sparta", "Спарта", 37.08, 22.43, -500, -147, "Лаконія", "Осередок Спарти, доки Греція не входить до римських провінцій.", ["antiquity-republic"]),
  place("antiquity-alexandria", "Александрія", 31.2, 29.92, -323, 394, "столиця Птолемеїв, потім римський Єгипет", "Заснована Александром. Не є кордоном Єгипту.", ["antiquity-persia", "antiquity-empire"], true),
  place("antiquity-persepolis", "Персеполь", 29.94, 52.89, -500, -331, "столиця Ахеменідів", "Спалений Александром. Далі це земля Селевкідів, Парфії чи Сасанідів, не те саме місто.", ["antiquity-persia"], true),
  place("antiquity-antioch", "Антіохія", 36.2, 36.16, -300, 394, "Сирія Селевкідів, потім римська", "Орієнтир Сирії. Не вся держава Селевкідів.", ["antiquity-empire"]),
  place("antiquity-london", "Лондіній", 51.51, -0.13, 117, 394, "римська Британія", "На зрізі Августа Британії ще немає. Шотландія й Ірландія лишаються поза провінцією.", ["antiquity-empire"]),
];
