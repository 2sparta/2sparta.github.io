// ==========================================================
// Конфиг проекта Firebase (schooleballs)
// ==========================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALxxd9W3RH4g17Ygdcy3qlBR4Um6CIQ3g",
  authDomain: "schooleballs.firebaseapp.com",
  projectId: "schooleballs",
  storageBucket: "schooleballs.firebasestorage.app",
  messagingSenderId: "816513463350",
  appId: "1:816513463350:web:d419b07188f9c36ff79497",
  measurementId: "G-K8HGF284FX"
};

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
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================================
// Локалізація (i18n)
// ==========================================================
const LANG_STORAGE_KEY = "schooleballs-lang";

const translations = {
  uk: {
    authTitle: "Вхід для вчителя",
    emailPlaceholder: "Електронна пошта",
    passwordPlaceholder: "Пароль",
    loginBtn: "Увійти",
    registerBtn: "Зареєструватися (вперше)",
    hintHtml:
      "Після реєстрації першого вчителя зайдіть у Firebase Console → Firestore → " +
      "колекція <code>users</code> → знайдіть свій uid і змініть поле " +
      "<code>role</code> на <b>teacher</b>. Інакше доступ до панелі буде закрито.",
    appTitle: "Бали учнів",
    logout: "Вийти",
    tabPoints: "Бали",
    tabTasks: "Завдання",
    addStudentHeading: "Додати учня",
    studentNamePlaceholder: "Ім'я учня",
    addBtn: "Додати",
    studentsListHeading: "Список учнів",
    thName: "Ім'я",
    thPoints: "Бали",
    thChange: "Змінити",
    thCode: "Код-запрошення",
    thLinked: "Прив'язаний",
    linked: "Прив'язаний",
    notLinked: "Очікує",
    deleteBtn: "Видалити",
    deleteConfirm: (name) => `Видалити ${name}?`,

    addSubjectHeading: "Додати предмет",
    subjectNamePlaceholder: "Назва предмета",
    subjectsListHeading: "Список предметів",
    noSubjectsMsg: "Предметів ще немає.",
    deleteSubjectConfirm: (name) => `Видалити предмет "${name}"? Уроки цього предмета залишаться, але без прив'язки.`,
    selectSubjectPlaceholder: "Оберіть предмет",
    addSubjectFirstHint: "Спочатку додайте хоча б один предмет.",

    scheduleHeading: "Розклад",
    groupSwitchLabel: "Група:",
    group1Label: "Група 1",
    group2Label: "Група 2",
    weekdays: { mon: "Понеділок", tue: "Вівторок", wed: "Середа", thu: "Четвер", fri: "П'ятниця", sat: "Субота", sun: "Неділя" },
    weekdaysShort: { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Нд" },
    addToScheduleBtn: "Додати",
    emptyDayHint: "На цей день предметів ще не додано.",
    periodStartLabel: "Початок уроку",
    periodEndLabel: "Кінець уроку",
    scheduleApplyBtn: "Застосувати розклад",
    scheduleEditBtn: "Змінити розклад",
    scheduleEmptyMsg: "Розклад порожній.",
    oneTimeChangeTitle: "Разова заміна (на цей тиждень)",
    removeOverrideTitle: "Скасувати разову заміну",
    confirmOverrideTitle: "Підтвердити заміну",
    cancelOverrideTitle: "Скасувати",

    liveLessonLabel: "Йде урок:",
    liveBreakLabel: "Перерва",
    liveNoSubject: "Урок",
    nextLessonLabel: "Далі",
    noActiveLesson: "Зараз немає активного уроку",
    minutesLeft: (m) => `залишилось ${m} хв`,

    addLessonHeading: "Додати урок",
    lessonTitlePlaceholder: "Назва уроку",
    lessonContentPlaceholder: "Зміст уроку / завдання",
    lessonDateLabel: "Дата уроку",
    homeworkDateLabel: "Дата дз (до)",
    lessonsHeading: "Список уроків",
    noLessons: "Уроків ще немає.",
    expandBtn: "Показати",
    collapseBtn: "Згорнути",
    deleteLessonConfirm: (title) => `Видалити урок «${title}»?`,
    lessonDateShort: "Урок:",
    homeworkDateShort: "ДЗ до:",
    deletedSubjectLabel: "Видалений предмет",

    viewToday: "Сьогодні",
    viewTomorrow: "Завтра",
    viewAll: "Всі",
    viewTypeLessons: "Уроки",
    viewTypeHomework: "ДЗ",
    noLessonForDay: "Урок на цю дату ще не додано.",
    noScheduleForDay: "На цей день розклад ще не задано.",
    noHomeworkForDay: "На цю дату дз ще не задано.",

    registerSuccess: (uid) =>
      "Акаунт створено. Тепер у Firebase Console → Firestore → users → " +
      uid + " встановіть role = teacher, після чого увійдіть знову.",
    noTeacherRole:
      "У цього акаунта немає прав вчителя (role != teacher). " +
      "Перевірте роль у Firestore або використайте інший акаунт.",
    errors: {
      "auth/invalid-email": "Некоректний email.",
      "auth/user-not-found": "Користувача не знайдено.",
      "auth/wrong-password": "Невірний пароль.",
      "auth/email-already-in-use": "Цей email вже зареєстрований.",
      "auth/weak-password": "Пароль занадто простий (мінімум 6 символів).",
      "auth/invalid-credential": "Невірний email або пароль.",
    },
  },
  en: {
    authTitle: "Teacher Sign In",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    registerBtn: "Register (first time)",
    hintHtml:
      "After registering the first teacher, go to Firebase Console → Firestore → " +
      "the <code>users</code> collection → find your uid and set the " +
      "<code>role</code> field to <b>teacher</b>. Otherwise access to the panel will stay closed.",
    appTitle: "Student Points",
    logout: "Sign Out",
    tabPoints: "Points",
    tabTasks: "Tasks",
    addStudentHeading: "Add a Student",
    studentNamePlaceholder: "Student name",
    addBtn: "Add",
    studentsListHeading: "Student List",
    thName: "Name",
    thPoints: "Points",
    thChange: "Change",
    thCode: "Invite Code",
    thLinked: "Linked",
    linked: "Linked",
    notLinked: "Pending",
    deleteBtn: "Delete",
    deleteConfirm: (name) => `Delete ${name}?`,

    addSubjectHeading: "Add a Subject",
    subjectNamePlaceholder: "Subject name",
    subjectsListHeading: "Subject List",
    noSubjectsMsg: "No subjects yet.",
    deleteSubjectConfirm: (name) => `Delete subject "${name}"? Its lessons will remain but unlinked.`,
    selectSubjectPlaceholder: "Choose a subject",
    addSubjectFirstHint: "Add at least one subject first.",

    scheduleHeading: "Schedule",
    groupSwitchLabel: "Group:",
    group1Label: "Group 1",
    group2Label: "Group 2",
    weekdays: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
    weekdaysShort: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
    addToScheduleBtn: "Add",
    emptyDayHint: "No subjects added for this day yet.",
    periodStartLabel: "Lesson start",
    periodEndLabel: "Lesson end",
    scheduleApplyBtn: "Apply schedule",
    scheduleEditBtn: "Change schedule",
    scheduleEmptyMsg: "The schedule is empty.",
    oneTimeChangeTitle: "One-time change (this week only)",
    removeOverrideTitle: "Cancel one-time change",
    confirmOverrideTitle: "Confirm change",
    cancelOverrideTitle: "Cancel",

    liveLessonLabel: "Lesson in progress:",
    liveBreakLabel: "Break",
    liveNoSubject: "Lesson",
    nextLessonLabel: "Next",
    noActiveLesson: "No active lesson right now",
    minutesLeft: (m) => `${m} min left`,

    addLessonHeading: "Add a Lesson",
    lessonTitlePlaceholder: "Lesson title",
    lessonContentPlaceholder: "Lesson content / assignment",
    lessonDateLabel: "Lesson date",
    homeworkDateLabel: "Homework due date",
    lessonsHeading: "Lesson List",
    noLessons: "No lessons yet.",
    expandBtn: "Show",
    collapseBtn: "Hide",
    deleteLessonConfirm: (title) => `Delete lesson "${title}"?`,
    lessonDateShort: "Lesson:",
    homeworkDateShort: "HW due:",
    deletedSubjectLabel: "Deleted subject",

    viewToday: "Today",
    viewTomorrow: "Tomorrow",
    viewAll: "All",
    viewTypeLessons: "Lessons",
    viewTypeHomework: "Homework",
    noLessonForDay: "No lesson added for this date yet.",
    noScheduleForDay: "No schedule set for this day yet.",
    noHomeworkForDay: "No homework due on this date yet.",

    registerSuccess: (uid) =>
      "Account created. Now in Firebase Console → Firestore → users → " +
      uid + " set role = teacher, then sign in again.",
    noTeacherRole:
      "This account doesn't have teacher rights (role != teacher). " +
      "Check the role in Firestore or use a different account.",
    errors: {
      "auth/invalid-email": "Invalid email.",
      "auth/user-not-found": "User not found.",
      "auth/wrong-password": "Wrong password.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Password is too weak (min 6 characters).",
      "auth/invalid-credential": "Invalid email or password.",
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
    if (translations[currentLang][key] !== undefined) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[currentLang][key] !== undefined) {
      el.placeholder = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (translations[currentLang][key] !== undefined) {
      el.innerHTML = t(key);
    }
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
}

function setLanguage(lang) {
  if (!translations[lang] || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  applyStaticTranslations();
  renderStudentsTable();
  renderSubjectsList();
  renderSubjectSelects();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});

applyStaticTranslations();

// ==========================================================
// Групи (Група 1 / Група 2) — окремий розклад для кожної
// ==========================================================
const GROUP_STORAGE_KEY = "schooleballs-group";
const GROUPS = ["group1", "group2"];

let currentGroup = localStorage.getItem(GROUP_STORAGE_KEY) || "group1";
if (!GROUPS.includes(currentGroup)) currentGroup = "group1";

function setGroup(group) {
  if (!GROUPS.includes(group) || group === currentGroup) return;
  currentGroup = group;
  localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  updateGroupButtons();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
}

function updateGroupButtons() {
  document.querySelectorAll(".group-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.group === currentGroup);
  });
}

// ---------- DOM refs ----------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const newStudentName = document.getElementById("new-student-name");
const addStudentBtn = document.getElementById("add-student-btn");
const studentsTbody = document.getElementById("students-tbody");

const tabPointsBtn = document.getElementById("tab-points-btn");
const tabTasksBtn = document.getElementById("tab-tasks-btn");
const pointsPanel = document.getElementById("points-panel");
const tasksPanel = document.getElementById("tasks-panel");

const newSubjectName = document.getElementById("new-subject-name");
const addSubjectBtn = document.getElementById("add-subject-btn");
const subjectsList = document.getElementById("subjects-list");
const noSubjectsMsg = document.getElementById("no-subjects-msg");

const scheduleDaysEl = document.getElementById("schedule-days");
const scheduleToggleBtn = document.getElementById("schedule-toggle-btn");
const liveStatusCard = document.getElementById("live-status-card");
const liveStatusEl = document.getElementById("live-status");
const group1Btn = document.getElementById("group-1-btn");
const group2Btn = document.getElementById("group-2-btn");

[group1Btn, group2Btn].forEach((btn) => {
  if (btn) btn.onclick = () => setGroup(btn.dataset.group);
});
updateGroupButtons();

if (scheduleToggleBtn) {
  scheduleToggleBtn.onclick = async () => {
    const groupSchedule = scheduleData[currentGroup];
    const newApplied = !groupSchedule.applied;
    try {
      await setDoc(
        doc(db, "schedule", "week"),
        { [currentGroup]: { applied: newApplied } },
        { merge: true }
      );
    } catch (e) {
      reportSaveError(e, "Не вдалося оновити розклад", "Failed to update the schedule");
    }
  };
}

const newLessonSubject = document.getElementById("new-lesson-subject");
const newLessonTitle = document.getElementById("new-lesson-title");
const newLessonContent = document.getElementById("new-lesson-content");
const newLessonDate = document.getElementById("new-lesson-date");
const newLessonHwDate = document.getElementById("new-lesson-hw-date");
const addLessonBtn = document.getElementById("add-lesson-btn");
const lessonsContainer = document.getElementById("lessons-container");
const noLessonsMsg = document.getElementById("no-lessons-msg");

const viewTodayBtn = document.getElementById("view-today-btn");
const viewTomorrowBtn = document.getElementById("view-tomorrow-btn");
const viewAllBtn = document.getElementById("view-all-btn");
const typeLessonsBtn = document.getElementById("type-lessons-btn");
const typeHomeworkBtn = document.getElementById("type-homework-btn");

// Стан розгортання (щоб не губився при перемальовуванні через onSnapshot)
const expandedLessons = new Set();
const expandedSubjectGroups = new Set();

let unsubscribeStudents = null;
let unsubscribeLessons = null;
let unsubscribeSubjects = null;
let unsubscribeSchedule = null;
let liveStatusInterval = null;

// Кешуємо останні дані зі Firestore
let lastStudents = []; // [{id, data}]
let lastLessons = []; // [{id, data}]
let lastSubjects = []; // [{id, data}]
let scheduleData = emptySchedule();
let currentView = "today"; // "today" | "tomorrow" | "all"
let currentType = "lessons"; // "lessons" | "homework"

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// getDay(): 0=Sun..6=Sat
const WEEKDAY_BY_JS_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function emptyGroupSchedule() {
  return {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    times: {},
    applied: false,
    overrides: {},
  };
}

// Повертає ISO-ключ поточного тижня, напр. "2026-W37".
// Використовується, щоб разові заміни автоматично "спливали" в кінці тижня.
function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Повертає активну (не протерміновану) разову заміну для клітинки, якщо є.
function getActiveOverride(groupSchedule, dayKey, r) {
  const dayOverrides = groupSchedule.overrides && groupSchedule.overrides[dayKey];
  if (!dayOverrides) return null;
  const entry = dayOverrides[r] ?? dayOverrides[String(r)];
  if (!entry) return null;
  if (entry.weekKey !== getISOWeekKey(new Date())) return null;
  return entry;
}

function emptySchedule() {
  return { group1: emptyGroupSchedule(), group2: emptyGroupSchedule() };
}

// Приводить сирі дані одної групи з Firestore до єдиного формату.
// Підтримує стару структуру (елементи дня — просто subjectId-рядки) для
// зворотної сумісності зі старим розкладом, який ще не мав груп/дублів.
function normalizeGroupData(groupRaw) {
  const base = emptyGroupSchedule();
  if (!groupRaw) return base;
  WEEKDAYS.forEach((dayKey) => {
    const arr = Array.isArray(groupRaw[dayKey]) ? groupRaw[dayKey] : [];
    base[dayKey] = arr.map((item, idx) => {
      if (typeof item === "string") {
        // старий формат: сам рядок subjectId
        return { eid: `legacy-${dayKey}-${idx}-${item}`, subjectId: item, raw: item };
      }
      return {
        eid: item.eid || `${item.subjectId}-${idx}`,
        subjectId: item.subjectId,
        raw: item,
      };
    });
  });
  base.times = groupRaw.times || {};
  base.applied = !!groupRaw.applied;
  base.overrides = groupRaw.overrides || {};
  return base;
}

function generateEntryId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTimeToMinutes(hhmm) {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- Tabs ----------
function showTab(tab) {
  const isPoints = tab === "points";
  tabPointsBtn.classList.toggle("active", isPoints);
  tabTasksBtn.classList.toggle("active", !isPoints);
  pointsPanel.classList.toggle("hidden", !isPoints);
  tasksPanel.classList.toggle("hidden", isPoints);
}
tabPointsBtn.onclick = () => showTab("points");
tabTasksBtn.onclick = () => showTab("tasks");

// ---------- Auth ----------
loginBtn.onclick = async () => {
  authError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (e) {
    authError.textContent = errorText(e);
  }
};

let isRegistering = false;

registerBtn.onclick = async () => {
  authError.textContent = "";
  isRegistering = true;
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
    await setDoc(doc(db, "users", cred.user.uid), {
      role: "pending-teacher",
      email: cred.user.email,
      createdAt: Date.now(),
    });
    authError.textContent = t("registerSuccess")(cred.user.uid);
    await signOut(auth);
  } catch (e) {
    authError.textContent = errorText(e);
  } finally {
    isRegistering = false;
  }
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (isRegistering) return;

  if (!user) {
    showAuthScreen();
    return;
  }
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== "teacher") {
    authError.textContent = t("noTeacherRole");
    await signOut(auth);
    return;
  }

  showAppScreen();
  listenToStudents();
  listenToSubjects();
  listenToSchedule();
  listenToLessons();
});

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (unsubscribeStudents) unsubscribeStudents();
  if (unsubscribeLessons) unsubscribeLessons();
  if (unsubscribeSubjects) unsubscribeSubjects();
  if (unsubscribeSchedule) unsubscribeSchedule();
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    liveStatusInterval = null;
  }
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  showTab("points");
  if (!liveStatusInterval) {
    liveStatusInterval = setInterval(updateLiveStatus, 30000);
  }
}

function errorText(e) {
  return translations[currentLang].errors[e.code] || e.message;
}

function reportSaveError(e, contextUk, contextEn) {
  console.error(contextUk, e);
  alert(currentLang === "uk" ? `${contextUk}: ${e.message}` : `${contextEn}: ${e.message}`);
}

// ---------- Students ----------
function listenToStudents() {
  const q = query(collection(db, "students"), orderBy("name"));
  unsubscribeStudents = onSnapshot(q, (snap) => {
    lastStudents = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    renderStudentsTable();
  });
}

function renderStudentsTable() {
  studentsTbody.innerHTML = "";
  lastStudents.forEach(({ id, data }) => {
    studentsTbody.appendChild(renderStudentRow(id, data));
  });
}

addStudentBtn.onclick = async () => {
  const name = newStudentName.value.trim();
  if (!name) return;
  await addDoc(collection(db, "students"), {
    name,
    points: 0,
    inviteCode: generateInviteCode(),
    authUid: null,
    createdAt: Date.now(),
  });
  newStudentName.value = "";
};

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function renderStudentRow(id, data) {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  nameTd.textContent = data.name;

  const pointsTd = document.createElement("td");
  pointsTd.className = "points";
  pointsTd.textContent = data.points ?? 0;

  const controlsTd = document.createElement("td");
  const controls = document.createElement("div");
  controls.className = "point-controls";

  const minusBtn = document.createElement("button");
  minusBtn.textContent = "-1";
  minusBtn.onclick = () => changePoints(id, data.points, -1);

  const plusBtn = document.createElement("button");
  plusBtn.textContent = "+1";
  plusBtn.onclick = () => changePoints(id, data.points, +1);

  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.placeholder = "±N";

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "OK";
  applyBtn.onclick = () => {
    const delta = parseInt(customInput.value, 10);
    if (!isNaN(delta)) {
      changePoints(id, data.points, delta);
      customInput.value = "";
    }
  };

  controls.append(minusBtn, plusBtn, customInput, applyBtn);
  controlsTd.appendChild(controls);

  const codeTd = document.createElement("td");
  codeTd.innerHTML = `<code>${data.inviteCode || "-"}</code>`;

  const linkedTd = document.createElement("td");
  if (data.authUid) {
    linkedTd.textContent = t("linked");
    linkedTd.className = "linked";
  } else {
    linkedTd.textContent = t("notLinked");
    linkedTd.className = "not-linked";
  }

  const deleteTd = document.createElement("td");
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("deleteBtn");
  deleteBtn.className = "secondary small";
  deleteBtn.onclick = () => {
    if (confirm(t("deleteConfirm")(data.name))) deleteDoc(doc(db, "students", id));
  };
  deleteTd.appendChild(deleteBtn);

  tr.append(nameTd, pointsTd, controlsTd, codeTd, linkedTd, deleteTd);
  return tr;
}

async function changePoints(id, currentPoints, delta) {
  const newValue = Math.max(0, (currentPoints || 0) + delta);
  await updateDoc(doc(db, "students", id), { points: newValue });
}

// ---------- Subjects (предмети) ----------
function listenToSubjects() {
  const q = query(collection(db, "subjects"), orderBy("name"));
  unsubscribeSubjects = onSnapshot(q, (snap) => {
    lastSubjects = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    renderSubjectsList();
    renderSubjectSelects();
    renderSchedule();
    renderLessonsContainer();
    updateLiveStatus();
  });
}

function getSubjectName(subjectId) {
  const found = lastSubjects.find((s) => s.id === subjectId);
  return found ? found.data.name : t("deletedSubjectLabel");
}

function renderSubjectsList() {
  subjectsList.innerHTML = "";
  lastSubjects.forEach(({ id, data }) => {
    const li = document.createElement("li");
    li.className = "subject-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "subject-item-name";
    nameSpan.textContent = data.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = t("deleteBtn");
    deleteBtn.className = "secondary small";
    deleteBtn.onclick = () => {
      if (confirm(t("deleteSubjectConfirm")(data.name))) deleteDoc(doc(db, "subjects", id));
    };

    li.append(nameSpan, deleteBtn);
    subjectsList.appendChild(li);
  });
  noSubjectsMsg.classList.toggle("hidden", lastSubjects.length > 0);
}

addSubjectBtn.onclick = async () => {
  const name = newSubjectName.value.trim();
  if (!name) return;
  try {
    await addDoc(collection(db, "subjects"), { name, createdAt: Date.now() });
    newSubjectName.value = "";
  } catch (e) {
    reportSaveError(e, "Не вдалося додати предмет. Перевірте правила Firestore для колекції subjects", "Failed to add the subject. Check Firestore Rules for the subjects collection");
  }
};

function renderSubjectSelects() {
  const options = lastSubjects.map((s) => `<option value="${s.id}">${escapeHtml(s.data.name)}</option>`).join("");
  const placeholder = `<option value="" disabled ${lastSubjects.length ? "" : "selected"}>${t("selectSubjectPlaceholder")}</option>`;

  // Форма додавання уроку
  const prevLessonSelectValue = newLessonSubject.value;
  newLessonSubject.innerHTML = placeholder + options;
  if (lastSubjects.some((s) => s.id === prevLessonSelectValue)) {
    newLessonSubject.value = prevLessonSelectValue;
  }

  // Селекти в розкладі (перебудовуються разом з блоками днів)
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Schedule (розклад) ----------
function listenToSchedule() {
  unsubscribeSchedule = onSnapshot(doc(db, "schedule", "week"), (snap) => {
    const raw = snap.exists() ? snap.data() : {};
    const hasGroups = !!raw.group1 || !!raw.group2;
    scheduleData = hasGroups
      ? { group1: normalizeGroupData(raw.group1), group2: normalizeGroupData(raw.group2) }
      // Старий документ без груп — показуємо його як Групу 1, Група 2 порожня
      : { group1: normalizeGroupData(raw), group2: emptyGroupSchedule() };
    renderSchedule();
    renderLessonsContainer();
    updateLiveStatus();
  });
}

function renderSchedule() {
  scheduleDaysEl.innerHTML = "";

  const groupSchedule = scheduleData[currentGroup];
  const applied = !!groupSchedule.applied;

  if (scheduleToggleBtn) {
    scheduleToggleBtn.textContent = applied ? t("scheduleEditBtn") : t("scheduleApplyBtn");
    scheduleToggleBtn.classList.toggle("secondary", applied);
  }

  // У прийнятому розкладі показуємо лише дні (стовпці), де є хоча б один урок.
  const visibleDays = applied
    ? WEEKDAYS.filter((d) => (groupSchedule[d] || []).length > 0)
    : WEEKDAYS;

  const maxPeriods = Math.max(0, ...visibleDays.map((d) => (groupSchedule[d] || []).length));
  // У режимі редагування лишаємо +1 рядок для додавання наступного уроку;
  // у прийнятому розкладі зайвих рядків не показуємо.
  const rowCount = applied ? maxPeriods : maxPeriods + 1;

  if (applied && rowCount === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("scheduleEmptyMsg");
    scheduleDaysEl.appendChild(hint);
    return;
  }

  const table = document.createElement("table");
  table.className = "schedule-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const cornerTh = document.createElement("th");
  cornerTh.className = "schedule-table-corner";
  headRow.appendChild(cornerTh);
  visibleDays.forEach((dayKey) => {
    const th = document.createElement("th");
    th.textContent = t("weekdaysShort")[dayKey];
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const periodTimes = groupSchedule.times || {};

  for (let r = 0; r < rowCount; r++) {
    const tr = document.createElement("tr");

    const rowTh = document.createElement("th");
    rowTh.className = "schedule-table-period";

    const numberEl = document.createElement("div");
    numberEl.className = "schedule-period-number";
    numberEl.textContent = String(r + 1);
    rowTh.appendChild(numberEl);

    const timesWrap = document.createElement("div");
    timesWrap.className = "schedule-period-times";

    const savedTime = periodTimes[r] || periodTimes[String(r)] || {};

       const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.className = "schedule-period-time-input";
    startInput.value = savedTime.start || "";
    startInput.setAttribute("aria-label", t("periodStartLabel"));
    startInput.onblur = async () => {
      const newStart = startInput.value || null;
      if (newStart === (savedTime.start || null)) return;

      try {
        await setDoc(
          doc(db, "schedule", "week"),
          { [currentGroup]: { times: { [r]: { start: newStart } } } },
          { merge: true }
        );
      } catch (e) {
        reportSaveError(e, "Не вдалося зберегти час уроку", "Failed to save the lesson time");
      }
    };

    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.className = "schedule-period-time-input";
    endInput.value = savedTime.end || "";
    endInput.setAttribute("aria-label", t("periodEndLabel"));
    endInput.onblur = async () => {
      const newEnd = endInput.value || null;
      if (newEnd === (savedTime.end || null)) return;

      try {
        await setDoc(
          doc(db, "schedule", "week"),
          { [currentGroup]: { times: { [r]: { end: newEnd } } } },
          { merge: true }
        );
      } catch (e) {
        reportSaveError(e, "Не вдалося зберегти час уроку", "Failed to save the lesson time");
      }
    };

    timesWrap.append(startInput, endInput);
    rowTh.appendChild(timesWrap);
    tr.appendChild(rowTh);

    visibleDays.forEach((dayKey) => {
      const dayEntries = groupSchedule[dayKey] || [];
      const td = document.createElement("td");
      td.className = "schedule-table-cell";

      if (applied && r < dayEntries.length) {
        const entry = dayEntries[r];
        const override = getActiveOverride(groupSchedule, dayKey, r);

        if (override) {
          // Активна разова заміна — показуємо на помаранчевому фоні,
          // з можливістю скасувати й повернути звичайний урок.
          const chip = document.createElement("span");
          chip.className = "chip chip-override";
          chip.textContent = getSubjectName(override.subjectId);

          const removeBtn = document.createElement("button");
          removeBtn.className = "chip-remove";
          removeBtn.textContent = "×";
          removeBtn.title = t("removeOverrideTitle");
          removeBtn.onclick = async () => {
            try {
              await updateDoc(doc(db, "schedule", "week"), {
                [`${currentGroup}.overrides.${dayKey}.${r}`]: deleteField(),
              });
            } catch (e) {
              reportSaveError(e, "Не вдалося скасувати заміну", "Failed to cancel the change");
            }
          };

          chip.appendChild(removeBtn);
          td.appendChild(chip);
        } else {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = getSubjectName(entry.subjectId);

          const swapBtn = document.createElement("button");
          swapBtn.className = "chip-remove chip-swap";
          swapBtn.textContent = "⇄";
          swapBtn.title = t("oneTimeChangeTitle");
          swapBtn.onclick = () => renderOverridePicker(td, dayKey, r);

          chip.appendChild(swapBtn);
          td.appendChild(chip);
        }
      } else if (applied) {
        td.classList.add("schedule-table-empty");
        td.textContent = "–";
      } else if (r < dayEntries.length) {
        const entry = dayEntries[r];
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = getSubjectName(entry.subjectId);

        const removeBtn = document.createElement("button");
        removeBtn.className = "chip-remove";
        removeBtn.textContent = "×";
        removeBtn.onclick = async () => {
          try {
            // Видаляємо саме цей конкретний запис (entry.raw), а не всі уроки
            // цього предмета в цей день — так можна тримати кілька однакових
            // уроків підряд і видаляти їх по одному.
            await setDoc(
              doc(db, "schedule", "week"),
              { [currentGroup]: { [dayKey]: arrayRemove(entry.raw) } },
              { merge: true }
            );
          } catch (e) {
            reportSaveError(e, "Не вдалося оновити розклад", "Failed to update the schedule");
          }
        };

        chip.appendChild(removeBtn);
        td.appendChild(chip);
      } else if (r === dayEntries.length) {
        // Тут навмисно НЕ виключаємо вже додані на цей день предмети —
        // це дозволяє додати той самий предмет кілька разів за день.
        const availableSubjects = lastSubjects;

        const addWrap = document.createElement("div");
        addWrap.className = "schedule-cell-add";

        const select = document.createElement("select");
        select.className = "schedule-cell-select";

        if (availableSubjects.length === 0) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = t("addSubjectFirstHint");
          opt.disabled = true;
          opt.selected = true;
          select.appendChild(opt);
          select.disabled = true;
        } else {
          const placeholderOpt = document.createElement("option");
          placeholderOpt.value = "";
          placeholderOpt.textContent = t("selectSubjectPlaceholder");
          placeholderOpt.disabled = true;
          placeholderOpt.selected = true;
          select.appendChild(placeholderOpt);
          availableSubjects.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.data.name;
            select.appendChild(opt);
          });
        }

        const addBtn = document.createElement("button");
        addBtn.className = "schedule-cell-add-btn";
        addBtn.textContent = "+";
        addBtn.title = t("addToScheduleBtn");
        addBtn.disabled = availableSubjects.length === 0;
        addBtn.onclick = async () => {
          const subjectId = select.value;
          if (!subjectId) return;
          const newEntry = { eid: generateEntryId(), subjectId };
          try {
            await setDoc(
              doc(db, "schedule", "week"),
              { [currentGroup]: { [dayKey]: arrayUnion(newEntry) } },
              { merge: true }
            );
          } catch (e) {
            reportSaveError(e, "Не вдалося оновити розклад. Перевірте правила Firestore для колекції schedule", "Failed to update the schedule. Check Firestore Rules for the schedule collection");
          }
        };

        addWrap.append(select, addBtn);
        td.appendChild(addWrap);
      } else {
        td.classList.add("schedule-table-empty");
        td.textContent = "–";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);

  const wrap = document.createElement("div");
  wrap.className = "schedule-table-wrap";
  wrap.appendChild(table);
  scheduleDaysEl.appendChild(wrap);
}

// Показує в клітинці розкладу вибір предмета для разової заміни на цей тиждень.
function renderOverridePicker(td, dayKey, r) {
  td.innerHTML = "";

  const addWrap = document.createElement("div");
  addWrap.className = "schedule-cell-add";

  const select = document.createElement("select");
  select.className = "schedule-cell-select";

  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  placeholderOpt.textContent = t("selectSubjectPlaceholder");
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  select.appendChild(placeholderOpt);

  lastSubjects.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.data.name;
    select.appendChild(opt);
  });

  const btnRow = document.createElement("div");
  btnRow.className = "schedule-cell-override-actions";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "schedule-cell-add-btn";
  confirmBtn.textContent = "✓";
  confirmBtn.title = t("confirmOverrideTitle");
  confirmBtn.onclick = async () => {
    const subjectId = select.value;
    if (!subjectId) return;
    try {
      await setDoc(
        doc(db, "schedule", "week"),
        {
          [currentGroup]: {
            overrides: {
              [dayKey]: { [r]: { subjectId, weekKey: getISOWeekKey(new Date()) } },
            },
          },
        },
        { merge: true }
      );
    } catch (e) {
      reportSaveError(e, "Не вдалося зберегти разову заміну", "Failed to save the one-time change");
    }
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "schedule-cell-add-btn";
  cancelBtn.textContent = "×";
  cancelBtn.title = t("cancelOverrideTitle");
  cancelBtn.onclick = () => renderSchedule();

  btnRow.append(confirmBtn, cancelBtn);
  addWrap.append(select, btnRow);
  td.appendChild(addWrap);
}

// ---------- Live status (зараз урок / перерва) ----------
function updateLiveStatus() {
  if (!liveStatusEl) return;

  const now = new Date();
  const groupSchedule = scheduleData[currentGroup];
  const weekdayKey = WEEKDAY_BY_JS_INDEX[now.getDay()];
  const dayEntries = groupSchedule[weekdayKey] || [];
  const periodTimes = groupSchedule.times || {};
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const maxPeriodIndex = Math.max(
    0,
    ...WEEKDAYS.map((d) => (groupSchedule[d] || []).length),
    ...Object.keys(periodTimes).map((k) => parseInt(k, 10) + 1)
  );

  const periods = [];
  for (let r = 0; r < maxPeriodIndex; r++) {
    const time = periodTimes[r] || periodTimes[String(r)];
    const start = time ? parseTimeToMinutes(time.start) : null;
    const end = time ? parseTimeToMinutes(time.end) : null;
    if (start !== null && end !== null && end > start) {
      periods.push({ r, start, end });
    }
  }
  periods.sort((a, b) => a.start - b.start);

  if (periods.length === 0) {
    liveStatusCard.classList.add("hidden");
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
  }
}

// ---------- Lessons (уроки) ----------
function listenToLessons() {
  const q = query(collection(db, "lessons"), orderBy("createdAt", "desc"));
  unsubscribeLessons = onSnapshot(q, (snap) => {
    lastLessons = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    renderLessonsContainer();
  });
}

addLessonBtn.onclick = async () => {
  const subjectId = newLessonSubject.value;
  const title = newLessonTitle.value.trim();
  const content = newLessonContent.value.trim();
  const lessonDate = newLessonDate.value || null;
  const homeworkDate = newLessonHwDate.value || null;

  if (!subjectId) {
    alert(t("selectSubjectPlaceholder"));
    return;
  }
  if (!title) return;

  try {
    await addDoc(collection(db, "lessons"), {
      subjectId,
      title,
      content: content || "",
      lessonDate,
      homeworkDate,
      createdAt: Date.now(),
    });
    newLessonTitle.value = "";
    newLessonContent.value = "";
    newLessonDate.value = "";
    newLessonHwDate.value = "";
  } catch (e) {
    reportSaveError(e, "Не вдалося додати урок. Перевірте правила Firestore для колекції lessons", "Failed to add the lesson. Check Firestore Rules for the lessons collection");
  }
};

[viewTodayBtn, viewTomorrowBtn, viewAllBtn].forEach((btn) => {
  btn.onclick = () => {
    currentView = btn.dataset.view;
    [viewTodayBtn, viewTomorrowBtn, viewAllBtn].forEach((b) => b.classList.toggle("active", b === btn));
    renderLessonsContainer();
  };
});

[typeLessonsBtn, typeHomeworkBtn].forEach((btn) => {
  btn.onclick = () => {
    currentType = btn.dataset.type;
    [typeLessonsBtn, typeHomeworkBtn].forEach((b) => b.classList.toggle("active", b === btn));
    renderLessonsContainer();
  };
});

function getFilteredAllLessons() {
  return currentType === "homework"
    ? lastLessons.filter((l) => !!l.data.homeworkDate)
    : lastLessons;
}

function renderLessonsContainer() {
  lessonsContainer.innerHTML = "";

  if (currentView === "all") {
    renderAllView();
  } else {
    renderDayView(currentView === "today" ? 0 : 1);
  }

  const nothingToShow =
    currentView === "all"
      ? getFilteredAllLessons().length === 0
      : false; // day views always render their own "no lesson/homework" hints
  noLessonsMsg.classList.toggle("hidden", !nothingToShow);
}

function renderDayView(dayOffset) {
  const target = new Date();
  target.setDate(target.getDate() + dayOffset);
  const targetDateStr = formatDateLocal(target);

  if (currentType === "homework") {
    renderDayHomework(targetDateStr);
  } else {
    renderDayLessons(target, targetDateStr);
  }
}

function renderDayLessons(target, targetDateStr) {
  const weekdayKey = WEEKDAY_BY_JS_INDEX[target.getDay()];
  const dayEntries = scheduleData[currentGroup][weekdayKey] || [];

  if (dayEntries.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("noScheduleForDay");
    lessonsContainer.appendChild(hint);
    return;
  }

  dayEntries.forEach(({ subjectId }) => {
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
      matchingLessons.forEach(({ id, data }) => {
        block.appendChild(renderLessonCard(id, data));
      });
    }

    lessonsContainer.appendChild(block);
  });
}

function renderDayHomework(targetDateStr) {
  // ДЗ прив'язане до дати здачі, а не до розкладу дня — тож шукаємо серед
  // усіх уроків незалежно від того, чи предмет стоїть у розкладі на targetDateStr
  const matching = lastLessons.filter((l) => l.data.homeworkDate === targetDateStr);

  if (matching.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("noHomeworkForDay");
    lessonsContainer.appendChild(hint);
    return;
  }

  const bySubject = new Map();
  matching.forEach((lesson) => {
    const key = lesson.data.subjectId || "__none__";
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(lesson);
  });

  const subjectOrder = lastSubjects.map((s) => s.id).filter((id) => bySubject.has(id));
  Array.from(bySubject.keys())
    .filter((id) => !subjectOrder.includes(id))
    .forEach((id) => subjectOrder.push(id));

  subjectOrder.forEach((subjectId) => {
    const block = document.createElement("div");
    block.className = "today-subject-block";

    const nameEl = document.createElement("div");
    nameEl.className = "today-subject-name";
    nameEl.textContent = subjectId === "__none__" ? t("deletedSubjectLabel") : getSubjectName(subjectId);
    block.appendChild(nameEl);

    bySubject.get(subjectId).forEach(({ id, data }) => {
      block.appendChild(renderLessonCard(id, data));
    });

    lessonsContainer.appendChild(block);
  });
}

function renderAllView() {
  const sourceLessons = getFilteredAllLessons();
  if (sourceLessons.length === 0) return;

  // Групуємо уроки за предметом
  const bySubject = new Map();
  sourceLessons.forEach((lesson) => {
    const key = lesson.data.subjectId || "__none__";
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(lesson);
  });

  // Порядок предметів: спочатку існуючі (за алфавітом), потім видалені
  const subjectOrder = lastSubjects.map((s) => s.id).filter((id) => bySubject.has(id));
  Array.from(bySubject.keys())
    .filter((id) => !subjectOrder.includes(id))
    .forEach((id) => subjectOrder.push(id));

  const dateField = currentType === "homework" ? "homeworkDate" : "lessonDate";

  subjectOrder.forEach((subjectId) => {
    const lessons = bySubject.get(subjectId).slice().sort((a, b) => {
      const dateA = a.data[dateField] || "";
      const dateB = b.data[dateField] || "";
      if (dateA !== dateB) return dateB.localeCompare(dateA); // новіші дати спершу
      return (b.data.createdAt || 0) - (a.data.createdAt || 0);
    });

    const group = document.createElement("div");
    group.className = "subject-group";

    const isExpanded = expandedSubjectGroups.has(subjectId);

    const header = document.createElement("div");
    header.className = "subject-group-header";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "subject-group-toggle";
    toggleBtn.textContent = isExpanded ? "▾" : "▸";

    const titleSpan = document.createElement("span");
    titleSpan.className = "subject-group-title";
    titleSpan.textContent = subjectId === "__none__" ? t("deletedSubjectLabel") : getSubjectName(subjectId);

    const countSpan = document.createElement("span");
    countSpan.className = "subject-group-count";
    countSpan.textContent = ` (${lessons.length})`;
    titleSpan.appendChild(countSpan);

    header.append(toggleBtn, titleSpan);

    const lessonsWrap = document.createElement("div");
    lessonsWrap.className = "subject-lessons" + (isExpanded ? "" : " hidden");
    lessons.forEach(({ id, data }) => {
      lessonsWrap.appendChild(renderLessonCard(id, data));
    });

    header.onclick = () => {
      const nowExpanded = !expandedSubjectGroups.has(subjectId);
      if (nowExpanded) expandedSubjectGroups.add(subjectId);
      else expandedSubjectGroups.delete(subjectId);
      lessonsWrap.classList.toggle("hidden", !nowExpanded);
      toggleBtn.textContent = nowExpanded ? "▾" : "▸";
    };

    group.append(header, lessonsWrap);
    lessonsContainer.appendChild(group);
  });
}

function renderLessonCard(id, data) {
  const li = document.createElement("div");
  li.className = "lesson-item";

  const isExpanded = expandedLessons.has(id);

  const header = document.createElement("div");
  header.className = "lesson-header";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "lesson-toggle";
  toggleBtn.setAttribute("aria-label", isExpanded ? t("collapseBtn") : t("expandBtn"));
  toggleBtn.textContent = isExpanded ? "▾" : "▸";

  const title = document.createElement("span");
  title.className = "lesson-title";
  title.textContent = data.title;

  const headerMain = document.createElement("div");
  headerMain.className = "lesson-header-main";
  headerMain.append(toggleBtn, title);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("deleteBtn");
  deleteBtn.className = "secondary small";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm(t("deleteLessonConfirm")(data.title))) deleteDoc(doc(db, "lessons", id));
  };

  header.append(headerMain, deleteBtn);

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

  const contentDiv = document.createElement("div");
  contentDiv.className = "lesson-content" + (isExpanded ? "" : " hidden");
  contentDiv.textContent = data.content || "";

  function toggle() {
    const nowExpanded = !expandedLessons.has(id);
    if (nowExpanded) expandedLessons.add(id);
    else expandedLessons.delete(id);
    contentDiv.classList.toggle("hidden", !nowExpanded);
    toggleBtn.textContent = nowExpanded ? "▾" : "▸";
    toggleBtn.setAttribute("aria-label", nowExpanded ? t("collapseBtn") : t("expandBtn"));
  }

  headerMain.onclick = toggle;

  li.append(header, datesRow, contentDiv);
  return li;
}
