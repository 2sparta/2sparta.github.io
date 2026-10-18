import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PRESETS,
  CAPABILITIES,
  WORK_TYPES,
  WORK_LABELS,
  applyPreset,
  type SchoolSettings,
  type Preset,
  type Capability,
} from "@/lib/school/settings";
import { calculateSemester } from "@/lib/school/grading";
import { saveSchoolSettings } from "@/lib/school/settings-api";
import { useSchoolSettings } from "./school-settings-context";
import { Panel, PanelTitle, Hint, PillButton, Select, TextInput } from "./ui/panel";
const FLAGS: {
  key: keyof Pick<
    SchoolSettings,
    | "studentArticles"
    | "points"
    | "chat"
    | "selfGovernment"
    | "clubs"
    | "studentHomework"
    | "allowSelfAssessment"
    | "articleLikes"
  >;
  uk: string;
  en: string;
  help: string;
  helpEn: string;
}[] = [
  {
    key: "studentArticles",
    uk: "Статті учнів",
    en: "Student articles",
    help: "Учні можуть створювати й редагувати власні статті; інші матеріали додає вчитель.",
    helpEn: "Students may create and edit their own articles. Other resources are teacher-managed.",
  },
  {
    key: "points",
    uk: "Бали та додаткова мотивація",
    en: "Points and motivation",
    help: "Особисті бали, рейтинг, бюджети та нагороди. Це окремо від навчальних оцінок.",
    helpEn: "Personal points, ranking, budgets and rewards, separate from academic marks.",
  },
  {
    key: "chat",
    uk: "Шкільний чат",
    en: "School chat",
    help: "Шкільні, класові та особисті чати в застосунку.",
    helpEn: "School, class and direct chats in the app.",
  },
  {
    key: "selfGovernment",
    uk: "Самоврядування",
    en: "Student council",
    help: "Посади, вибори старости, події й чергування. Права посад задаються нижче.",
    helpEn:
      "Offices, monitor elections, activities and duty rosters. Configure office permissions below.",
  },
  {
    key: "clubs",
    uk: "Гуртки й факультативи",
    en: "Clubs and electives",
    help: "Каталог гуртків та запис учнів.",
    helpEn: "Club directory and student enrollment.",
  },
  {
    key: "studentHomework",
    uk: "Учнівське домашнє завдання",
    en: "Student-posted homework",
    help: "ДЗ можуть додавати уповноважені учні, староста та посади з відповідним правом.",
    helpEn: "Authorized students, monitors and permitted office holders may post class homework.",
  },
  {
    key: "allowSelfAssessment",
    uk: "Самооцінювання за урок",
    en: "Lesson self-assessment",
    help: "Учень подає 1–12 за звичайний урок. До перевірки бал не впливає на середній. Контрольні, практичні, самостійні, семестрові й підсумкові оцінки виставляє вчитель.",
    helpEn:
      "Students submit 1–12 for regular lessons, pending teacher review. Tests, practical, independent, semester and final marks remain teacher-only.",
  },
  {
    key: "articleLikes",
    uk: "Лайки статей",
    en: "Article likes",
    help: "Один лайк на читача для опублікованої статті; повторне натискання прибирає його.",
    helpEn: "One like per reader for published articles; click again to remove it.",
  },
];
export function SchoolSettingsEditor({ uk }: { uk: boolean }) {
  const query = useSchoolSettings();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SchoolSettings | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const edit = (next: SchoolSettings) => {
    if (draft === null) setDraftRevision(query.data?.revision ?? 0);
    setDraft(next);
  };
  const value = draft ?? query.settings;
  const change = (patch: Partial<SchoolSettings>) =>
    edit({ ...structuredClone(value), ...patch, preset: "custom" });
  const save = useMutation({
    mutationFn: () =>
      saveSchoolSettings({ settings: value, revision: draftRevision ?? query.data?.revision ?? 0 }),
    onSuccess: async () => {
      setDraft(null);
      setDraftRevision(null);
      await qc.invalidateQueries({ queryKey: ["school-settings"] });
      await qc.invalidateQueries({ queryKey: ["grading-settings"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["office-holders"] });
      toast.success(uk ? "Налаштування школи збережено" : "School settings saved");
    },
    onError: (e) =>
      toast.error(
        e.message === "CONFLICT"
          ? uk
            ? "Налаштування змінилися в іншому вікні. Оновіть дані й повторіть зміни."
            : "Settings changed in another window. Refresh and reapply your changes."
          : uk
            ? "Перевірте назви, коефіцієнти та дати. Зміни ще не збережено."
            : "Check names, weights and dates. Changes have not been saved.",
      ),
  });
  if (query.isPending)
    return (
      <Panel>
        <p role="status">{uk ? "Завантаження налаштувань школи…" : "Loading school settings…"}</p>
      </Panel>
    );
  if (query.isError)
    return (
      <Panel>
        <p role="alert">
          {uk ? "Не вдалося завантажити налаштування школи." : "Could not load school settings."}
        </p>
        <PillButton onClick={() => void query.refetch()}>{uk ? "Повторити" : "Retry"}</PillButton>
      </Panel>
    );
  const policy = value.grading;
  const example = calculateSemester(
    [
      { value: "8", kind: "lesson", workType: "lesson", createdAt: "" },
      { value: "12", kind: "lesson", workType: "test", createdAt: "" },
      { value: "10", kind: "lesson", workType: "practical", createdAt: "" },
    ],
    policy,
  );
  const officeChange = (id: string, patch: Partial<SchoolSettings["offices"][string]>) =>
    change({ offices: { ...value.offices, [id]: { ...value.offices[id], ...patch } } });
  return (
    <Panel>
      <PanelTitle>{uk ? "Налаштування школи" : "School settings"}</PanelTitle>
      <Hint>
        {uk
          ? "Спільні для всіх учасників. Оберіть пресет або змініть окремі параметри, потім збережіть. Вимкнення приховує можливість і блокує нові дії; збережені матеріали та бали залишаються."
          : "Shared by all members. Choose a preset or adjust individual options, then save. Disabled features block new actions while stored content and points remain."}
      </Hint>
      <fieldset disabled={save.isPending} className="space-y-6">
        <div className="grid gap-3 lg:grid-cols-3">
          {(Object.keys(PRESETS) as Preset[]).map((id) => (
            <section
              key={id}
              className={`rounded-2xl border p-4 ${value.preset === id ? "border-forest-mid bg-forest/10" : "border-hairline"}`}
            >
              <h3 className="font-display font-extrabold">{PRESETS[id].title[uk ? 0 : 1]}</h3>
              <p className="my-3 text-xs leading-5 text-muted">
                {PRESETS[id].description[uk ? 0 : 1]}
              </p>
              <PillButton
                tone={value.preset === id ? "primary" : "ghost"}
                onClick={() => edit(applyPreset(value, id))}
              >
                {uk ? "Обрати пресет" : "Choose preset"}
              </PillButton>
            </section>
          ))}
        </div>
        <p className="text-sm font-bold">
          {uk ? "Поточний набір: " : "Current configuration: "}
          {value.preset === "custom"
            ? uk
              ? "Власні налаштування"
              : "Custom settings"
            : PRESETS[value.preset].title[uk ? 0 : 1]}
          {draft ? (uk ? " · незбережені зміни" : " · unsaved changes") : ""}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {FLAGS.map((flag) => (
            <label
              key={flag.key}
              className="flex items-start gap-3 rounded-xl border border-hairline p-3 text-sm"
            >
              <input
                className="mt-1"
                type="checkbox"
                checked={value[flag.key]}
                onChange={(e) => change({ [flag.key]: e.target.checked })}
              />
              <span>
                <strong>{uk ? flag.uk : flag.en}</strong>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  {uk ? flag.help : flag.helpEn}
                </span>
              </span>
            </label>
          ))}
        </div>
        <section className="space-y-3 border-t border-hairline pt-5">
          <h3 className="font-display text-lg font-extrabold">
            {uk ? "Картки справа на головній" : "Home sidebar cards"}
          </h3>
          <label className="block text-sm font-bold">
            {uk ? "Вміст стрічки" : "Feed content"}
            <Select
              className="mt-2 block"
              value={value.feedMode}
              onChange={(e) => change({ feedMode: e.target.value as SchoolSettings["feedMode"] })}
            >
              <option value="off">{uk ? "Вимкнено" : "Off"}</option>
              <option value="proposals">{uk ? "Пропозиції учнів" : "Student proposals"}</option>
              <option value="news">{uk ? "Шкільні новини" : "School news"}</option>
            </Select>
          </label>
          <p className="text-xs text-muted">
            {uk
              ? "Пропозиції подають учні. Новини публікують учителі та посади з правом публікації новин. Коментарі можуть видаляти їхні автори й учителі."
              : "Students submit proposals. Teachers and permitted office holders publish news. Comment authors and teachers may delete comments."}
          </p>
          <label className="mr-5 inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.feedLikes}
              onChange={(e) => change({ feedLikes: e.target.checked })}
            />
            {uk ? "Лайки пропозицій і новин" : "Proposal and news likes"}
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.feedComments}
              onChange={(e) => change({ feedComments: e.target.checked })}
            />
            {uk ? "Коментарі пропозицій і новин" : "Proposal and news comments"}
          </label>
        </section>
        <details className="border-t border-hairline pt-5">
          <summary className="min-h-11 cursor-pointer font-display text-lg font-extrabold">
            {uk ? "Посади й можливості самоврядування" : "Council offices and permissions"}
          </summary>
          <p className="mb-4 text-xs leading-5 text-muted">
            {uk
              ? "Одна посада на учня. Призначення — у розділі самоврядування. Видалення посади знімає призначення після збереження. Права діють лише коли відповідна можливість школи ввімкнена; посади не дають доступу до вчительського оцінювання."
              : "One office per student. Assign holders in Student council. Removing an office clears its appointment on save. Permissions also require the corresponding school feature. Offices cannot grant teacher grading access."}
          </p>
          <div className="space-y-4">
            {Object.entries(value.offices).map(([id, office]) => (
              <div key={id} className="rounded-xl border border-hairline p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <TextInput
                    aria-label={uk ? "Назва посади" : "Office name"}
                    className="min-w-0 flex-1"
                    maxLength={120}
                    value={office.name}
                    onChange={(e) => officeChange(id, { name: e.target.value })}
                  />
                  <PillButton
                    tone="ghost"
                    onClick={() => {
                      const offices = { ...value.offices };
                      delete offices[id];
                      change({ offices });
                    }}
                  >
                    {uk ? "Прибрати посаду" : "Remove office"}
                  </PillButton>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(Object.keys(CAPABILITIES) as Capability[]).map((cap) => (
                    <label key={cap} className="flex min-h-9 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={office.permissions.includes(cap)}
                        onChange={(e) =>
                          officeChange(id, {
                            permissions: e.target.checked
                              ? [...office.permissions, cap]
                              : office.permissions.filter((v) => v !== cap),
                          })
                        }
                      />
                      {CAPABILITIES[cap][uk ? 0 : 1]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <PillButton
            className="mt-3"
            tone="ghost"
            disabled={Object.keys(value.offices).length >= 30}
            onClick={() =>
              change({
                offices: {
                  ...value.offices,
                  [`role_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`]: {
                    name: uk ? "Нова посада" : "New office",
                    permissions: [],
                  },
                },
              })
            }
          >
            {uk ? "Додати посаду" : "Add office"}
          </PillButton>
        </details>
        <details className="border-t border-hairline pt-5" open>
          <summary className="min-h-11 cursor-pointer font-display text-lg font-extrabold">
            {uk ? "Семестрові оцінки та коефіцієнти" : "Semester marks and weights"}
          </summary>
          <p className="mb-4 text-xs leading-5 text-muted">
            {uk
              ? "Розрахунок пропонує оцінку; остаточно зберігає її вчитель. У середньому всі оцінки рівноцінні. У зваженому середньому: сума (оцінка × коефіцієнт) / сума коефіцієнтів. Відсутності, неперевірені самооцінки та підсумкові оцінки не враховуються. У зваженому режимі коефіцієнт 0 виключає вид роботи."
              : "The calculation suggests a mark; a teacher saves the final result. Mean treats marks equally. Weighted mean is sum(mark × weight) / sum(weights). Absences, pending submissions and final marks are excluded. In weighted mode, a zero weight excludes that work type."}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold">
              {uk ? "Метод розрахунку" : "Calculation method"}
              <Select
                className="mt-1 block w-full"
                value={policy.method}
                onChange={(e) =>
                  change({ grading: { ...policy, method: e.target.value as typeof policy.method } })
                }
              >
                <option value="mean">{uk ? "Середнє арифметичне" : "Mean"}</option>
                <option value="weighted">{uk ? "Зважене середнє" : "Weighted mean"}</option>
              </Select>
            </label>
            <label className="text-xs font-bold">
              {uk ? "Округлення" : "Rounding"}
              <Select
                className="mt-1 block w-full"
                value={policy.rounding}
                onChange={(e) =>
                  change({
                    grading: { ...policy, rounding: e.target.value as typeof policy.rounding },
                  })
                }
              >
                <option value="nearest">{uk ? "До найближчого" : "Nearest"}</option>
                <option value="floor">{uk ? "Вниз" : "Down"}</option>
                <option value="ceil">{uk ? "Вгору" : "Up"}</option>
              </Select>
            </label>
            <label className="text-xs font-bold">
              {uk ? "Мінімум оцінок" : "Minimum mark count"}
              <TextInput
                type="number"
                className="mt-1 w-full"
                min={1}
                max={100}
                value={policy.minimumMarks}
                onChange={(e) =>
                  change({ grading: { ...policy, minimumMarks: Number(e.target.value) } })
                }
              />
            </label>
          </div>
          <label className="my-3 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={policy.includeHomework}
              onChange={(e) =>
                change({ grading: { ...policy, includeHomework: e.target.checked } })
              }
            />
            {uk ? "Враховувати домашні роботи" : "Include homework marks"}
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORK_TYPES.map((type) => (
              <label key={type} className="text-xs font-bold">
                {WORK_LABELS[type][uk ? 0 : 1]}
                <TextInput
                  type="number"
                  aria-label={`${uk ? "Коефіцієнт" : "Weight"}: ${WORK_LABELS[type][uk ? 0 : 1]}`}
                  className="mt-1 block w-full"
                  min={0}
                  max={10}
                  step={0.1}
                  value={policy.weights[type]}
                  onChange={(e) =>
                    change({
                      grading: {
                        ...policy,
                        weights: { ...policy.weights, [type]: Number(e.target.value) },
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["semester1From", "semester1To", "semester2From", "semester2To"] as const).map(
              (key, i) => (
                <label key={key} className="text-xs font-bold">
                  {uk
                    ? [
                        "I семестр: від (ММ-ДД)",
                        "I семестр: до (ММ-ДД)",
                        "II семестр: від (ММ-ДД)",
                        "II семестр: до (ММ-ДД)",
                      ][i]
                    : [
                        "Semester 1 from (MM-DD)",
                        "Semester 1 to (MM-DD)",
                        "Semester 2 from (MM-DD)",
                        "Semester 2 to (MM-DD)",
                      ][i]}
                  <TextInput
                    className="mt-1 w-full"
                    placeholder="09-01"
                    value={policy[key]}
                    onChange={(e) => change({ grading: { ...policy, [key]: e.target.value } })}
                  />
                </label>
              ),
            )}
          </div>
          <p className="rounded-xl bg-surface-2 p-3 text-sm" role="status">
            {uk
              ? "Приклад: урок 8, контрольна 12, практична 10 → "
              : "Example: lesson 8, test 12, practical 10 → "}
            <strong>{example.value ?? "—"}</strong>
            {example.raw !== null
              ? ` (${example.raw.toFixed(2)})`
              : uk
                ? " · недостатньо оцінок або всі ваги нульові"
                : " · insufficient marks or all weights are zero"}
          </p>
        </details>
        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          <PillButton disabled={!draft || save.isPending} onClick={() => save.mutate()}>
            {save.isPending
              ? uk
                ? "Збереження…"
                : "Saving…"
              : uk
                ? "Зберегти налаштування школи"
                : "Save school settings"}
          </PillButton>
          <PillButton
            tone="ghost"
            disabled={!draft}
            onClick={() => {
              setDraft(null);
              setDraftRevision(null);
            }}
          >
            {uk ? "Скасувати зміни" : "Discard changes"}
          </PillButton>
        </div>
      </fieldset>
    </Panel>
  );
}
