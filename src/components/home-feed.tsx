import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Newspaper, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listSchoolPosts,
  removeSchoolPost,
  saveSchoolPost,
  type SchoolPost,
} from "@/lib/school/feed-api";
import { canOffice } from "@/lib/school/settings";
import { useSchoolSettings } from "./school-settings-context";
import { useMeQuery } from "./session-gate";
import { ContentInteractions } from "./content-interactions";
import { PillButton, TextInput } from "./ui/panel";
export function HomeFeed({ uk }: { uk: boolean }) {
  const { settings, isError } = useSchoolSettings(),
    p = useMeQuery().data?.profile,
    qc = useQueryClient();
  const posts = useQuery({
    queryKey: ["school-posts", p?.schoolId, settings.feedMode],
    queryFn: listSchoolPosts,
    enabled: !!p?.schoolId && settings.feedMode !== "off" && !isError,
    refetchInterval: 30_000,
  });
  const [composer, setComposer] = useState(false),
    [editing, setEditing] = useState<SchoolPost | null>(null),
    [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const canPost =
    settings.feedMode === "proposals"
      ? p?.role === "student" && p.linked
      : p?.role === "teacher" || canOffice(settings, p ?? { role: null }, "publishNews");
  const refresh = () => qc.invalidateQueries({ queryKey: ["school-posts"] });
  const error = () =>
    toast.error(
      uk
        ? "Не вдалося зберегти допис. Перевірте дозвіл і підключення."
        : "Could not save the post. Check permission and connection.",
    );
  const save = useMutation({
    mutationFn: () => saveSchoolPost({ id: editing?.id, title, body }),
    onSuccess: async () => {
      setComposer(false);
      setEditing(null);
      setTitle("");
      setBody("");
      await refresh();
    },
    onError: error,
  });
  const remove = useMutation({ mutationFn: removeSchoolPost, onSuccess: refresh, onError: error });
  if (settings.feedMode === "off" || isError) return null;
  const proposal = settings.feedMode === "proposals",
    Icon = proposal ? Lightbulb : Newspaper;
  return (
    <aside
      className="min-w-0 space-y-3 min-[1250px]:sticky min-[1250px]:top-6 min-[1250px]:max-h-[calc(100dvh-48px)] min-[1250px]:overflow-y-auto"
      aria-label={uk ? "Пропозиції та новини" : "Proposals and news"}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-extrabold">
          <Icon className="size-5 text-forest-mid" />
          {proposal ? (uk ? "Пропозиції" : "Proposals") : uk ? "Новини" : "News"}
        </h2>
        {canPost && (
          <PillButton
            tone="ghost"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setBody("");
              setComposer((v) => !v);
            }}
          >
            {uk ? "Додати" : "Add"}
          </PillButton>
        )}
      </div>
      {composer && canPost && (
        <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
          <TextInput
            className="w-full"
            aria-label={uk ? "Назва допису" : "Post title"}
            placeholder={uk ? "Коротка назва" : "Short title"}
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            aria-label={uk ? "Текст допису" : "Post body"}
            className="min-h-28 w-full rounded-xl border border-hairline bg-surface-2 p-3 text-sm"
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <PillButton
              disabled={!title.trim() || !body.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {uk ? "Опублікувати" : "Publish"}
            </PillButton>
            <PillButton
              tone="ghost"
              onClick={() => {
                setComposer(false);
                setEditing(null);
              }}
            >
              {uk ? "Скасувати" : "Cancel"}
            </PillButton>
          </div>
        </section>
      )}
      {posts.isPending && (
        <p role="status" className="text-sm text-muted">
          {uk ? "Завантаження…" : "Loading…"}
        </p>
      )}
      {posts.isError && (
        <p role="alert" className="text-sm text-terracotta">
          {uk ? "Не вдалося завантажити стрічку." : "Could not load the feed."}
        </p>
      )}
      {!posts.isPending && !posts.isError && !posts.data?.length && (
        <p className="rounded-2xl border border-dashed border-hairline p-5 text-sm text-muted">
          {uk ? "Тут з’являться нові дописи школи." : "New school posts will appear here."}
        </p>
      )}
      {posts.data?.map((post) => (
        <article
          key={post.id}
          className="flex min-h-56 flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-[var(--shadow-soft)]"
        >
          <div className="flex min-h-0 flex-1 flex-col p-4 pb-0">
            <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-muted">
              <span>{new Date(post.createdAt).toLocaleDateString(uk ? "uk-UA" : "en-GB")}</span>
              <div className="flex gap-2">
                {canPost && post.authorId === p?.userId && (
                  <button
                    type="button"
                    aria-label={uk ? "Редагувати допис" : "Edit post"}
                    onClick={() => {
                      setEditing(post);
                      setTitle(post.title);
                      setBody(post.body);
                      setComposer(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
                {(p?.role === "teacher" || post.authorId === p?.userId) && (
                  <button
                    type="button"
                    aria-label={uk ? "Видалити допис" : "Delete post"}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(uk ? "Видалити цей допис?" : "Delete this post?"))
                        remove.mutate(post.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <h3 className="line-clamp-2 break-words font-display text-base leading-5 font-extrabold">
              {post.title}
            </h3>
            <details className="mt-1 text-xs leading-4 text-ink-soft">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="line-clamp-2 break-words">{post.body}</span>
                <span className="text-xs font-bold text-forest-mid">
                  {uk ? "Читати повністю" : "Read more"}
                </span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words">{post.body}</p>
            </details>
            <p className="mt-auto pt-1 text-xs text-muted">{post.authorName}</p>
          </div>
          <div className="px-4 pb-3">
            <ContentInteractions target="post" id={post.id} uk={uk} />
          </div>
        </article>
      ))}
    </aside>
  );
}
