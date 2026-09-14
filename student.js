// ==========================================================
// Кабінет учня. Читає ті самі колекції Firestore, що й панель
// вчителя (app.js), але сам нічого не редагує, крім прив'язки
// свого профілю за кодом-запрошення (students/{id}.authUid) і
// власного users/{uid} (role: "student" — створюється автоматично
// при першому вході/реєстрації, так само як role: "pending-teacher"
// створюється в app.js).
//
// Під поточні Firestore Rules (read/write students, lessons, subjects,
// schedule дозволено будь-якому автентифікованому користувачу) усе це
// вже працює без додаткових налаштувань. Майте на увазі: такі правила
// також дозволяють учневі технічно записати будь-що в ці колекції
// (наприклад, змінити свої ж бали) напряму через консоль браузера —
// цей файл сам такого не робить, але правила це не забороняють.
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  firebaseConfig,
  WEEKDAY_BY_JS_INDEX,
  getActiveOverride,
  getDayEntriesList,
  getDayMaxPeriodIndex,
  getDayEffectiveTimes,
  normalizeGroupData,
  parseTimeToMinutes,
  formatDateLocal,
  escapeHtml,
} from "./common.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM ----------
// Винесено ДО i18n: applyStaticTranslations() нижче одразу викликає
// updateGreeting()/renderScheduleContainer()/... , яким ці елементи
// потрібні вже під час першого виклику. Якщо оголосити їх нижче,
// це кине ReferenceError (temporal dead zone) ще до того, як скрипт
// дійде до прив'язки кнопок логіну/реєстрації — і сторінка виглядає
// так, ніби кнопки взагалі нічого не роблять.
const authScreen = document.getElementById("auth-screen");
const linkScreen = document.getElementById("link-screen");
const appScreen = document.getElementById("app-screen");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");

const inviteCodeInput = document.getElementById("invite-code-input");
const linkBtn = document.getElementById("link-btn");
const linkLogoutBtn = document.getElementById("link-logout-btn");
const linkError = document.getElementById("link-error");

const avatarEl = document.getElementById("avatar");
const greetingDateEl = document.getElementById("greeting-date");
const greetingTitleEl = document.getElementById("greeting-title");
const greetingSubtitleEl = document.getElementById("greeting-subtitle");
const pointsHeroValueEl = document.getElementById("points-hero-value");

const tabScheduleBtn = document.getElementById("tab-schedule-btn");
const tabTasksBtn = document.getElementById("tab-tasks-btn");
const schedulePanel = document.getElementById("schedule-panel");
const tasksPanel = document.getElementById("tasks-panel");

const liveStatusCard = document.getElementById("live-status-card");
const liveStatusEl = document.getElementById("live-status");
const joinMeetingCard = document.getElementById("join-meeting-card");
const joinMeetingBtn = document.getElementById("join-meeting-btn");

const viewTodayBtn = document.getElementById("view-today-btn");
const viewTomorrowBtn = document.getElementById("view-tomorrow-btn");
const scheduleContainer = document.getElementById("schedule-container");

const homeworkContainer = document.getElementById("homework-container");
const noHomeworkMsg = document.getElementById("no-homework-msg");
const hwSortSelect = document.getElementById("hw-sort-select");
const hwSubjectFilter = document.getElementById("hw-subject-filter");
const hwHideDoneCheckbox = document.getElementById("hw-hide-done-checkbox");

const subjectsListEl = document.getElementById("subjects-list");
const noSubjectsMsg = document.getElementById("no-subjects-msg");

const newElectiveName = document.getElementById("new-elective-name");
const addElectiveBtn = document.getElementById("add-elective-btn");
const electivesListEl = document.getElementById("electives-list");
const noElectivesMsg = document.getElementById("no-electives-msg");

// ---------- State ----------
// Так само як DOM-блок вище: винесено ДО i18n, бо updateGreeting() /
// renderScheduleContainer() / updateLiveStatus() читають ці змінні вже
// під час першого виклику applyStaticTranslations() нижче.
let studentId = null;
let studentData = null;
let lastSubjects = [];
let lastLessons = [];
let lastScheduleRaw = {};
let lastElectives = [];
let unsubscribeElectives = null;
let currentView = "today"; // "today" | "tomorrow"
let hwSortMode = "date"; // "date" | "subject"
let hwSubjectFilterId = "";
let hwHideDone = false;
let liveStatusInterval = null;
let unsubscribeStudentDoc = null;
let unsubscribeSubjects = null;
let unsubscribeLessons = null;
let unsubscribeSchedule = null;
let hwDoneIds = new Set();

// ---------- Homework prefs / "done" marks (збережено локально на пристрої) ----------
// Позначки "виконано" — суто локальна зручність для учня (немає окремого
// поля в Firestore під це і не хочеться додавати запис прав на students/
// lessons заради чекбокса). Тому зберігаємо в localStorage, окремо на
// кожного прив'язаного учня, щоб не змішувалось при вході різних акаунтів
// на одному пристрої.
function hwDoneStorageKey() {
  return `schooleballs-hw-done-${studentId}`;
}
function hwPrefsStorageKey() {
  return `schooleballs-hw-prefs-${studentId}`;
}
function loadHwDoneSet() {
  try {
    const raw = localStorage.getItem(hwDoneStorageKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}
function saveHwDoneSet(set) {
  try {
    localStorage.setItem(hwDoneStorageKey(), JSON.stringify([...set]));
  } catch (e) {
    /* localStorage недоступний (приватний режим тощо) — просто ігноруємо */
  }
}
function loadHwPrefs() {
  try {
    const raw = localStorage.getItem(hwPrefsStorageKey());
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.sort === "date" || prefs.sort === "subject") hwSortMode = prefs.sort;
    if (typeof prefs.subjectId === "string") hwSubjectFilterId = prefs.subjectId;
    if (typeof prefs.hideDone === "boolean") hwHideDone = prefs.hideDone;
  } catch (e) {
    /* ігноруємо биті/відсутні дані */
  }
}
function saveHwPrefs() {
  try {
    localStorage.setItem(
      hwPrefsStorageKey(),
      JSON.stringify({ sort: hwSortMode, subjectId: hwSubjectFilterId, hideDone: hwHideDone })
    );
  } catch (e) {
    /* ігноруємо */
  }
}

// ---------- i18n ----------
const LANG_STORAGE_KEY = "schooleballs-lang";

const translations = {
  uk: {
    authTitle: "Вхід для учня",
    emailPlaceholder: "Електронна пошта",
    passwordPlaceholder: "Пароль",
    loginBtn: "Увійти",
    registerBtn: "Зареєструватися (вперше)",
    logout: "Вийти",
    linkHeading: "Прив'язати профіль",
    linkHint: "Введіть код-запрошення, який дав вам учитель.",
    inviteCodePlaceholder: "Код-запрошення",
    linkBtn: "Прив'язати",
    teacherLinkText: "Я вчитель →",
    codeNotFound: "Код не знайдено. Перевірте, чи правильно він введений.",
    codeAlreadyUsed: "Цей код вже використано. Зверніться до вчителя.",
    notStudentRole: "Цей акаунт зареєстровано як вчительський. Скористайтеся панеллю вчителя (посилання нижче).",
    greeting: (name) => `Привіт, ${name}!`,
    pointsLabel: "балів",
    tabSchedule: "Розклад",
    tabTasks: "Завдання",
    scheduleHeading: "Розклад",
    viewToday: "Сьогодні",
    viewTomorrow: "Завтра",
    homeworkHeading: "Найближчі домашні завдання",
    noHomeworkMsg: "Найближчим часом дз не заплановано.",
    hwSortLabel: "Сортувати:",
    hwSortDate: "За датою",
    hwSortSubject: "За предметом",
    hwFilterSubjectLabel: "Предмет:",
    hwFilterAllSubjects: "Усі предмети",
    hwHideDoneLabel: "Приховати виконані",
    hwMarkDoneLabel: "Виконано",
    subjectsListHeading: "Мої предмети",
    noSubjectsMsg: "Предметів ще немає.",
    electivesHeading: "Мої факультативи",
    electivesHint: "Видно тільки вам — вчитель і інші учні їх не бачать.",
    electiveNamePlaceholder: "Назва факультативу",
    noElectivesMsg: "Факультативів ще немає.",
    addBtn: "Додати",
    deleteBtn: "Видалити",
    joinMeetingBtn: "Приєднатися до зустрічі",
    liveLessonLabel: "Йде урок:",
    liveBreakLabel: "Перерва",
    liveNoSubject: "Урок",
    nextLessonLabel: "Далі",
    noActiveLesson: "Зараз немає активного уроку",
    minutesLeft: (m) => `залишилось ${m} хв`,
    noLessonForDay: "Урок на цю дату ще не додано.",
    noScheduleForDay: "На цей день розклад ще не задано.",
    homeworkDateShort: "ДЗ до:",
    lessonDateShort: "Урок:",
    deletedSubjectLabel: "Видалений предмет",
    noMeetingLink: "",
    errors: {
      "auth/invalid-email": "Некоректний email.",
      "auth/user-not-found": "Користувача не знайдено.",
      "auth/wrong-password": "Невірний пароль.",
      "auth/email-already-in-use": "Цей email вже зареєстрований.",
      "auth/weak-password": "Пароль занадто простий (мінімум 6 символів).",
      "auth/invalid-credential": "Невірний email або пароль.",
      "permission-denied": "Firestore відхилив запит (перевірте правила безпеки).",
    },
  },
  en: {
    authTitle: "Student Sign In",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    registerBtn: "Register (first time)",
    logout: "Sign Out",
    linkHeading: "Link your profile",
    linkHint: "Enter the invite code your teacher gave you.",
    inviteCodePlaceholder: "Invite code",
    linkBtn: "Link",
    teacherLinkText: "I'm a teacher →",
    codeNotFound: "Code not found. Check that it's typed correctly.",
    codeAlreadyUsed: "This code has already been used. Contact your teacher.",
    notStudentRole: "This account is registered as a teacher account. Use the teacher panel (link below).",
    greeting: (name) => `Hi, ${name}!`,
    pointsLabel: "points",
    tabSchedule: "Schedule",
    tabTasks: "Tasks",
    scheduleHeading: "Schedule",
    viewToday: "Today",
    viewTomorrow: "Tomorrow",
    homeworkHeading: "Upcoming homework",
    noHomeworkMsg: "No homework due soon.",
    hwSortLabel: "Sort:",
    hwSortDate: "By date",
    hwSortSubject: "By subject",
    hwFilterSubjectLabel: "Subject:",
    hwFilterAllSubjects: "All subjects",
    hwHideDoneLabel: "Hide completed",
    hwMarkDoneLabel: "Done",
    subjectsListHeading: "My subjects",
    noSubjectsMsg: "No subjects yet.",
    electivesHeading: "My electives",
    electivesHint: "Only visible to you — your teacher and other students can't see these.",
    electiveNamePlaceholder: "Elective name",
    noElectivesMsg: "No electives yet.",
    addBtn: "Add",
    deleteBtn: "Delete",
    joinMeetingBtn: "Join the meeting",
    liveLessonLabel: "Lesson in progress:",
    liveBreakLabel: "Break",
    liveNoSubject: "Lesson",
    nextLessonLabel: "Next",
    noActiveLesson: "No active lesson right now",
    minutesLeft: (m) => `${m} min left`,
    noLessonForDay: "No lesson added for this date yet.",
    noScheduleForDay: "No schedule set for this day yet.",
    homeworkDateShort: "HW due:",
    lessonDateShort: "Lesson:",
    deletedSubjectLabel: "Deleted subject",
    noMeetingLink: "",
    errors: {
      "auth/invalid-email": "Invalid email.",
      "auth/user-not-found": "User not found.",
      "auth/wrong-password": "Wrong password.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Password is too weak (min 6 characters).",
      "auth/invalid-credential": "Invalid email or password.",
      "permission-denied": "Firestore rejected the request (check security rules).",
    },
  },
};

let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "uk";
if (!translations[currentLang]) currentLang = "uk";

function t(key) {
  return translations[currentLang][key];
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key] !== undefined) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[currentLang][key] !== undefined) el.placeholder = t(key);
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
  updateGreeting();
  renderScheduleContainer();
  renderHomeworkContainer();
  renderSubjectsList();
  updateLiveStatus();
}

function setLanguage(lang) {
  if (!translations[lang] || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  applyStaticTranslations();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});
applyStaticTranslations();

// ---------- Tabs ----------
function showTab(tab) {
  if (tabScheduleBtn) tabScheduleBtn.classList.toggle("active", tab === "schedule");
  if (tabTasksBtn) tabTasksBtn.classList.toggle("active", tab === "tasks");
  if (schedulePanel) schedulePanel.classList.toggle("hidden", tab !== "schedule");
  if (tasksPanel) tasksPanel.classList.toggle("hidden", tab !== "tasks");
}
if (tabScheduleBtn) tabScheduleBtn.onclick = () => showTab("schedule");
if (tabTasksBtn) tabTasksBtn.onclick = () => showTab("tasks");

function errorText(e) {
  return translations[currentLang].errors[e.code] || e.message;
}

function myGroup() {
  return studentData && studentData.group ? studentData.group : "group1";
}

// ---------- Screens ----------
function showAuthScreen() {
  authScreen.classList.remove("hidden");
  linkScreen.classList.add("hidden");
  appScreen.classList.add("hidden");
  teardownListeners();
}

function showLinkScreen() {
  authScreen.classList.add("hidden");
  linkScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  linkScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  if (!liveStatusInterval) liveStatusInterval = setInterval(updateLiveStatus, 30000);
}

function teardownListeners() {
  if (unsubscribeStudentDoc) unsubscribeStudentDoc();
  if (unsubscribeSubjects) unsubscribeSubjects();
  if (unsubscribeLessons) unsubscribeLessons();
  if (unsubscribeSchedule) unsubscribeSchedule();
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    liveStatusInterval = null;
  }
  studentId = null;
  studentData = null;
  hwDoneIds = new Set();
  hwSortMode = "date";
  hwSubjectFilterId = "";
  hwHideDone = false;
}

// ---------- Auth ----------
loginBtn.onclick = async () => {
  authError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (e) {
    authError.textContent = errorText(e);
  }
};

registerBtn.onclick = async () => {
  authError.textContent = "";
  try {
    // На відміну від вчителя, учневі не потрібне ручне підтвердження ролі —
    // users/{uid} з role: "student" створюється одразу в onAuthStateChanged
    // нижче (ensureStudentRoleDoc), і onAuthStateChanged сам поведе далі,
    // на екран прив'язки коду.
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (e) {
    authError.textContent = errorText(e);
  }
};

logoutBtn.onclick = () => signOut(auth);
linkLogoutBtn.onclick = () => signOut(auth);

// Гарантує документ users/{uid} з role: "student" (як того вимагають
// Firestore Rules при create) і повертає поточну роль акаунта. Якщо
// документ уже існує (наприклад, акаунт зареєстровано на панелі вчителя
// як pending-teacher/teacher), роль не змінюємо — просто повертаємо її.
async function ensureStudentRoleDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data().role;
  await setDoc(ref, { role: "student", email: user.email, createdAt: Date.now() });
  return "student";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAuthScreen();
    return;
  }
  try {
    const role = await ensureStudentRoleDoc(user);
    if (role !== "student") {
      authError.textContent = t("notStudentRole");
      await signOut(auth);
      return;
    }
    const found = await findLinkedStudent(user.uid);
    if (found) {
      studentId = found.id;
      studentData = found.data;
      startDashboard(user);
    } else {
      showLinkScreen();
    }
  } catch (e) {
    authError.textContent = errorText(e);
    showAuthScreen();
  }
});

async function findLinkedStudent(uid) {
  const q = query(collection(db, "students"), where("authUid", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

linkBtn.onclick = async () => {
  linkError.textContent = "";
  const code = inviteCodeInput.value.trim().toUpperCase();
  if (!code) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    const q = query(collection(db, "students"), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) {
      linkError.textContent = t("codeNotFound");
      return;
    }
    const docSnap = snap.docs[0];
    if (docSnap.data().authUid) {
      linkError.textContent = t("codeAlreadyUsed");
      return;
    }
    await updateDoc(doc(db, "students", docSnap.id), { authUid: user.uid });
    studentId = docSnap.id;
    studentData = { ...docSnap.data(), authUid: user.uid };
    inviteCodeInput.value = "";
    startDashboard(user);
  } catch (e) {
    linkError.textContent = errorText(e);
  }
};

// ---------- Dashboard bootstrap ----------
function startDashboard(user) {
  loadHwPrefs();
  hwDoneIds = loadHwDoneSet();
  showAppScreen();
  if (avatarEl) {
    avatarEl.textContent = (studentData.name || user.email || "?").trim().charAt(0).toUpperCase();
    avatarEl.title = user.email || "";
  }
  updateGreeting();

  unsubscribeStudentDoc = onSnapshot(doc(db, "students", studentId), (snap) => {
    if (!snap.exists()) return;
    studentData = snap.data();
    updateGreeting();
    updateLiveStatus();
    renderScheduleContainer();
  });

  unsubscribeSubjects = onSnapshot(
    query(collection(db, "subjects"), orderBy("name")),
    (snap) => {
      lastSubjects = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderSubjectsList();
      renderScheduleContainer();
      renderHomeworkContainer();
      updateLiveStatus();
    }
  );

  unsubscribeLessons = onSnapshot(
    query(collection(db, "lessons"), orderBy("createdAt", "desc")),
    (snap) => {
      lastLessons = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderScheduleContainer();
      renderHomeworkContainer();
    }
  );

  unsubscribeSchedule = onSnapshot(doc(db, "schedule", "week"), (snap) => {
    lastScheduleRaw = snap.exists() ? snap.data() : {};
    renderScheduleContainer();
    updateLiveStatus();
  });

  unsubscribeElectives = onSnapshot(
    query(collection(db, "electives"), where("uid", "==", user.uid)),
    (snap) => {
      lastElectives = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderElectivesList();
    }
  );
}

// Розклад свого класу будується "на льоту" з сирого документа schedule/week —
// так учневі не потрібен повний список усіх класів (їх бачить лише вчитель).
function getGroupSchedule(classId) {
  return normalizeGroupData(lastScheduleRaw[classId]);
}

// ---------- Greeting ----------
function updateGreeting() {
  if (greetingDateEl) {
    const locale = currentLang === "uk" ? "uk-UA" : "en-US";
    const text = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    greetingDateEl.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (greetingTitleEl) {
    greetingTitleEl.textContent = t("greeting")(studentData ? studentData.name : "");
  }
  if (greetingSubtitleEl) greetingSubtitleEl.textContent = "";
  if (pointsHeroValueEl) pointsHeroValueEl.textContent = String(studentData ? studentData.points ?? 0 : 0);
}

// ---------- Subjects (read-only) ----------
function getSubjectName(subjectId) {
  const found = lastSubjects.find((s) => s.id === subjectId);
  return found ? found.data.name : t("deletedSubjectLabel");
}

function renderSubjectsList() {
  subjectsListEl.innerHTML = "";
  lastSubjects.forEach(({ data }) => {
    const li = document.createElement("li");
    li.className = "subject-item";

    const topRow = document.createElement("div");
    topRow.className = "subject-item-top";

    const nameSpan = document.createElement("span");
    nameSpan.className = "subject-item-name";
    nameSpan.textContent = data.name;
    topRow.appendChild(nameSpan);

    if (data.meetingLink) {
      const joinBtn = document.createElement("button");
      joinBtn.className = "secondary small";
      joinBtn.textContent = t("joinMeetingBtn");
      joinBtn.onclick = () => window.open(data.meetingLink, "_blank", "noopener");
      topRow.appendChild(joinBtn);
    }

    li.appendChild(topRow);
    subjectsListEl.appendChild(li);
  });
  noSubjectsMsg.classList.toggle("hidden", lastSubjects.length > 0);
}

// ---------- Live status (як у вчителя, але для фіксованої групи учня) ----------
function updateJoinMeetingButton(subjectId) {
  if (!joinMeetingCard || !joinMeetingBtn) return;
  const subject = subjectId ? lastSubjects.find((s) => s.id === subjectId) : null;
  const link = subject && subject.data.meetingLink ? subject.data.meetingLink.trim() : "";
  if (!link) {
    joinMeetingCard.classList.add("hidden");
    joinMeetingBtn.onclick = null;
    return;
  }
  joinMeetingCard.classList.remove("hidden");
  joinMeetingBtn.textContent = `${t("joinMeetingBtn")} — ${subject.data.name}`;
  joinMeetingBtn.onclick = () => window.open(link, "_blank", "noopener");
}

function updateLiveStatus() {
  if (!liveStatusEl || !studentData) return;

  const now = new Date();
  const groupSchedule = getGroupSchedule(myGroup());
  const weekdayKey = WEEKDAY_BY_JS_INDEX[now.getDay()];
  const dayEntries = groupSchedule[weekdayKey] || {};
  const periodTimes = getDayEffectiveTimes(groupSchedule, weekdayKey);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const maxPeriodIndex = Math.max(
    0,
    ...["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => getDayMaxPeriodIndex(groupSchedule[d]) + 1),
    ...Object.keys(periodTimes).map((k) => parseInt(k, 10) + 1)
  );

  const periods = [];
  for (let r = 0; r < maxPeriodIndex; r++) {
    const time = periodTimes[r] || periodTimes[String(r)];
    const start = time ? parseTimeToMinutes(time.start) : null;
    const end = time ? parseTimeToMinutes(time.end) : null;
    if (start !== null && end !== null && end > start) periods.push({ r, start, end });
  }
  periods.sort((a, b) => a.start - b.start);

  if (periods.length === 0) {
    liveStatusCard.classList.add("hidden");
    updateJoinMeetingButton(null);
    return;
  }
  liveStatusCard.classList.remove("hidden");

  let state = null;
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (nowMinutes >= p.start && nowMinutes < p.end) {
      state = { type: "lesson", period: p };
      break;
    }
    if (i < periods.length - 1 && nowMinutes >= p.end && nowMinutes < periods[i + 1].start) {
      state = { type: "break", from: p, to: periods[i + 1] };
      break;
    }
  }

  if (!state) {
    liveStatusEl.innerHTML = `<div class="live-status-row live-status-idle">${t("noActiveLesson")}</div>`;
    updateJoinMeetingButton(null);
    return;
  }

  if (state.type === "lesson") {
    const remaining = state.period.end - nowMinutes;
    const override = getActiveOverride(groupSchedule, weekdayKey, state.period.r);
    const subjectId = override
      ? override.subjectId
      : dayEntries[state.period.r] ? dayEntries[state.period.r].subjectId : null;
    const subjectName = subjectId ? getSubjectName(subjectId) : t("liveNoSubject");
    liveStatusEl.innerHTML = `
      <div class="live-status-row live-status-lesson">
        <span class="live-status-dot"></span>
        <span class="live-status-text">
          <span class="live-status-label">${t("liveLessonLabel")}</span>
          <span class="live-status-subject">${escapeHtml(subjectName)}</span>
        </span>
        <span class="live-status-minutes">${t("minutesLeft")(remaining)}</span>
      </div>`;
    updateJoinMeetingButton(subjectId);
  } else {
    const remaining = state.to.start - nowMinutes;
    const nextOverride = getActiveOverride(groupSchedule, weekdayKey, state.to.r);
    const nextSubjectId = nextOverride
      ? nextOverride.subjectId
      : dayEntries[state.to.r] ? dayEntries[state.to.r].subjectId : null;
    const nextName = nextSubjectId ? getSubjectName(nextSubjectId) : "";
    liveStatusEl.innerHTML = `
      <div class="live-status-row live-status-break">
        <span class="live-status-dot"></span>
        <span class="live-status-text">
          <span class="live-status-label">${t("liveBreakLabel")}</span>
          ${nextName ? `<span class="live-status-subject">${t("nextLessonLabel")}: ${escapeHtml(nextName)}</span>` : ""}
        </span>
        <span class="live-status-minutes">${t("minutesLeft")(remaining)}</span>
      </div>`;
    updateJoinMeetingButton(null);
  }
}

// ---------- Schedule (сьогодні / завтра) ----------
[viewTodayBtn, viewTomorrowBtn].forEach((btn) => {
  btn.onclick = () => {
    currentView = btn.dataset.view;
    [viewTodayBtn, viewTomorrowBtn].forEach((b) => b.classList.toggle("active", b === btn));
    renderScheduleContainer();
  };
});

function renderScheduleContainer() {
  if (!scheduleContainer || !studentData) return;
  scheduleContainer.innerHTML = "";

  const target = new Date();
  target.setDate(target.getDate() + (currentView === "tomorrow" ? 1 : 0));
  const targetDateStr = formatDateLocal(target);
  const weekdayKey = WEEKDAY_BY_JS_INDEX[target.getDay()];
  const groupSchedule = getGroupSchedule(myGroup());
  const dayEntries = getDayEntriesList(groupSchedule, weekdayKey);

  if (dayEntries.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("noScheduleForDay");
    scheduleContainer.appendChild(hint);
    return;
  }

  dayEntries.forEach(({ period, subjectId: baseSubjectId }) => {
    const override = getActiveOverride(groupSchedule, weekdayKey, period);
    const subjectId = override ? override.subjectId : baseSubjectId;

    const block = document.createElement("div");
    block.className = "today-subject-block";

    const nameEl = document.createElement("div");
    nameEl.className = "today-subject-name";
    nameEl.textContent = getSubjectName(subjectId);
    block.appendChild(nameEl);

    const matchingLessons = lastLessons.filter(
      (l) => l.data.subjectId === subjectId && l.data.lessonDate === targetDateStr
    );

    if (matchingLessons.length === 0) {
      const hint = document.createElement("div");
      hint.className = "no-lesson-hint";
      hint.textContent = t("noLessonForDay");
      block.appendChild(hint);
    } else {
      matchingLessons.forEach(({ data }) => block.appendChild(renderLessonView(data)));
    }

    scheduleContainer.appendChild(block);
  });
}

function renderLessonView(data) {
  const wrap = document.createElement("div");
  wrap.className = "lesson-item";

  const title = document.createElement("div");
  title.className = "lesson-title";
  title.textContent = data.title;
  wrap.appendChild(title);

  const datesRow = document.createElement("div");
  datesRow.className = "lesson-dates";
  if (data.lessonDate) {
    const badge = document.createElement("span");
    badge.className = "date-badge";
    badge.textContent = `${t("lessonDateShort")} ${data.lessonDate}`;
    datesRow.appendChild(badge);
  }
  if (data.homeworkDate) {
    const badge = document.createElement("span");
    badge.className = "date-badge hw";
    badge.textContent = `${t("homeworkDateShort")} ${data.homeworkDate}`;
    datesRow.appendChild(badge);
  }
  wrap.appendChild(datesRow);

  if (data.content) {
    const content = document.createElement("div");
    content.className = "lesson-content";
    content.textContent = data.content;
    wrap.appendChild(content);
  }

  return wrap;
}

// ---------- Homework (найближчі, з сортуванням/фільтром/позначками) ----------
if (hwSortSelect) {
  hwSortSelect.onchange = () => {
    hwSortMode = hwSortSelect.value === "subject" ? "subject" : "date";
    if (studentId) saveHwPrefs();
    renderHomeworkContainer();
  };
}
if (hwSubjectFilter) {
  hwSubjectFilter.onchange = () => {
    hwSubjectFilterId = hwSubjectFilter.value;
    if (studentId) saveHwPrefs();
    renderHomeworkContainer();
  };
}
if (hwHideDoneCheckbox) {
  hwHideDoneCheckbox.onchange = () => {
    hwHideDone = hwHideDoneCheckbox.checked;
    if (studentId) saveHwPrefs();
    renderHomeworkContainer();
  };
}

// Перебудовує список опцій фільтра за предметом, намагаючись зберегти
// поточний вибір, якщо цей предмет ще існує.
function updateHwSubjectFilterOptions() {
  if (!hwSubjectFilter) return;
  hwSubjectFilter.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = t("hwFilterAllSubjects");
  hwSubjectFilter.appendChild(allOpt);
  lastSubjects.forEach(({ id, data }) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.name;
    hwSubjectFilter.appendChild(opt);
  });
  const stillValid = hwSubjectFilterId && lastSubjects.some((s) => s.id === hwSubjectFilterId);
  hwSubjectFilter.value = stillValid ? hwSubjectFilterId : "";
  if (!stillValid) hwSubjectFilterId = "";
}

function renderHomeworkContainer() {
  if (!homeworkContainer) return;
  updateHwSubjectFilterOptions();
  if (hwSortSelect) hwSortSelect.value = hwSortMode;
  if (hwHideDoneCheckbox) hwHideDoneCheckbox.checked = hwHideDone;
  homeworkContainer.innerHTML = "";

  const todayStr = formatDateLocal(new Date());
  let upcoming = lastLessons.filter((l) => !!l.data.homeworkDate && l.data.homeworkDate >= todayStr);

  if (hwSubjectFilterId) {
    upcoming = upcoming.filter((l) => l.data.subjectId === hwSubjectFilterId);
  }
  if (hwHideDone) {
    upcoming = upcoming.filter((l) => !hwDoneIds.has(l.id));
  }

  if (hwSortMode === "subject") {
    const locale = currentLang === "uk" ? "uk" : "en";
    upcoming = upcoming.slice().sort((a, b) => {
      const cmp = getSubjectName(a.data.subjectId).localeCompare(getSubjectName(b.data.subjectId), locale);
      return cmp !== 0 ? cmp : a.data.homeworkDate.localeCompare(b.data.homeworkDate);
    });
  } else {
    upcoming = upcoming.slice().sort((a, b) => a.data.homeworkDate.localeCompare(b.data.homeworkDate));
  }

  upcoming = upcoming.slice(0, 20);

  upcoming.forEach(({ id, data }) => {
    const block = document.createElement("div");
    block.className = "today-subject-block";
    if (hwDoneIds.has(id)) block.classList.add("hw-done");

    const nameEl = document.createElement("div");
    nameEl.className = "today-subject-name";
    nameEl.textContent = getSubjectName(data.subjectId);
    block.appendChild(nameEl);

    block.appendChild(renderLessonView(data));

    const doneLabel = document.createElement("label");
    doneLabel.className = "hw-done-toggle";
    const doneCheckbox = document.createElement("input");
    doneCheckbox.type = "checkbox";
    doneCheckbox.checked = hwDoneIds.has(id);
    doneCheckbox.onchange = () => {
      if (doneCheckbox.checked) hwDoneIds.add(id);
      else hwDoneIds.delete(id);
      saveHwDoneSet(hwDoneIds);
      renderHomeworkContainer();
    };
    const doneText = document.createElement("span");
    doneText.textContent = t("hwMarkDoneLabel");
    doneLabel.appendChild(doneCheckbox);
    doneLabel.appendChild(doneText);
    block.appendChild(doneLabel);

    homeworkContainer.appendChild(block);
  });

  noHomeworkMsg.classList.toggle("hidden", upcoming.length > 0);
}

// ---------- Факультативи (приватні, видно тільки самому учню) ----------
if (addElectiveBtn) {
  addElectiveBtn.onclick = async () => {
    const name = newElectiveName.value.trim();
    if (!name || !studentId || !auth.currentUser) return;
    try {
      await addDoc(collection(db, "electives"), {
        uid: auth.currentUser.uid,
        studentId,
        name,
        createdAt: Date.now(),
      });
      newElectiveName.value = "";
    } catch (e) {
      alert(errorText(e));
    }
  };
}

function renderElectivesList() {
  if (!electivesListEl) return;
  electivesListEl.innerHTML = "";
  lastElectives
    .slice()
    .sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0))
    .forEach(({ id, data }) => {
      const li = document.createElement("li");
      li.className = "elective-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "elective-item-name";
      nameSpan.textContent = data.name;
      li.appendChild(nameSpan);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "elective-delete-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", t("deleteBtn"));
      deleteBtn.onclick = () => deleteDoc(doc(db, "electives", id)).catch((e) => alert(errorText(e)));
      li.appendChild(deleteBtn);

      electivesListEl.appendChild(li);
    });
  if (noElectivesMsg) noElectivesMsg.classList.toggle("hidden", lastElectives.length > 0);
}