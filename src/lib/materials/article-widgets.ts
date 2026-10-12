export type ConflictSide = {
  name: string;
  participants: string;
  leaders: string;
  forces: string;
  losses: string;
};
export type ArticleWidget =
  | { type: "toc"; title: string }
  | {
      type: "conflict";
      title: string;
      summary: string;
      date: string;
      location: string;
      result: string;
      sides: ConflictSide[];
    }
  | { type: "infobox"; title: string; rows: { label: string; value: string }[] }
  | { type: "timeline"; title: string; entries: { date: string; text: string }[] }
  | { type: "callout"; title: string; tone: "note" | "tip" | "warning"; text: string };
export type WidgetType = ArticleWidget["type"];
export type WidgetBlock = {
  widget: ArticleWidget;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
};
export type ArticleHeading = {
  level: number;
  text: string;
  id: string;
  line: number;
  number: string;
};
export const WIDGET_LABELS = {
  uk: {
    toc: "Зміст статті",
    conflict: "Сторони конфлікту",
    infobox: "Інформаційна картка",
    timeline: "Хронологія",
    callout: "Примітка / порада",
  },
  en: {
    toc: "Table of contents",
    conflict: "Conflict sides",
    infobox: "Infobox",
    timeline: "Timeline",
    callout: "Note / tip",
  },
};
export const WIDGET_TYPES: WidgetType[] = ["toc", "conflict", "infobox", "timeline", "callout"];
export function emptyConflictSide(): ConflictSide {
  return { name: "", participants: "", leaders: "", forces: "", losses: "" };
}
export function newArticleWidget(type: WidgetType, uk: boolean): ArticleWidget {
  const title = WIDGET_LABELS[uk ? "uk" : "en"][type];
  if (type === "toc") return { type, title };
  if (type === "conflict")
    return {
      type,
      title,
      summary: "",
      date: "",
      location: "",
      result: "",
      sides: [emptyConflictSide(), emptyConflictSide()],
    };
  if (type === "infobox") return { type, title, rows: [{ label: "", value: "" }] };
  if (type === "timeline") return { type, title, entries: [{ date: "", text: "" }] };
  return { type, title, tone: "note", text: "" };
}
export function validateArticleWidget(raw: unknown): ArticleWidget {
  if (!raw || typeof raw !== "object") throw new Error("INVALID_WIDGET");
  const w = raw as Record<string, unknown>;
  const text = (value: unknown, max: number, required = false) => {
    if (typeof value !== "string" || value.length > max || (required && !value.trim()))
      throw new Error("INVALID_WIDGET");
    return value.trim();
  };
  const title = text(w.title, 160, true);
  if (w.type === "toc") return { type: w.type, title };
  if (w.type === "conflict") {
    if (!Array.isArray(w.sides) || w.sides.length < 2 || w.sides.length > 4)
      throw new Error("INVALID_WIDGET");
    const sides = w.sides.map((side) => {
      if (!side || typeof side !== "object") throw new Error("INVALID_WIDGET");
      return {
        name: text(side.name, 160, true),
        participants: text(side.participants, 2000),
        leaders: text(side.leaders, 2000),
        forces: text(side.forces, 1000),
        losses: text(side.losses, 1000),
      };
    });
    return {
      type: w.type,
      title,
      summary: text(w.summary, 2000),
      date: text(w.date, 300),
      location: text(w.location, 300),
      result: text(w.result, 2000),
      sides,
    };
  }
  if (w.type === "infobox") {
    if (!Array.isArray(w.rows) || !w.rows.length || w.rows.length > 12)
      throw new Error("INVALID_WIDGET");
    return {
      type: w.type,
      title,
      rows: w.rows.map((row) => {
        if (!row || typeof row !== "object") throw new Error("INVALID_WIDGET");
        return { label: text(row.label, 160, true), value: text(row.value, 2000, true) };
      }),
    };
  }
  if (w.type === "timeline") {
    if (!Array.isArray(w.entries) || !w.entries.length || w.entries.length > 20)
      throw new Error("INVALID_WIDGET");
    return {
      type: w.type,
      title,
      entries: w.entries.map((entry) => {
        if (!entry || typeof entry !== "object") throw new Error("INVALID_WIDGET");
        return { date: text(entry.date, 160, true), text: text(entry.text, 2000, true) };
      }),
    };
  }
  if (w.type === "callout" && ["note", "tip", "warning"].includes(String(w.tone)))
    return {
      type: w.type,
      title,
      tone: w.tone as "note" | "tip" | "warning",
      text: text(w.text, 4000, true),
    };
  throw new Error("INVALID_WIDGET");
}
export function serializeArticleWidget(widget: ArticleWidget) {
  return `:::widget\n${JSON.stringify(validateArticleWidget(widget), null, 2)}\n:::`;
}
/** Character offsets preserve the original body, including CRLF, when editing a widget. */
export function articleWidgets(body: string): WidgetBlock[] {
  const lines = body.split("\n");
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  const blocks: WidgetBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== ":::widget") continue;
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== ":::") end++;
    if (end === lines.length) continue;
    try {
      const widget = validateArticleWidget(JSON.parse(lines.slice(i + 1, end).join("\n")));
      blocks.push({
        widget,
        start: offsets[i],
        end: offsets[end] + lines[end].replace(/\r$/, "").length,
        startLine: i,
        endLine: end,
      });
      i = end;
    } catch {
      /* Invalid/unknown directives remain readable as ordinary text. */
    }
  }
  return blocks;
}
export function articleHeadings(body: string): ArticleHeading[] {
  const widgets = articleWidgets(body);
  const ids = new Set<string>();
  const numbers = [0, 0, 0, 0, 0];
  const result: ArticleHeading[] = [];
  body
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line, index) => {
      if (widgets.some((w) => index >= w.startLine && index <= w.endLine)) return;
      const match = line.match(/^(#{1,5})\s+(.+?)\s*$/);
      if (!match) return;
      const level = match[1].length;
      const text = match[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*`]/g, "");
      const base =
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "") || "section";
      let id = base;
      let suffix = 2;
      while (ids.has(id)) id = `${base}-${suffix++}`;
      ids.add(id);
      numbers[level - 1]++;
      numbers.fill(0, level);
      result.push({
        level,
        text,
        id,
        line: index,
        number: numbers.slice(0, level).filter(Boolean).join("."),
      });
    });
  return result;
}
/** Show named widget placeholders in the text editor, keeping stored data out of the authoring flow. */
export function articleEditorProjection(body: string, uk = true) {
  const blocks = articleWidgets(body);
  const tokens: {
    label: string;
    raw: string;
    start: number;
    end: number;
    visibleStart: number;
    visibleEnd: number;
  }[] = [];
  let text = "";
  let previous = 0;
  blocks.forEach((block, index) => {
    text += body.slice(previous, block.start);
    const name = `${uk ? "Віджет" : "Widget"} ${index + 1}: ${block.widget.title.replace(/[\r\n⟦⟧]/g, " ")}`;
    let label = `⟦${name}⟧`;
    let suffix = 2;
    while (body.includes(label)) label = `⟦${name} (${suffix++})⟧`;
    tokens.push({
      label,
      raw: body.slice(block.start, block.end),
      start: block.start,
      end: block.end,
      visibleStart: text.length,
      visibleEnd: text.length + label.length,
    });
    text += label;
    previous = block.end;
  });
  text += body.slice(previous);
  const toSource = (position: number, end = false) => {
    let delta = 0;
    for (const t of tokens) {
      if (position < t.visibleStart) break;
      if (position < t.visibleEnd) return end ? t.end : t.start;
      delta += t.raw.length - t.label.length;
    }
    return position + delta;
  };
  const toVisible = (position: number) => {
    let delta = 0;
    for (const t of tokens) {
      if (position < t.start) break;
      if (position < t.end) return t.visibleStart;
      delta += t.raw.length - t.label.length;
    }
    return position - delta;
  };
  const expand = (value: string) => {
    if (tokens.some((t) => !value.includes(t.label))) throw new Error("WIDGET_PLACEHOLDER");
    if (!tokens.length) return value;
    const pattern = new RegExp(
      tokens.map((t) => t.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
      "g",
    );
    return value.replace(pattern, (label) => tokens.find((t) => t.label === label)!.raw);
  };
  const intersectsWidget = (start: number, end: number) =>
    tokens.some((t) => start < t.visibleEnd && end >= t.visibleStart);
  return { text, tokens, toSource, toVisible, expand, intersectsWidget };
}
export function applyArticleHeading(
  body: string,
  start: number,
  end: number,
  level: number,
  placeholder: string,
) {
  if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error("HEADING_LEVEL");
  const a = start === 0 ? 0 : body.lastIndexOf("\n", start - 1) + 1;
  const selectionEnd = end > start && body[end - 1] === "\n" ? end - 1 : end;
  const newline = body.indexOf("\n", selectionEnd);
  const b = newline < 0 ? body.length : newline;
  const prefix = level ? "#".repeat(level) + " " : "";
  const replacement = body
    .slice(a, b)
    .split("\n")
    .map((line) => prefix + (line.replace(/^#{1,5}\s+/, "") || (level ? placeholder : "")))
    .join("\n");
  return {
    body: body.slice(0, a) + replacement + body.slice(b),
    start: a,
    end: a + replacement.length,
  };
}
