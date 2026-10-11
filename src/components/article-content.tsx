import { Fragment, type ReactNode } from "react";
import { safeWebUrl } from "@/lib/materials/model";

function inline(text: string): ReactNode[] {
  const tokens = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\))/g;
  const result: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index! > start) result.push(text.slice(start, match.index));
    const key = match.index;
    if (match[2]) result.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3]) result.push(<em key={key}>{match[3]}</em>);
    else if (match[4])
      result.push(
        <code key={key} className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">
          {match[4]}
        </code>,
      );
    else {
      const url = safeWebUrl(match[6]);
      result.push(
        url ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-forest-mid underline underline-offset-4"
          >
            {match[5]}
          </a>
        ) : (
          <Fragment key={key}>{match[5]}</Fragment>
        ),
      );
    }
    start = match.index! + match[0].length;
  }
  result.push(text.slice(start));
  return result;
}
/** Markdown subset rendered as React text. Raw HTML is never evaluated. */
export function ArticleContent({ body }: { body: string }) {
  const lines = body.replace(/\r/g, "").split("\n");
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const image = line.trim().match(/^!\[([^\]\n]*)\]\(([^\s)]+)\)$/);
    if (image) {
      const url = safeWebUrl(image[2]);
      nodes.push(
        url ? (
          <figure key={i} className="my-6">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={image[1]}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-[36rem] max-w-full rounded-xl object-contain"
              />
            </a>
            {image[1] && <figcaption className="mt-2 text-sm text-muted">{image[1]}</figcaption>}
          </figure>
        ) : (
          <p key={i}>{image[1]}</p>
        ),
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : "h3";
      nodes.push(
        <Tag key={i} className="mt-7 mb-3 font-display text-xl font-extrabold">
          {inline(heading[2])}
        </Tag>,
      );
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-6 border-hairline" />);
      continue;
    }
    if (/^>\s?/.test(line)) {
      nodes.push(
        <blockquote key={i} className="my-4 border-l-4 border-forest-mid bg-surface-2 p-4 italic">
          {inline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const start = i;
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s+/ : /^[-*]\s+/).test(lines[i])) {
        items.push(
          <li key={i} className="pl-1">
            {inline(lines[i].replace(/^([-*]|\d+\.)\s+/, ""))}
          </li>,
        );
        i++;
      }
      i--;
      const Tag = ordered ? "ol" : "ul";
      nodes.push(
        <Tag
          key={start}
          className={`my-4 space-y-2 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items}
        </Tag>,
      );
      continue;
    }
    const start = i;
    const paragraph = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s|---+$|!\[)/.test(lines[i + 1])
    )
      paragraph.push(lines[++i]);
    nodes.push(
      <p key={start} className="my-4 whitespace-pre-wrap leading-7">
        {inline(paragraph.join("\n"))}
      </p>,
    );
  }
  return <div className="min-w-0 break-words text-ink">{nodes}</div>;
}
