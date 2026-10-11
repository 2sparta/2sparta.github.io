export type MaterialKind = "article" | "video" | "link";
export type MaterialStatus = "draft" | "published";
export type Material = {
  id: string;
  schoolId: string;
  kind: MaterialKind;
  status: MaterialStatus;
  title: string;
  topic: string;
  summary: string;
  body: string;
  url: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
};
export type MaterialInput = Pick<
  Material,
  "kind" | "status" | "title" | "topic" | "summary" | "body" | "url"
>;
export function safeWebUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function videoEmbedUrl(raw: string): string | null {
  const safe = safeWebUrl(raw);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }
  if (host === "vimeo.com" && /^\/\d+$/.test(url.pathname))
    return `https://player.vimeo.com/video${url.pathname}`;
  return null;
}
export function validateMaterial(input: MaterialInput): MaterialInput {
  const result = {
    ...input,
    title: input.title.trim(),
    topic: input.topic.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    url: input.url.trim(),
  };
  if (
    !["article", "video", "link"].includes(result.kind) ||
    !["draft", "published"].includes(result.status) ||
    !result.title ||
    result.title.length > 160 ||
    !result.topic ||
    result.topic.length > 80 ||
    result.summary.length > 500 ||
    result.body.length > 50_000 ||
    result.url.length > 2000
  )
    throw new Error("INVALID_MATERIAL");
  if (result.status === "published" && result.kind === "article" && !result.body)
    throw new Error("ARTICLE_BODY_REQUIRED");
  if (result.kind !== "article" && !safeWebUrl(result.url)) throw new Error("INVALID_URL");
  if (result.kind === "article") result.url = "";
  return result;
}
export function readingMinutes(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 180));
}
