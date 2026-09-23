import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroupChat, deleteMessage, editMessage, listChats, listMessages, listPeople, listSubjects, sendMessage, startDm } from "@/lib/school/server";
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
  const [grouping, setGrouping] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [subjectTag, setSubjectTag] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjects() });
  const msgs = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => listMessages({ data: { chatId: chatId! } }),
    enabled: Boolean(chatId),
    refetchInterval: 2500,
  });
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: async () => {
      if (editingId) {
        await editMessage({ data: { messageId: editingId, body: text } });
        return { id: editingId };
      }
      return sendMessage({ data: { chatId: chatId!, body: text, subjectName: subjectTag } });
    },
    onSuccess: async () => {
      setText("");
      setEditingId(null);
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
  const group = useMutation({
    mutationFn: () => createGroupChat({ data: { name: groupName, memberUids: members } }),
    onSuccess: async (res) => {
      setGrouping(false);
      setGroupName("");
      setMembers([]);
      setChatId(res.id);
      await qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
  const dropMsg = useMutation({
    mutationFn: (messageId: string) => deleteMessage({ data: { messageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", chatId] }),
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
          <PillButton tone="ghost" type="button" className="h-9 px-3 text-xs" onClick={() => setGrouping((v) => !v)}>
            {t.chatNewGroup}
          </PillButton>
        </div>
        {grouping && (
          <div className="mb-2 space-y-2 rounded-xl bg-cream/50 p-2">
            <TextInput value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t.chatGroupPh} className="h-9 w-full" />
            <p className="text-xs font-bold text-muted">{t.chatMembers}</p>
            <ul className="max-h-32 overflow-auto text-sm">
              {(people.data?.people ?? []).map((p) => {
                const on = members.includes(p.userId);
                return (
                  <li key={p.userId}>
                    <label className="flex items-center gap-2 px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setMembers((cur) => (on ? cur.filter((id) => id !== p.userId) : [...cur, p.userId]))}
                      />
                      {p.displayName || p.userId}
                    </label>
                  </li>
                );
              })}
            </ul>
            <PillButton type="button" className="h-9" disabled={!groupName.trim() || members.length === 0 || group.isPending} onClick={() => group.mutate()}>
              {t.chatCreateGroup}
            </PillButton>
          </div>
        )}
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
            <div className="mb-2">
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.chatSearch} className="h-9" />
            </div>
            <div className="mb-3 flex-1 space-y-2 overflow-y-auto">
              {(msgs.data?.messages ?? [])
                .filter((m) => {
                  const q = query.trim().toLowerCase();
                  if (!q) return true;
                  return m.body.toLowerCase().includes(q) || m.subjectName.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q);
                })
                .map((m) => {
                const mine = m.authorId === me.data?.profile.userId;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-forest text-paper" : "bg-cream")}>
                      {!mine && <p className="text-[11px] font-bold opacity-80">{m.authorName}</p>}
                      {m.subjectName && <p className="text-[10px] font-bold uppercase opacity-70">{m.subjectName}</p>}
                      <p className="text-sm whitespace-pre-wrap">{m.deleted ? t.deletedMsg : m.body}</p>
                      {m.edited && !m.deleted && <p className="text-[10px] opacity-70">{t.edited}</p>}
                      {mine && !m.deleted && (
                        <span className="mt-1 flex gap-2 text-[10px] underline opacity-80">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(m.id);
                              setText(m.body);
                            }}
                          >
                            {t.edit}
                          </button>
                          <button type="button" onClick={() => dropMsg.mutate(m.id)}>
                            {t.delete}
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) send.mutate();
              }}
            >
              <select
                value={subjectTag}
                onChange={(e) => setSubjectTag(e.target.value)}
                className="h-11 rounded-2xl border border-transparent bg-paper-2 px-3 text-sm outline-none focus:border-forest-mid/35"
              >
                <option value="">{t.subjectFilter}</option>
                {(subjects.data?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <TextInput
                className="min-w-[180px] flex-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.chatPh}
              />
              {editingId && (
                <PillButton
                  tone="ghost"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setText("");
                  }}
                >
                  {t.cancel}
                </PillButton>
              )}
              <PillButton type="submit" disabled={!text.trim() || send.isPending}>
                {editingId ? t.save : t.send}
              </PillButton>
            </form>
          </>
        )}
      </Panel>
    </div>
  );
}
