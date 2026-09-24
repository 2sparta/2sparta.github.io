import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { createGroupChat, deleteMessage, editMessage, listChats, listMessages, listPeople, listSubjects, pinMessage, sendMessage, startDm } from "@/lib/school/server";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useMeQuery } from "@/components/session-gate";
import { Hint, Panel, PillButton, TextInput } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/chat")({ component: Page });

function sentAt(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

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
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; mine: boolean; body: string; pinned: boolean } | null>(null);
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
      return sendMessage({ data: { chatId: chatId!, body: text, subjectName: subjectChat ? subjectTag : "" } });
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
  const pin = useMutation({
    mutationFn: (d: { messageId: string; pinned: boolean }) => pinMessage({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", chatId] }),
  });

  const active = (chats.data?.chats ?? []).find((c) => c.id === chatId);
  const subjectChat = active?.kind === "class";
  const locale = lang === "uk" ? "uk-UA" : "en-GB";
  const messages = (msgs.data?.messages ?? []).filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return m.body.toLowerCase().includes(q) || m.subjectName.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q);
  });
  const pinned = (msgs.data?.messages ?? []).filter((m) => m.pinned && !m.deleted);

  useEffect(() => {
    if (!chatId && chats.data?.chats[0]) setChatId(chats.data.chats[0].id);
  }, [chats.data, chatId]);

  useEffect(() => {
    if (!subjectChat && subjectTag) setSubjectTag("");
  }, [subjectChat, subjectTag]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  return (
    <div className="grid min-h-[70vh] gap-3 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-[22px] border border-hairline bg-surface p-3">
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
                  className="w-full rounded-lg px-2 py-1 text-left hover:bg-surface"
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
                onClick={() => {
                  setChatId(c.id);
                  setEditingId(null);
                  setText("");
                  setMenu(null);
                }}
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
            {pinned.length > 0 && (
              <div className="mb-2 space-y-1">
                {pinned.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl bg-cream/70 px-3 py-1.5 text-left text-xs"
                    onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >
                    <Pin className="size-3 shrink-0 text-forest" />
                    <span className="truncate font-semibold">{m.body}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mb-3 flex-1 space-y-2 overflow-y-auto">
              {messages.map((m) => {
                const mine = m.authorId === me.data?.profile.userId;
                const when = sentAt(m.createdAt, locale);
                return (
                  <div key={m.id} id={`msg-${m.id}`} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-forest text-paper" : "bg-cream")}
                      onContextMenu={(e) => {
                        if (m.deleted) return;
                        e.preventDefault();
                        const width = 196;
                        const height = mine ? 168 : 88;
                        setMenu({
                          x: Math.max(8, Math.min(e.clientX, window.innerWidth - width - 8)),
                          y: Math.max(8, Math.min(e.clientY, window.innerHeight - height - 8)),
                          id: m.id,
                          mine,
                          body: m.body,
                          pinned: m.pinned,
                        });
                      }}
                    >
                      {!mine && <p className="text-[11px] font-bold opacity-80">{m.authorName}</p>}
                      {subjectChat && m.subjectName && <p className="text-[10px] font-bold uppercase opacity-70">{m.subjectName}</p>}
                      <p className="text-sm whitespace-pre-wrap">{m.deleted ? t.deletedMsg : m.body}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                        {m.pinned && !m.deleted && <Pin className="size-3" />}
                        <span>
                          {when}
                          {m.edited && !m.deleted ? ` · ${t.edited}` : ""}
                          {m.pinned && !m.deleted ? ` · ${t.chatPinned}` : ""}
                        </span>
                      </p>
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
              {subjectChat && (
                <select
                  value={subjectTag}
                  onChange={(e) => setSubjectTag(e.target.value)}
                  className="h-11 rounded-2xl border border-transparent bg-surface-2 px-3 text-sm text-ink outline-none focus:border-forest-mid/35"
                >
                  <option value="">{t.subjectFilter}</option>
                  {(subjects.data?.subjects ?? []).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
              <TextInput
                className="min-w-[180px] flex-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={editingId ? t.edit : t.chatPh}
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
      {menu && (
        <div
          className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border border-hairline bg-surface py-1 text-ink shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuItem
            label={t.chatCopy}
            onClick={() => {
              void navigator.clipboard.writeText(menu.body);
              setMenu(null);
            }}
          />
          <MenuItem
            label={menu.pinned ? t.chatUnpin : t.chatPin}
            onClick={() => {
              pin.mutate({ messageId: menu.id, pinned: !menu.pinned });
              setMenu(null);
            }}
          />
          {menu.mine && (
            <>
              <div className="my-1 border-t border-hairline" />
              <MenuItem
                label={t.edit}
                onClick={() => {
                  setEditingId(menu.id);
                  setText(menu.body);
                  setMenu(null);
                }}
              />
              <MenuItem
                label={t.delete}
                danger
                onClick={() => {
                  if (window.confirm(t.confirmDelete)) dropMsg.mutate(menu.id);
                  setMenu(null);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn("block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-cream/70", danger && "text-terracotta")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
