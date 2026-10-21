import type { Feature, FeatureCollection, Geometry } from "geojson";

export const ATLAS_YEARS = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400] as const;
export const ATLAS_MIN_YEAR = 395;
export const ATLAS_MAX_YEAR = 1994;
export const BYZANTINE_YEARS = [
  395, 450, 476, 565, 592, 622, 630, 641, 668, 717, 775, 813, 842, 867, 927, 959, 969, 975, 1000,
  1025, 1045, 1059, 1081, 1118, 1143, 1155, 1180, 1203, 1205, 1230, 1254, 1262, 1328, 1340, 1354,
  1400, 1403, 1445, 1453,
] as const;
export type AtlasView =
  | "rus"
  | "europe"
  | "world"
  | "byzantium"
  | "franks"
  | "mongols"
  | "hordes"
  | "mughals"
  | "france"
  | "poland"
  | "lithuania"
  | "commonwealth"
  | "cossacks"
  | "spain"
  | "spanish-empire"
  | "england"
  | "scotland"
  | "wales"
  | "ireland"
  | "isles"
  | "antiquity"
  | "germany"
  | "napoleon";
export type HistoricalProperties = {
  name: string;
  subject: string;
  precision: number;
  detailed?: boolean;
  sourceYear?: number;
  sourceId?: string;
  region?:
    | "franks"
    | "rus"
    | "mongols"
    | "france"
    | "commonwealth"
    | "spain"
    | "england"
    | "isles"
    | "antiquity"
    | "germany"
    | "napoleon";
  layer?: "state" | "land" | "dependency" | "occupation" | "cossack" | "colony" | "front";
  worldOverlay?: "reconquista" | "front";
  validUntilDate?: string;
  validTo?: number;
  invaded?: boolean;
  custom?: boolean;
  control?: "direct" | "relative";
  relation?: string;
  validFrom?: number;
  description?: string;
  sourceUrl?: string;
  color?: string;
};
export type HistoricalFeature = Feature<Geometry, HistoricalProperties>;
export type HistoricalCollection = FeatureCollection<Geometry, HistoricalProperties>;
export type AtlasSource = { id: string; title: string; url: string; note: string };
export type AtlasPlace = {
  id: string;
  name: string;
  type: "city" | "area" | "polity";
  from: number;
  to: number;
  lat: number;
  lng: number;
  dateLabel: string;
  description: string;
  sources: string[];
  europe?: boolean;
  byzantine?: boolean;
  frankish?: boolean;
  french?: boolean;
  english?: boolean;
  spanish?: boolean;
  colonial?: boolean;
  polish?: boolean;
  lithuanian?: boolean;
  commonwealth?: boolean;
  ruthenian?: boolean;
  cossack?: boolean;
  occupation?: boolean;
  rus?: boolean;
  capital?: boolean;
  mongol?: boolean;
  campaign?: "battle" | "sack" | "withdrawal";
  isles?: boolean;
  irish?: boolean;
  scottish?: boolean;
  welsh?: boolean;
};
export type AtlasEvent = {
  year: number;
  month?: number;
  day?: number;
  title: string;
  description: string;
  sources: string[];
  approximate?: boolean;
  ruthenian?: boolean;
  europe?: boolean;
};
export function clampAtlasYear(value: number) {
  return Math.max(
    ATLAS_MIN_YEAR,
    Math.min(ATLAS_MAX_YEAR, Math.round(Number.isFinite(value) ? value : 1000)),
  );
}
/** Other countries have no configured historical geometry outside the original range. */
export function overviewSnapshot(year: number) {
  return year >= 500 && year <= 1400 ? nearestSnapshot(year) : undefined;
}
/** Use the last documented Byzantine frame; never borrow future conquests or interpolate. */
export function byzantineSnapshot(year: number) {
  const target = clampAtlasYear(year);
  return [...BYZANTINE_YEARS].reverse().find((y) => y <= target)!;
}
export function isCoarseByzantine(name: string) {
  return /^(Byzantine Empire|Eastern Roman Empire|Trebizond|Empire of Nicaea|Nicaea|Despotate of Epirus|Principality of Theodoro)$/.test(
    name,
  );
}
export const FRANKISH_YEARS = [481, 511, 561, 614, 768, 814, 843, 870, 881, 888] as const;
export function frankishSnapshot(year: number) {
  if (year < 481 || year > 900) return undefined;
  return [...FRANKISH_YEARS].reverse().find((y) => y <= year);
}
export function isUnknownRegion(name: string) {
  return !name.trim() || /^unspecified$/i.test(name.trim());
}
export function isCoarseFrankish(name: string) {
  return /^(Franks|Frankish Kingdom|Carolingian Empire)$/.test(name);
}
export const RUS_YEARS = [882, 1054, 1113, 1132, 1194, 1237, 1240] as const;
/** Last documented Rus frame; 1240 is an endpoint using the 1237 source. */
export function rusSnapshot(year: number) {
  if (year < 882 || year > 1240) return undefined;
  return [...RUS_YEARS].reverse().find((y) => y <= year);
}
export function isCoarseRus(name: string) {
  return /^(Kyivan Rus|Kievan Rus|Other Rus Principalities|Principality of Galicia-Volhynia|Principality of Novgorod)$/.test(
    name,
  );
}
export function combineHistoricalLayers(
  overview: HistoricalCollection | undefined,
  detailed: HistoricalCollection | undefined,
  frankish?: HistoricalCollection,
  rus?: HistoricalCollection,
  mongols?: HistoricalCollection,
): HistoricalCollection | undefined {
  const clean = overview?.features.filter((f) => !isUnknownRegion(f.properties.name));
  if (!detailed && !frankish && !rus && !mongols)
    return clean?.length === overview?.features.length
      ? overview
      : clean
        ? { type: "FeatureCollection", features: clean }
        : undefined;
  return {
    type: "FeatureCollection",
    features: [
      ...(clean ?? []).filter(
        (f) =>
          !(detailed && isCoarseByzantine(f.properties.name)) &&
          !(frankish && isCoarseFrankish(f.properties.name)) &&
          !(rus && isCoarseRus(f.properties.name)) &&
          !(
            mongols &&
            /^(Mongol Empire|Mongol Empire.*|Chagatai Khanate|Ilkhanate|Khanate of the Golden Horde|Golden Horde|Blue Horde|White Horde|Timurid Empire|China \(Yuan Dynasty\))$/.test(
              f.properties.name,
            )
          ),
      ),
      ...(detailed?.features ?? []),
      ...(frankish?.features ?? []),
      ...(rus?.features ?? []),
      ...(mongols?.features ?? []),
    ],
  };
}
export function nearestSnapshot(year: number) {
  const target = clampAtlasYear(year);
  return ATLAS_YEARS.reduce(
    (best, next) => (Math.abs(next - target) < Math.abs(best - target) ? next : best),
    ATLAS_YEARS[0] as number,
  );
}
export function activePlaces(places: AtlasPlace[], year: number) {
  return places.filter((p) => year >= p.from && year <= p.to);
}
/** Stable between marker dates, so scrubbing a year does not redraw unchanged geographic layers. */
export function placeEpoch(places: AtlasPlace[], year: number) {
  return Math.max(
    ATLAS_MIN_YEAR,
    ...places.flatMap((p) => [
      p.from <= year ? p.from : ATLAS_MIN_YEAR,
      p.to < year ? p.to + 1 : ATLAS_MIN_YEAR,
    ]),
  );
}
export function historicalName(name: string, uk = true) {
  const names: Record<string, string> = {
    France: "Франція",
    Ukraine: "Україна",
    USSR: "СРСР",
    Russia: "Росія",
    England: "Англія",
    Scotland: "Шотландія",
    Wales: "Вельс",
    Austria: "Австрія",
    Italy: "Італія",
    Greece: "Греція",
    Turkey: "Туреччина",
    Romania: "Румунія",
    Moldova: "Молдова",
    Belarus: "Білорусь",
    China: "Китай",
    India: "Індія",
    Japan: "Японія",
    Canada: "Канада",
    "United States of America": "Сполучені Штати Америки",
    "United States": "Сполучені Штати Америки",
    Brazil: "Бразилія",
    Argentina: "Аргентина",
    "Qing Empire": "Імперія Цін",
    "Manchu Empire": "Маньчжурська імперія",
    "British Raj": "Британська Індія",
    "Visigothic Kingdom": "Вестготське королівство",
    Florida: "Флорида",
    Spain: "Іспанія",
    "Christian Iberian lands": "Християнські володіння · кілька держав",
    "Al-Andalus — survey": "Аль-Андалус · оглядовий ареал",
    "Nationalist-held Spain": "Зона заколотників / військ Франко",
    "Republican-held Spain": "Республіканська зона",
    "Spain — Franco regime": "Іспанія · режим Франко",
    "Spanish Philippines": "Іспанські Філіппіни",
    "Spanish overseas possessions": "Іспанські заморські володіння",
    "Spanish Guinea": "Іспанська Гвінея",
    "Spanish Sahara": "Іспанська Сахара",
    "Portugal — Iberian Union": "Португалія · династична Іберійська унія",
    "New Spain — early conquests": "Нова Іспанія · ранні завоювання",
    "Viceroyalty of New Spain": "Віце-королівство Нова Іспанія",
    "Viceroyalty of Peru": "Віце-королівство Перу",
    "Viceroyalty of New Granada": "Віце-королівство Нова Гранада",
    "Viceroyalty of the Río de la Plata": "Віце-королівство Ріо-де-ла-Плата",
    Castilla: "Кастилія",
    Castile: "Кастилія",
    Castille: "Кастилія",
    Aragón: "Арагонська корона",
    Granada: "Гранадський емірат",
    Navarre: "Наварра",
    León: "Леон",
    Asturias: "Астурія",
    Portugal: "Португалія",
    "Roman Britain": "Римська Британія",
    "Northern Britain": "Північ Британії поза провінцією",
    "Gaelic Ireland": "Гельська Ірландія",
    "Channel Islands": "Нормандські острови",
    "Isle of Man": "Острів Мен",
    "Northern Isles": "Оркнейські й Шетландські острови",
    Hebrides: "Гебриди",
    Dumnonia: "Думнонія",
    "Welsh kingdoms": "Валлійські королівства",
    Kent: "Кент",
    Sussex: "Сассекс",
    Essex: "Ессекс",
    "East Anglia": "Східна Англія",
    Wessex: "Вессекс",
    Northumbria: "Нортумбрія",
    Pictland: "Піктландія",
    Mercia: "Мерсія",
    "English Northumbria": "Англійська Нортумбрія",
    Danelaw: "Данелаг",
    "Wessex and English Mercia": "Вессекс і англійська Мерсія",
    "Kingdom of the Isles": "Королівство островів",
    "Kingdom of Alba": "Королівство Алба",
    "Kingdom of England": "Королівство Англія",
    "Kingdom of Scotland": "Королівство Шотландія",
    "Lordship of Ireland": "Лордство Ірландії",
    "Kingdom of Ireland": "Королівство Ірландія",
    "Commonwealth of England": "Співдружність Англії, Шотландії й Ірландії",
    "Kingdom of Great Britain": "Королівство Великої Британії",
    "United Kingdom": "Сполучене Королівство",
    "Irish Free State": "Ірландська Вільна держава",
    Ireland: "Ірландія",
    "Emirate of Córdoba": "Кордовський емірат",
    "Caliphate of Córdoba": "Кордовський халіфат",
    "Almoravid dynasty": "Альморавіди · Іберійські володіння",
    "Almohad Caliphate": "Альмохади · Іберійські володіння",
    "Cuba (Spain)": "Куба та залежні острови · Іспанія",
    "Hispaniola (Spain)": "Еспаньйола та залежні острови · Іспанія",
    "Santo Domingo (Spain)": "Санто-Домінго · Іспанія",
    "Florida (Spain)": "Флорида · Іспанія",
    Sardinia: "Сардинія",
    Naples: "Неаполітанське королівство",
    Sicily: "Сицилія",
    Milan: "Мілан",
    "Franche-Comté": "Франш-Конте",
    Paraguay: "Парагвай",
    "Kyivan Rus": "Київська Русь",
    "Kievan Rus": "Київська Русь",
    "Rus dependent territories": "Залежні території Русі",
    "Principality of Kyiv": "Київське князівство",
    "Principality of Chernihiv": "Чернігівське князівство",
    "Principality of Pereiaslav": "Переяславське князівство",
    "Principality of Smolensk": "Смоленське князівство",
    "Principality of Polotsk": "Полоцьке князівство",
    "Principality of Volhynia": "Волинське князівство",
    "Principality of Halych": "Галицьке князівство",
    "Principality of Rostov-Suzdal": "Ростово-Суздальське князівство",
    "Principality of Vladimir-Suzdal": "Владимиро-Суздальське князівство",
    "Principality of Murom": "Муромське князівство",
    "Principality of Ryazan": "Рязанське князівство",
    "Principality of Turiv-Pinsk": "Турово-Пінське князівство",
    "Principality of Novhorod-Siverskyi": "Новгород-Сіверське князівство",
    "Novgorod Republic": "Новгородська республіка",
    "Novgorod core lands": "Новгородська земля — основні володіння",
    "Kyiv and western Rus lands": "Київська й західні землі Русі",
    "Volhynian appanages": "Волинські уділи",
    "Galician appanages": "Галицькі князівські володіння",
    "Vladimir-Suzdal lands": "Владимирська та Ростово-Суздальська землі",
    "Polotsk and Minsk lands": "Полоцько-Мінські володіння",
    "Smolensk and Toropets lands": "Смоленська земля й Торопецький уділ",
    "Murom and Ryazan lands": "Муромська та Рязанська землі",
    "Rus' Khaganate": "Руський каганат? (гіпотеза)",
    "Other Rus Principalities": "Інші князівства Русі (узагальнення)",
    "Principality of Galicia-Volhynia": "Галицько-Волинська держава",
    "Principality of Novgorod": "Новгородська земля",
    "Cuman Khanates": "Половецькі об’єднання",
    "Khazar Khaganate": "Хозарський каганат",
    Khazars: "Хозари",
    Pechenegs: "Печеніги",
    "Golden Horde": "Золота Орда",
    "Mongol Empire": "Монгольська імперія",
    "Mongol successor realms — combined extent": "Монгольські улуси — сукупна територія",
    "Chagatai Khanate": "Чагатайський улус",
    "Yuan dynasty": "Династія Юань",
    Ilkhanate: "Ільханат",
    "Great Horde": "Велика Орда",
    "Crimean Khanate": "Кримське ханство",
    "Sibir Khanate": "Сибірське ханство",
    "Eastern Chagatai realms": "Східні чагатайські володіння",
    "Nogai Horde": "Ногайська Орда",
    "Mughal Empire": "Імперія Великих Моголів",
    "Livonia — joint Crown and Lithuania": "Лівонія · спільне володіння Корони й ВКЛ",
    Crown: "Корона Польська",
    Commonwealth: "Річ Посполита",
    "Russian Empire": "Російська імперія",
    Prussia: "Пруссія",
    "Habsburg Monarchy": "Габсбурзька монархія",
    "Duchy of Courland and Semigallia": "Курляндія і Семигалія · ленне герцогство",
    Sweden: "Швеція",
    "Ottoman Empire": "Османська імперія",
    Zaporizhia: "Запорожжя",
    "Crown of the Kingdom of Poland": "Корона Польська · Річ Посполита",
    "Grand Duchy of Lithuania in the Commonwealth": "ВКЛ · Річ Посполита",
    "Polish-Lithuanian Commonwealth": "Річ Посполита",
    "Republic of Poland": "Польща · XX ст.",
    "Republic of Lithuania": "Литва · XX ст.",
    "Polish Crown fiefs": "Ленні володіння Корони",
    "Lithuanian dependent lands": "Залежні землі ВКЛ",
    "Commonwealth fiefs": "Ленні володіння Речі Посполитої",
    "Volhynia lands": "Волинь · історичний ареал",
    "Belz lands": "Белзщина · історичний ареал",
    "Ruthenian lands": "Руське воєводство / Галичина · ареал",
    "Podolian lands": "Поділля · історичний ареал",
    "Bratslav lands": "Брацлавщина · історичний ареал",
    "Kyiv lands": "Київщина · історичний ареал",
    "Chernihiv-Siverian lands": "Чернігово-Сіверщина · історичний ареал",
    "Left-Bank Hetmanate": "Лівобережна Гетьманщина · козацька автономія",
    "Muscovite wartime occupation": "Московське військове зайняття · 1655–1661",
    "Muscovy / Russian Empire": "Московія / Російська імперія",
    Muscovy: "Московія",
    "Cossack Hetmanate": "Гетьманщина · козацька автономія",
    "Swedish occupation — Deluge": "Шведська окупація · Потоп 1655–1657",
    "Ottoman Podolia": "Поділля під османським управлінням",
    "Zaporizhia — joint suzerainty": "Запорожжя · спільне підпорядкування 1667–1686",
    "Poland-Lithuania": "Польща і ВКЛ (узагальнена геометрія)",
    "Byzantine Empire": "Візантійська імперія",
    "Eastern Roman Empire": "Східна Римська імперія",
    "Empire of Nicaea": "Нікейська імперія",
    "Empire of Trebizond": "Трапезундська імперія",
    "Despotate of Epirus": "Епірська держава",
    "Empire of Thessalonica": "Фессалонікійська імперія",
    "Principality of Theodoro": "Князівство Феодоро",
    "Byzantine-Arab condominium": "Візантійсько-арабське співволодіння",
    "Roman Empire": "Римська імперія",
    "Frankish Kingdom": "Франкське королівство",
    Franks: "Франки",
    "Frankish realms": "Франкські володіння",
    "Carolingian Empire": "Каролінзька імперія",
    "Frankish dependent territories": "Залежні території франків",
    "Kingdom of Orleans": "Орлеанське королівство",
    "Kingdom of Paris": "Паризьке королівство",
    "Kingdom of Reims": "Реймське королівство",
    "Kingdom of Soissons": "Суассонське королівство",
    "West Francia": "Західна Франкія",
    "Middle Francia": "Середня Франкія",
    "East Francia": "Східна Франкія",
    "Kingdom of Italy": "Італійське королівство",
    "Charles III's realms": "Володіння Карла III — Італія й східні землі",
    "Papal States": "Папська держава",
    "Disputed Aquitaine": "Аквітанія — спірні володіння",
    "West Francia — Louis III": "Західна Франкія — Людовик III",
    "West Francia — Carloman II": "Західна Франкія — Карломан II",
    "Lower Burgundy": "Нижня Бургундія",
    "Upper Burgundy": "Верхня Бургундія",
    "Holy Roman Empire": "Священна Римська імперія",
    "Duchy of Lotharingia": "Лотаринзьке герцогство",
    "Duchy of Franconia": "Франконське герцогство",
    "Duchy of Swabia": "Швабське герцогство",
    "Duchy of Bavaria": "Баварське герцогство",
    "Duchy of Saxony": "Саксонське герцогство",
    Bohemia: "Чехія",
    "Duchy of Austria": "Австрійське герцогство",
    "Margraviate of Brandenburg": "Бранденбурзька марка",
    "Kingdom of Burgundy": "Бургундське королівство",
    "Swabian lands": "Швабські землі",
    "Low Countries": "Нідерландські лени",
    "County Palatine of the Rhine": "Рейнський Пфальц",
    "Electoral Saxony": "Саксонське курфюрство",
    "Imperial Italy": "Імперська Італія",
    "Habsburg lands": "Землі Габсбургів",
    "Duchy of Prussia": "Герцогство Пруссія",
    "Dutch Republic": "Голландська республіка",
    "Swiss Confederacy": "Швейцарська конфедерація",
    "Brandenburg-Prussia": "Бранденбург-Пруссія",
    "Kingdom of Prussia": "Прусське королівство",
    "East Prussia": "Східна Пруссія",
    "Confederation of the Rhine": "Рейнський союз",
    "Austrian Empire": "Австрійська імперія",
    "Kingdom of Bavaria": "Баварське королівство",
    "Kingdom of Saxony": "Саксонське королівство",
    "Kingdom of Hanover": "Ганноверське королівство",
    "Kingdom of Württemberg": "Вюртемберзьке королівство",
    "Grand Duchy of Baden": "Велике герцогство Баден",
    "Guelph lands": "Землі Вельфів",
    "North German Confederation": "Північнонімецький союз",
    "Alsace-Lorraine": "Ельзас-Лотарингія",
    "Imperial Alsace": "Імперський Ельзас",
    "Weimar Germany": "Веймарська Німеччина",
    "Saar Basin": "Саарський басейн",
    "German Reich": "Німецький Райх",
    "Federal Republic of Germany": "Федеративна Республіка Німеччина",
    "German Democratic Republic": "Німецька Демократична Республіка",
    Germany: "Німеччина",
    "French Republic": "Французька республіка",
    "French Empire": "Французька імперія",
    "Kingdom of France": "Французьке королівство",
    "Austrian Netherlands": "Австрійські Нідерланди",
    "Batavian Republic": "Батавська республіка",
    "United Netherlands": "Об’єднане королівство Нідерландів",
    "Cisalpine Republic": "Цизальпійська республіка",
    "Ligurian Republic": "Лігурійська республіка",
    "Kingdom of Naples": "Неаполітанське королівство",
    "Kingdom of the Two Sicilies": "Королівство обох Сицилій",
    "Electorate of Hanover": "Ганноверське курфюрство",
    "Rhineland states": "Держави Рейнланду",
    "Kingdom of Westphalia": "Вестфальське королівство",
    "Grand Duchy of Berg": "Велике герцогство Берг",
    "Grand Duchy of Hesse": "Велике герцогство Гессен",
    "Kingdom of Bohemia": "Чеське королівство",
    "Kingdom of Galicia": "Королівство Галичини",
    "Denmark-Norway": "Данія-Норвегія",
    "Sweden-Norway": "Швеція-Норвегія",
    "Duchy of Warsaw": "Варшавське герцогство",
    "Illyrian Provinces": "Іллірійські провінції",
    "Free City of Danzig": "Вільне місто Данциг",
    "Free City of Kraków": "Вільне місто Краків",
    "Congress Poland": "Царство Польське",
    "Allied Belgium": "Бельгія під союзниками",
    "Russian campaign": "Похід на Росію",
    "Republic of Venice": "Венеційська республіка",
    "Kingdom of Etruria": "Етрурське королівство",
    "Kingdom of Sardinia": "Сардинське королівство",
    "Grand Duchy of Tuscany": "Велике герцогство Тоскана",
    "Kingdom of Poland": "Польське королівство",
    Poland: "Польща",
    "Kingdom of Hungary": "Угорське королівство",
    Hungary: "Угорщина",
    Bulgaria: "Болгарія",
    "First Bulgarian Empire": "Перше Болгарське царство",
    "Second Bulgarian Empire": "Друге Болгарське царство",
    Lithuania: "Велике князівство Литовське",
    "Grand Duchy of Lithuania": "Велике князівство Литовське",
    "Avar Khaganate": "Аварський каганат",
    Sclaveni: "Склавини",
    Antes: "Анти",
    "Sub-Roman Britain": "Післяримська Британія",
    "Ireland (state)": "Ірландія",
    Ulaid: "Улад",
    Ailech: "Айлех",
    Airgialla: "Айргіалла",
    Breifne: "Брейфне",
    Connacht: "Коннахт",
    Mide: "Міде",
    Leinster: "Ленстер",
    Osraige: "Осрайге",
    Munster: "Манстер",
    Dublin: "Дублін",
    Waterford: "Ватерфорд",
    Limerick: "Лімерик",
    "Gaelic lordships": "Гельські володіння",
    Thomond: "Томонд",
    "Northern Ireland": "Північна Ірландія",
    "Dál Riata": "Дал Ріада",
    Strathclyde: "Стратклайд",
    "Lords of Galloway": "Володарі Галловея",
    "English Mercia": "Англійська Мерсія",
    Cornwall: "Корнуол",
    Gwynedd: "Гвінед",
    Powys: "Повіс",
    Deheubarth: "Дехейбарт",
    Dyfed: "Дівед",
    Ceredigion: "Кередігіон",
    Morgannwg: "Морганнуг",
    Gwent: "Гвент",
    "Marcher lordships": "Марки Вельсу",
    "Principality of Wales": "Князівство Вельсу",
    "Duchy of Normandy": "Герцогство Нормандія",
    "County of Maine": "Графство Мен",
    "County of Anjou": "Графство Анжу",
    "Duchy of Aquitaine": "Герцогство Аквітанія",
    "Duchy of Gascony": "Герцогство Гасконь",
    "Pale of Calais": "Кале",
    "English Île-de-France": "Англійська Іль-де-Франс",
    "Thirteen Colonies": "Тринадцять колоній",
    "British Canada": "Британська Канада",
    "British Florida": "Британська Флорида",
    Bengal: "Бенгалія",
    "British India": "Британська Індія",
    Ceylon: "Цейлон",
    Australia: "Австралія",
    "New Zealand": "Нова Зеландія",
    "Cape Colony": "Капська колонія",
    "Rupert's Land": "Земля Руперта",
    "British West Indies": "Британська Вест-Індія",
    "British West Africa": "Британська Західна Африка",
    "British East Africa": "Британська Східна Африка",
    "Union of South Africa": "Південно-Африканський Союз",
    Rhodesia: "Родезія",
    "British Malaya": "Британська Малайя",
    "Hong Kong": "Гонконг",
    Gibraltar: "Гібралтар",
    "Falkland Islands": "Фолклендські острови",
    Bermuda: "Бермуди",
    "Roman Republic": "Римська республіка",
    Carthage: "Карфаген",
    "Achaemenid Empire": "Імперія Ахеменідів",
    "Empire of Alexander": "Імперія Александра",
    "Kingdom of Macedon": "Македонське царство",
    Athens: "Афіни",
    Sparta: "Спарта",
    "Greek Sicily": "Грецька Сицилія",
    Etruria: "Етрурія",
    "Ptolemaic Egypt": "Єгипет Птолемеїв",
    "Seleucid Empire": "Держава Селевкідів",
    "Kingdom of Pergamon": "Пергамське царство",
    Numidia: "Нумідія",
    Mauretania: "Мавретанія",
    "Parthian Empire": "Парфянське царство",
    "Sasanian Empire": "Сасанідська держава",
    "Kingdom of Kush": "Куш",
    "Kingdom of Armenia": "Вірменське царство",
  };
  if (uk && name.includes(" — ")) {
    const partition =
      /^(Russian Empire|Prussia|Habsburg Monarchy) — partition of (1772|1793|1795)$/.exec(name);
    if (partition) return `${names[partition[1]]} · поділ ${partition[2]} р.`;
    const [area, owner] = name.split(" — ");
    if (
      names[area] &&
      [
        "Poland",
        "Lithuania",
        "Crown",
        "Commonwealth",
        "Russian Empire",
        "Prussia",
        "Habsburg Monarchy",
      ].includes(owner)
    )
      return `${names[area]} · ${names[owner] ?? owner}`;
  }
  return uk ? (names[name] ?? name) : name;
}
export function featureNote(name: string, year: number) {
  if (name === "Rus' Khaganate")
    return "Назва та територія раннього руського політичного утворення дискусійні. Геометрія 800 р. — гіпотетична реконструкція; це не доведена держава з установленими кордонами.";
  if (name === "Poland-Lithuania" && year === 1400)
    return "Джерело об’єднує Польщу й ВКЛ в одну геометрію. У 1400 р. це були окремі держави під династичною унією; Річ Посполита постала 1569 р.";
  if (/Rus|Kievan|Galicia/.test(name))
    return "Геометрія оглядова: вона не розрізняє всі удільні князівства, залежність і зміну місцевого управління. Докладніші картки розташовані в регіональному шарі.";
  return "Джерело подає оглядову територію держави або культурного ареалу. Межі не є сучасними юридичними кордонами й можуть перекриватися.";
}
export function polityColor(name: string) {
  if (name === "Byzantine-Arab condominium") return "#f8e0e9";
  if (/Byzantine|Eastern Roman|Nicaea/.test(name)) return "#f3cbda";
  if (/Trebizond/.test(name)) return "#d2f3be";
  if (/Epirus|Thessalonica/.test(name)) return "#f3f28c";
  if (/Theodoro/.test(name)) return "#c5c1ff";
  if (/Rus|Kievan|Galicia/.test(name)) return "#a65839";
  const colors = [
    "#749d74",
    "#c19f63",
    "#8397ba",
    "#b58b9c",
    "#9c9871",
    "#83a6a1",
    "#b7a279",
    "#ae977c",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
export function validateHistoricalCollection(raw: unknown): HistoricalCollection {
  const d = raw as HistoricalCollection;
  if (!d || d.type !== "FeatureCollection" || !Array.isArray(d.features) || !d.features.length)
    throw new Error("INVALID_ATLAS_DATA");
  for (const f of d.features) {
    if (
      f.type !== "Feature" ||
      typeof f.properties?.name !== "string" ||
      typeof f.properties.subject !== "string" ||
      !f.geometry ||
      !["Polygon", "MultiPolygon"].includes(f.geometry.type)
    )
      throw new Error("INVALID_ATLAS_DATA");
    const coords = (f.geometry as { coordinates: unknown }).coordinates;
    const valid = (x: unknown): boolean =>
      Array.isArray(x) &&
      x.length > 0 &&
      (typeof x[0] === "number"
        ? x.length >= 2 &&
          Number.isFinite(x[0]) &&
          Number.isFinite(x[1]) &&
          Math.abs(x[0]) <= 180.001 &&
          Math.abs(x[1] as number) <= 90.001
        : x.every(valid));
    if (!valid(coords)) throw new Error("INVALID_ATLAS_DATA");
  }
  return d;
}
