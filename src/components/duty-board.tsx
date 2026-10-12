import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { getDuty, setDuty } from "@/lib/school/server";
import {
  insertDutyColumn,
  insertDutyRow,
  duplicateDutyColumn,
  moveDutyColumn,
  MAX_DUTY_COLS,
  MAX_DUTY_ROWS,
  pasteDutyCells,
  type DutyGrid,
} from "@/lib/school/duty-grid";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { Hint, Panel, PanelTitle, PillButton } from "@/components/ui/panel";

export function DutyBoard({
  classId,
  onDirtyChange,
}: {
  classId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  return <DutyBoardSession key={classId} classId={classId} onDirtyChange={onDirtyChange} />;
}
function DutyBoardSession({
  classId,
  onDirtyChange,
}: {
  classId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const lang = usePrefs((s) => s.lang);
  const uk = lang === "uk";
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["duty", classId],
    queryFn: () => getDuty({ data: { classId } }),
    enabled: Boolean(classId),
  });
  const [draft, setDraft] = useState<DutyGrid | null>(null);
  const [base, setBase] = useState<{ grid: DutyGrid; revision: number } | null>(null);
  const [past, setPast] = useState<DutyGrid[]>([]);
  const [future, setFuture] = useState<DutyGrid[]>([]);
  const [notice, setNotice] = useState("");
  const table = useRef<HTMLTableElement>(null);
  const grid = draft ?? q.data?.grid;
  const dirty = Boolean(draft && base && JSON.stringify(draft) !== JSON.stringify(base.grid));
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm(
        uk
          ? "Залишити сторінку й відкинути незбережені зміни таблиці?"
          : "Leave and discard unsaved table changes?",
      ),
    enableBeforeUnload: dirty,
  });
  useEffect(() => {
    if (!dirty) return;
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () => setDuty({ data: { classId, ...draft!, revision: base!.revision } }),
    onSuccess: async (result) => {
      qc.setQueryData(["duty", classId], { ...q.data, grid: draft, revision: result.revision });
      setDraft(null);
      setBase(null);
      setPast([]);
      setFuture([]);
      setNotice(uk ? "Таблицю збережено" : "Table saved");
      await qc.invalidateQueries({ queryKey: ["duty", classId] });
    },
  });
  if (!classId) return null;
  if (q.isPending)
    return (
      <Panel>
        <p role="status">{uk ? "Завантаження чергувань…" : "Loading duty table…"}</p>
      </Panel>
    );
  if (q.isError || !grid)
    return (
      <Panel>
        <p role="alert">{uk ? "Не вдалося завантажити таблицю." : "Could not load table."}</p>
        <PillButton type="button" tone="ghost" onClick={() => void q.refetch()}>
          {uk ? "Повторити" : "Retry"}
        </PillButton>
      </Panel>
    );
  const editing = draft !== null;
  const change = (next: DutyGrid) => {
    if (next === grid) return;
    setPast((p) => [...p.slice(-49), grid]);
    setFuture([]);
    setDraft(next);
    setNotice("");
    save.reset();
  };
  const undo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setFuture((f) => [grid, ...f]);
    setPast((p) => p.slice(0, -1));
    setDraft(prev);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((p) => [...p, grid]);
    setFuture((f) => f.slice(1));
    setDraft(next);
  };
  const discard = () => {
    if (dirty && !window.confirm(uk ? "Відкинути незбережені зміни?" : "Discard unsaved changes?"))
      return;
    setDraft(null);
    setBase(null);
    setPast([]);
    setFuture([]);
    save.reset();
    void q.refetch();
  };
  const delRow = (r: number) => {
    if (
      grid.rows[r].some(Boolean) &&
      !window.confirm(uk ? "Видалити рядок із даними?" : "Delete populated row?")
    )
      return;
    change({ ...grid, rows: grid.rows.filter((_, i) => i !== r) });
  };
  const delCol = (c: number) => {
    if (
      (grid.cols[c] || grid.rows.some((r) => r[c])) &&
      !window.confirm(uk ? "Видалити колонку та її дані?" : "Delete column and its data?")
    )
      return;
    change({
      cols: grid.cols.filter((_, i) => i !== c),
      rows: grid.rows.map((r) => r.filter((_, i) => i !== c)),
    });
  };
  const moveRow = (r: number, delta: number) => {
    const rows = [...grid.rows];
    [rows[r], rows[r + delta]] = [rows[r + delta], rows[r]];
    change({ ...grid, rows });
  };
  const focusCell = (r: number, c: number) =>
    table.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${r}:${c}"]`)?.focus();
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>, r: number, c: number) => {
    if (e.key === "Tab") {
      const index = r * grid.cols.length + c + (e.shiftKey ? -1 : 1);
      if (index >= 0 && index < grid.rows.length * grid.cols.length) {
        e.preventDefault();
        focusCell(Math.floor(index / grid.cols.length), index % grid.cols.length);
      }
    }
    if (e.key === "Enter" && !e.shiftKey && r < grid.rows.length - 1) {
      e.preventDefault();
      focusCell(r + 1, c);
    }
  };
  const edgeButton =
    "absolute z-10 grid size-6 place-items-center rounded-full border border-forest/30 bg-surface text-forest-mid shadow-sm hover:bg-forest-mid hover:text-paper disabled:opacity-30";
  const exportCsv = () => {
    const csv =
      "\uFEFF" +
      [grid.cols, ...grid.rows]
        .map((r) =>
          r.map((v) => `"${(/^[=+@-]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "duty-table.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PanelTitle>{t.dutyTitle}</PanelTitle>
          <Hint>
            {editing
              ? uk
                ? "Натискайте + на межі рядка або колонки. Tab — наступна клітинка, Enter — нижня, Shift+Enter — новий рядок у клітинці. Можна вставляти дані з Excel."
                : "Use + at row and column edges. Tab moves to the next cell, Enter moves down, Shift+Enter adds a line. Paste cells from Excel."
              : t.dutyHint}
          </Hint>
        </div>
        <div className="flex flex-wrap gap-2">
          <PillButton type="button" tone="ghost" onClick={exportCsv}>
            <Download className="mr-2 size-4" />
            CSV
          </PillButton>
          {q.data?.canEdit && !editing && (
            <PillButton
              type="button"
              onClick={() => {
                setDraft(grid);
                setBase({ grid, revision: q.data!.revision });
                setNotice("");
              }}
            >
              {uk ? "Редагувати таблицю" : "Edit table"}
            </PillButton>
          )}
        </div>
      </div>
      <fieldset disabled={save.isPending} className="min-w-0">
        {editing && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl bg-surface-2 disabled:opacity-40"
              aria-label={uk ? "Скасувати останню зміну" : "Undo"}
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl bg-surface-2 disabled:opacity-40"
              aria-label={uk ? "Повторити зміну" : "Redo"}
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 className="size-4" />
            </button>
            <span className="text-xs text-muted">
              {grid.rows.length}/{MAX_DUTY_ROWS} {uk ? "рядків" : "rows"} · {grid.cols.length}/
              {MAX_DUTY_COLS} {uk ? "колонок" : "columns"}
            </span>
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface-2/20 p-4">
          <table
            ref={table}
            className="w-full min-w-[480px] table-fixed border-collapse text-sm"
            aria-label={t.dutyTitle}
          >
            <thead>
              <tr>
                {grid.cols.map((col, c) => (
                  <th
                    key={c}
                    scope="col"
                    className="relative border border-hairline bg-surface-2 p-3 text-left align-top"
                  >
                    {editing ? (
                      <>
                        <input
                          aria-label={`${uk ? "Назва колонки" : "Column name"} ${c + 1}`}
                          maxLength={2000}
                          value={col}
                          onChange={(e) =>
                            change({
                              ...grid,
                              cols: grid.cols.map((v, i) => (i === c ? e.target.value : v)),
                            })
                          }
                          placeholder={`${t.dutyCol} ${c + 1}`}
                          className="min-h-10 w-full bg-transparent pl-5 font-bold outline-none focus:ring-2 focus:ring-forest-mid/30"
                        />
                        <button
                          type="button"
                          disabled={grid.cols.length >= MAX_DUTY_COLS}
                          className={`${edgeButton} -top-3 -right-3`}
                          aria-label={`${uk ? "Додати колонку після" : "Insert column after"} ${c + 1}`}
                          onClick={() => change(insertDutyColumn(grid, c + 1))}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        {c === 0 && (
                          <button
                            type="button"
                            disabled={grid.cols.length >= MAX_DUTY_COLS}
                            className={`${edgeButton} -top-3 -left-3`}
                            aria-label={uk ? "Додати першу колонку" : "Insert first column"}
                            onClick={() => change(insertDutyColumn(grid, 0))}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        )}
                        <details className="absolute top-3 left-0 z-20">
                          <summary
                            aria-label={`${uk ? "Дії з колонкою" : "Column actions"} ${c + 1}`}
                            className="grid h-8 w-7 cursor-pointer list-none place-items-center rounded-lg text-muted hover:bg-surface"
                          >
                            <MoreHorizontal className="size-4" />
                          </summary>
                          <div className="absolute top-8 left-0 w-48 rounded-xl border border-hairline bg-surface p-2 shadow-xl">
                            {[
                              {
                                label: uk ? "Дублювати" : "Duplicate",
                                icon: Copy,
                                disabled: grid.cols.length >= MAX_DUTY_COLS,
                                action: () => change(duplicateDutyColumn(grid, c)),
                              },
                              {
                                label: uk ? "Перемістити ліворуч" : "Move left",
                                icon: ArrowLeft,
                                disabled: c === 0,
                                action: () => change(moveDutyColumn(grid, c, -1)),
                              },
                              {
                                label: uk ? "Перемістити праворуч" : "Move right",
                                icon: ArrowRight,
                                disabled: c === grid.cols.length - 1,
                                action: () => change(moveDutyColumn(grid, c, 1)),
                              },
                              {
                                label: t.delete,
                                icon: Trash2,
                                disabled: grid.cols.length <= 1,
                                action: () => delCol(c),
                              },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                disabled={item.disabled}
                                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs hover:bg-surface-2 disabled:opacity-30"
                                onClick={(e) => {
                                  (e.currentTarget.closest("details") as HTMLDetailsElement).open =
                                    false;
                                  item.action();
                                }}
                              >
                                <item.icon className="size-4" />
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </details>
                      </>
                    ) : (
                      col || "—"
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row, r) => (
                <tr key={r} className="even:bg-surface-2/40">
                  {row.map((cell, c) => (
                    <td key={c} className="relative border border-hairline p-3 align-top">
                      {editing ? (
                        <textarea
                          data-cell={`${r}:${c}`}
                          rows={2}
                          maxLength={2000}
                          aria-label={`${uk ? "Рядок" : "Row"} ${r + 1}, ${grid.cols[c] || c + 1}`}
                          value={cell}
                          onKeyDown={(e) => keys(e, r, c)}
                          onChange={(e) =>
                            change({
                              ...grid,
                              rows: grid.rows.map((rr, i) =>
                                i === r ? rr.map((v, j) => (j === c ? e.target.value : v)) : rr,
                              ),
                            })
                          }
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text/plain");
                            if (text.includes("\t") || text.includes("\n")) {
                              e.preventDefault();
                              try {
                                change(pasteDutyCells(grid, r, c, text));
                              } catch {
                                setNotice(
                                  uk
                                    ? "Вставка перевищує ліміт 40 рядків або 12 колонок."
                                    : "Paste exceeds 40 rows or 12 columns.",
                                );
                              }
                            }
                          }}
                          className={`min-h-12 w-full resize-y rounded-md bg-transparent outline-none focus:bg-surface focus:ring-2 focus:ring-forest-mid/40 ${c === 0 ? "pl-5" : ""}`}
                        />
                      ) : (
                        <span className="block min-h-6 whitespace-pre-wrap break-words">
                          {cell || "—"}
                        </span>
                      )}
                      {editing && c === 0 && (
                        <>
                          <button
                            type="button"
                            disabled={grid.rows.length >= MAX_DUTY_ROWS}
                            className={`${edgeButton} -bottom-3 -left-3`}
                            aria-label={`${uk ? "Додати рядок після" : "Insert row after"} ${r + 1}`}
                            onClick={() => change(insertDutyRow(grid, r + 1))}
                          >
                            <Plus className="size-3.5" />
                          </button>
                          {r === 0 && (
                            <button
                              type="button"
                              disabled={grid.rows.length >= MAX_DUTY_ROWS}
                              className={`${edgeButton} -top-3 -left-3`}
                              aria-label={uk ? "Додати перший рядок" : "Insert first row"}
                              onClick={() => change(insertDutyRow(grid, 0))}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          )}
                          <details className="absolute top-3 left-0 z-20">
                            <summary
                              aria-label={`${uk ? "Дії з рядком" : "Row actions"} ${r + 1}`}
                              className="grid h-8 w-7 cursor-pointer list-none place-items-center rounded-lg text-muted hover:bg-surface"
                            >
                              <MoreHorizontal className="size-4" />
                            </summary>
                            <div className="absolute top-8 left-0 w-48 rounded-xl border border-hairline bg-surface p-2 shadow-xl">
                              {[
                                {
                                  label: uk ? "Дублювати" : "Duplicate",
                                  icon: Copy,
                                  disabled: grid.rows.length >= MAX_DUTY_ROWS,
                                  action: () =>
                                    change({
                                      ...grid,
                                      rows: [
                                        ...grid.rows.slice(0, r + 1),
                                        [...row],
                                        ...grid.rows.slice(r + 1),
                                      ],
                                    }),
                                },
                                {
                                  label: uk ? "Перемістити вище" : "Move up",
                                  icon: ArrowUp,
                                  disabled: r === 0,
                                  action: () => moveRow(r, -1),
                                },
                                {
                                  label: uk ? "Перемістити нижче" : "Move down",
                                  icon: ArrowDown,
                                  disabled: r === grid.rows.length - 1,
                                  action: () => moveRow(r, 1),
                                },
                                {
                                  label: t.delete,
                                  icon: Trash2,
                                  disabled: grid.rows.length <= 1,
                                  action: () => delRow(r),
                                },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  type="button"
                                  disabled={item.disabled}
                                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs hover:bg-surface-2 disabled:opacity-30"
                                  onClick={(e) => {
                                    (
                                      e.currentTarget.closest("details") as HTMLDetailsElement
                                    ).open = false;
                                    item.action();
                                  }}
                                >
                                  <item.icon className="size-4" />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </details>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PillButton type="button" disabled={!dirty} onClick={() => save.mutate()}>
              {save.isPending ? (uk ? "Збереження…" : "Saving…") : t.save}
            </PillButton>
            <PillButton type="button" tone="ghost" onClick={discard}>
              {t.cancel}
            </PillButton>
            <span className="text-xs text-muted">
              {dirty
                ? uk
                  ? "Є незбережені зміни"
                  : "Unsaved changes"
                : uk
                  ? "Без змін"
                  : "No changes"}
            </span>
          </div>
        )}
      </fieldset>
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {save.isError && (
        <div role="alert" className="mt-3 text-sm text-terracotta">
          {save.error.message === "CONFLICT"
            ? uk
              ? "Хтось уже змінив таблицю. Ваші зміни залишились у редакторі. Експортуйте CSV для збереження копії або скасуйте редагування та завантажте актуальну таблицю."
              : "Someone changed the table. Your draft is preserved. Export a CSV copy or cancel editing and reload the table."
            : uk
              ? "Не вдалося зберегти таблицю. Ваші зміни збережено в редакторі — спробуйте ще раз."
              : "Could not save. Your draft is preserved; please retry."}
        </div>
      )}
    </Panel>
  );
}
