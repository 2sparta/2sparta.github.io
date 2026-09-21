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
  const chatSubjectSelect = document.getElementById("chat-subject-select");
  const chatSubjectFilter = document.getElementById("chat-subject-filter");
  const chatComposeSubjectWrap = document.getElementById("chat-compose-subject-wrap");
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
    fillSubjectControls(chat);
    renderChatList();
    subscribeMessages(chatId);
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
  function subscribeMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    const q = query(
      collection(db, "chatMessages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    unsubscribeMessages = onSnapshot(
      q,
      (snap) => {
        lastMessages = snap.docs.map((d) => ({ id: d.id, data: d.data() })).reverse();
        renderMessages(true);
      },
      (err) => {
        console.warn("chatMessages", err);
        // Fallback without orderBy if index missing
        const q2 = query(collection(db, "chatMessages"), where("chatId", "==", chatId), limit(200));
        unsubscribeMessages = onSnapshot(q2, (snap) => {
          lastMessages = snap.docs
            .map((d) => ({ id: d.id, data: d.data() }))
            .sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));
          renderMessages();
        });
      }
    );
  }

  function fillSubjectControls(chat) {
    const subjects = typeof getSubjects === "function" ? getSubjects() : [];
    const showSubject =
      chat &&
      chat.data &&
      !chat.data.noSubjects &&
      (chat.data.type === "group" || chat.data.type === "class" || chat.data.type === "school" || chat.data.type === "students");

    if (chatComposeSubjectWrap) {
      chatComposeSubjectWrap.classList.toggle("hidden", !showSubject || !isTeacherSide);
    }
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
        renderMessages();
      };
    }
    if (chatSubjectSelect) {
      chatSubjectSelect.innerHTML = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = t("chatNoSubject") || "Without subject";
      chatSubjectSelect.appendChild(none);
      subjects.forEach(({ id, data }) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = data.name || id;
        chatSubjectSelect.appendChild(opt);
      });
    }
  }

  function renderMessages() {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "";
    const user = getUser();
    const locale = currentLang() === "uk" ? "uk-UA" : "en-US";
    let msgs = lastMessages;
    if (subjectFilterId) {
      msgs = msgs.filter((m) => m.data.subjectId === subjectFilterId);
    }
    if (msgs.length === 0) {
      const p = document.createElement("p");
      p.className = "hint chat-messages-empty";
      p.textContent = t("chatNoMessages") || "No messages yet. Say hello!";
      chatMessagesEl.appendChild(p);
      return;
    }
    msgs.forEach(({ data }) => {
      const mine = user && data.senderUid === user.uid;
      const row = document.createElement("div");
      row.className = "chat-msg" + (mine ? " chat-msg--mine" : "");
      if (!mine) {
        const name = document.createElement("div");
        name.className = "chat-msg-name";
        name.textContent = data.senderName || "";
        row.appendChild(name);
      }
      if (data.subjectId || data.subjectName) {
        const chip = document.createElement("span");
        chip.className = "chat-msg-subject";
        chip.textContent = data.subjectName || data.subjectId;
        row.appendChild(chip);
      }
      const bubble = document.createElement("div");
      bubble.className = "chat-msg-bubble";
      bubble.textContent = data.text || "";
      row.appendChild(bubble);
      const meta = document.createElement("div");
      meta.className = "chat-msg-meta";
      meta.textContent = data.createdAt
        ? new Date(data.createdAt).toLocaleString(locale, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      row.appendChild(meta);
      chatMessagesEl.appendChild(row);
    });
    if (arguments.length === 0 || arguments[0]) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  async function sendMessage() {
    const user = getUser();
    const profile = getProfile();
    if (!user || !activeChatId) return;
    const text = (chatComposeText && chatComposeText.value.trim()) || "";
    if (!text) return;
    let subjectId = null;
    let subjectName = null;
    if (chatSubjectSelect && chatSubjectSelect.value && isTeacherSide) {
      subjectId = chatSubjectSelect.value;
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
    renderMessages(true);
    if (chatComposeText) {
      chatComposeText.value = "";
      try { chatComposeText.style.height = "auto"; } catch (_) {}
    }
    try {
      await addDoc(collection(db, "chatMessages"), {
        chatId: activeChatId,
        senderUid: user.uid,
        senderName,
        text,
        createdAt: now,
        subjectId,
        subjectName,
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
          <div id="chat-compose-subject-wrap" class="chat-compose-subject-wrap hidden">
            <select id="chat-subject-select" aria-label="Subject tag"></select>
          </div>
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
    });
    chatComposeText.addEventListener("input", () => {
      chatComposeText.style.height = "auto";
      chatComposeText.style.height = Math.min(chatComposeText.scrollHeight, 120) + "px";
    });
  }
  if (chatNewDmBtn) chatNewDmBtn.onclick = () => openNewDmModal();
  if (chatNewGroupBtn) chatNewGroupBtn.onclick = () => openNewGroupModal();
  if (chatNewModalClose) chatNewModalClose.onclick = () => closeNewModal();

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
    if (chatSendBtn) chatSendBtn.textContent = t("chatSendBtn") || "Send";
    const hint = document.querySelector(".chat-subject-hint");
    if (hint) {
      hint.textContent = isTeacherSide
        ? t("chatSubjectHintTeacher") ||
          "Optional: tag a subject so students can filter the thread."
        : t("chatSubjectHintStudent") || "Filter by subject above if the chat is busy.";
    }
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
