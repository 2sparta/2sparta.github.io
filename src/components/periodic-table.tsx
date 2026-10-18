import { useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { Atom, ArrowUpRight, Search } from "lucide-react";
import {
  CATEGORIES,
  ELEMENTS,
  elementByNumber,
  formatNumber,
  massLabel,
  matchesElement,
  stateAt,
  temperatureToKelvin,
  temperatureFromKelvin,
  temperatureValue,
  wikipediaUrl,
  type Category,
  type PeriodicLayout,
  type TemperatureUnit,
} from "@/lib/periodic/model";
import "./periodic-table.css";

type Option = readonly [string, string];
const EV_PER_KJ_MOL = 1 / 96.4853321233;
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="periodic-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  );
}
function Property({
  title,
  value,
  unit,
  children,
  note,
}: {
  title: string;
  value: number | string | null | undefined;
  unit?: string;
  children?: ReactNode;
  note?: string;
}) {
  return (
    <div className="periodic-property">
      <dt>
        <span>{title}</span>
        {children}
      </dt>
      <dd>
        <strong>{typeof value === "string" ? value : formatNumber(value)}</strong>
        {unit && value != null && <span className="periodic-unit">{unit}</span>}
        {note && <small>{note}</small>}
      </dd>
    </div>
  );
}

export function PeriodicTable({
  number = 4,
  layout = "compact",
  onChange,
}: {
  number?: number;
  layout?: PeriodicLayout;
  onChange: (number: number, layout: PeriodicLayout) => void;
}) {
  const element = elementByNumber(number);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [temperature, setTemperature] = useState("20");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [energyUnit, setEnergyUnit] = useState("kJ/mol");
  const [radius, setRadius] = useState<keyof typeof element.radius>("calculated");
  const [hardness, setHardness] = useState<keyof typeof element.hardness>("brinell");
  const [modulus, setModulus] = useState<keyof typeof element.modulus>("bulk");
  const [density, setDensity] = useState<keyof typeof element.density>("stp");
  const [densityUnit, setDensityUnit] = useState("kg/m³");
  const [conductivity, setConductivity] = useState<keyof typeof element.conductivity>("thermal");
  const [heat, setHeat] = useState<keyof typeof element.heat>("specific");
  const [abundance, setAbundance] = useState<keyof typeof element.abundance>("universe");
  const [ionization, setIonization] = useState(1);
  const cells = useRef(new Map<number, HTMLButtonElement>());
  const tableRef = useRef<HTMLDivElement>(null);
  const selectedIonization = Math.min(ionization, Math.max(1, element.ionization.length));
  const energy = (value: number | null | undefined) =>
    value == null ? null : value * (energyUnit === "eV" ? EV_PER_KJ_MOL : 1);
  const kelvin =
    temperature.trim() === ""
      ? NaN
      : temperatureToKelvin(Number(temperature.replace(",", ".")), temperatureUnit);
  const matches = ELEMENTS.filter(
    (e) => matchesElement(e, query) && (category === "all" || e.category === category),
  );
  const matchIds = new Set(matches.map((e) => e.number));
  const categoryInfo = CATEGORIES[element.category];
  const temperatureSymbol = temperatureUnit === "K" ? "K" : `°${temperatureUnit}`;
  function changeTemperatureUnit(unit: TemperatureUnit) {
    if (Number.isFinite(kelvin))
      setTemperature(String(Math.round(temperatureFromKelvin(kelvin, unit)! * 100) / 100));
    setTemperatureUnit(unit);
  }
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, atomicNumber: number) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    const [dx, dy] = directions[event.key];
    const key = layout === "long" ? "widePosition" : "position";
    const [x, y] = elementByNumber(atomicNumber)[key];
    const candidates = ELEMENTS.filter((e) => {
      const [cx, cy] = e[key];
      return dx ? cy === y && (cx - x) * dx > 0 : (cy - y) * dy > 0;
    }).sort((a, b) => {
      const [ax, ay] = a[key],
        [bx, by] = b[key];
      return dx
        ? Math.abs(ax - x) - Math.abs(bx - x)
        : Math.abs(ay - y) - Math.abs(by - y) || Math.abs(ax - x) - Math.abs(bx - x);
    });
    if (candidates[0]) cells.current.get(candidates[0].number)?.focus();
  }
  return (
    <section className="periodic-tool" aria-label="Періодична таблиця хімічних елементів">
      <header className="periodic-heading">
        <div>
          <p className="periodic-eyebrow">
            <Atom size={15} /> Хімія · 118 елементів
          </p>
          <h2>Періодична таблиця</h2>
          <p>Оберіть елемент, щоб дослідити його властивості.</p>
        </div>
        <div className="periodic-layout" aria-label="Вигляд таблиці">
          <button
            type="button"
            aria-pressed={layout === "compact"}
            onClick={() => onChange(element.number, "compact")}
          >
            Короткий <small>18 колонок</small>
          </button>
          <button
            type="button"
            aria-pressed={layout === "long"}
            onClick={() => onChange(element.number, "long")}
          >
            Довгий <small>32 колонки</small>
          </button>
        </div>
      </header>
      <div className="periodic-workspace">
        <div className="periodic-table-area">
          <div className="periodic-toolbar">
            <label className="periodic-search">
              <Search size={18} />
              <input
                aria-label="Знайти елемент"
                type="search"
                placeholder="Назва, символ або номер…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {(query || category !== "all") && (
            <div className="periodic-results" aria-live="polite">
              <span>
                {matches.length ? `Знайдено: ${matches.length}` : "Елементів не знайдено"}
              </span>
              {matches.slice(0, 12).map((e) => (
                <button key={e.number} type="button" onClick={() => onChange(e.number, layout)}>
                  {e.symbol} · {e.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Скинути пошук
              </button>
            </div>
          )}
          <p className="periodic-scroll-hint">
            Прокручуйте таблицю горизонтально на вузькому екрані. Клавіші зі стрілками переміщують
            фокус, Enter обирає елемент.
          </p>
          <div
            ref={tableRef}
            className="periodic-scroll"
            tabIndex={0}
            role="region"
            aria-label={
              layout === "long" ? "Довга таблиця, 32 колонки" : "Коротка таблиця, 18 колонок"
            }
          >
            <div
              className={`periodic-grid periodic-grid-${layout}`}
              style={{
                gridTemplateColumns: `24px repeat(${layout === "long" ? 32 : 18}, minmax(52px, 1fr))`,
              }}
            >
              <div className="periodic-key" style={{ gridColumn: "4 / 13", gridRow: "2 / 5" }}>
                <p>Категорії елементів</p>
                <div className="periodic-legend" aria-label="Категорії елементів">
                  <button
                    type="button"
                    aria-pressed={category === "all"}
                    onClick={() => setCategory("all")}
                  >
                    Усі
                  </button>
                  {Object.entries(CATEGORIES).map(([id, info]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={category === id}
                      onClick={() => setCategory(category === id ? "all" : (id as Category))}
                    >
                      <span style={{ background: info.color }} />
                      {info.name}
                    </button>
                  ))}
                </div>
              </div>
              <span className="periodic-axis" style={{ gridColumn: 1, gridRow: 1 }}>
                П\Г
              </span>
              {Array.from({ length: 18 }, (_, index) => index + 1).map((group) => (
                <span
                  key={`g${group}`}
                  className="periodic-axis"
                  style={{
                    gridColumn: (layout === "long" && group >= 3 ? group + 14 : group) + 1,
                    gridRow: 1,
                  }}
                >
                  {group}
                </span>
              ))}
              {Array.from({ length: 7 }, (_, i) => i + 1).map((period) => (
                <span
                  key={`p${period}`}
                  className="periodic-axis"
                  style={{ gridColumn: 1, gridRow: period + 1 }}
                >
                  {period}
                </span>
              ))}
              {layout === "compact" && (
                <>
                  <span
                    className="periodic-block-placeholder"
                    style={{ gridColumn: 4, gridRow: 7 }}
                  >
                    57–71
                    <br />↘
                  </span>
                  <span
                    className="periodic-block-placeholder"
                    style={{ gridColumn: 4, gridRow: 8 }}
                  >
                    89–103
                    <br />↘
                  </span>
                  <span
                    className="periodic-block-label"
                    style={{ gridColumn: "1 / 4", gridRow: 10 }}
                  >
                    Лантаноїди
                  </span>
                  <span
                    className="periodic-block-label"
                    style={{ gridColumn: "1 / 4", gridRow: 11 }}
                  >
                    Актиноїди
                  </span>
                </>
              )}
              {ELEMENTS.map((e) => {
                const [x, y] = layout === "long" ? e.widePosition : e.position;
                return (
                  <button
                    key={e.number}
                    type="button"
                    ref={(node) => {
                      if (node) cells.current.set(e.number, node);
                      else cells.current.delete(e.number);
                    }}
                    className={`periodic-cell${matchIds.has(e.number) ? "" : " periodic-cell-dim"}`}
                    style={
                      {
                        gridColumn: x + 1,
                        gridRow: y + 1,
                        "--element-color": CATEGORIES[e.category].color,
                      } as React.CSSProperties
                    }
                    aria-label={`${e.number}. ${e.name}, ${e.symbol}, ${CATEGORIES[e.category].name}`}
                    aria-pressed={e.number === element.number}
                    title={`${e.name}${e.aliases.length ? ` (${e.aliases.join(", ")})` : ""} · ${CATEGORIES[e.category].name}`}
                    onKeyDown={(event) => moveFocus(event, e.number)}
                    onClick={() => onChange(e.number, layout)}
                  >
                    <span className="periodic-number">{e.number}</span>
                    <strong>{e.symbol}</strong>
                    <span className="periodic-name">{e.name}</span>
                    <span className="periodic-mass">{massLabel(e, false)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <article className="periodic-details" aria-label="Властивості обраного елемента">
          <header className="periodic-detail-header">
            <div
              className="periodic-emblem"
              style={{ "--element-color": categoryInfo.color } as React.CSSProperties}
            >
              <small>{element.number}</small>
              <strong>{element.symbol}</strong>
            </div>
            <div>
              <p className="periodic-eyebrow">
                Група {element.group} · Період {element.period}
              </p>
              <h3 aria-live="polite">{element.name}</h3>
              {element.aliases.length > 0 && <p>{element.aliases.join(", ")}</p>}
              <span className="periodic-category">
                <i style={{ background: categoryInfo.color }} />
                {categoryInfo.name}
              </span>
            </div>
            <a
              href={wikipediaUrl(element)}
              target="_blank"
              rel="noopener noreferrer"
              className="periodic-wiki"
            >
              Опис: {element.name} · Вікіпедія <ArrowUpRight size={16} />
            </a>
          </header>
          <div className="periodic-detail-controls">
            <span>Одиниці енергії</span>
            <Choice
              label="Одиниці енергії"
              value={energyUnit}
              options={[
                ["kJ/mol", "кДж/моль"],
                ["eV", "еВ на частинку"],
              ]}
              onChange={setEnergyUnit}
            />
            <small>Застосовується до спорідненості, іонізації та молярної теплоти.</small>
            <button
              type="button"
              className="periodic-back"
              onClick={() => {
                tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                cells.current.get(element.number)?.focus({ preventScroll: true });
              }}
            >
              ↑ До таблиці
            </button>
          </div>
          <dl className="periodic-properties">
            <Property title="Категорія" value={categoryInfo.name} />
            <Property
              title={`Агрегатний стан за ${temperature || "…"} ${temperatureSymbol}`}
              value={
                Number.isFinite(kelvin) ? stateAt(element, kelvin) : "Введіть коректну температуру"
              }
              note="Орієнтовно за атмосферного тиску (1 атм)."
            >
              <label className="periodic-temperature">
                Стан за температури
                <input
                  aria-label="Температура для визначення стану"
                  type="text"
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <Choice
                  label="Одиниця температури"
                  value={temperatureUnit}
                  options={[
                    ["C", "°C"],
                    ["F", "°F"],
                    ["K", "K"],
                  ]}
                  onChange={(v) => changeTemperatureUnit(v as TemperatureUnit)}
                />
              </label>
            </Property>
            <Property
              title="Атомна маса"
              value={massLabel(element)}
              unit={element.isotopeMass ? undefined : "u"}
              note={
                element.isotopeMass
                  ? "У дужках — масове число вибраного ізотопу; стандартної атомної маси немає."
                  : element.massRange
                    ? "Інтервал для природного ізотопного складу (CIAAW)."
                    : `CIAAW${element.massUncertainty ? `; похибка останніх цифр: (${element.massUncertainty})` : ""}.`
              }
            />
            <Property
              title="Електрони за енергетичними рівнями"
              value={element.shells.join(" · ")}
              note={element.configuration}
            />
            <Property
              title="Електронегативність"
              value={element.electronegativity}
              note="Безрозмірна шкала Полінга."
            />
            <Property
              title="Температура плавлення"
              value={temperatureValue(element.melting, temperatureUnit)}
              unit={temperatureSymbol}
              note={
                element.number === 2
                  ? "Лише під підвищеним тиском."
                  : [6, 33].includes(element.number)
                    ? "За підвищеного тиску; за 1 атм сублімує."
                    : undefined
              }
            />
            <Property
              title="Температура кипіння"
              value={temperatureValue(element.boiling, temperatureUnit)}
              unit={temperatureSymbol}
            />
            <Property
              title="Спорідненість до електрона"
              value={energy(element.affinity)}
              unit={energyUnit === "eV" ? "еВ" : "кДж/моль"}
              note="Додатне значення — виділення енергії; від’ємне — її поглинання."
            />
            <Property
              title="Енергія іонізації"
              value={energy(element.ionization[selectedIonization - 1])}
              unit={energyUnit === "eV" ? "еВ" : "кДж/моль"}
            >
              <Choice
                label="Ступінь іонізації"
                value={String(selectedIonization)}
                options={Array.from(
                  { length: Math.max(1, element.ionization.length) },
                  (_, i) => [String(i + 1), `Іонізація ${i + 1}`] as const,
                )}
                onChange={(v) => setIonization(Number(v))}
              />
            </Property>
            <Property title="Атомний радіус" value={element.radius[radius]} unit="пм">
              <Choice
                label="Тип радіуса"
                value={radius}
                options={[
                  ["calculated", "Розрахований"],
                  ["empirical", "Емпіричний"],
                  ["covalent", "Ковалентний"],
                  ["vanderwaals", "Ван дер Ваальса"],
                ]}
                onChange={(v) => setRadius(v as typeof radius)}
              />
            </Property>
            <Property
              title="Твердість"
              value={element.hardness[hardness]}
              unit={hardness === "mohs" ? undefined : "МПа"}
              note={hardness === "mohs" ? "Безрозмірна шкала Мооса." : undefined}
            >
              <Choice
                label="Шкала твердості"
                value={hardness}
                options={[
                  ["brinell", "Брінелля"],
                  ["mohs", "Мооса"],
                  ["vickers", "Віккерса"],
                ]}
                onChange={(v) => setHardness(v as typeof hardness)}
              />
            </Property>
            <Property title="Модуль пружності" value={element.modulus[modulus]} unit="ГПа">
              <Choice
                label="Тип модуля"
                value={modulus}
                options={[
                  ["bulk", "Об’ємний"],
                  ["shear", "Зсуву"],
                  ["young", "Юнга"],
                ]}
                onChange={(v) => setModulus(v as typeof modulus)}
              />
            </Property>
            <Property
              title="Густина"
              value={
                element.density[density] == null
                  ? null
                  : element.density[density]! / (densityUnit === "g/cm³" ? 1000 : 1)
              }
              unit={densityUnit === "g/cm³" ? "г/см³" : "кг/м³"}
              note={
                density === "stp"
                  ? "Для газів: 0 °C, 1 атм; для твердих тіл — довідкове значення."
                  : "Рідина поблизу температури плавлення."
              }
            >
              <Choice
                label="Умови густини"
                value={density}
                options={[
                  ["stp", "Стандартні умови"],
                  ["liquid", "Рідина"],
                ]}
                onChange={(v) => setDensity(v as typeof density)}
              />
              <Choice
                label="Одиниця густини"
                value={densityUnit}
                options={[
                  ["kg/m³", "кг/м³"],
                  ["g/cm³", "г/см³"],
                ]}
                onChange={setDensityUnit}
              />
            </Property>
            <Property
              title="Провідність"
              value={element.conductivity[conductivity]}
              unit={conductivity === "thermal" ? "Вт/(м·К)" : "МСм/м"}
            >
              <Choice
                label="Тип провідності"
                value={conductivity}
                options={[
                  ["thermal", "Теплопровідність"],
                  ["electric", "Електропровідність"],
                ]}
                onChange={(v) => setConductivity(v as typeof conductivity)}
              />
            </Property>
            <Property
              title="Теплові властивості"
              value={heat === "specific" ? element.heat.specific : energy(element.heat[heat])}
              unit={
                heat === "specific" ? "Дж/(кг·К)" : energyUnit === "eV" ? "еВ на атом" : "кДж/моль"
              }
            >
              <Choice
                label="Тип теплової властивості"
                value={heat}
                options={[
                  ["specific", "Питома теплоємність"],
                  ["vaporization", "Теплота випаровування"],
                  ["fusion", "Теплота плавлення"],
                ]}
                onChange={(v) => setHeat(v as typeof heat)}
              />
            </Property>
            <Property
              title="Поширеність"
              value={element.abundance[abundance]}
              unit="%"
              note="Орієнтовна масова частка."
            >
              <Choice
                label="Середовище поширеності"
                value={abundance}
                options={[
                  ["universe", "Всесвіт"],
                  ["solar", "Сонце"],
                  ["meteor", "Метеорити"],
                  ["crust", "Земна кора"],
                  ["ocean", "Океан"],
                  ["human", "Організм людини"],
                ]}
                onChange={(v) => setAbundance(v as typeof abundance)}
              />
            </Property>
            <Property
              title="Відкриття"
              value={
                element.discovered == null
                  ? null
                  : element.discovered < 0
                    ? `Відомий з давнини (близько ${Math.abs(element.discovered)} р. до н. е.)`
                    : `${element.discovered} р. н. е.`
              }
            />
          </dl>
          <footer className="periodic-sources">
            <p>
              Довідкові значення залежать від температури, тиску та алотропної форми. Для надважких
              елементів частина властивостей прогнозована; «Немає даних» означає відсутність
              значення в джерелі.
            </p>
            <p>
              Дані:{" "}
              <a
                href="https://ciaaw.org/atomic-weights.htm"
                target="_blank"
                rel="noopener noreferrer"
              >
                CIAAW 2024
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/Bowserinator/Periodic-Table-JSON"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bowserinator (CC BY-SA 3.0)
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/sweaver2112/periodic-table-data-complete"
                target="_blank"
                rel="noopener noreferrer"
              >
                Scott Weaver (MIT)
              </a>
              . Українські назви й нормалізація — цього сайту. Знімок джерел: 13.10.2026.{" "}
              <a
                href="https://github.com/2sparta/2sparta.github.io/blob/main/src/lib/periodic/SOURCES.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                Зміни й ліцензії даних
              </a>
              .
            </p>
          </footer>
        </article>
      </div>
    </section>
  );
}
