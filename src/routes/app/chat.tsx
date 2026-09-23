import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listChats, listMessages, listPeople, sendMessage, startDm } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PillButton, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/chat")({ component: Page });

function Page() {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const me = useMeQuery();
  const chats = useQuery({ queryKey: ["chats"], queryFn: () => listChats(), refetchInterval: 4000 });
  const people = useQuery({ queryKey: ["people"], queryFn: () => listPeople() });
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const msgs = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => listMessages({ data: { chatId: chatId! } }),
    enabled: Boolean(chatId),
    refetchInterval: 2500,
  });
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => sendMessage({ data: { chatId: chatId!, body: text } }),
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["messages", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
  const dm = useMutation({
    mutationFn: (d: { otherUserId: string; name: string }) => startDm({ data: d }),
    onSuccess: async (res) => {
      setPicking(false);
      setChatId(res.id);
      await qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  useEffect(() => {
    if (!chatId && chats.data?.chats[0]) setChatId(chats.data.chats[0].id);
  }, [chats.data, chatId]);

  return (
    <div className="grid min-h-[70vh] gap-3 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-[22px] border border-hairline bg-paper p-3">
        <div className="mb-2 flex gap-2">
          <PillButton tone="ghost" type="button" className="h-9 px-3 text-xs" onClick={() => setPicking((v) => !v)}>
            {t.chatWrite}
          </PillButton>
        </div>
        {picking && (
          <ul className="mb-2 max-h-40 overflow-auto rounded-xl bg-cream/50 p-2 text-sm">
            {(people.data?.people ?? []).map((p) => (
              <li key={p.userId}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1 text-left hover:bg-paper"
                  onClick={() => dm.mutate({ otherUserId: p.userId, name: p.displayName || p.userId })}
                >
                  {p.displayName || p.userId}
                </button>
              </li>
            ))}
          </ul>
        )}
        {(chats.data?.chats ?? []).length === 0 && <Hint>{t.chatEmpty}</Hint>}
        <ul className="space-y-1">
          {(chats.data?.chats ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setChatId(c.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left",
                  chatId === c.id ? "bg-forest text-paper" : "hover:bg-cream/60",
                )}
              >
                <span className="block font-display text-sm font-bold">{c.name}</span>
                {c.lastBody && <span className="block truncate text-xs opacity-80">{c.lastBody}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <Panel className="mb-0 flex min-h-[70vh] flex-col">
        {!chatId ? (
          <Hint>{t.chatPick}</Hint>
        ) : (
          <>
            <div className="mb-3 flex-1 space-y-2 overflow-y-auto">
              {(msgs.data?.messages ?? []).map((m) => {
                const mine = m.authorId === me.data?.profile.userId;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-forest text-paper" : "bg-cream")}>
                      {!mine && <p className="text-[11px] font-bold opacity-80">{m.authorName}</p>}
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) send.mutate();
              }}
            >
              <TextInput
                className="flex-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.chatPh}
              />
              <PillButton type="submit" disabled={!text.trim() || send.isPending}>
                {t.send}
              </PillButton>
            </form>
          </>
        )}
      </Panel>
    </div>
  );
}
