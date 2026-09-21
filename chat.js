// ==========================================================
// Чат: групи, особисті, авто-групи школи, теги предметів
// Спільний модуль для app.js (вчитель) і student.js (учень)
// ==========================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * @typedef {Object} ChatMember
 * @property {string} name
 * @property {string} role  // teacher | admin | student
 * @property {number} joinedAt
 */

/**
 * Структура chat:
 *  type: "dm" | "group" | "school" | "students"
 *  schoolId: string
 *  name: string
 *  memberUids: string[]
 *  members: { [uid]: ChatMember }
 *  createdBy: string
 *  createdAt: number
 *  lastMessageAt: number
 *  lastMessagePreview: string
 *  isAuto: boolean
 *  dmKey?: string  // for DMs: sorted uids joined
 */

export function dmChatId(uidA, uidB) {
  const [a, b] = [uidA, uidB].sort();
  return `dm_${a}_${b}`;
}

/** @deprecated legacy */
export function schoolAutoChatId(schoolId, kind) {
  return `auto_${kind}_${schoolId}`;
}

export function teachersChatId(schoolId) {
  return `auto_teachers_${schoolId}`;
}

export function classChatId(classId) {
  return `auto_class_${classId}`;
}

/**
 * Ініціалізує UI чату і підписки.
 * @param {object} opts
 * @param {import("firebase/firestore").Firestore} opts.db
 * @param {() => import("firebase/auth").User|null} opts.getUser
 * @param {() => object|null} opts.getProfile  // { role, displayName, schoolId, subjectIds }
 * @param {() => string} opts.t  // i18n
 * @param {() => string} opts.currentLang
 * @param {() => Array<{id,data}>} opts.getStudents  // linked students with authUid
 * @param {() => Array<{id,data}>} opts.getTeachers  // school teachers/admins
 * @param {() => Array<{id,data}>} opts.getSubjects
 * @param {boolean} opts.isTeacherSide
 */
export function initChat(opts) {
  const {
    db,
    getUser,
    getProfile,
    t,
    currentLang,
    getStudents,
    getTeachers,
    getSubjects,
    getClasses,
    getGroups,
    isTeacherSide,
  } = opts;

  // ---------- DOM (створюємо, якщо немає) ----------
  ensureChatDom();

  const chatFab = document.getElementById("chat-fab");
  const chatBadge = document.getElementById("chat-badge");
  const chatPanel = document.getElementById("chat-panel");
  const chatPanelClose = document.getElementById("chat-panel-close");
  const chatListView = document.getElementById("chat-list-view");
  const chatThreadView = document.getElementById("chat-thread-view");
  const chatListEl = document.getElementById("chat-list");
  const chatListEmpty = document.getElementById("chat-list-empty");
  const chatNewDmBtn = document.getElementById("chat-new-dm-btn");
  const chatNewGroupBtn = document.getElementById("chat-new-group-btn");
  const chatBackBtn = document.getElementById("chat-back-btn");
  const chatThreadTitle = document.getElementById("chat-thread-title");
  const chatThreadMeta = document.getElementById("chat-thread-meta");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatComposeText = document.getElementById("chat-compose-text");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatSubjectFilter = document.getElementById("chat-subject-filter");
  const chatNewModal = document.getElementById("chat-new-modal");
  const chatNewModalClose = document.getElementById("chat-new-modal-close");
  const chatNewModalBody = document.getElementById("chat-new-modal-body");
  const chatNewModalTitle = document.getElementById("chat-new-modal-title");

  let panelOpen = false;
  let activeChatId = null;
  let lastChats = [];
  let lastMessages = [];
  let subjectFilterId = "";
  let unsubscribeChats = null;
  let unsubscribeMessages = null;
  let unreadByChat = {}; // chatId -> count (local, based on lastReadAt in members)

  const PAGE_SIZE = 40;
  let oldestSnap = null; // DocumentSnapshot of oldest loaded message
  let hasMoreOlder = true;
  let loadingOlder = false;
  let searchQuery = "";
  let searchOpen = false;
  let unsubscribeTyping = null;
  let typingClearTimer = null;
  let lastTypingWrite = 0;
  let olderMessages = []; // prepended older pages (chronological)
  let stickToBottom = true;
  let editingMessageId = null;

  // ---------- Public API ----------
  function showFab(show) {
    if (chatFab) chatFab.classList.toggle("hidden", !show);
    if (!show) closePanel();
  }

  function openPanel() {
    panelOpen = true;
    if (chatPanel) chatPanel.classList.remove("hidden");
    showListView();
    ensureAutoGroups().catch((e) => console.warn("ensureAutoGroups", e));
  }

  function closePanel() {
    panelOpen = false;
    activeChatId = null;
    if (chatPanel) chatPanel.classList.add("hidden");
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    olderMessages = [];
    oldestSnap = null;
    hasMoreOlder = true;
    loadingOlder = false;
    searchQuery = "";
    searchOpen = false;
    editingMessageId = null;
    stopTypingPresence();
    const searchBar = document.getElementById("chat-search-bar");
    if (searchBar) searchBar.classList.add("hidden");
    const searchInput = document.getElementById("chat-search-input");
    if (searchInput) searchInput.value = "";

  }

  function showListView() {
    activeChatId = null;
    if (chatListView) chatListView.classList.remove("hidden");
    if (chatThreadView) chatThreadView.classList.add("hidden");
    const empty = document.getElementById("chat-empty-state");
    if (empty) empty.classList.remove("hidden");
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    olderMessages = [];
    oldestSnap = null;
    hasMoreOlder = true;
    loadingOlder = false;
    searchQuery = "";
    searchOpen = false;
    editingMessageId = null;
    stopTypingPresence();
    const searchBar = document.getElementById("chat-search-bar");
    if (searchBar) searchBar.classList.add("hidden");
    const searchInput = document.getElementById("chat-search-input");
    if (searchInput) searchInput.value = "";

    renderChatList();
  }

  function openThread(chatId) {
    activeChatId = chatId;
    const embedded = document.getElementById("chat-panel") && document.getElementById("chat-panel").classList.contains("tab-panel");
    if (chatListView && !embedded && !chatListView.classList.contains("chat-tabs")) {
      chatListView.classList.add("hidden");
    }
    if (chatThreadView) chatThreadView.classList.remove("hidden");
    const empty = document.getElementById("chat-empty-state");
    if (empty) empty.classList.add("hidden");
    const chat = lastChats.find((c) => c.id === chatId);
    if (chatThreadTitle) {
      chatThreadTitle.textContent = chatDisplayName(chat);
    }
    if (chatThreadMeta) {
      chatThreadMeta.textContent = chatMetaLine(chat);
    }
    subjectFilterId = "";
    olderMessages = [];
    oldestSnap = null;
    hasMoreOlder = true;
    loadingOlder = false;
    searchQuery = "";
    searchOpen = false;
    editingMessageId = null;
    stickToBottom = true;
    const searchBar = document.getElementById("chat-search-bar");
    if (searchBar) searchBar.classList.add("hidden");
    const searchInput = document.getElementById("chat-search-input");
    if (searchInput) searchInput.value = "";
    fillSubjectControls(chat);
    renderChatList();
    subscribeMessages(chatId);
    subscribeTyping(chatId);
    markChatRead(chatId).catch(() => {});
  }

  // ---------- Auto groups ----------
  // Учительський чат (лише вчителі/адміни, без предметів) + чати по класах
  // (учні класу + усі вчителі школи). Старі auto_school / auto_students більше не створюємо.
  async function ensureAutoGroups() {
    const user = getUser();
    const profile = getProfile();
    if (!user || !profile || !profile.schoolId) return;
    const schoolId = profile.schoolId;
    const myUid = user.uid;
    const myName = profile.displayName || user.email || "User";
    const myRole =
      profile.role === "admin" ? "admin" : profile.role === "student" ? "student" : "teacher";

    if (myRole === "teacher" || myRole === "admin") {
      await ensureTeachersChat({ schoolId, myUid, myName, myRole });
    }

    const classes = typeof getClasses === "function" ? getClasses() || [] : [];
    if (myRole === "student") {
      const classIdFromProfile = profile.classId || null;
      const targetClassIds = [];
      if (classIdFromProfile) targetClassIds.push(classIdFromProfile);
      else {
        classes.forEach((c) => targetClassIds.push(c.id));
      }
      for (const cid of targetClassIds) {
        const cls = classes.find((c) => c.id === cid) || { id: cid, data: { name: cid } };
        await ensureClassChat({
          classId: cid,
          className: (cls.data && cls.data.name) || cid,
          schoolId,
          myUid,
          myName,
          myRole,
        });
      }
    } else {
      for (const cls of classes) {
        await ensureClassChat({
          classId: cls.id,
          className: (cls.data && cls.data.name) || cls.id,
          schoolId,
          myUid,
          myName,
          myRole,
        });
      }
    }
  }

  async function ensureTeachersChat({ schoolId, myUid, myName, myRole }) {
    const id = teachersChatId(schoolId);
    const ref = doc(db, "chats", id);
    const snap = await getDoc(ref);
    const name =
      (typeof t === "function" && t("chatAutoTeachers")) ||
      (currentLang() === "en" ? "Teachers chat" : "Учительський чат");

    const members = {};
    const memberUids = [];
    const addTeacher = (uid, data) => {
      if (!uid || members[uid]) return;
      const r = data && data.role === "admin" ? "admin" : "teacher";
      members[uid] = {
        name: (data && (data.displayName || data.email)) || uid,
        role: r,
        joinedAt: Date.now(),
        lastReadAt: uid === myUid ? Date.now() : 0,
      };
      memberUids.push(uid);
    };

    addTeacher(myUid, { displayName: myName, role: myRole });
    if (getTeachers) {
      getTeachers().forEach(({ id: tid, data }) => {
        const r = data.role;
        if (r === "teacher" || r === "admin" || r === "pending-teacher") {
          addTeacher(tid, data);
        }
      });
    }

    if (!snap.exists()) {
      await setDoc(ref, {
        type: "teachers",
        schoolId,
        name,
        memberUids,
        members,
        createdBy: myUid,
        createdAt: Date.now(),
        lastMessageAt: 0,
        lastMessagePreview: "",
        isAuto: true,
        noSubjects: true,
      });
      return;
    }

    const data = snap.data();
    const updates = {};
    let needUpdate = false;
    if (data.name !== name) {
      updates.name = name;
      needUpdate = true;
    }
    if (!(data.memberUids || []).includes(myUid)) {
      updates.memberUids = arrayUnion(myUid);
      updates[`members.${myUid}`] = {
        name: myName,
        role: myRole,
        joinedAt: Date.now(),
        lastReadAt: Date.now(),
      };
      needUpdate = true;
    } else if (data.members && data.members[myUid] && data.members[myUid].name !== myName) {
      updates[`members.${myUid}.name`] = myName;
      needUpdate = true;
    }
    const existing = new Set(data.memberUids || []);
    const missing = memberUids.filter((u) => !existing.has(u));
    if (missing.length > 0) {
      const mergedUids = [...existing, ...missing];
      const mergedMembers = { ...(data.members || {}) };
      missing.forEach((u) => {
        mergedMembers[u] = members[u];
      });
      await updateDoc(ref, { name, memberUids: mergedUids, members: mergedMembers });
      return;
    }
    if (needUpdate) await updateDoc(ref, updates);
  }

  function groupIdsForClass(classId) {
    if (!classId || typeof getGroups !== "function") return new Set();
    const groups = getGroups() || [];
    return new Set(
      groups.filter((g) => g.data && g.data.classId === classId).map((g) => g.id)
    );
  }

  async function ensureClassChat({ classId, className, schoolId, myUid, myName, myRole }) {
    if (!classId) return;
    const id = classChatId(classId);
    const ref = doc(db, "chats", id);
    const snap = await getDoc(ref);
    const name = className || classId;

    const members = {};
    const memberUids = [];
    const addMember = (uid, info) => {
      if (!uid || members[uid]) return;
      members[uid] = {
        name: info.name || uid,
        role: info.role || "student",
        joinedAt: Date.now(),
        lastReadAt: uid === myUid ? Date.now() : 0,
      };
      memberUids.push(uid);
    };

    if (getTeachers) {
      getTeachers().forEach(({ id: tid, data }) => {
        const r = data.role;
        if (r === "teacher" || r === "admin" || r === "pending-teacher") {
          addMember(tid, {
            name: data.displayName || data.email || tid,
            role: r === "admin" ? "admin" : "teacher",
          });
        }
      });
    }
    const groupIds = groupIdsForClass(classId);
    if (getStudents) {
      getStudents().forEach(({ data }) => {
        const uid = data.authUid;
        if (!uid) return;
        const g = data.group;
        if (groupIds.size > 0) {
          if (!groupIds.has(g)) return;
        } else if (data.classId && data.classId !== classId) {
          return;
        } else if (groupIds.size === 0 && !data.classId && myRole === "student") {
          if (uid !== myUid) return;
        }
        addMember(uid, { name: data.name || uid, role: "student" });
      });
    }
    if (myRole === "teacher" || myRole === "admin" || myRole === "student") {
      addMember(myUid, { name: myName, role: myRole });
    }

    if (!snap.exists()) {
      await setDoc(ref, {
        type: "class",
        schoolId,
        classId,
        name,
        memberUids,
        members,
        createdBy: myUid,
        createdAt: Date.now(),
        lastMessageAt: 0,
        lastMessagePreview: "",
        isAuto: true,
      });
      return;
    }

    const data = snap.data();
    const updates = {};
    let needUpdate = false;
    if (name && name !== classId && data.name !== name) {
      updates.name = name;
      needUpdate = true;
    }
    if (!(data.memberUids || []).includes(myUid)) {
      updates.memberUids = arrayUnion(myUid);
      updates[`members.${myUid}`] = {
        name: myName,
        role: myRole,
        joinedAt: Date.now(),
        lastReadAt: Date.now(),
      };
      needUpdate = true;
    } else if (data.members && data.members[myUid] && data.members[myUid].name !== myName) {
      updates[`members.${myUid}.name`] = myName;
      needUpdate = true;
    }
    const existing = new Set(data.memberUids || []);
    const missing = memberUids.filter((u) => !existing.has(u));
    if (missing.length > 0) {
      const mergedUids = [...existing, ...missing];
      const mergedMembers = { ...(data.members || {}) };
      missing.forEach((u) => {
        mergedMembers[u] = members[u];
      });
      if (myUid && !mergedMembers[myUid]) {
        mergedMembers[myUid] = {
          name: myName,
          role: myRole,
          joinedAt: Date.now(),
          lastReadAt: Date.now(),
        };
      }
      const payload = { memberUids: mergedUids, members: mergedMembers };
      if (name && name !== classId) payload.name = name;
      await updateDoc(ref, payload);
      return;
    }
    if (needUpdate) await updateDoc(ref, updates);
  }

  async function syncAutoGroupMembers() {
    try {
      await ensureAutoGroups();
    } catch (e) {
      console.warn("syncAutoGroupMembers", e);
    }
  }

  // ---------- Subscribe chats ----------
  function subscribeChats() {
    if (unsubscribeChats) unsubscribeChats();
    const user = getUser();
    if (!user) return;
    const q = query(collection(db, "chats"), where("memberUids", "array-contains", user.uid));
    unsubscribeChats = onSnapshot(
      q,
      (snap) => {
        lastChats = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        recomputeUnread();
        if (panelOpen && !activeChatId) renderChatList();
        else if (panelOpen && activeChatId) {
          const chat = lastChats.find((c) => c.id === activeChatId);
          if (chatThreadTitle) chatThreadTitle.textContent = chatDisplayName(chat);
          if (chatThreadMeta) chatThreadMeta.textContent = chatMetaLine(chat);
        }
        updateBadge();
      },
      (err) => console.warn("chats", err)
    );
  }

  function recomputeUnread() {
    const user = getUser();
    if (!user) {
      unreadByChat = {};
      return;
    }
    const map = {};
    lastChats.forEach(({ id, data }) => {
      const counts = data.unreadCounts || {};
      const n = counts[user.uid];
      if (typeof n === "number" && n > 0) {
        map[id] = n;
        return;
      }
      const me = data.members && data.members[user.uid];
      const lastRead = (me && me.lastReadAt) || 0;
      const lastMsg = data.lastMessageAt || 0;
      if (lastMsg > lastRead && data.lastMessageSenderUid !== user.uid) {
        map[id] = 1;
      }
    });
    unreadByChat = map;
  }

  function updateBadge() {
    if (!chatBadge) return;
    const n = Object.values(unreadByChat).reduce((a, b) => a + (Number(b) || 0), 0);
    if (n > 0) {
      chatBadge.textContent = n > 99 ? "99+" : String(n);
      chatBadge.classList.remove("hidden");
    } else {
      chatBadge.classList.add("hidden");
    }
  }

  async function markChatRead(chatId) {
    const user = getUser();
    if (!user) return;
    await updateDoc(doc(db, "chats", chatId), {
      [`members.${user.uid}.lastReadAt`]: Date.now(),
      [`unreadCounts.${user.uid}`]: 0,
    });
  }

  // ---------- Render list ----------
  function chatDisplayName(chat) {
    if (!chat) return "";
    const data = chat.data;
    if (data.type === "dm") {
      const user = getUser();
      const otherUid = (data.memberUids || []).find((u) => u !== (user && user.uid));
      const other = otherUid && data.members && data.members[otherUid];
      return (other && other.name) || t("chatDmFallback") || "Direct message";
    }
    if (data.type === "teachers") {
      return t("chatAutoTeachers") || data.name || "Учительський чат";
    }
    if (data.type === "class") {
      return data.name || t("chatTypeClass") || "Class";
    }
    if (data.type === "school") return t("chatAutoSchool") || data.name || "School";
    if (data.type === "students") return t("chatAutoStudents") || data.name || "Students";
    return data.name || t("chatGroupFallback") || "Group";
  }

  function chatMetaLine(chat) {
    if (!chat) return "";
    const data = chat.data;
    const n = (data.memberUids || []).length;
    if (data.type === "dm") return t("chatTypeDm") || "Direct";
    if (data.type === "teachers") return `${t("chatTypeTeachers") || "Teachers"} · ${n}`;
    if (data.type === "class") return `${t("chatTypeClass") || "Class"} · ${n}`;
    if (data.type === "school") return `${t("chatTypeSchool") || "School"} · ${n}`;
    if (data.type === "students") return `${t("chatTypeStudents") || "Students"} · ${n}`;
    return `${t("chatTypeGroup") || "Group"} · ${n}`;
  }

  function chatTypeIcon(type) {
    if (type === "dm") return "👤";
    if (type === "teachers") return "👨‍🏫";
    if (type === "class") return "📚";
    if (type === "school") return "🏫";
    if (type === "students") return "🎓";
    return "💬";
  }

  function renderChatList() {
    if (!chatListEl) return;
    chatListEl.innerHTML = "";
    const items = lastChats
      .filter((c) => {
        const ty = c.data && c.data.type;
        if (c.data && c.data.isAuto && (ty === "school" || ty === "students")) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.data.lastMessageAt || b.data.createdAt || 0) - (a.data.lastMessageAt || a.data.createdAt || 0));
    if (chatListEmpty) chatListEmpty.classList.toggle("hidden", items.length > 0);
    items.forEach(({ id, data }) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "chat-list-item" + (unreadByChat[id] ? " unread" : "");
      const icon = document.createElement("span");
      icon.className = "chat-list-icon";
      icon.textContent = chatTypeIcon(data.type);
      const body = document.createElement("div");
      body.className = "chat-list-body";
      const title = document.createElement("div");
      title.className = "chat-list-title";
      title.textContent = chatDisplayName({ id, data });
      const preview = document.createElement("div");
      preview.className = "chat-list-preview";
      preview.textContent = data.lastMessagePreview || chatMetaLine({ id, data });
      body.append(title, preview);
      el.append(icon, body);
      if (unreadByChat[id]) {
        const dot = document.createElement("span");
        dot.className = "chat-list-unread-dot";
        el.appendChild(dot);
      }
      if (id === activeChatId) el.classList.add("active");
      el.onclick = () => openThread(id);
      chatListEl.appendChild(el);
    });
  }

  // ---------- Messages ----------
  function mergeMessages(live, older) {
    const map = new Map();
    older.forEach((m) => map.set(m.id, m));
    live.forEach((m) => map.set(m.id, m));
    return [...map.values()].sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));
  }

  function subscribeMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    olderMessages = [];
    oldestSnap = null;
    hasMoreOlder = true;
    loadingOlder = false;
    const q = query(
      collection(db, "chatMessages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    unsubscribeMessages = onSnapshot(
      q,
      (snap) => {
        const live = snap.docs.map((d) => ({ id: d.id, data: d.data(), _snap: d })).reverse();
        if (snap.docs.length > 0) {
          if (olderMessages.length === 0) {
            oldestSnap = snap.docs[snap.docs.length - 1];
            hasMoreOlder = snap.docs.length >= PAGE_SIZE;
          }
        } else if (olderMessages.length === 0) {
          hasMoreOlder = false;
          oldestSnap = null;
        }
        lastMessages = mergeMessages(live, olderMessages);
        renderMessages(stickToBottom);
        updateScrollBottomBtn();
      },
      (err) => {
        console.warn("chatMessages", err);
        const q2 = query(collection(db, "chatMessages"), where("chatId", "==", chatId), limit(200));
        unsubscribeMessages = onSnapshot(q2, (snap) => {
          lastMessages = snap.docs
            .map((d) => ({ id: d.id, data: d.data(), _snap: d }))
            .sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));
          if (snap.docs.length) {
            oldestSnap = snap.docs.slice().sort((a, b) => (a.data().createdAt || 0) - (b.data().createdAt || 0))[0];
          }
          hasMoreOlder = false;
          renderMessages(true);
        });
      }
    );
  }

  async function loadOlderMessages() {
    if (!activeChatId || loadingOlder || !hasMoreOlder || !oldestSnap) return;
    loadingOlder = true;
    renderLoadOlderHint(true);
    try {
      const q = query(
        collection(db, "chatMessages"),
        where("chatId", "==", activeChatId),
        orderBy("createdAt", "desc"),
        startAfter(oldestSnap),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (snap.empty || snap.docs.length === 0) {
        hasMoreOlder = false;
      } else {
        const batch = snap.docs.map((d) => ({ id: d.id, data: d.data(), _snap: d })).reverse();
        olderMessages = mergeMessages(batch, olderMessages);
        oldestSnap = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < PAGE_SIZE) hasMoreOlder = false;
        const el = chatMessagesEl;
        const prevHeight = el ? el.scrollHeight : 0;
        const prevTop = el ? el.scrollTop : 0;
        const liveOnly = lastMessages.filter((m) => !olderMessages.some((o) => o.id === m.id));
        lastMessages = mergeMessages(liveOnly, olderMessages);
        renderMessages(false);
        if (el) {
          const newHeight = el.scrollHeight;
          el.scrollTop = prevTop + (newHeight - prevHeight);
        }
      }
    } catch (e) {
      console.warn("loadOlderMessages", e);
      hasMoreOlder = false;
    } finally {
      loadingOlder = false;
      renderLoadOlderHint(false);
    }
  }

  function renderLoadOlderHint(loading) {
    if (!chatMessagesEl) return;
    let hint = chatMessagesEl.querySelector(".chat-load-older-hint");
    if (!hasMoreOlder && !loading) {
      if (hint) hint.remove();
      return;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "chat-load-older-hint hint";
      chatMessagesEl.insertBefore(hint, chatMessagesEl.firstChild);
    }
    hint.textContent = loading
      ? (t("chatSending") || "…")
      : (t("chatLoadOlderHint") || "Scroll up for older messages");
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function dayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dayStart.getTime() === today.getTime()) return t("chatDayToday") || "Today";
    if (dayStart.getTime() === yesterday.getTime()) return t("chatDayYesterday") || "Yesterday";
    const locale = currentLang() === "uk" ? "uk-UA" : "en-US";
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  }

  function fillSubjectControls(chat) {
    const subjects = typeof getSubjects === "function" ? getSubjects() : [];
    const showSubject =
      chat &&
      chat.data &&
      !chat.data.noSubjects &&
      (chat.data.type === "group" || chat.data.type === "class" || chat.data.type === "school" || chat.data.type === "students");

    if (chatSubjectFilter) {
      chatSubjectFilter.classList.toggle("hidden", !showSubject);
      chatSubjectFilter.innerHTML = "";
      const all = document.createElement("option");
      all.value = "";
      all.textContent = t("chatFilterAllSubjects") || "All subjects";
      chatSubjectFilter.appendChild(all);
      subjects.forEach(({ id, data }) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = data.name || id;
        chatSubjectFilter.appendChild(opt);
      });
      chatSubjectFilter.value = subjectFilterId;
      chatSubjectFilter.onchange = () => {
        subjectFilterId = chatSubjectFilter.value;
        renderMessages(false);
        updateSubjectHint();
      };
    }
    updateSubjectHint();
  }

  function updateSubjectHint() {
    const hint = document.querySelector(".chat-subject-hint");
    if (!hint) return;
    if (!subjectFilterId) {
      hint.textContent = isTeacherSide
        ? (t("chatSubjectHintTeacher") || "Оберіть предмет зверху — повідомлення отримає цей тег, і стрічка фільтруватиметься.")
        : (t("chatSubjectHintStudent") || "Оберіть предмет зверху, щоб фільтрувати повідомлення.");
    } else {
      const sub = (typeof getSubjects === "function" ? getSubjects() : []).find((s) => s.id === subjectFilterId);
      const name = (sub && sub.data && sub.data.name) || subjectFilterId;
      hint.textContent = isTeacherSide
        ? ((t("chatSubjectActiveTeacher") || "Пишете в предмет: {name}. Змініть зверху, щоб перейти до іншого.").replace("{name}", name))
        : ((t("chatSubjectActiveStudent") || "Фільтр: {name}").replace("{name}", name));
    }
  }

  function updateScrollBottomBtn() {
    const btn = document.getElementById("chat-scroll-bottom-btn");
    if (!btn || !chatMessagesEl) return;
    const dist = chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop - chatMessagesEl.clientHeight;
    const show = dist > 120;
    btn.classList.toggle("hidden", !show);
  }

  function renderPinnedBar(msgs) {
    let bar = document.getElementById("chat-pinned-bar");
    const pinned = msgs.filter((m) => m.data && m.data.pinned && !m.data.deleted);
    if (!chatThreadView) return;
    if (pinned.length === 0) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "chat-pinned-bar";
      bar.className = "chat-pinned-bar";
      const header = chatThreadView.querySelector(".chat-thread-header");
      if (header && header.nextSibling) {
        chatThreadView.insertBefore(bar, header.nextSibling);
      } else {
        chatThreadView.insertBefore(bar, chatThreadView.firstChild);
      }
    }
    bar.innerHTML = "";
    pinned.slice(0, 3).forEach(({ id, data }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-pinned-item";
      item.innerHTML = `<span class="chat-pinned-icon">📌</span><span class="chat-pinned-text">${escapeText((data.text || "").slice(0, 80))}</span>`;
      item.onclick = () => {
        const el = chatMessagesEl && chatMessagesEl.querySelector(`[data-msg-id="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("chat-msg--flash");
          setTimeout(() => el.classList.remove("chat-msg--flash"), 1200);
        }
      };
      bar.appendChild(item);
    });
  }

  function renderMessages(scrollBottom) {
    if (!chatMessagesEl) return;
    const user = getUser();
    const locale = currentLang() === "uk" ? "uk-UA" : "en-US";
    let msgs = lastMessages.slice();
    if (subjectFilterId) {
      msgs = msgs.filter((m) => m.data.subjectId === subjectFilterId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter((m) => (m.data.text || "").toLowerCase().includes(q));
    }

    renderPinnedBar(lastMessages);

    chatMessagesEl.innerHTML = "";
    if (hasMoreOlder && !searchQuery) {
      const hint = document.createElement("div");
      hint.className = "chat-load-older-hint hint";
      hint.textContent = loadingOlder
        ? (t("chatSending") || "…")
        : (t("chatLoadOlderHint") || "Scroll up for older messages");
      chatMessagesEl.appendChild(hint);
    }

    if (msgs.length === 0) {
      const p = document.createElement("p");
      p.className = "hint chat-messages-empty";
      p.textContent = t("chatNoMessages") || "No messages yet. Say hello!";
      chatMessagesEl.appendChild(p);
      if (scrollBottom) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      return;
    }

    let prevDay = null;
    msgs.forEach(({ id, data }) => {
      const ts = data.createdAt || 0;
      const dk = dayKey(ts);
      if (dk !== prevDay) {
        prevDay = dk;
        const sep = document.createElement("div");
        sep.className = "chat-day-separator";
        sep.textContent = dayLabel(ts);
        chatMessagesEl.appendChild(sep);
      }

      const mine = user && data.senderUid === user.uid;
      const deleted = !!data.deleted;
      const row = document.createElement("div");
      row.className =
        "chat-msg" +
        (mine ? " chat-msg--mine" : "") +
        (deleted ? " chat-msg--deleted" : "") +
        (data._pending ? " chat-msg--pending" : "") +
        (data.pinned ? " chat-msg--pinned" : "");
      row.dataset.msgId = id;

      if (!mine && !deleted) {
        const name = document.createElement("div");
        name.className = "chat-msg-name";
        name.textContent = data.senderName || "";
        row.appendChild(name);
      }
      if (!deleted && (data.subjectId || data.subjectName)) {
        const chip = document.createElement("span");
        chip.className = "chat-msg-subject";
        chip.textContent = data.subjectName || data.subjectId;
        row.appendChild(chip);
      }

      const bubble = document.createElement("div");
      bubble.className = "chat-msg-bubble";
      if (deleted) {
        bubble.textContent = t("chatMessageDeleted") || "Message deleted";
      } else {
        bubble.textContent = data.text || "";
      }
      row.appendChild(bubble);

      if (!data._pending) {
        const actions = document.createElement("div");
        actions.className = "chat-msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "chat-msg-action-btn";
        copyBtn.textContent = t("chatCopy") || "Copy";
        copyBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(data.text || "");
          } catch (_) {}
        };
        actions.appendChild(copyBtn);

        if (!deleted) {
          const pinBtn = document.createElement("button");
          pinBtn.type = "button";
          pinBtn.className = "chat-msg-action-btn";
          pinBtn.textContent = data.pinned
            ? (t("chatUnpin") || "Unpin")
            : (t("chatPin") || "Pin");
          pinBtn.onclick = async (e) => {
            e.stopPropagation();
            try {
              await updateDoc(doc(db, "chatMessages", id), {
                pinned: !data.pinned,
                pinnedAt: !data.pinned ? Date.now() : null,
              });
            } catch (err) {
              console.warn("pin", err);
              alert(err.message || "Failed");
            }
          };
          actions.appendChild(pinBtn);
        }

        if (mine && !deleted) {
          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "chat-msg-action-btn";
          editBtn.textContent = t("chatEdit") || "Edit";
          editBtn.onclick = (e) => {
            e.stopPropagation();
            startEditMessage(id, data.text || "");
          };
          actions.appendChild(editBtn);

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "chat-msg-action-btn chat-msg-action-btn--danger";
          delBtn.textContent = t("chatDelete") || "Delete";
          delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(t("chatDeleteConfirm") || "Delete this message?")) return;
            try {
              await updateDoc(doc(db, "chatMessages", id), {
                deleted: true,
                deletedAt: Date.now(),
                text: "",
              });
            } catch (err) {
              console.warn("delete", err);
              alert(err.message || "Failed");
            }
          };
          actions.appendChild(delBtn);
        }
        row.appendChild(actions);
      }

      const meta = document.createElement("div");
      meta.className = "chat-msg-meta";
      const parts = [];
      if (data.createdAt) {
        parts.push(
          new Date(data.createdAt).toLocaleString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
      if (data.editedAt && !deleted) parts.push(t("chatEdited") || "edited");
      if (data.pinned && !deleted) parts.push("📌");
      if (data._pending) parts.push(t("chatSending") || "…");
      meta.textContent = parts.join(" · ");
      row.appendChild(meta);
      chatMessagesEl.appendChild(row);
    });

    ensureTypingIndicatorEl();

    if (scrollBottom) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      stickToBottom = true;
    }
    updateScrollBottomBtn();
  }

  function startEditMessage(id, text) {
    editingMessageId = id;
    if (!chatComposeText) return;
    chatComposeText.value = text;
    chatComposeText.focus();
    chatComposeText.style.height = "auto";
    chatComposeText.style.height = Math.min(chatComposeText.scrollHeight, 120) + "px";
    if (chatSendBtn) chatSendBtn.textContent = t("chatSaveEdit") || "Save";
    let cancel = document.getElementById("chat-edit-cancel");
    if (!cancel && chatComposeText.parentElement) {
      cancel = document.createElement("button");
      cancel.id = "chat-edit-cancel";
      cancel.type = "button";
      cancel.className = "secondary small";
      cancel.textContent = t("cancelOverrideTitle") || "Cancel";
      cancel.onclick = () => cancelEditMessage();
      chatComposeText.parentElement.appendChild(cancel);
    }
  }

  function cancelEditMessage() {
    editingMessageId = null;
    if (chatComposeText) {
      chatComposeText.value = "";
      chatComposeText.style.height = "auto";
    }
    if (chatSendBtn) chatSendBtn.textContent = t("chatSendBtn") || "Send";
    const cancel = document.getElementById("chat-edit-cancel");
    if (cancel) cancel.remove();
  }

  async function sendMessage() {
    const user = getUser();
    const profile = getProfile();
    if (!user || !activeChatId) return;
    const text = (chatComposeText && chatComposeText.value.trim()) || "";
    if (!text) return;

    if (editingMessageId) {
      const id = editingMessageId;
      try {
        await updateDoc(doc(db, "chatMessages", id), {
          text,
          editedAt: Date.now(),
        });
        cancelEditMessage();
        clearTyping();
      } catch (e) {
        console.error(e);
        alert((typeof t === "function" && t("chatSendError")) || e.message || "Failed");
      }
      return;
    }

    let subjectId = null;
    let subjectName = null;
    if (subjectFilterId) {
      subjectId = subjectFilterId;
      const sub = (getSubjects() || []).find((s) => s.id === subjectId);
      subjectName = (sub && sub.data && sub.data.name) || subjectId;
    }
    const now = Date.now();
    const senderName = (profile && profile.displayName) || user.email || "User";
    const tempId = "tmp-" + now;
    lastMessages = lastMessages.concat([{
      id: tempId,
      data: { chatId: activeChatId, senderUid: user.uid, senderName, text, createdAt: now, subjectId, subjectName, _pending: true },
    }]);
    stickToBottom = true;
    renderMessages(true);
    if (chatComposeText) {
      chatComposeText.value = "";
      try { chatComposeText.style.height = "auto"; } catch (_) {}
    }
    clearTyping();
    try {
      await addDoc(collection(db, "chatMessages"), {
        chatId: activeChatId,
        senderUid: user.uid,
        senderName,
        text,
        createdAt: now,
        subjectId,
        subjectName,
        deleted: false,
        pinned: false,
      });
      const preview = subjectName ? `[${subjectName}] ${text}` : text;
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "chats", activeChatId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const members = snap.data().members || {};
        const unreadCounts = Object.assign({}, snap.data().unreadCounts || {});
        Object.keys(members).forEach((uid) => {
          if (uid !== user.uid) unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
        });
        unreadCounts[user.uid] = 0;
        tx.update(ref, {
          lastMessageAt: now,
          lastMessagePreview: preview.slice(0, 120),
          lastMessageSenderUid: user.uid,
          unreadCounts: unreadCounts,
          ["members." + user.uid + ".lastReadAt"]: now,
        });
      });
      lastMessages = lastMessages.filter((m) => m.id !== tempId);
    } catch (e) {
      console.error(e);
      lastMessages = lastMessages.filter((m) => m.id !== tempId);
      renderMessages(true);
      alert((typeof t === "function" && t("chatSendError")) || e.message || "Failed to send");
    }
  }

  // ---------- Typing indicator ----------
  function typingDocId(chatId, uid) {
    return `${chatId}_${uid}`;
  }

  function ensureTypingIndicatorEl() {
    let el = document.getElementById("chat-typing-indicator");
    if (!el && chatMessagesEl && chatMessagesEl.parentElement) {
      el = document.createElement("div");
      el.id = "chat-typing-indicator";
      el.className = "chat-typing-indicator hidden";
      chatMessagesEl.parentElement.insertBefore(el, chatMessagesEl.nextSibling);
    }
    return el;
  }

  function subscribeTyping(chatId) {
    if (unsubscribeTyping) {
      unsubscribeTyping();
      unsubscribeTyping = null;
    }
    const user = getUser();
    if (!user || !chatId) return;
    const q = query(collection(db, "chatTyping"), where("chatId", "==", chatId));
    unsubscribeTyping = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const names = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data || data.uid === user.uid) return;
          if ((data.updatedAt || 0) < now - 4000) return;
          if (data.name) names.push(data.name);
        });
        const el = ensureTypingIndicatorEl();
        if (!el) return;
        if (names.length === 0) {
          el.classList.add("hidden");
          el.textContent = "";
        } else {
          el.classList.remove("hidden");
          const label = t("chatIsTyping") || "is typing…";
          el.textContent =
            names.length === 1
              ? `${names[0]} ${label}`
              : `${names.slice(0, 3).join(", ")} ${label}`;
        }
      },
      (err) => console.warn("chatTyping", err)
    );
  }

  function stopTypingPresence() {
    if (unsubscribeTyping) {
      unsubscribeTyping();
      unsubscribeTyping = null;
    }
    if (typingClearTimer) {
      clearTimeout(typingClearTimer);
      typingClearTimer = null;
    }
    const el = document.getElementById("chat-typing-indicator");
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
    clearTyping();
  }

  async function writeTyping() {
    const user = getUser();
    const profile = getProfile();
    if (!user || !activeChatId) return;
    const now = Date.now();
    if (now - lastTypingWrite < 1500) return;
    lastTypingWrite = now;
    const id = typingDocId(activeChatId, user.uid);
    try {
      await setDoc(
        doc(db, "chatTyping", id),
        {
          chatId: activeChatId,
          uid: user.uid,
          name: (profile && profile.displayName) || user.email || "User",
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (e) {
      /* ignore */
    }
    if (typingClearTimer) clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => clearTyping(), 3500);
  }

  async function clearTyping() {
    const user = getUser();
    if (!user || !activeChatId) return;
    const id = typingDocId(activeChatId, user.uid);
    try {
      await updateDoc(doc(db, "chatTyping", id), { updatedAt: 0 }).catch(() => {});
    } catch (_) {}
  }

  // ---------- New DM ----------
  function openNewDmModal() {
    if (!chatNewModal || !chatNewModalBody) return;
    chatNewModalTitle.textContent = t("chatNewDmTitle") || "New message";
    chatNewModalBody.innerHTML = "";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("chatSearchPeople") || "Search...";
    search.className = "chat-modal-search";
    const list = document.createElement("div");
    list.className = "chat-modal-list";

    const people = [];
    const myUid = getUser() && getUser().uid;
    if (getStudents) {
      getStudents().forEach(({ id, data }) => {
        if (!data.authUid || data.authUid === myUid) return;
        people.push({
          uid: data.authUid,
          name: data.name || id,
          role: "student",
          label: data.name || id,
        });
      });
    }
    if (getTeachers) {
      getTeachers().forEach(({ id, data }) => {
        if (id === myUid) return;
        people.push({
          uid: id,
          name: data.displayName || data.email || id,
          role: data.role === "admin" ? "admin" : "teacher",
          label: data.displayName || data.email || id,
        });
      });
    }
    people.sort((a, b) => a.name.localeCompare(b.name, currentLang() === "uk" ? "uk" : "en"));

    function renderPeople(filter) {
      list.innerHTML = "";
      const f = (filter || "").toLowerCase();
      people
        .filter((p) => !f || p.name.toLowerCase().includes(f))
        .forEach((p) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "chat-modal-person";
          btn.innerHTML = `<span class="chat-modal-person-name">${escapeText(p.name)}</span><span class="hint">${p.role}</span>`;
          btn.onclick = () => startDm(p);
          list.appendChild(btn);
        });
      if (list.childElementCount === 0) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = t("chatNoPeople") || "No one found.";
        list.appendChild(empty);
      }
    }
    search.oninput = () => renderPeople(search.value);
    renderPeople("");
    chatNewModalBody.append(search, list);
    chatNewModal.classList.remove("hidden");
  }

  async function startDm(person) {
    const user = getUser();
    const profile = getProfile();
    if (!user || !profile) return;
    const id = dmChatId(user.uid, person.uid);
    const ref = doc(db, "chats", id);
    const snap = await getDoc(ref);
    const myName = profile.displayName || user.email || "User";
    const myRole =
      profile.role === "admin" ? "admin" : profile.role === "student" ? "student" : "teacher";
    if (!snap.exists()) {
      await setDoc(ref, {
        type: "dm",
        schoolId: profile.schoolId || null,
        name: "",
        memberUids: [user.uid, person.uid],
        members: {
          [user.uid]: { name: myName, role: myRole, joinedAt: Date.now(), lastReadAt: Date.now() },
          [person.uid]: {
            name: person.name,
            role: person.role,
            joinedAt: Date.now(),
            lastReadAt: 0,
          },
        },
        createdBy: user.uid,
        createdAt: Date.now(),
        lastMessageAt: 0,
        lastMessagePreview: "",
        isAuto: false,
        dmKey: id,
      });
    }
    closeNewModal();
    openThread(id);
  }

  // ---------- New group ----------
  function openNewGroupModal() {
    if (!chatNewModal || !chatNewModalBody) return;
    chatNewModalTitle.textContent = t("chatNewGroupTitle") || "New group";
    chatNewModalBody.innerHTML = "";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = t("chatGroupNamePlaceholder") || "Group name";
    nameInput.className = "chat-modal-search";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("chatGroupMembersHint") || "Select members:";

    const list = document.createElement("div");
    list.className = "chat-modal-list";
    const selected = new Set();
    const myUid = getUser() && getUser().uid;

    const people = [];
    if (getStudents) {
      getStudents().forEach(({ id, data }) => {
        if (!data.authUid || data.authUid === myUid) return;
        people.push({ uid: data.authUid, name: data.name || id, role: "student" });
      });
    }
    if (getTeachers) {
      getTeachers().forEach(({ id, data }) => {
        if (id === myUid) return;
        people.push({
          uid: id,
          name: data.displayName || data.email || id,
          role: data.role === "admin" ? "admin" : "teacher",
        });
      });
    }

    people.forEach((p) => {
      const label = document.createElement("label");
      label.className = "chat-modal-person chat-modal-person--check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.onchange = () => {
        if (cb.checked) selected.add(p.uid);
        else selected.delete(p.uid);
      };
      const span = document.createElement("span");
      span.className = "chat-modal-person-name";
      span.textContent = p.name;
      const role = document.createElement("span");
      role.className = "hint";
      role.textContent = p.role;
      label.append(cb, span, role);
      list.appendChild(label);
    });

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.textContent = t("chatCreateGroupBtn") || "Create group";
    createBtn.onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert(t("chatNeedGroupName") || "Enter a group name.");
        return;
      }
      if (selected.size === 0) {
        alert(t("chatNeedMembers") || "Select at least one member.");
        return;
      }
      await createGroup(name, [...selected], people);
      closeNewModal();
    };

    chatNewModalBody.append(nameInput, hint, list, createBtn);
    chatNewModal.classList.remove("hidden");
  }

  async function createGroup(name, memberUids, peopleCatalog) {
    const user = getUser();
    const profile = getProfile();
    if (!user || !profile) return;
    const myName = profile.displayName || user.email || "User";
    const myRole =
      profile.role === "admin" ? "admin" : profile.role === "student" ? "student" : "teacher";
    const members = {
      [user.uid]: { name: myName, role: myRole, joinedAt: Date.now(), lastReadAt: Date.now() },
    };
    const uids = [user.uid];
    memberUids.forEach((uid) => {
      if (uid === user.uid) return;
      const p = peopleCatalog.find((x) => x.uid === uid);
      members[uid] = {
        name: (p && p.name) || uid,
        role: (p && p.role) || "student",
        joinedAt: Date.now(),
        lastReadAt: 0,
      };
      uids.push(uid);
    });
    const ref = await addDoc(collection(db, "chats"), {
      type: "group",
      schoolId: profile.schoolId || null,
      name,
      memberUids: uids,
      members,
      createdBy: user.uid,
      createdAt: Date.now(),
      lastMessageAt: 0,
      lastMessagePreview: "",
      isAuto: false,
    });
    openThread(ref.id);
  }

  function closeNewModal() {
    if (chatNewModal) chatNewModal.classList.add("hidden");
  }

  function escapeText(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------- DOM bootstrap ----------
  function ensureChatDom() {
    if (document.getElementById("chat-panel") && document.getElementById("chat-list")) return;
    if (document.getElementById("chat-fab")) return;

    const fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.className = "chat-fab hidden";
    fab.type = "button";
    fab.setAttribute("aria-label", "Chat");
    fab.title = "Chat";
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <span id="chat-badge" class="chat-badge hidden">0</span>
    `;
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.className = "chat-panel hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "chat-panel-heading");
    panel.innerHTML = `
      <div class="chat-panel-header">
        <h2 id="chat-panel-heading">${(typeof t === "function" && t("chatTitle")) || "Chat"}</h2>
        <button id="chat-panel-close" class="chat-panel-close" type="button" aria-label="Close">✕</button>
      </div>
      <div id="chat-list-view" class="chat-list-view">
        <div class="chat-list-actions">
          <button id="chat-new-dm-btn" type="button" class="secondary small">${(typeof t === "function" && t("chatNewDmBtn")) || "Write"}</button>
          <button id="chat-new-group-btn" type="button" class="secondary small">${(typeof t === "function" && t("chatNewGroupBtn")) || "New group"}</button>
        </div>
        <div id="chat-list" class="chat-list"></div>
        <p id="chat-list-empty" class="hint chat-list-empty hidden">${(typeof t === "function" && t("chatListEmpty")) || "No chats yet."}</p>
      </div>
      <div id="chat-thread-view" class="chat-thread-view hidden">
        <div class="chat-thread-header">
          <button id="chat-back-btn" type="button" class="chat-back-btn" aria-label="Back">←</button>
          <div class="chat-thread-titles">
            <div id="chat-thread-title" class="chat-thread-title"></div>
            <div id="chat-thread-meta" class="chat-thread-meta"></div>
          </div>
        </div>
        <div class="chat-subject-filter-wrap">
          <select id="chat-subject-filter" class="hidden" aria-label="Filter by subject"></select>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-compose">
          <div class="chat-compose-row">
            <textarea id="chat-compose-text" rows="2" placeholder="${(typeof t === "function" && t("chatComposePlaceholder")) || "Message..."}"></textarea>
            <button id="chat-send-btn" type="button">${(typeof t === "function" && t("chatSendBtn")) || "Send"}</button>
          </div>
          <p class="hint chat-subject-hint">${(typeof t === "function" && t("chatSubjectHint")) || ""}</p>
        </div>
      </div>
      <div id="chat-new-modal" class="chat-new-modal hidden" role="dialog">
        <div class="chat-new-modal-inner">
          <div class="chat-new-modal-header">
            <h3 id="chat-new-modal-title"></h3>
            <button id="chat-new-modal-close" type="button" class="chat-panel-close" aria-label="Close">✕</button>
          </div>
          <div id="chat-new-modal-body" class="chat-new-modal-body"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ---------- Bind events ----------
  if (chatFab) {
    chatFab.onclick = () => {
      if (panelOpen) closePanel();
      else openPanel();
    };
  }
  if (chatPanelClose) chatPanelClose.onclick = () => closePanel();
  if (chatBackBtn) chatBackBtn.onclick = () => showListView();
  if (chatSendBtn) chatSendBtn.onclick = () => sendMessage();
  if (chatComposeText) {
    chatComposeText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Escape" && editingMessageId) {
        e.preventDefault();
        cancelEditMessage();
      }
    });
    chatComposeText.addEventListener("input", () => {
      chatComposeText.style.height = "auto";
      chatComposeText.style.height = Math.min(chatComposeText.scrollHeight, 120) + "px";
      if (chatComposeText.value.trim()) writeTyping();
      else clearTyping();
    });
  }
  if (chatNewDmBtn) chatNewDmBtn.onclick = () => openNewDmModal();
  if (chatNewGroupBtn) chatNewGroupBtn.onclick = () => openNewGroupModal();
  if (chatNewModalClose) chatNewModalClose.onclick = () => closeNewModal();

  // Search toggle
  const chatSearchToggle = document.getElementById("chat-search-toggle");
  const chatSearchBar = document.getElementById("chat-search-bar");
  const chatSearchInput = document.getElementById("chat-search-input");
  if (chatSearchToggle && chatSearchBar) {
    chatSearchToggle.onclick = () => {
      searchOpen = !searchOpen;
      chatSearchBar.classList.toggle("hidden", !searchOpen);
      if (searchOpen && chatSearchInput) {
        chatSearchInput.focus();
      } else {
        searchQuery = "";
        if (chatSearchInput) chatSearchInput.value = "";
        renderMessages(false);
      }
    };
  }
  if (chatSearchInput) {
    chatSearchInput.placeholder = (typeof t === "function" && t("chatSearchInThread")) || "Search…";
    chatSearchInput.addEventListener("input", () => {
      searchQuery = chatSearchInput.value.trim();
      renderMessages(false);
    });
  }

  // Scroll: load older + bottom button
  if (chatMessagesEl) {
    chatMessagesEl.addEventListener("scroll", () => {
      const dist = chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop - chatMessagesEl.clientHeight;
      stickToBottom = dist < 80;
      updateScrollBottomBtn();
      if (chatMessagesEl.scrollTop < 60) {
        loadOlderMessages();
      }
    });
  }
  const scrollBottomBtn = document.getElementById("chat-scroll-bottom-btn");
  if (scrollBottomBtn) {
    scrollBottomBtn.onclick = () => {
      if (chatMessagesEl) {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        stickToBottom = true;
        updateScrollBottomBtn();
      }
    };
  }

  // ---------- Lifecycle ----------
  function start() {
    subscribeChats();
    ensureAutoGroups()
      .then(() => syncAutoGroupMembers())
      .catch((e) => console.warn(e));
    showFab(true);
    refreshI18n();
  }

  function stop() {
    if (unsubscribeChats) {
      unsubscribeChats();
      unsubscribeChats = null;
    }
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    stopTypingPresence();
    showFab(false);
    closePanel();
    setChatTabsVisible(false);
    lastChats = [];
  }

  function refreshI18n() {
    const heading = document.getElementById("chat-panel-heading");
    if (heading) heading.textContent = t("chatTitle") || "Chat";
    if (chatNewDmBtn) chatNewDmBtn.textContent = t("chatNewDmBtn") || "Write";
    if (chatNewGroupBtn) chatNewGroupBtn.textContent = t("chatNewGroupBtn") || "New group";
    if (chatListEmpty) chatListEmpty.textContent = t("chatListEmpty") || "No chats yet.";
    if (chatComposeText) chatComposeText.placeholder = t("chatComposePlaceholder") || "Message...";
    if (chatSendBtn) chatSendBtn.textContent = editingMessageId
      ? (t("chatSaveEdit") || "Save")
      : (t("chatSendBtn") || "Send");
    const searchInputEl = document.getElementById("chat-search-input");
    if (searchInputEl) searchInputEl.placeholder = t("chatSearchInThread") || "Search…";
    updateSubjectHint();
    if (chatFab) {
      chatFab.setAttribute("aria-label", t("chatTitle") || "Chat");
      chatFab.title = t("chatTitle") || "Chat";
    }
  }

  function setChatTabsVisible(show) {
    const nav = document.getElementById("chat-list-view");
    if (nav && nav.classList.contains("chat-tabs")) {
      nav.classList.toggle("hidden", !show);
    }
    document.body.classList.toggle("chat-tab-open", !!show);
  }

  function onTabActivated() {
    panelOpen = true;
    setChatTabsVisible(true);
    ensureAutoGroups().catch(function () {});
    renderChatList();
    if (!activeChatId) showListView();
  }

  function onTabDeactivated() {
    setChatTabsVisible(false);
  }

  if (document.getElementById("chat-panel") && document.getElementById("chat-panel").classList.contains("tab-panel")) {
    if (chatFab) chatFab.classList.add("hidden");
  }
  return {
    start: start,
    stop: stop,
    showFab: showFab,
    openPanel: openPanel,
    closePanel: closePanel,
    ensureAutoGroups: ensureAutoGroups,
    syncAutoGroupMembers: syncAutoGroupMembers,
    refreshI18n: refreshI18n,
    onTabActivated: onTabActivated,
    onTabDeactivated: onTabDeactivated,
  };
}
