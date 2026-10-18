import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UserRound, X } from "lucide-react";
import { assignOffice, listOfficeHolders, listStudents } from "@/lib/school/server";
import { useSchoolSettings } from "./school-settings-context";
import type { RosterStudent } from "@/lib/school/types";
import { useMeQuery } from "@/components/session-gate";
import { usePrefs } from "@/lib/prefs";
import { Hint, Panel, PanelTitle, PillButton, Select, TextInput } from "./ui/panel";

export function OfficeBoard() {
  const uk = usePrefs((s) => s.lang) === "uk";
  const { settings } = useSchoolSettings();
  const officeName = (id: string | null | undefined) => settings.offices[id ?? ""]?.name ?? id ?? "";
  const teacher = useMeQuery().data?.profile.role === "teacher";
  const holders = useQuery({ queryKey: ["office-holders"], queryFn: listOfficeHolders });
  const roster = useQuery({ queryKey: ["students"], queryFn: listStudents, enabled: teacher });
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Panel>
      <PanelTitle>{uk ? "Комітети та спікер" : "Committees and speaker"}</PanelTitle>
      <Hint>
        {uk
          ? "Склад шкільного самоврядування. Одному учню можна призначити одну посаду."
          : "School council directory. Each student can hold one office."}
      </Hint>
      {holders.isPending && <p role="status">{uk ? "Завантаження…" : "Loading…"}</p>}
      {(holders.isError || roster.isError) && (
        <p role="alert" className="text-terracotta">
          {uk ? "Не вдалося завантажити призначення." : "Could not load appointments."}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void holders.refetch();
              if (teacher) void roster.refetch();
            }}
          >
            {uk ? "Повторити" : "Retry"}
          </button>
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {Object.entries(settings.offices).map(([id, entry]) => {
          const o = { id, ...entry };
          const holder = holders.data?.find((s) => s.office === o.id);
          return (
            <section key={o.id} className="rounded-2xl border border-hairline p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-display font-extrabold">{o.name}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${holder ? "bg-forest/10 text-forest-mid" : "bg-surface-2 text-muted"}`}
                >
                  {holder ? (uk ? "Призначено" : "Assigned") : uk ? "Вакантна" : "Vacant"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-forest-mid">
                  <UserRound className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold">
                    {holder?.name ?? (uk ? "Посада вільна" : "No appointment")}
                  </p>
                  <p className="text-xs text-muted">
                    {holder
                      ? `${holder.className}${settings.points ? ` · ${uk ? "Бюджет" : "Budget"}: ${holder.budget.toLocaleString(uk ? "uk-UA" : "en-GB")}` : ""}`
                      : uk
                        ? "Оберіть представника школи"
                        : "Choose a school representative"}
                  </p>
                </div>
              </div>
              {teacher && editing !== o.id && (
                <PillButton
                  type="button"
                  tone="ghost"
                  className="mt-3"
                  disabled={
                    roster.isPending || roster.isError || holders.isPending || holders.isError
                  }
                  onClick={() => setEditing(o.id)}
                >
                  {uk ? "Керувати призначенням" : "Manage appointment"}
                </PillButton>
              )}
              {teacher && editing === o.id && (
                <OfficeEditor
                  key={o.id}
                  office={o.id}
                  people={roster.data ?? []}
                  holderId={holder?.id ?? null}
                  onClose={() => {
                    setEditing(null);
                    void holders.refetch();
                    void roster.refetch();
                  }}
                />
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function OfficeEditor({
  office,
  people,
  holderId,
  onClose,
}: {
  office: string;
  people: RosterStudent[];
  holderId: string | null;
  onClose: () => void;
}) {
  const uk = usePrefs((s) => s.lang) === "uk";
  const { settings } = useSchoolSettings();
  const officeName = (id: string | null | undefined) => settings.offices[id ?? ""]?.name ?? id ?? "";
  const holder = people.find((p) => p.id === holderId);
  // Capture expectations when opening; refreshes must not silently change the submitted intent.
  const [expectedHolderId] = useState(holderId);
  const [expectedHolderBudget] = useState(holder?.budget ?? 0);
  const [selectedId, setSelectedId] = useState(holderId ?? "");
  const [expectedSelectedOffice, setExpectedSelectedOffice] = useState(holder?.office ?? null);
  const [expectedSelectedBudget, setExpectedSelectedBudget] = useState(holder?.budget ?? 0);
  const [budget, setBudget] = useState(String(holder?.budget ?? 0));
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const selected = people.find((p) => p.id === selectedId);
  const choices = people
    .filter(
      (p) =>
        (!classId || p.classId === classId) &&
        `${p.name} ${p.className}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const classes = [...new Map(people.map((p) => [p.classId, p.className])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "uk"),
  );
  const validBudget = /^\d+$/.test(budget) && Number(budget) <= 1_000_000;
  const save = useMutation({
    mutationFn: () =>
      assignOffice({
        data: {
          office,
          rosterId: selectedId || null,
          budget: selectedId ? Number(budget) : 0,
          expectedHolderId,
          expectedHolderBudget,
          expectedSelectedOffice,
          expectedSelectedBudget,
        },
      }),
    onSuccess: async () => {
      await Promise.all(
        ["office-holders", "students", "me", "rewards"].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onClose();
    },
  });
  const pick = (id: string) => {
    const person = people.find((p) => p.id === id);
    setSelectedId(id);
    setExpectedSelectedOffice(person?.office ?? null);
    setExpectedSelectedBudget(person?.budget ?? 0);
    setBudget(String(person?.budget ?? 0));
    save.reset();
  };
  return (
    <div className="mt-4 space-y-3 border-t border-hairline pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{uk ? "Нове призначення" : "Appointment details"}</p>
        <button
          type="button"
          aria-label={uk ? "Закрити редактор" : "Close editor"}
          disabled={save.isPending}
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>
      <fieldset disabled={save.isPending} className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{uk ? "Пошук учня" : "Search students"}</span>
          <Search className="absolute top-3.5 left-3 size-4 text-muted" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={uk ? "Пошук за ім’ям або класом" : "Search name or class"}
            className="w-full pl-9"
          />
        </label>
        <label className="block text-xs font-bold">
          {uk ? "Клас" : "Class"}
          <Select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full"
          >
            <option value="">{uk ? "Усі класи" : "All classes"}</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <div
          className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-hairline p-1"
          role="group"
          aria-label={uk ? "Кандидати на посаду" : "Candidates"}
        >
          <button
            type="button"
            className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${!selectedId ? "bg-forest/10" : "hover:bg-surface-2"}`}
            onClick={() => pick("")}
          >
            {uk ? "Залишити посаду вакантною" : "Leave office vacant"}
            {!selectedId && <Check className="size-4" />}
          </button>
          {!choices.length && (
            <p className="p-3 text-sm text-muted">
              {uk ? "Учнів не знайдено" : "No matching students"}
            </p>
          )}
          {choices.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selectedId === p.id}
              onClick={() => pick(p.id)}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left ${selectedId === p.id ? "bg-forest/10" : "hover:bg-surface-2"}`}
            >
              <span>
                <span className="block text-sm font-bold">
                  {p.name} · {p.className}
                </span>
                {p.office && (
                  <span className="block text-xs text-muted">{officeName(p.office)}</span>
                )}
              </span>
              {selectedId === p.id && <Check className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
        <p className="text-sm font-bold">
          {uk ? "Обрано" : "Selected"}:{" "}
          {selected
            ? `${selected.name} · ${selected.className}`
            : uk
              ? "Вакантна посада"
              : "Vacant office"}
        </p>
        {selectedId && settings.points && (
          <label className="block text-xs font-bold">
            {uk ? "Бюджет представника (0–1 000 000)" : "Representative budget (0–1,000,000)"}
            <TextInput
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full"
            />
          </label>
        )}
        {selected?.office && selected.office !== office && (
          <p className="rounded-xl bg-cream p-3 text-sm">
            {uk
              ? `Учень залишить посаду «${officeName(selected.office)}». Вона стане вакантною.`
              : `This student will leave “${officeName(selected.office)}”. That office will become vacant.`}
          </p>
        )}
        {holder && holder.id !== selectedId && (
          <p className="text-sm text-muted">
            {uk
              ? `${holder.name} буде звільнено з цієї посади. Особисті бали не зміняться.`
              : `${holder.name} will leave this office. Personal points stay the same.`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <PillButton
            type="button"
            disabled={Boolean(selectedId) && !validBudget}
            onClick={() => save.mutate()}
          >
            {save.isPending
              ? uk
                ? "Збереження…"
                : "Saving…"
              : uk
                ? "Підтвердити зміни"
                : "Confirm changes"}
          </PillButton>
          <PillButton type="button" tone="ghost" onClick={onClose}>
            {uk ? "Скасувати" : "Cancel"}
          </PillButton>
        </div>
      </fieldset>
      {save.isError && (
        <p role="alert" className="text-sm text-terracotta">
          {save.error.message === "CONFLICT"
            ? uk
              ? "Призначення змінилося. Закрийте редактор, оновіть список і спробуйте знову."
              : "The appointment changed. Close the editor, refresh and try again."
            : uk
              ? "Не вдалося зберегти. Спробуйте ще раз."
              : "Could not save. Please retry."}
        </p>
      )}
    </div>
  );
}
