import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { getDuty, setDuty } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { Hint, Panel, PanelTitle, PillButton } from "@/components/ui/panel";

type Grid = { cols: string[]; rows: string[][] };

function blank(width: number) {
  return Array.from({ length: Math.max(width, 1) }, () => "");
}

export function DutyBoard({ classId }: { classId: string }) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["duty", classId], queryFn: () => getDuty({ data: { classId } }), enabled: Boolean(classId) });
  const [grid, setGrid] = useState<Grid>({ cols: ["", ""], rows: [["", ""]] });
  useEffect(() => {
    if (q.data?.grid) setGrid(q.data.grid);
  }, [q.data]);
  const save = useMutation({
    mutationFn: (next: Grid) => setDuty({ data: { classId, cols: next.cols, rows: next.rows } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duty", classId] }),
  });
  if (!classId || !q.data) return null;
  const canEdit = q.data.canEdit;
  const width = Math.max(grid.cols.length, 1);

  const setCell = (row: number, col: number, value: string) => {
    setGrid((cur) => ({
      ...cur,
      rows: cur.rows.map((cells, i) => (i === row ? cells.map((cell, j) => (j === col ? value : cell)) : cells)),
    }));
  };

  return (
    <Panel>
      <PanelTitle>{t.dutyTitle}</PanelTitle>
      <Hint>{t.dutyHint}</Hint>
      <div className="overflow-x-auto rounded-2xl border border-hairline">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-cream/70">
              {grid.cols.map((col, i) => (
                <th key={i} className="border-b border-hairline px-2 py-2 text-left">
                  {canEdit ? (
                    <input
                      value={col}
                      onChange={(e) => setGrid((cur) => ({ ...cur, cols: cur.cols.map((item, j) => (j === i ? e.target.value : item)) }))}
                      placeholder={t.dutyCol}
                      className="w-full bg-transparent font-display text-xs font-extrabold outline-none"
                    />
                  ) : (
                    <span className="font-display text-xs font-extrabold">{col || "—"}</span>
                  )}
                </th>
              ))}
              {canEdit && <th className="w-10 border-b border-hairline" />}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={r} className="border-t border-hairline">
                {row.map((cell, c) => (
                  <td key={c} className="px-2 py-1.5 align-top">
                    {canEdit ? (
                      <input
                        value={cell}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        className="w-full rounded-lg bg-surface-2 px-2 py-1.5 outline-none"
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{cell || "—"}</span>
                    )}
                  </td>
                ))}
                {canEdit && (
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      className="grid size-8 place-items-center text-muted"
                      aria-label={t.delete}
                      onClick={() => setGrid((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== r).length ? cur.rows.filter((_, i) => i !== r) : [blank(width)] }))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <PillButton
            type="button"
            tone="ghost"
            onClick={() => setGrid((cur) => ({ ...cur, rows: [...cur.rows, blank(cur.cols.length)] }))}
          >
            <Plus className="size-4" /> {t.dutyAddRow}
          </PillButton>
          <PillButton
            type="button"
            tone="ghost"
            onClick={() =>
              setGrid((cur) => ({
                cols: [...cur.cols, ""],
                rows: cur.rows.map((row) => [...row, ""]),
              }))
            }
          >
            <Plus className="size-4" /> {t.dutyAddCol}
          </PillButton>
          {grid.cols.length > 1 && (
            <PillButton
              type="button"
              tone="ghost"
              onClick={() =>
                setGrid((cur) => ({
                  cols: cur.cols.slice(0, -1),
                  rows: cur.rows.map((row) => row.slice(0, -1)),
                }))
              }
            >
              {t.dutyDropCol}
            </PillButton>
          )}
          <PillButton type="button" disabled={save.isPending} onClick={() => save.mutate(grid)}>
            {t.save}
          </PillButton>
        </div>
      )}
    </Panel>
  );
}
