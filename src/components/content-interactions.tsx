import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addContentComment,
  listContentInteractions,
  removeContentComment,
  toggleContentLike,
  type EngagementTarget,
} from "@/lib/school/feed-api";
import { useSchoolSettings } from "./school-settings-context";
import { useMeQuery } from "./session-gate";
import { PillButton } from "./ui/panel";
export function ContentInteractions({
  target,
  id,
  uk,
}: {
  target: EngagementTarget;
  id: string;
  uk: boolean;
}) {
  const { settings } = useSchoolSettings(),
    p = useMeQuery().data?.profile;
  const likes = target === "article" ? settings.articleLikes : settings.feedLikes,
    comments = target === "post" && settings.feedComments;
  const qc = useQueryClient(),
    key = ["content-interactions", p?.schoolId, p?.userId, target, id, likes, comments];
  const data = useQuery({
    queryKey: key,
    queryFn: () => listContentInteractions(target, id),
    enabled: !!p?.schoolId && (likes || comments),
    refetchInterval: 30_000,
  });
  const [expanded, setExpanded] = useState(false),
    [body, setBody] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["content-interactions"] });
  const error = () =>
    toast.error(
      uk
        ? "Дію не збережено. Перевірте підключення та налаштування школи."
        : "Action was not saved. Check your connection and school settings.",
    );
  const like = useMutation({
    mutationFn: () => toggleContentLike(target, id),
    onSuccess: refresh,
    onError: error,
  });
  const post = useMutation({
    mutationFn: () => addContentComment(id, body),
    onSuccess: async () => {
      setBody("");
      await refresh();
    },
    onError: error,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => removeContentComment(id, commentId),
    onSuccess: refresh,
    onError: error,
  });
  if (!likes && !comments) return null;
  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <div className="flex flex-wrap items-center gap-3">
        {likes && (
          <button
            type="button"
            aria-pressed={data.data?.liked ?? false}
            aria-label={uk ? "Подобається" : "Like"}
            disabled={like.isPending || data.isPending || data.isError}
            onClick={() => like.mutate()}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline px-3 text-xs font-bold ${data.data?.liked ? "bg-terracotta/10 text-terracotta" : "text-ink-soft"}`}
          >
            <Heart className="size-4" fill={data.data?.liked ? "currentColor" : "none"} />
            {data.data?.count ?? 0}
          </button>
        )}
        {comments && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-bold"
          >
            <MessageCircle className="size-4" />
            {uk ? "Коментарі" : "Comments"} ({data.data?.comments.length ?? 0})
          </button>
        )}
      </div>
      {data.isError && (
        <p role="alert" className="text-xs text-terracotta">
          {uk ? "Не вдалося завантажити реакції." : "Could not load reactions."}
        </p>
      )}
      {comments && expanded && (
        <div className="mt-3 space-y-3">
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {data.data?.comments.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-2 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong>{c.authorName}</strong>
                  {(p?.role === "teacher" || p?.userId === c.authorId) && (
                    <button
                      type="button"
                      aria-label={uk ? "Видалити коментар" : "Delete comment"}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words leading-5">{c.body}</p>
              </li>
            ))}
          </ul>
          <label className="block text-xs font-bold">
            {uk ? "Ваш коментар" : "Your comment"}
            <textarea
              className="mt-1 min-h-20 w-full rounded-xl border border-hairline bg-surface-2 p-3 text-sm font-normal"
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <PillButton disabled={!body.trim() || post.isPending} onClick={() => post.mutate()}>
            {uk ? "Надіслати коментар" : "Post comment"}
          </PillButton>
        </div>
      )}
    </div>
  );
}
