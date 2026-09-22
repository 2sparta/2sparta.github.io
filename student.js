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
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  firebaseConfig,
  WEEKDAYS,
  WEEKDAY_BY_JS_INDEX,
  getActiveOverride,
  getDayEntriesList,
  getDayMaxPeriodIndex,
  getDayEffectiveTimes,
  normalizeGroupData,
  parseTimeToMinutes,
  formatDateLocal,
  escapeHtml,
  setSparkleGreeting,
  initThemeToggle,
  initBackgroundParticles,
  initSettingsPanel,
  isNumericGrade,
} from "./common.js";
import { initChat } from "./chat.js";

// Тема (світла/темна) застосовується одразу, до будь-якого рендеру,
// щоб уникнути "блимання" світлою темою при завантаженні.
initThemeToggle();
initBackgroundParticles();
let settingsPanelApi = null;
function ensureSettingsPanel() {
  if (!settingsPanelApi) {
    settingsPanelApi = initSettingsPanel((k) => (typeof t === "function" ? t(k) : k));
  } else if (settingsPanelApi.refreshI18n) {
    settingsPanelApi.refreshI18n((k) => (typeof t === "function" ? t(k) : k));
  }
}

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
const tabGradesBtn = document.getElementById("tab-grades-btn");
const tabSelfGovBtn = document.getElementById("tab-selfgov-btn");
const tabChatBtn = document.getElementById("tab-chat-btn");
const chatPanelEl = document.getElementById("chat-panel");
const schedulePanel = document.getElementById("schedule-panel");
const tasksPanel = document.getElementById("tasks-panel");
const gradesPanel = document.getElementById("grades-panel");
const selfgovPanel = document.getElementById("selfgov-panel");
const gradesTableContainer = document.getElementById("grades-table-container");
const noGradesMsg = document.getElementById("no-grades-msg");
const gradesStatOverall = document.getElementById("grades-stat-overall");
const gradesStatCount = document.getElementById("grades-stat-count");
const gradesStatAbsences = document.getElementById("grades-stat-absences");
const gradesStatBest = document.getElementById("grades-stat-best");
const gradesStatTrend = document.getElementById("grades-stat-trend");
const tabAnnouncementsBtn = document.getElementById("tab-announcements-btn");
const announcementsPanel = document.getElementById("announcements-panel");
const announcementsListEl = document.getElementById("announcements-list");
const noAnnouncementsMsg = document.getElementById("no-announcements-msg");
const gradesChartBars = document.getElementById("grades-chart-bars");
const gradesChartEmpty = document.getElementById("grades-chart-empty");
const gradesChartTrend = document.getElementById("grades-chart-trend");

const liveStatusCard = document.getElementById("live-status-card");
const liveStatusEl = document.getElementById("live-status");
const joinMeetingCard = document.getElementById("join-meeting-card");
const joinMeetingBtn = document.getElementById("join-meeting-btn");

const typeDayBtn = document.getElementById("type-day-btn");
const typeHomeworkBtn = document.getElementById("type-homework-btn");
const daySubviewSwitch = document.getElementById("day-subview-switch");
const dayViewBlock = document.getElementById("day-view-block");
const homeworkViewBlock = document.getElementById("homework-view-block");

const viewTodayBtn = document.getElementById("view-today-btn");
const viewTomorrowBtn = document.getElementById("view-tomorrow-btn");
const scheduleContainer = document.getElementById("schedule-container");
const weeklyScheduleContainer = document.getElementById("weekly-schedule-container");

const homeworkContainer = document.getElementById("homework-container");
const noHomeworkMsg = document.getElementById("no-homework-msg");
const hwSortSelect = document.getElementById("hw-sort-select");
const hwSubjectFilter = document.getElementById("hw-subject-filter");
const hwHideDoneCheckbox = document.getElementById("hw-hide-done-checkbox");

const starostaHwSection = document.getElementById("starosta-hw-section");
const starostaHwSubject = document.getElementById("starosta-hw-subject");
const starostaHwTitle = document.getElementById("starosta-hw-title");
const starostaHwContent = document.getElementById("starosta-hw-content");
const starostaHwDate = document.getElementById("starosta-hw-date");
const starostaHwAddBtn = document.getElementById("starosta-hw-add-btn");

const subjectsListEl = document.getElementById("subjects-list");
const noSubjectsMsg = document.getElementById("no-subjects-msg");

const newElectiveName = document.getElementById("new-elective-name");
const newElectiveDay = document.getElementById("new-elective-day");
const newElectiveStart = document.getElementById("new-elective-start");
const newElectiveEnd = document.getElementById("new-elective-end");
const addElectiveBtn = document.getElementById("add-elective-btn");
const electivesListEl = document.getElementById("electives-list");
const noElectivesMsg = document.getElementById("no-electives-msg");

// ---------- State ----------
// Так само як DOM-блок вище: винесено ДО i18n, бо updateGreeting() /
// renderScheduleContainer() / updateLiveStatus() читають ці змінні вже
// під час першого виклику applyStaticTranslations() нижче.
let studentId = null;
let studentData = null;
let studentClassId = null; // classId батьківського класу групи учня (для фільтра призначених уроків)
let lastSubjects = [];
let lastLessons = [];
let lastScheduleRaw = {};
let lastScheduleDefaults = { times: {}, dayTimes: {} };
let unsubscribeScheduleDefaults = null;
let lastElectives = [];
let lastGrades = [];
let gradesPeriodMode = "all";
let gradesPeriodFrom = "";
let gradesPeriodTo = "";

let unsubscribeElectives = null;
let unsubscribeGrades = null;
let currentView = "today"; // "today" | "tomorrow"
let currentTaskType = "day"; // "day" | "homework" — перемикач всередині вкладки "Завдання"
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
    pointsHistoryBtnTitle: "Історія балів",
    pointsHistoryTitle: "Історія балів",
    pointsHistoryEmpty: "Історії змін балів ще немає.",
    pointsHistoryHint: "Натисніть на бали, щоб переглянути історію.",
    tabSchedule: "Розклад",
    tabTasks: "Завдання",
    tabGrades: "Оцінки",
    tabPoints: "Бали",
    pointsLeaderboardHeading: "Топ за балами",
    pointsLeaderboardHint: "Рейтинг учнів за балами",
    pointsLeaderboardEmpty: "Ще немає учнів з балами.",
    pointsLeaderboardPoints: "балів",
    lbModeSchool: "Вся школа",
    lbModeClass: "Клас",
    groupSwitchLabel: "Клас:",
    settingsTitle: "Налаштування",
    settingsBack: "Назад",
    settingsTabAppearance: "Оформлення",
    settingsGlassLabel: "Матове скло на фоні",
    settingsGlassHint: "Частинки та ефект розмиття карток. Вимкніть для звичайного фону.",
    settingsAppearanceHint: "Тема та режим фону змінюються кнопками в шапці (поруч із мовою).",
    scheduleHeading: "Розклад",
    viewToday: "Сьогодні",
    viewTomorrow: "Завтра",
    viewTypeDay: "Розклад дня",
    viewTypeHomework: "ДЗ",
    weeklyScheduleHeading: "Тижневий розклад",
    weeklyScheduleHint: "Лише перегляд — розклад редагує вчитель.",
    scheduleEmptyMsg: "Розклад порожній.",
    weekdaysShort: { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Нд" },
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
    gradesHeading: "Оцінки",
    gradesHint: "Оцінки виставляє вчитель за уроки та домашні завдання.",
    noGradesMsg: "Оцінок ще немає.",
    gradesAverageLabel: "Середній бал",
    gradesTableSubjectHeader: "Предмет",
    gradeTypeLesson: "Урок",
    gradeTypeHomework: "ДЗ",
    gradesAnalyticsHeading: "Аналітика успішності",
    gradesAnalyticsHint: "Середні бали, динаміка та розподіл оцінок за предметами.",
    gradesOverallAvg: "Загальний середній",
    gradesCountLabel: "Усього оцінок",
    gradesAbsencesLabel: "Пропуски (Н)",
    gradesBestSubject: "Найкращий предмет",
    gradesTrendLabel: "Тренд",
    tabAnnouncements: "Оголошення",
    announcementsHeading: "Оголошення",
    announcementsStudentHint: "Оголошення від учителів для вашого класу або всієї школи.",
    noAnnouncementsMsg: "Оголошень ще немає.",
    announcementAllClasses: "Усі класи",
    announcementFrom: "Від",

    gradesChartBySubject: "Середній бал за предметами",
    gradesChartTrend: "Динаміка оцінок",
    gradesChartEmpty: "Недостатньо даних для графіка.",
    gradesTrendUp: "Покращення",
    gradesTrendDown: "Погіршення",
    gradesTrendStable: "Стабільно",
    gradesTrendNone: "Немає даних",
    gradesOfMax: "з 12",
    finalGradesHeading: "Підсумкові оцінки",
    finalPeriod_semester1: "1 семестр",
    finalPeriod_semester2: "2 семестр",
    finalPeriod_year: "Рік",
    gradesPeriodLabel: "Період",
    gradesPeriodAll: "Увесь час",
    gradesPeriodThisMonth: "Цей місяць",
    gradesPeriodLastMonth: "Минулий місяць",
    gradesPeriodSemester1: "1 семестр",
    gradesPeriodSemester2: "2 семестр",
    gradesPeriodCustom: "Довільний період",
    gradesPeriodFrom: "З",
    gradesPeriodTo: "По",
    electivesHeading: "Мої факультативи",
    electivesHint: "Видно тільки вам — вчитель і інші учні їх не бачать.",
    electiveNamePlaceholder: "Назва факультативу",
    noElectivesMsg: "Факультативів ще немає.",
    electiveNoDay: "Без дня в розкладі",
    electiveTimeInvalidMsg: "Час закінчення має бути пізніше часу початку.",
    addBtn: "Додати",
    deleteBtn: "Видалити",
    joinMeetingBtn: "Приєднатися до зустрічі",
    roomLabel: "Кабінет",
    roomShort: "каб.",
    liveLessonLabel: "Йде урок:",
    liveBreakLabel: "Перерва",
    liveNoSubject: "Урок",
    nextLessonLabel: "Далі",
    noActiveLesson: "Зараз немає активного уроку",
    minutesLeft: (m) => `залишилось ${m} хв`,
    noLessonForDay: "Урок на цю дату ще не додано.",
    noScheduleForDay: "На цей день розклад ще не задано.",
    homeworkDateShort: "ДЗ до:",
    homeworkNoDueDate: "ДЗ без дати здачі",
    lessonDateShort: "Урок:",
    deletedSubjectLabel: "Видалений предмет",
    noMeetingLink: "",
    homeworkDateLabel: "Дата дз (до)",
    subjectsExpandBtn: "Розгорнути",
    subjectsCollapseBtn: "Згорнути",
    tabSelfGov: "Самоврядування",
    tabChat: "Чат",
    selfGovHeading: "Самоврядування",
    selfGovStudentHint: "Тут ви можете подати кандидатуру на старосту або проголосувати під час виборів.",
    selfGovHistoryHeading: "Історія виборів / старост",
    selfGovNoHistory: "Історії ще немає.",
    selfGovPhaseCandidacy: "Подача кандидатур",
    selfGovPhaseVoting: "Голосування",
    selfGovPhaseClosed: "Завершені",
    selfGovNoActive: "Зараз немає активних виборів для вашого класу.",
    selfGovApplyBtn: "Подати кандидатуру",
    selfGovApplied: "Ви вже кандидат",
    selfGovVoteBtn: "Голосувати",
    selfGovVotedFor: "Ваш голос:",
    selfGovCannotVoteSelf: "Не можна голосувати за себе.",
    selfGovCandidates: "Кандидати",
    selfGovVotes: "голосів",
    selfGovNoCandidates: "Кандидатів ще немає.",
    selfGovUntilNow: "досі",
    selfGovFrom: "з",
    selfGovTo: "по",
    selfGovTotalVotes: "Усього голосів",
    selfGovApplyDone: "Кандидатуру подано.",
    selfGovVoteDone: "Голос зараховано.",
    selfGovNeedLink: "Спочатку прив'яжіть профіль за кодом-запрошення.",
    starostaHwHeading: "Додати ДЗ (староста)",
    starostaHwHint: "Запишіть домашнє завдання, яке вчитель оголосив усно або на дошці. Доступні лише предмети, для яких вчитель дозволив самостійний запис ДЗ.",
    starostaHwTitlePlaceholder: "Назва / короткий опис ДЗ",
    starostaHwContentPlaceholder: "Деталі завдання (необов'язково)",
    starostaHwNoSubjects: "Немає предметів, для яких дозволено самостійний запис ДЗ.",
    starostaHwNeedDate: "Вкажіть дату здачі ДЗ.",
    starostaHwNeedTitle: "Вкажіть назву або короткий опис завдання.",
    starostaHwNeedSubject: "Оберіть предмет.",
    starostaHwAdded: "Домашнє завдання додано.",
    addedByStarostaBadge: "Від старости",
    selectSubjectPlaceholder: "Оберіть предмет",
    messagesTitle: "Повідомлення",
    messagesEmpty: "Повідомлень ще немає.",
    messagesNotifOnlyHint: "Тут лише системні сповіщення (оцінки, ДЗ, оголошення). Писати людям — у чаті.",
    chatTitle: "Чат",
    chatNewDmBtn: "Написати",
    chatNewGroupBtn: "Нова група",
    chatListEmpty: "Чатів ще немає. Напишіть комусь або створіть групу.",
    chatComposePlaceholder: "Повідомлення...",
    chatSendBtn: "Надіслати",
    chatNoMessages: "Повідомлень ще немає. Напишіть першим!",
    chatAutoSchool: "Вся школа",
    chatAutoStudents: "Учні",
    chatAutoTeachers: "Учительський чат",
    chatTypeDm: "Особисті",
    chatTypeSchool: "Школа",
    chatTypeStudents: "Учні",
    chatTypeTeachers: "Учителі",
    chatTypeClass: "Клас",
    chatTypeGroup: "Група",
    chatDmFallback: "Особисте повідомлення",
    chatGroupFallback: "Група",
    chatNewDmTitle: "Нове повідомлення",
    chatNewGroupTitle: "Нова група",
    chatSearchPeople: "Пошук...",
    chatNoPeople: "Нікого не знайдено.",
    chatGroupNamePlaceholder: "Назва групи",
    chatGroupMembersHint: "Оберіть учасників:",
    chatCreateGroupBtn: "Створити групу",
    chatNeedGroupName: "Вкажіть назву групи.",
    chatNeedMembers: "Оберіть хоча б одного учасника.",
    chatFilterAllSubjects: "Усі предмети",
    chatNoSubject: "Без предмета",
    chatSubjectHintTeacher: "Оберіть предмет зверху — повідомлення отримає цей тег, і стрічка фільтруватиметься.",
    chatSubjectHintStudent: "Оберіть предмет зверху, щоб фільтрувати повідомлення.",
    chatSubjectActiveTeacher: "Пишете в предмет: {name}. Змініть зверху, щоб перейти до іншого.",
    chatSubjectActiveStudent: "Фільтр: {name}",
    chatSendError: "Не вдалося надіслати повідомлення.",
    chatPickOrStart: "Оберіть чат справа або створіть новий.",
    chatSearchInThread: "Пошук у чаті...",
    chatIsTyping: "пише…",
    chatMessageDeleted: "Повідомлення видалено",
    chatEdited: "змінено",
    chatSending: "Надсилання…",
    chatCopy: "Копіювати",
    chatDelete: "Видалити",
    chatDayToday: "Сьогодні",
    chatDayYesterday: "Вчора",
    chatLoadOlderHint: "Прокрутіть вгору для старіших повідомлень",
    chatEdit: "Редагувати",
    chatSaveEdit: "Зберегти",
    chatPin: "Закріпити",
    chatUnpin: "Відкріпити",
    chatDeleteConfirm: "Видалити це повідомлення?",
    notifGradeComment: "Коментар учителя",
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
    pointsHistoryBtnTitle: "Points history",
    pointsHistoryTitle: "Points history",
    pointsHistoryEmpty: "No points changes yet.",
    pointsHistoryHint: "Tap your points to view history.",
    tabSchedule: "Schedule",
    tabTasks: "Tasks",
    tabGrades: "Grades",
    tabPoints: "Points",
    pointsLeaderboardHeading: "Points leaderboard",
    pointsLeaderboardHint: "Student ranking by points",
    pointsLeaderboardEmpty: "No students with points yet.",
    pointsLeaderboardPoints: "points",
    lbModeSchool: "Whole school",
    lbModeClass: "Class",
    groupSwitchLabel: "Class:",
    settingsTitle: "Settings",
    settingsBack: "Back",
    settingsTabAppearance: "Appearance",
    settingsGlassLabel: "Frosted glass background",
    settingsGlassHint: "Particles and card blur. Turn off for a plain background.",
    settingsAppearanceHint: "Theme and background mode are controlled by the buttons in the header.",
    scheduleHeading: "Schedule",
    viewToday: "Today",
    viewTomorrow: "Tomorrow",
    viewTypeDay: "Day schedule",
    viewTypeHomework: "Homework",
    weeklyScheduleHeading: "Weekly schedule",
    weeklyScheduleHint: "View only — your teacher edits the schedule.",
    scheduleEmptyMsg: "The schedule is empty.",
    weekdaysShort: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
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
    gradesHeading: "Grades",
    gradesHint: "Your teacher enters grades for lessons and homework.",
    noGradesMsg: "No grades yet.",
    gradesAverageLabel: "Average",
    gradesTableSubjectHeader: "Subject",
    gradeTypeLesson: "Lesson",
    gradeTypeHomework: "HW",
    gradesAnalyticsHeading: "Performance analytics",
    gradesAnalyticsHint: "Averages, trends and grade distribution by subject.",
    gradesOverallAvg: "Overall average",
    gradesCountLabel: "Total grades",
    gradesAbsencesLabel: "Absences (Н)",
    gradesBestSubject: "Best subject",
    tabAnnouncements: "Announcements",
    announcementsHeading: "Announcements",
    announcementsStudentHint: "Announcements from teachers for your class or the whole school.",
    noAnnouncementsMsg: "No announcements yet.",
    announcementAllClasses: "All classes",
    announcementFrom: "From",

    gradesTrendLabel: "Trend",
    gradesChartBySubject: "Average by subject",
    gradesChartTrend: "Grade trend",
    gradesChartEmpty: "Not enough data for a chart.",
    gradesTrendUp: "Improving",
    gradesTrendDown: "Declining",
    gradesTrendStable: "Stable",
    gradesTrendNone: "No data",
    gradesOfMax: "of 12",
    finalGradesHeading: "Final grades",
    finalPeriod_semester1: "1st semester",
    finalPeriod_semester2: "2nd semester",
    finalPeriod_year: "Year",
    gradesPeriodLabel: "Period",
    gradesPeriodAll: "All time",
    gradesPeriodThisMonth: "This month",
    gradesPeriodLastMonth: "Last month",
    gradesPeriodSemester1: "1st semester",
    gradesPeriodSemester2: "2nd semester",
    gradesPeriodCustom: "Custom range",
    gradesPeriodFrom: "From",
    gradesPeriodTo: "To",
    electivesHeading: "My electives",
    electivesHint: "Only visible to you — your teacher and other students can't see these.",
    electiveNamePlaceholder: "Elective name",
    noElectivesMsg: "No electives yet.",
    electiveNoDay: "Not in schedule",
    electiveTimeInvalidMsg: "End time must be after start time.",
    addBtn: "Add",
    deleteBtn: "Delete",
    joinMeetingBtn: "Join the meeting",
    roomLabel: "Room",
    roomShort: "rm.",
    liveLessonLabel: "Lesson in progress:",
    liveBreakLabel: "Break",
    liveNoSubject: "Lesson",
    nextLessonLabel: "Next",
    noActiveLesson: "No active lesson right now",
    minutesLeft: (m) => `${m} min left`,
    noLessonForDay: "No lesson added for this date yet.",
    noScheduleForDay: "No schedule set for this day yet.",
    homeworkDateShort: "HW due:",
    homeworkNoDueDate: "HW with no due date",
    lessonDateShort: "Lesson:",
    deletedSubjectLabel: "Deleted subject",
    noMeetingLink: "",
    homeworkDateLabel: "Homework due date",
    subjectsExpandBtn: "Expand",
    subjectsCollapseBtn: "Collapse",
    tabSelfGov: "Self-government",
    selfGovHeading: "Self-government",
    selfGovStudentHint: "Here you can apply as a class monitor candidate or vote during elections.",
    selfGovHistoryHeading: "Election / monitor history",
    selfGovNoHistory: "No history yet.",
    selfGovPhaseCandidacy: "Candidacy",
    selfGovPhaseVoting: "Voting",
    selfGovPhaseClosed: "Closed",
    selfGovNoActive: "There are no active elections for your class right now.",
    selfGovApplyBtn: "Apply as candidate",
    selfGovApplied: "You are already a candidate",
    selfGovVoteBtn: "Vote",
    selfGovVotedFor: "Your vote:",
    selfGovCannotVoteSelf: "You cannot vote for yourself.",
    selfGovCandidates: "Candidates",
    selfGovVotes: "votes",
    selfGovNoCandidates: "No candidates yet.",
    selfGovUntilNow: "present",
    selfGovFrom: "from",
    selfGovTo: "to",
    selfGovTotalVotes: "Total votes",
    selfGovApplyDone: "Candidacy submitted.",
    selfGovVoteDone: "Vote recorded.",
    selfGovNeedLink: "Link your profile with an invite code first.",
    starostaHwHeading: "Add homework (class monitor)",
    starostaHwHint: "Record homework the teacher announced orally or wrote on the board. Only subjects where the teacher allowed student-written homework are available.",
    starostaHwTitlePlaceholder: "Title / short description",
    starostaHwContentPlaceholder: "Assignment details (optional)",
    starostaHwNoSubjects: "No subjects allow student-written homework yet.",
    starostaHwNeedDate: "Please set a homework due date.",
    starostaHwNeedTitle: "Please enter a title or short description.",
    starostaHwNeedSubject: "Please choose a subject.",
    starostaHwAdded: "Homework added.",
    addedByStarostaBadge: "By class monitor",
    selectSubjectPlaceholder: "Choose a subject",
    messagesTitle: "Messages",
    messagesEmpty: "No messages yet.",
    messagesNotifOnlyHint: "System notifications only (grades, homework, announcements). To write to people, use Chat.",
    chatTitle: "Chat",
    chatNewDmBtn: "Write",
    chatNewGroupBtn: "New group",
    chatListEmpty: "No chats yet. Message someone or create a group.",
    chatComposePlaceholder: "Message...",
    chatSendBtn: "Send",
    chatNoMessages: "No messages yet. Say hello!",
    chatAutoSchool: "Whole school",
    chatAutoStudents: "Students",
    chatAutoTeachers: "Teachers chat",
    chatTypeDm: "Direct",
    chatTypeSchool: "School",
    chatTypeStudents: "Students",
    chatTypeTeachers: "Teachers",
    chatTypeClass: "Class",
    chatTypeGroup: "Group",
    chatDmFallback: "Direct message",
    chatGroupFallback: "Group",
    chatNewDmTitle: "New message",
    chatNewGroupTitle: "New group",
    chatSearchPeople: "Search...",
    chatNoPeople: "No one found.",
    chatGroupNamePlaceholder: "Group name",
    chatGroupMembersHint: "Select members:",
    chatCreateGroupBtn: "Create group",
    chatNeedGroupName: "Enter a group name.",
    chatNeedMembers: "Select at least one member.",
    chatFilterAllSubjects: "All subjects",
    chatNoSubject: "No subject",
    chatSubjectHintTeacher: "Optional: tag a subject so the thread can be filtered.",
    chatSubjectHintStudent: "Filter by subject above if the chat is busy.",
    chatSendError: "Failed to send message.",
    chatSearchInThread: "Search in chat...",
    chatIsTyping: "is typing…",
    chatMessageDeleted: "Message deleted",
    chatEdited: "edited",
    chatSending: "Sending…",
    chatCopy: "Copy",
    chatDelete: "Delete",
    chatDayToday: "Today",
    chatDayYesterday: "Yesterday",
    chatLoadOlderHint: "Scroll up for older messages",
    chatEdit: "Edit",
    chatSaveEdit: "Save",
    chatPin: "Pin",
    chatUnpin: "Unpin",
    chatDeleteConfirm: "Delete this message?",
    notifGradeComment: "Teacher comment",
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
  renderWeeklyScheduleTable();
  renderHomeworkContainer();
  renderSubjectsList();
  populateElectiveDaySelect(newElectiveDay);
  renderElectivesList();
  updateStarostaHwSection();
  updateLiveStatus();
  renderGradesTable();
}

// Заповнює <select> вибору дня тижня для факультативу перекладеними
// назвами днів, намагаючись зберегти поточний вибір (або viz. selectedValue,
// якщо переданий явно — використовується під час рендеру рядка факультативу
// зі збереженим значенням дня).
function populateElectiveDaySelect(selectEl, selectedValue) {
  if (!selectEl) return;
  const prev = selectedValue !== undefined ? selectedValue : selectEl.value;
  selectEl.innerHTML = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = t("electiveNoDay");
  selectEl.appendChild(noneOpt);
  WEEKDAYS.forEach((dayKey) => {
    const opt = document.createElement("option");
    opt.value = dayKey;
    opt.textContent = t("weekdaysShort")[dayKey];
    selectEl.appendChild(opt);
  });
  selectEl.value = prev || "";
}

function setLanguage(lang) {
  if (!translations[lang] || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  applyStaticTranslations();
  ensureSettingsPanel();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});
applyStaticTranslations();
ensureSettingsPanel();

// ---------- Tabs ----------
function showTab(tab) {
  if (tabScheduleBtn) tabScheduleBtn.classList.toggle("active", tab === "schedule");
  if (tabTasksBtn) tabTasksBtn.classList.toggle("active", tab === "tasks");
  if (tabGradesBtn) tabGradesBtn.classList.toggle("active", tab === "grades");
  if (tabAnnouncementsBtn) tabAnnouncementsBtn.classList.toggle("active", tab === "announcements");
  if (tabSelfGovBtn) tabSelfGovBtn.classList.toggle("active", tab === "selfgov");
  if (tabChatBtn) tabChatBtn.classList.toggle("active", tab === "chat");
  if (schedulePanel) schedulePanel.classList.toggle("hidden", tab !== "schedule");
  if (tasksPanel) tasksPanel.classList.toggle("hidden", tab !== "tasks");
  if (gradesPanel) gradesPanel.classList.toggle("hidden", tab !== "grades");
  if (announcementsPanel) announcementsPanel.classList.toggle("hidden", tab !== "announcements");
  if (selfgovPanel) selfgovPanel.classList.toggle("hidden", tab !== "selfgov");
  if (chatPanelEl) chatPanelEl.classList.toggle("hidden", tab !== "chat");
  document.body.classList.toggle("chat-tab-open", tab === "chat");
  const greeting = document.querySelector(".greeting-card");
  if (greeting) greeting.classList.toggle("hidden", tab === "chat");
  if (tab === "selfgov") renderSelfGovStudent();
  if (tab === "announcements") renderStudentAnnouncements();
  if (tab === "chat") {
    const api = typeof ensureStudentChatApi === "function" ? ensureStudentChatApi() : chatApi;
    if (api && api.onTabActivated) api.onTabActivated();
    else if (api && api.start) api.start();
  } else {
    const api = chatApi;
    if (api && api.onTabDeactivated) api.onTabDeactivated();
  }
}
if (tabScheduleBtn) tabScheduleBtn.onclick = () => showTab("schedule");
if (tabTasksBtn) tabTasksBtn.onclick = () => showTab("tasks");
if (tabGradesBtn) tabGradesBtn.onclick = () => showTab("grades");
if (tabAnnouncementsBtn) tabAnnouncementsBtn.onclick = () => showTab("announcements");
if (tabSelfGovBtn) tabSelfGovBtn.onclick = () => showTab("selfgov");
if (tabChatBtn) tabChatBtn.onclick = () => showTab("chat");

// Перемикач всередині вкладки "Завдання": розклад дня (сьогодні/завтра) чи ДЗ.
function showTaskType(type) {
  currentTaskType = type;
  if (typeDayBtn) typeDayBtn.classList.toggle("active", type === "day");
  if (typeHomeworkBtn) typeHomeworkBtn.classList.toggle("active", type === "homework");
  if (daySubviewSwitch) daySubviewSwitch.classList.toggle("hidden", type !== "day");
  if (dayViewBlock) dayViewBlock.classList.toggle("hidden", type !== "day");
  if (homeworkViewBlock) homeworkViewBlock.classList.toggle("hidden", type !== "homework");
}
if (typeDayBtn) typeDayBtn.onclick = () => showTaskType("day");
if (typeHomeworkBtn) typeHomeworkBtn.onclick = () => showTaskType("homework");
showTaskType(currentTaskType);

function errorText(e) {
  return translations[currentLang].errors[e.code] || e.message;
}

function myGroup() {
  return studentData && studentData.group ? studentData.group : "group1";
}

async function resolveStudentClassId() {
  const groupId = myGroup();
  if (!groupId) {
    studentClassId = null;
    return;
  }
  try {
    const snap = await getDoc(doc(db, "groups", groupId));
    if (snap.exists()) {
      studentClassId = snap.data().classId || null;
    } else {
      studentClassId = null;
    }
  } catch (e) {
    studentClassId = null;
  }
}

// Урок видно учню, якщо:
// 1) не обмежений класами або призначений його класу;
// 2) не запланований на майбутнє (publishAt ще не настав).
function lessonVisibleToStudent(lessonData) {
  if (lessonData.publishAt && lessonData.publishAt > Date.now()) return false;
  const ids = lessonData.assignedClassIds;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return true;
  if (!studentClassId) return true; // ще не знаємо клас — показуємо (щоб не ховати все)
  return ids.includes(studentClassId);
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
  if (unsubscribeElectives) unsubscribeElectives();
  if (unsubscribeGrades) unsubscribeGrades();
  if (unsubscribeElections) { unsubscribeElections(); unsubscribeElections = null; }
  if (unsubscribeStarostaHistory) { unsubscribeStarostaHistory(); unsubscribeStarostaHistory = null; }
  if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
  if (unsubscribeAnnouncements) { unsubscribeAnnouncements(); unsubscribeAnnouncements = null; }
  if (unsubscribeScheduleDefaults) { unsubscribeScheduleDefaults(); unsubscribeScheduleDefaults = null; }
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    liveStatusInterval = null;
  }
  showMessagesFab(false);
  if (chatApi) { try { chatApi.stop(); } catch (e) {} chatApi = null; }
  if (unsubscribePeerTeachers) { unsubscribePeerTeachers(); unsubscribePeerTeachers = null; }
  if (unsubscribePeerStudents) { unsubscribePeerStudents(); unsubscribePeerStudents = null; }
  closeMessagesPanel();
  studentId = null;
  studentData = null;
  studentClassId = null;
  lastElectives = [];
  lastGrades = [];
  lastNotifications = [];
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
// ---------- Чат (учень) ----------
let chatApi = null;
let lastPeerTeachers = [];
let lastPeerStudents = [];
let unsubscribePeerTeachers = null;
let unsubscribePeerStudents = null;

function ensureStudentChatApi() {
  if (chatApi) return chatApi;
  chatApi = initChat({
    db,
    getUser: () => auth.currentUser,
    getProfile: () => {
      let schoolId = (studentData && studentData.schoolId) || null;
      if (!schoolId && lastPeerTeachers.length) {
        const withSchool = lastPeerTeachers.find((u) => u.data && u.data.schoolId);
        if (withSchool) schoolId = withSchool.data.schoolId;
      }
      return {
        role: "student",
        displayName: (studentData && studentData.name) || (auth.currentUser && auth.currentUser.email) || "Student",
        schoolId: schoolId || "default",
        classId: studentClassId || null,
        subjectIds: [],
      };
    },
    t: (k) => (typeof t === "function" ? t(k) : k),
    currentLang: () => (typeof currentLang !== "undefined" ? currentLang : "uk"),
    getStudents: () => lastPeerStudents,
    getTeachers: () => lastPeerTeachers,
    getSubjects: () => lastSubjects || [],
    getClasses: () => {
      if (!studentClassId) return [];
      return [{ id: studentClassId, data: { name: studentClassId } }];
    },
    getGroups: () => {
      if (!studentData || !studentData.group) return [];
      return [{ id: studentData.group, data: { classId: studentClassId } }];
    },
    isTeacherSide: false,
  });
  return chatApi;
}

function subscribeChatPeers() {
  if (unsubscribePeerTeachers) unsubscribePeerTeachers();
  if (unsubscribePeerStudents) unsubscribePeerStudents();
  unsubscribePeerTeachers = onSnapshot(collection(db, "users"), (snap) => {
    lastPeerTeachers = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter((u) => {
        const r = u.data.role;
        return r === "teacher" || r === "admin" || r === "pending-teacher";
      });
    if (chatApi && chatApi.syncAutoGroupMembers) {
      chatApi.syncAutoGroupMembers().catch(() => {});
    }
  }, (err) => console.warn("peer teachers", err));
  unsubscribePeerStudents = onSnapshot(collection(db, "students"), (snap) => {
    lastPeerStudents = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter((s) => s.data && s.data.authUid);
  }, (err) => console.warn("peer students", err));
}

function startDashboard(user) {
  loadHwPrefs();
  hwDoneIds = loadHwDoneSet();
  showAppScreen();
  try {
    subscribeChatPeers();
    ensureStudentChatApi().start();
  } catch (e) {
    console.warn("chat start", e);
  }
  if (avatarEl) {
    avatarEl.textContent = (studentData.name || user.email || "?").trim().charAt(0).toUpperCase();
    avatarEl.title = user.email || "";
  }
  updateGreeting();
  resolveStudentClassId().then(() => {
    renderScheduleContainer();
    renderHomeworkContainer();
    updateStarostaHwSection();
  });

  unsubscribeStudentDoc = onSnapshot(doc(db, "students", studentId), (snap) => {
    if (!snap.exists()) return;
    const prevGroup = studentData && studentData.group;
    studentData = snap.data();
    updateGreeting();
    updateLiveStatus();
    updateStarostaHwSection();
    if (studentData.group !== prevGroup) {
      resolveStudentClassId().then(() => {
        renderScheduleContainer();
        renderHomeworkContainer();
      });
    } else {
      renderScheduleContainer();
      renderWeeklyScheduleTable();
    }
  });

  unsubscribeSubjects = onSnapshot(
    query(collection(db, "subjects"), orderBy("name")),
    (snap) => {
      lastSubjects = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderSubjectsList();
      renderScheduleContainer();
      renderWeeklyScheduleTable();
      renderHomeworkContainer();
      updateStarostaHwSection();
      updateLiveStatus();
      renderGradesTable();
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
    renderWeeklyScheduleTable();
    updateLiveStatus();
  });

  unsubscribeElectives = onSnapshot(
    query(collection(db, "electives"), where("uid", "==", user.uid)),
    (snap) => {
      lastElectives = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderElectivesList();
      renderScheduleContainer();
      renderWeeklyScheduleTable();
    }
  );

  unsubscribeGrades = onSnapshot(
    query(collection(db, "grades"), where("studentId", "==", studentId)),
    (snap) => {
      lastGrades = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      renderGradesTable();
    }
  );

  subscribeStudentElections();
  subscribeStudentNotifications();
  subscribeStudentAnnouncements();
  subscribeScheduleDefaultsStudent();
  showMessagesFab(true);
}

function subscribeScheduleDefaultsStudent() {
  if (unsubscribeScheduleDefaults) unsubscribeScheduleDefaults();
  unsubscribeScheduleDefaults = onSnapshot(doc(db, "schedule", "defaults"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    lastScheduleDefaults = {
      times: data.times && typeof data.times === "object" ? data.times : {},
      dayTimes: data.dayTimes && typeof data.dayTimes === "object" ? data.dayTimes : {},
    };
    try {
      updateLiveStatus();
      renderScheduleContainer();
      renderWeeklyScheduleTable();
    } catch (_) {}
  });
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
    setSparkleGreeting(greetingTitleEl, t("greeting")(studentData ? studentData.name : ""));
  }
  if (greetingSubtitleEl) greetingSubtitleEl.textContent = "";
  if (pointsHeroValueEl) pointsHeroValueEl.textContent = String(studentData ? studentData.points ?? 0 : 0);
  const hero = document.querySelector(".points-hero");
  if (hero) {
    hero.title = t("pointsHistoryHint") || t("pointsHistoryBtnTitle") || "";
    hero.setAttribute("aria-label", t("pointsHistoryBtnTitle") || "");
  }
}

// ---------- Subjects (read-only) ----------
function getSubjectName(subjectId) {
  const found = lastSubjects.find((s) => s.id === subjectId);
  return found ? found.data.name : t("deletedSubjectLabel");
}

function getSubjectRoom(subjectId) {
  const found = lastSubjects.find((s) => s.id === subjectId);
  if (!found || !found.data) return "";
  const room = found.data.room;
  return room != null && String(room).trim() ? String(room).trim() : "";
}

function formatSubjectLiveLabel(subjectId, subjectName) {
  const room = getSubjectRoom(subjectId);
  if (!room) return escapeHtml(subjectName);
  return `${escapeHtml(subjectName)} <span class="live-status-room">(${escapeHtml(t("roomShort"))} ${escapeHtml(room)})</span>`;
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

    if (data.room && String(data.room).trim()) {
      const roomBadge = document.createElement("span");
      roomBadge.className = "subject-item-room-badge";
      roomBadge.textContent = `${t("roomShort")} ${String(data.room).trim()}`;
      topRow.appendChild(roomBadge);
    }

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

// ---------- Grades analytics + table ----------
const GRADE_SCALE_MAX = 12;

function isAbsenceGrade(value) {
  if (value == null) return false;
  const s = String(value).trim().toUpperCase();
  return s === "Н" || s === "H" || s === "N";
}


function getGradesPeriodRange(period, fromCustom, toCustom) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (yy, mm, dd) => `${yy}-${pad(mm)}-${pad(dd)}`;
  if (period === "all" || !period) return [null, null];
  if (period === "thisMonth") {
    const last = new Date(y, m + 1, 0).getDate();
    return [iso(y, m + 1, 1), iso(y, m + 1, last)];
  }
  if (period === "lastMonth") {
    const d = new Date(y, m - 1, 1);
    const yy = d.getFullYear();
    const mm = d.getMonth();
    const last = new Date(yy, mm + 1, 0).getDate();
    return [iso(yy, mm + 1, 1), iso(yy, mm + 1, last)];
  }
  if (period === "semester1") {
    const startYear = m >= 8 ? y : y - 1;
    return [iso(startYear, 9, 1), iso(startYear, 12, 31)];
  }
  if (period === "semester2") {
    const startYear = m >= 8 ? y + 1 : y;
    return [iso(startYear, 1, 1), iso(startYear, 5, 31)];
  }
  if (period === "custom") {
    return [fromCustom || null, toCustom || null];
  }
  return [null, null];
}

function filterGradesByPeriod(gradesList, period, fromCustom, toCustom) {
  const [from, to] = getGradesPeriodRange(period, fromCustom, toCustom);
  if (!from && !to) return gradesList;
  return gradesList.filter((g) => {
    const d = g.data && g.data.date;
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function getFilteredStudentGrades() {
  const current = lastGrades.filter((g) => g.data.type !== "final");
  return filterGradesByPeriod(current, gradesPeriodMode, gradesPeriodFrom, gradesPeriodTo);
}

function getStudentFinalGrades() {
  return lastGrades.filter((g) => g.data.type === "final");
}

function syncGradesCustomRangeVisibility() {
  const el = document.getElementById("grades-custom-range");
  if (!el) return;
  el.classList.toggle("hidden", gradesPeriodMode !== "custom");
}

function initGradesPeriodControls() {
  const sel = document.getElementById("grades-period-select");
  const fromIn = document.getElementById("grades-from");
  const toIn = document.getElementById("grades-to");
  if (sel && !sel.dataset.bound) {
    sel.dataset.bound = "1";
    sel.value = gradesPeriodMode;
    sel.onchange = () => {
      gradesPeriodMode = sel.value || "all";
      syncGradesCustomRangeVisibility();
      renderGradesTable();
    };
  }
  if (fromIn && !fromIn.dataset.bound) {
    fromIn.dataset.bound = "1";
    fromIn.onchange = () => {
      gradesPeriodFrom = fromIn.value || "";
      if (gradesPeriodMode === "custom") renderGradesTable();
    };
  }
  if (toIn && !toIn.dataset.bound) {
    toIn.dataset.bound = "1";
    toIn.onchange = () => {
      gradesPeriodTo = toIn.value || "";
      if (gradesPeriodMode === "custom") renderGradesTable();
    };
  }
  syncGradesCustomRangeVisibility();
}

function computeGradesAnalytics() {
  const source = getFilteredStudentGrades();
  const values = source
    .map((g) => Number(g.data.value))
    .filter((v) => !isNaN(v) && v >= 1 && v <= 12);
  const overall =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const absences = source.filter((g) => isAbsenceGrade(g.data.value)).length;

  const bySubject = {};
  source.forEach((g) => {
    const sid = g.data.subjectId;
    const v = Number(g.data.value);
    if (!sid || isNaN(v) || v < 1 || v > 12) return;
    if (!bySubject[sid]) bySubject[sid] = [];
    bySubject[sid].push(v);
  });
  const subjectAvgs = Object.keys(bySubject).map((sid) => {
    const arr = bySubject[sid];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { id: sid, name: getSubjectName(sid), avg, count: arr.length };
  });
  subjectAvgs.sort((a, b) => b.avg - a.avg);

  // Chronological series for trend (by date, then updatedAt)
  const chronological = source
    .map((g) => ({
      date: g.data.date || "",
      value: Number(g.data.value),
      at: g.data.updatedAt || 0,
    }))
    .filter((x) => x.date && !isNaN(x.value) && x.value >= 1 && x.value <= 12)
    .sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);

  let trend = "none";
  if (chronological.length >= 4) {
    const half = Math.floor(chronological.length / 2);
    const first = chronological.slice(0, half);
    const second = chronological.slice(half);
    const avg1 = first.reduce((s, x) => s + x.value, 0) / first.length;
    const avg2 = second.reduce((s, x) => s + x.value, 0) / second.length;
    const diff = avg2 - avg1;
    if (diff >= 0.4) trend = "up";
    else if (diff <= -0.4) trend = "down";
    else trend = "stable";
  } else if (chronological.length >= 2) {
    const first = chronological[0].value;
    const last = chronological[chronological.length - 1].value;
    const diff = last - first;
    if (diff >= 0.5) trend = "up";
    else if (diff <= -0.5) trend = "down";
    else trend = "stable";
  }

  return { overall, count: values.length, absences, subjectAvgs, chronological, trend };
}

function renderGradesAnalytics() {
  const stats = computeGradesAnalytics();

  if (gradesStatOverall) {
    gradesStatOverall.textContent =
      stats.overall != null
        ? `${stats.overall.toFixed(1)} ${t("gradesOfMax") || "з 12"}`
        : "—";
  }
  if (gradesStatCount) gradesStatCount.textContent = String(stats.count);
  if (gradesStatAbsences) gradesStatAbsences.textContent = String(stats.absences || 0);
  if (gradesStatBest) {
    if (stats.subjectAvgs.length > 0) {
      const best = stats.subjectAvgs[0];
      gradesStatBest.textContent = `${best.name} (${best.avg.toFixed(1)})`;
      gradesStatBest.title = best.name;
    } else {
      gradesStatBest.textContent = "—";
      gradesStatBest.title = "";
    }
  }
  if (gradesStatTrend) {
    const map = {
      up: t("gradesTrendUp"),
      down: t("gradesTrendDown"),
      stable: t("gradesTrendStable"),
      none: t("gradesTrendNone"),
    };
    gradesStatTrend.textContent = map[stats.trend] || map.none;
    gradesStatTrend.className =
      "grades-stat-value grades-stat-value--sm" +
      (stats.trend === "up"
        ? " grades-trend-up"
        : stats.trend === "down"
          ? " grades-trend-down"
          : "");
  }

  // Bar chart by subject
  if (gradesChartBars) {
    gradesChartBars.innerHTML = "";
    if (stats.subjectAvgs.length === 0) {
      if (gradesChartEmpty) gradesChartEmpty.classList.remove("hidden");
    } else {
      if (gradesChartEmpty) gradesChartEmpty.classList.add("hidden");
      const maxBar = GRADE_SCALE_MAX;
      stats.subjectAvgs.forEach((s) => {
        const row = document.createElement("div");
        row.className = "grades-bar-row";

        const label = document.createElement("div");
        label.className = "grades-bar-label";
        label.textContent = s.name;
        label.title = s.name;

        const track = document.createElement("div");
        track.className = "grades-bar-track";
        const fill = document.createElement("div");
        fill.className = "grades-bar-fill";
        const pct = Math.min(100, (s.avg / maxBar) * 100);
        fill.style.width = `${pct}%`;
        // Color intensity by score
        if (s.avg >= 10) fill.classList.add("grades-bar-high");
        else if (s.avg >= 7) fill.classList.add("grades-bar-mid");
        else fill.classList.add("grades-bar-low");
        track.appendChild(fill);

        const val = document.createElement("div");
        val.className = "grades-bar-value";
        val.textContent = s.avg.toFixed(1);

        row.append(label, track, val);
        gradesChartBars.appendChild(row);
      });
    }
  }

  // Trend line chart (SVG)
  if (gradesChartTrend) {
    gradesChartTrend.innerHTML = "";
    const series = stats.chronological;
    if (series.length < 2) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = t("gradesChartEmpty");
      gradesChartTrend.appendChild(p);
    } else {
      const w = 320;
      const h = 120;
      const padL = 28;
      const padR = 12;
      const padT = 12;
      const padB = 28;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const n = series.length;
      const xs = series.map((_, i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW));
      const ys = series.map((s) => {
        const norm = Math.max(0, Math.min(1, (s.value - 1) / (GRADE_SCALE_MAX - 1)));
        return padT + plotH * (1 - norm);
      });

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("class", "grades-trend-svg");
      svg.setAttribute("aria-hidden", "true");

      // Grid lines at 4, 8, 12
      [4, 8, 12].forEach((g) => {
        const tNorm = (g - 1) / (GRADE_SCALE_MAX - 1);
        const y = padT + plotH * (1 - tNorm);
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", String(padL));
        line.setAttribute("x2", String(w - padR));
        line.setAttribute("y1", String(y));
        line.setAttribute("y2", String(y));
        line.setAttribute("class", "grades-trend-grid");
        svg.appendChild(line);
        const txt = document.createElementNS(svgNS, "text");
        txt.setAttribute("x", String(padL - 4));
        txt.setAttribute("y", String(y + 3));
        txt.setAttribute("text-anchor", "end");
        txt.setAttribute("class", "grades-trend-axis");
        txt.textContent = String(g);
        svg.appendChild(txt);
      });

      // Polyline
      const points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
      const poly = document.createElementNS(svgNS, "polyline");
      poly.setAttribute("points", points);
      poly.setAttribute("class", "grades-trend-line");
      svg.appendChild(poly);

      // Dots
      xs.forEach((x, i) => {
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("cx", String(x));
        c.setAttribute("cy", String(ys[i]));
        c.setAttribute("r", "3.5");
        c.setAttribute("class", "grades-trend-dot");
        const title = document.createElementNS(svgNS, "title");
        title.textContent = `${series[i].date}: ${series[i].value}`;
        c.appendChild(title);
        svg.appendChild(c);
      });

      // First / last date labels
      if (series[0]) {
        const t0 = document.createElementNS(svgNS, "text");
        t0.setAttribute("x", String(xs[0]));
        t0.setAttribute("y", String(h - 8));
        t0.setAttribute("text-anchor", n > 1 ? "start" : "middle");
        t0.setAttribute("class", "grades-trend-axis");
        t0.textContent = series[0].date.slice(5); // MM-DD
        svg.appendChild(t0);
      }
      if (n > 1) {
        const t1 = document.createElementNS(svgNS, "text");
        t1.setAttribute("x", String(xs[n - 1]));
        t1.setAttribute("y", String(h - 8));
        t1.setAttribute("text-anchor", "end");
        t1.setAttribute("class", "grades-trend-axis");
        t1.textContent = series[n - 1].date.slice(5);
        svg.appendChild(t1);
      }

      gradesChartTrend.appendChild(svg);
    }
  }
}

function renderGradesTable() {
  if (!gradesTableContainer) return;
  initGradesPeriodControls();
  gradesTableContainer.innerHTML = "";
  const filteredGrades = getFilteredStudentGrades();
  renderGradesAnalytics();

  if (filteredGrades.length === 0) {
    const finalsOnly = getStudentFinalGrades();
    if (finalsOnly.length > 0) {
      if (noGradesMsg) noGradesMsg.classList.add("hidden");
      renderStudentFinalGrades();
      return;
    }
    if (noGradesMsg) noGradesMsg.classList.remove("hidden");
    return;
  }
  if (noGradesMsg) noGradesMsg.classList.add("hidden");

  // Стовпці — унікальні дати оцінок, за зростанням.
  const dateSet = new Set(filteredGrades.map((g) => g.data.date).filter(Boolean));
  const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

  // Рядки — предмети, що мають хоча б одну оцінку; спочатку в порядку
  // зі списку предметів, потім видалені (яких вже немає в lastSubjects).
  const subjectIdsWithGrades = new Set(filteredGrades.map((g) => g.data.subjectId).filter(Boolean));
  const subjectOrder = lastSubjects.map((s) => s.id).filter((id) => subjectIdsWithGrades.has(id));
  [...subjectIdsWithGrades]
    .filter((id) => !subjectOrder.includes(id))
    .forEach((id) => subjectOrder.push(id));

  if (dates.length === 0 || subjectOrder.length === 0) {
    if (noGradesMsg) noGradesMsg.classList.remove("hidden");
    return;
  }

  // gradesForCell(subjectId, date) → усі оцінки з цим предметом+датою
  // (може бути окремо за урок і за ДЗ).
  function gradesForCell(subjectId, date) {
    return filteredGrades
      .filter((g) => g.data.subjectId === subjectId && g.data.date === date)
      .sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
  }

  function gradeValueClass(value) {
    if (value === "Н" || value === "н" || String(value).toUpperCase() === "Н") return "grade-val-absent";
    const v = Number(value);
    if (isNaN(v) || v <= 0) return "";
    if (v >= 10) return "grade-val-high";
    if (v >= 7) return "grade-val-mid";
    return "grade-val-low";
  }
  function formatGradeDateShort(isoDate) {
    if (!isoDate || isoDate.length < 10) return isoDate || "";
    return `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
  }

  const legend = document.createElement("div");
  legend.className = "grades-table-legend";
  legend.innerHTML = `
    <span class="grades-legend-item"><span class="chip grade-cell-chip grade-chip-lesson grade-val-mid">10</span> ${t("gradeTypeLesson")}</span>
    <span class="grades-legend-item"><span class="chip grade-cell-chip grade-chip-hw grade-val-mid">10</span> ${t("gradeTypeHomework")}</span>
  `;

  const wrap = document.createElement("div");
  wrap.className = "schedule-table-wrap grades-table-wrap";

  const table = document.createElement("table");
  table.className = "schedule-table grades-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const cornerTh = document.createElement("th");
  cornerTh.className = "schedule-table-corner grades-table-sticky-col";
  cornerTh.textContent = t("gradesTableSubjectHeader");
  headRow.appendChild(cornerTh);
  dates.forEach((date) => {
    const th = document.createElement("th");
    th.className = "grades-table-date-th";
    th.textContent = formatGradeDateShort(date);
    th.title = date;
    headRow.appendChild(th);
  });
  const avgTh = document.createElement("th");
  avgTh.className = "grades-table-avg-th";
  avgTh.textContent = t("gradesAverageLabel");
  headRow.appendChild(avgTh);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  subjectOrder.forEach((subjectId) => {
    const tr = document.createElement("tr");

    const rowTh = document.createElement("th");
    rowTh.className = "grades-table-subject grades-table-sticky-col";
    rowTh.textContent = getSubjectName(subjectId);
    rowTh.title = getSubjectName(subjectId);
    tr.appendChild(rowTh);

    const values = [];
    dates.forEach((date) => {
      const td = document.createElement("td");
      td.className = "schedule-table-cell grades-table-cell";
      const matches = gradesForCell(subjectId, date);
      if (matches.length === 0) {
        td.classList.add("schedule-table-empty");
        td.textContent = "–";
      } else {
        const cellInner = document.createElement("div");
        cellInner.className = "grades-cell-stack";
        matches.forEach((g) => {
          if (isNumericGrade(g.data.value)) values.push(Number(g.data.value));
          const chip = document.createElement("span");
          chip.className = "chip grade-cell-chip " + gradeValueClass(g.data.value);
          if (g.data.type === "homework") chip.classList.add("grade-chip-hw");
          else if (g.data.type === "lesson") chip.classList.add("grade-chip-lesson");
          const typeLabel =
            g.data.type === "homework"
              ? t("gradeTypeHomework")
              : g.data.type === "lesson"
                ? t("gradeTypeLesson")
                : "";
          chip.textContent = String(g.data.value);
          let tip = typeLabel
            ? `${g.data.value} — ${typeLabel} (${date})`
            : `${g.data.value} (${date})`;
          if (g.data.comment) tip += ` — ${g.data.comment}`;
          chip.title = tip;
          cellInner.appendChild(chip);
        });
        td.appendChild(cellInner);
      }
      tr.appendChild(td);
    });

    const avgTd = document.createElement("td");
    avgTd.className = "schedule-table-cell grades-average-cell";
    if (values.length) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgTd.textContent = avg.toFixed(1);
      avgTd.classList.add(gradeValueClass(avg));
    } else {
      avgTd.textContent = "–";
    }
    tr.appendChild(avgTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  gradesTableContainer.appendChild(legend);
  gradesTableContainer.appendChild(wrap);
  renderStudentFinalGrades();
}

function renderStudentFinalGrades() {
  const finals = getStudentFinalGrades();
  if (!finals.length || !gradesTableContainer) return;
  const bySubject = new Map();
  finals.forEach((g) => {
    const sid = g.data.subjectId || "__none__";
    if (!bySubject.has(sid)) bySubject.set(sid, {});
    bySubject.get(sid)[g.data.period] = g.data.value;
  });
  const section = document.createElement("div");
  section.className = "final-grades-section";
  const heading = document.createElement("h3");
  heading.className = "final-grades-heading";
  heading.textContent = t("finalGradesHeading");
  section.appendChild(heading);
  const periods = ["semester1", "semester2", "year"];
  const tableWrap = document.createElement("div");
  tableWrap.className = "schedule-table-wrap final-grades-table-wrap";
  const table = document.createElement("table");
  table.className = "schedule-table final-grades-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.textContent = t("gradesTableSubjectHeader");
  headRow.appendChild(corner);
  periods.forEach((p) => {
    const th = document.createElement("th");
    th.textContent = t("finalPeriod_" + p);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const subjectOrder = lastSubjects.map((subj) => subj.id).filter((id) => bySubject.has(id));
  [...bySubject.keys()].filter((id) => !subjectOrder.includes(id)).forEach((id) => subjectOrder.push(id));
  subjectOrder.forEach((subjectId) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "grades-table-subject";
    th.textContent = getSubjectName(subjectId) || subjectId;
    tr.appendChild(th);
    const vals = bySubject.get(subjectId) || {};
    periods.forEach((p) => {
      const td = document.createElement("td");
      td.className = "schedule-table-cell";
      const v = vals[p];
      td.textContent = v !== undefined && v !== null ? String(v) : "–";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  gradesTableContainer.appendChild(section);
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
  const periodTimes = getDayEffectiveTimes(groupSchedule, weekdayKey, lastScheduleDefaults);
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
    // Пропускаємо урок, якщо в цей день для нього немає ні запланованого
    // предмета, ні активної разової заміни — інакше час дзвінків без уроку
    // (напр. "порожній" 7-й урок у скорочений день) показувався б як
    // "Йде урок: Урок" замість перерви/відсутності активного уроку.
    const override = getActiveOverride(groupSchedule, weekdayKey, r);
    const hasLesson = override
      ? !!override.subjectId
      : !!(dayEntries[r] && dayEntries[r].subjectId);
    if (start !== null && end !== null && end > start && hasLesson) {
      periods.push({ r, start, end });
    }
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

// Факультативи учня, розписані на конкретний день тижня (day заповнено),
// відсортовані за часом початку. Факультативи без часу йдуть в кінець
// (у порядку додавання), факультативи без day взагалі виключаються — вони
// лишаються тільки в списку "Мої факультативи" і не потрапляють у розклад.
function getScheduledElectivesForDay(dayKey) {
  return lastElectives
    .filter((e) => e.data.day === dayKey)
    .slice()
    .sort((a, b) => {
      const aMin = parseTimeToMinutes(a.data.start);
      const bMin = parseTimeToMinutes(b.data.start);
      if (aMin === null && bMin === null) return (a.data.createdAt || 0) - (b.data.createdAt || 0);
      if (aMin === null) return 1;
      if (bMin === null) return -1;
      return aMin - bMin;
    });
}

function renderScheduleContainer() {
  if (!scheduleContainer || !studentData) return;
  scheduleContainer.innerHTML = "";

  const target = new Date();
  target.setDate(target.getDate() + (currentView === "tomorrow" ? 1 : 0));
  const targetDateStr = formatDateLocal(target);
  const weekdayKey = WEEKDAY_BY_JS_INDEX[target.getDay()];
  const groupSchedule = getGroupSchedule(myGroup());
  const dayEntries = getDayEntriesList(groupSchedule, weekdayKey);
  const dayElectives = getScheduledElectivesForDay(weekdayKey);

  if (dayEntries.length === 0 && dayElectives.length === 0) {
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
      (l) =>
        l.data.subjectId === subjectId &&
        l.data.lessonDate === targetDateStr &&
        lessonVisibleToStudent(l.data)
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

  dayElectives.forEach(({ data }) => {
    const block = document.createElement("div");
    block.className = "today-subject-block today-subject-block-elective";

    const nameEl = document.createElement("div");
    nameEl.className = "today-subject-name";
    nameEl.textContent = data.name;
    block.appendChild(nameEl);

    if (data.start || data.end) {
      const timeEl = document.createElement("div");
      timeEl.className = "elective-block-time";
      timeEl.textContent = `${data.start || "?"}–${data.end || "?"}`;
      block.appendChild(timeEl);
    }

    scheduleContainer.appendChild(block);
  });
}

// Домальовує в клітинку табличкі чіп факультативу (фіолетовий, на відміну
// від звичайних уроків) з часом, якщо він заданий.
function appendElectiveCell(td, data) {
  const chip = document.createElement("span");
  chip.className = "chip chip-elective";
  chip.textContent = data.name;
  td.appendChild(chip);
  if (data.start || data.end) {
    const timeEl = document.createElement("div");
    timeEl.className = "schedule-cell-time";
    timeEl.textContent = `${data.start || "?"}–${data.end || "?"}`;
    td.appendChild(timeEl);
  }
}

// ---------- Тижневий розклад (табличка, лише перегляд уроків) ----------
// На відміну від renderScheduleContainer() (день сьогодні/завтра), тут
// показуємо всю таблицю на тиждень одразу — уроки редагує тільки вчитель
// (student.js нічого в schedule/week не записує). Факультативи ж — приватні
// записи самого учня (колекція electives): для дня, куди учень призначив
// факультатив, ми вставляємо його в першу вільну клітинку періоду; якщо
// вільних клітинок для цього дня вже нема — під факультативи, що не влізли,
// додаються додаткові рядки внизу таблиці (спільні для всіх днів).
// Для кожного дня беремо ефективний час уроку через getDayEffectiveTimes():
// якщо вчитель задав окремий ("унікальний") розклад дзвінків саме для
// цього дня тижня (dayTimes), покажемо саме його, а не спільний times.
function renderWeeklyScheduleTable() {
  if (!weeklyScheduleContainer || !studentData) return;
  weeklyScheduleContainer.innerHTML = "";

  const groupSchedule = getGroupSchedule(myGroup());

  const electivesByDay = {};
  WEEKDAYS.forEach((d) => {
    electivesByDay[d] = getScheduledElectivesForDay(d);
  });

  const visibleDays = WEEKDAYS.filter(
    (d) => getDayMaxPeriodIndex(groupSchedule[d]) >= 0 || electivesByDay[d].length > 0
  );

  if (visibleDays.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("scheduleEmptyMsg");
    weeklyScheduleContainer.appendChild(hint);
    return;
  }

  const periodRowCount = Math.max(-1, ...visibleDays.map((d) => getDayMaxPeriodIndex(groupSchedule[d]))) + 1;

  // Розкладаємо факультативи кожного дня по вільних (без уроку) клітинках
  // періодів; те, що не влізло, іде "понад" таблицю — в overflow.
  const electiveSlotByDay = {};
  const overflowByDay = {};
  visibleDays.forEach((dayKey) => {
    electiveSlotByDay[dayKey] = {};
    const dayMap = groupSchedule[dayKey] || {};
    const freeRows = [];
    for (let r = 0; r < periodRowCount; r++) {
      if (!dayMap[r]) freeRows.push(r);
    }
    const dayElectives = electivesByDay[dayKey];
    dayElectives.forEach((ev, idx) => {
      if (idx < freeRows.length) {
        electiveSlotByDay[dayKey][freeRows[idx]] = ev;
      }
    });
    overflowByDay[dayKey] = dayElectives.slice(freeRows.length);
  });

  const maxOverflow = Math.max(0, ...visibleDays.map((d) => overflowByDay[d].length));
  const totalRowCount = periodRowCount + maxOverflow;

  const table = document.createElement("table");
  table.className = "schedule-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const cornerTh = document.createElement("th");
  cornerTh.className = "schedule-table-corner";
  headRow.appendChild(cornerTh);
  const todayWeekdayKey = WEEKDAY_BY_JS_INDEX[new Date().getDay()];
  visibleDays.forEach((dayKey) => {
    const th = document.createElement("th");
    th.textContent = t("weekdaysShort")[dayKey];
    if (dayKey === todayWeekdayKey) th.classList.add("schedule-table-today");
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let r = 0; r < totalRowCount; r++) {
    const tr = document.createElement("tr");

    const rowTh = document.createElement("th");
    rowTh.className = "schedule-table-period";
    const numberEl = document.createElement("div");
    numberEl.className = "schedule-period-number";
    numberEl.textContent = String(r + 1);
    rowTh.appendChild(numberEl);
    tr.appendChild(rowTh);

    visibleDays.forEach((dayKey) => {
      const td = document.createElement("td");
      td.className = "schedule-table-cell";
      if (dayKey === todayWeekdayKey) td.classList.add("schedule-table-today");

      if (r < periodRowCount) {
        const dayMap = groupSchedule[dayKey] || {};
        const baseEntry = dayMap[r];
        const override = baseEntry ? getActiveOverride(groupSchedule, dayKey, r) : null;
        const subjectId = override ? override.subjectId : baseEntry ? baseEntry.subjectId : null;

        if (subjectId) {
          const chip = document.createElement("span");
          chip.className = override ? "chip chip-override" : "chip";
          chip.textContent = getSubjectName(subjectId);
          td.appendChild(chip);

          // Ефективний (можливо, унікальний саме для цього дня) час уроку.
          const dayTimes = getDayEffectiveTimes(groupSchedule, dayKey, lastScheduleDefaults);
          const time = dayTimes[r] || dayTimes[String(r)];
          if (time && (time.start || time.end)) {
            const timeEl = document.createElement("div");
            timeEl.className = "schedule-cell-time";
            timeEl.textContent = `${time.start || "?"}–${time.end || "?"}`;
            td.appendChild(timeEl);
          }
        } else if (electiveSlotByDay[dayKey][r]) {
          appendElectiveCell(td, electiveSlotByDay[dayKey][r].data);
        } else {
          td.classList.add("schedule-table-empty");
          td.textContent = "–";
        }
      } else {
        const overflowIdx = r - periodRowCount;
        const ev = overflowByDay[dayKey][overflowIdx];
        if (ev) {
          appendElectiveCell(td, ev.data);
        } else {
          td.classList.add("schedule-table-empty");
          td.textContent = "–";
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);

  const wrap = document.createElement("div");
  wrap.className = "schedule-table-wrap";
  wrap.appendChild(table);
  weeklyScheduleContainer.appendChild(wrap);
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
  } else if (data.hasHomework) {
    const badge = document.createElement("span");
    badge.className = "date-badge hw";
    badge.textContent = t("homeworkNoDueDate");
    datesRow.appendChild(badge);
  }
  if (data.addedByStarosta) {
    const badge = document.createElement("span");
    badge.className = "date-badge starosta-badge";
    badge.textContent = t("addedByStarostaBadge");
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


// ---------- Додавання ДЗ старостою ----------
// Показуємо форму лише якщо учень має isStarosta і є хоча б один предмет
// з studentsCanAddHw. Запис іде в ту саму колекцію lessons, що й уроки
// вчителя, з позначкою addedByStarosta, щоб у списках було видно джерело.
function getSubjectsAllowingStudentHw() {
  return lastSubjects.filter((s) => !!s.data.studentsCanAddHw);
}

function updateStarostaHwSection() {
  if (!starostaHwSection) return;
  const isStarosta = !!(studentData && studentData.isStarosta);
  const allowed = getSubjectsAllowingStudentHw();
  const show = isStarosta && allowed.length > 0;
  starostaHwSection.classList.toggle("hidden", !show);
  if (!show) return;

  if (starostaHwSubject) {
    const prev = starostaHwSubject.value;
    starostaHwSubject.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = !prev;
    placeholder.textContent = t("selectSubjectPlaceholder");
    starostaHwSubject.appendChild(placeholder);
    allowed.forEach(({ id, data }) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.name;
      starostaHwSubject.appendChild(opt);
    });
    if (allowed.some((s) => s.id === prev)) starostaHwSubject.value = prev;
  }
}

if (starostaHwAddBtn) {
  starostaHwAddBtn.onclick = async () => {
    if (!(studentData && studentData.isStarosta)) return;
    const subjectId = starostaHwSubject ? starostaHwSubject.value : "";
    const title = starostaHwTitle ? starostaHwTitle.value.trim() : "";
    const content = starostaHwContent ? starostaHwContent.value.trim() : "";
    const homeworkDate = starostaHwDate ? starostaHwDate.value : "";

    if (!subjectId) {
      alert(t("starostaHwNeedSubject"));
      return;
    }
    if (!getSubjectsAllowingStudentHw().some((s) => s.id === subjectId)) {
      alert(t("starostaHwNoSubjects"));
      return;
    }
    if (!title) {
      alert(t("starostaHwNeedTitle"));
      return;
    }

    try {
      const payload = {
        subjectId,
        title,
        content: content || "",
        lessonDate: null,
        homeworkDate: homeworkDate || null,
        hasHomework: true,
        createdAt: Date.now(),
        addedByStarosta: true,
        addedByStudentId: studentId || null,
        addedByUid: auth.currentUser ? auth.currentUser.uid : null,
      };
      // Прив'язуємо до класу старости, щоб інші класи не бачили чуже ДЗ.
      if (studentClassId) {
        payload.assignedClassIds = [studentClassId];
      }
      await addDoc(collection(db, "lessons"), payload);
      if (starostaHwTitle) starostaHwTitle.value = "";
      if (starostaHwContent) starostaHwContent.value = "";
      if (starostaHwDate) starostaHwDate.value = "";
      alert(t("starostaHwAdded"));
    } catch (e) {
      alert(errorText(e));
    }
  };
}

function lessonHasHomework(data) {
  if (!data) return false;
  return !!(data.homeworkDate || data.hasHomework);
}

function renderHomeworkContainer() {
  if (!homeworkContainer) return;
  updateHwSubjectFilterOptions();
  if (hwSortSelect) hwSortSelect.value = hwSortMode;
  if (hwHideDoneCheckbox) hwHideDoneCheckbox.checked = hwHideDone;
  homeworkContainer.innerHTML = "";

  const todayStr = formatDateLocal(new Date());
  let upcoming = lastLessons.filter((l) => {
    if (!lessonHasHomework(l.data) || !lessonVisibleToStudent(l.data)) return false;
    if (!l.data.homeworkDate) return true;
    return l.data.homeworkDate >= todayStr;
  });

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
      if (cmp !== 0) return cmp;
      return (a.data.homeworkDate || "9999").localeCompare(b.data.homeworkDate || "9999");
    });
  } else {
    upcoming = upcoming.slice().sort((a, b) =>
      (a.data.homeworkDate || "9999").localeCompare(b.data.homeworkDate || "9999")
    );
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
// day/start/end — необов'язкові: якщо день не вибрано, факультатив лишається
// просто записом у списку і не потрапляє в табличку розкладу. День без часу
// теж дозволений — тоді в табличці буде показано назву без годин.
if (addElectiveBtn) {
  addElectiveBtn.onclick = async () => {
    const name = newElectiveName.value.trim();
    if (!name || !studentId || !auth.currentUser) return;

    const day = newElectiveDay && newElectiveDay.value ? newElectiveDay.value : null;
    const startRaw = newElectiveStart ? newElectiveStart.value : "";
    const endRaw = newElectiveEnd ? newElectiveEnd.value : "";
    const start = day && startRaw ? startRaw : null;
    const end = day && endRaw ? endRaw : null;
    if (start && end && parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
      alert(t("electiveTimeInvalidMsg"));
      return;
    }

    try {
      await addDoc(collection(db, "electives"), {
        uid: auth.currentUser.uid,
        studentId,
        name,
        day,
        start,
        end,
        createdAt: Date.now(),
      });
      newElectiveName.value = "";
      if (newElectiveDay) newElectiveDay.value = "";
      if (newElectiveStart) newElectiveStart.value = "";
      if (newElectiveEnd) newElectiveEnd.value = "";
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

      const topRow = document.createElement("div");
      topRow.className = "elective-item-top";

      const nameSpan = document.createElement("span");
      nameSpan.className = "elective-item-name";
      nameSpan.textContent = data.name;
      topRow.appendChild(nameSpan);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "elective-delete-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", t("deleteBtn"));
      deleteBtn.onclick = () => deleteDoc(doc(db, "electives", id)).catch((e) => alert(errorText(e)));
      topRow.appendChild(deleteBtn);

      li.appendChild(topRow);

      // Учень сам призначає (і може будь-коли змінити) день і час свого
      // факультативу — саме ці значення потім потрапляють у клітинку
      // тижневої табличкі розкладу (renderWeeklyScheduleTable) та у
      // список "Сьогодні/Завтра" (renderScheduleContainer).
      const scheduleRow = document.createElement("div");
      scheduleRow.className = "elective-item-schedule";

      const daySelect = document.createElement("select");
      daySelect.className = "elective-day-select";
      populateElectiveDaySelect(daySelect, data.day || "");

      const startInput = document.createElement("input");
      startInput.type = "time";
      startInput.className = "elective-time-input";
      startInput.value = data.start || "";

      const endInput = document.createElement("input");
      endInput.type = "time";
      endInput.className = "elective-time-input";
      endInput.value = data.end || "";

      const resetInputs = () => {
        daySelect.value = data.day || "";
        startInput.value = data.start || "";
        endInput.value = data.end || "";
      };

      const saveSchedule = () => {
        const day = daySelect.value || null;
        const start = day && startInput.value ? startInput.value : null;
        const end = day && endInput.value ? endInput.value : null;
        if (start && end && parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
          alert(t("electiveTimeInvalidMsg"));
          resetInputs();
          return;
        }
        updateDoc(doc(db, "electives", id), { day, start, end }).catch((e) => alert(errorText(e)));
      };
      daySelect.onchange = saveSchedule;
      startInput.onchange = saveSchedule;
      endInput.onchange = saveSchedule;

      scheduleRow.appendChild(daySelect);
      scheduleRow.appendChild(startInput);
      scheduleRow.appendChild(endInput);
      li.appendChild(scheduleRow);

      electivesListEl.appendChild(li);
    });
  if (noElectivesMsg) noElectivesMsg.classList.toggle("hidden", lastElectives.length > 0);
}
// ==========================================================
// Самоврядування — вибори старости (кабінет учня)
// ==========================================================
const ELECTION_COLORS = [
  "#24866b", "#0e7490", "#c2410c", "#7c3aed", "#b45309",
  "#34b58e", "#6366f1", "#dc2626", "#0891b2", "#a855f7",
];

let lastElections = [];
let lastStarostaHistory = [];
let unsubscribeElections = null;
let unsubscribeStarostaHistory = null;
let selfgovHistoryExpanded = false;

const selfgovStudentStatus = document.getElementById("selfgov-student-status");
const selfgovStudentActions = document.getElementById("selfgov-student-actions");
const selfgovStudentPie = document.getElementById("selfgov-student-pie");
const selfgovStudentLegend = document.getElementById("selfgov-student-legend");
const selfgovStudentCandidates = document.getElementById("selfgov-student-candidates");
const selfgovHistoryToggle = document.getElementById("selfgov-history-toggle");
const selfgovHistoryBody = document.getElementById("selfgov-history-body");
const selfgovHistoryList = document.getElementById("selfgov-history-list");
const selfgovNoHistoryMsg = document.getElementById("selfgov-no-history-msg");

function electionPhase(data, now = Date.now()) {
  if (data.closed) return "closed";
  if (now < data.startAt) return "candidacy";
  if (now < data.endAt) return "voting";
  return "closed";
}

function getActiveElectionForMyClass() {
  if (!studentClassId) return null;
  return (
    lastElections.find(
      (e) => e.data.classId === studentClassId && !e.data.closed && electionPhase(e.data) !== "closed"
    ) || null
  );
}

function countVotes(electionData) {
  const votes = electionData.votes || {};
  const counts = {};
  Object.values(votes).forEach((cid) => {
    counts[cid] = (counts[cid] || 0) + 1;
  });
  return counts;
}

function renderStudentPie(electionData) {
  if (!selfgovStudentPie || !selfgovStudentLegend) return;
  const candidates = electionData.candidates || {};
  const counts = countVotes(electionData);
  const entries = Object.keys(candidates).map((sid, i) => ({
    id: sid,
    name: candidates[sid].name || sid,
    votes: counts[sid] || 0,
    color: ELECTION_COLORS[i % ELECTION_COLORS.length],
  }));
  const total = entries.reduce((s, e) => s + e.votes, 0);
  if (entries.length === 0 || total === 0) {
    selfgovStudentPie.style.background = `conic-gradient(var(--color-border) 0deg 360deg)`;
    selfgovStudentLegend.innerHTML = `<div class="hint">${t("selfGovNoCandidates")}</div>`;
    return;
  }
  let deg = 0;
  const parts = [];
  entries.forEach((e) => {
    const slice = (e.votes / total) * 360;
    parts.push(`${e.color} ${deg}deg ${deg + slice}deg`);
    deg += slice;
  });
  selfgovStudentPie.style.background = `conic-gradient(${parts.join(", ")})`;
  selfgovStudentLegend.innerHTML = "";
  const totalLabel = document.createElement("div");
  totalLabel.className = "hint";
  totalLabel.textContent = `${t("selfGovTotalVotes")}: ${total}`;
  selfgovStudentLegend.appendChild(totalLabel);
  entries
    .slice()
    .sort((a, b) => b.votes - a.votes)
    .forEach((e) => {
      const row = document.createElement("div");
      row.className = "election-legend-item";
      const sw = document.createElement("span");
      sw.className = "election-legend-swatch";
      sw.style.background = e.color;
      const txt = document.createElement("span");
      txt.textContent = `${e.name}: ${e.votes}`;
      row.append(sw, txt);
      selfgovStudentLegend.appendChild(row);
    });
}

function renderSelfGovStudent() {
  if (!selfgovPanel) return;
  if (!studentId) {
    if (selfgovStudentStatus) selfgovStudentStatus.textContent = t("selfGovNeedLink");
    return;
  }

  const active = getActiveElectionForMyClass();
  if (selfgovStudentActions) selfgovStudentActions.innerHTML = "";
  if (selfgovStudentCandidates) selfgovStudentCandidates.innerHTML = "";

  if (!active) {
    if (selfgovStudentStatus) selfgovStudentStatus.textContent = t("selfGovNoActive");
    if (selfgovStudentPie) selfgovStudentPie.style.background = `conic-gradient(var(--color-border) 0deg 360deg)`;
    if (selfgovStudentLegend) selfgovStudentLegend.innerHTML = "";
    renderStudentStarostaHistory();
    return;
  }

  const phase = electionPhase(active.data);
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  const startStr = new Date(active.data.startAt).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endStr = new Date(active.data.endAt).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const phaseLabel =
    phase === "candidacy"
      ? t("selfGovPhaseCandidacy")
      : phase === "voting"
        ? t("selfGovPhaseVoting")
        : t("selfGovPhaseClosed");
  const badgeClass =
    phase === "voting"
      ? "election-phase-badge voting"
      : phase === "closed"
        ? "election-phase-badge closed"
        : "election-phase-badge";
  if (selfgovStudentStatus) {
    selfgovStudentStatus.innerHTML = `${phaseLabel} <span class="${badgeClass}">${phaseLabel}</span><br><span class="hint">${startStr} — ${endStr}</span>`;
  }

  const candidates = active.data.candidates || {};
  const votes = active.data.votes || {};
  const myVote = votes[studentId];
  const isCandidate = !!candidates[studentId];

  if (phase === "candidacy" && selfgovStudentActions) {
    if (isCandidate) {
      const span = document.createElement("span");
      span.className = "hint";
      span.textContent = t("selfGovApplied");
      selfgovStudentActions.appendChild(span);
    } else {
      const btn = document.createElement("button");
      btn.textContent = t("selfGovApplyBtn");
      btn.onclick = async () => {
        try {
          const name = (studentData && studentData.name) || "Student";
          await updateDoc(doc(db, "elections", active.id), {
            [`candidates.${studentId}`]: { name, appliedAt: Date.now() },
          });
          alert(t("selfGovApplyDone"));
        } catch (e) {
          alert(errorText(e));
        }
      };
      selfgovStudentActions.appendChild(btn);
    }
  }

  if (phase === "voting" && myVote && selfgovStudentActions) {
    const votedName = (candidates[myVote] && candidates[myVote].name) || myVote;
    const span = document.createElement("span");
    span.className = "hint";
    span.textContent = `${t("selfGovVotedFor")} ${votedName}`;
    selfgovStudentActions.appendChild(span);
  }

  renderStudentPie(active.data);

  if (selfgovStudentCandidates) {
    const counts = countVotes(active.data);
    const ids = Object.keys(candidates);
    if (ids.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = t("selfGovNoCandidates");
      selfgovStudentCandidates.appendChild(p);
    } else {
      ids
        .slice()
        .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
        .forEach((sid) => {
          const row = document.createElement("div");
          row.className = "selfgov-candidate-row";
          const name = document.createElement("span");
          name.className = "selfgov-candidate-name";
          name.textContent = candidates[sid].name || sid;
          const right = document.createElement("div");
          right.style.display = "flex";
          right.style.alignItems = "center";
          right.style.gap = "10px";
          const votesEl = document.createElement("span");
          votesEl.className = "selfgov-candidate-votes";
          votesEl.textContent = `${counts[sid] || 0} ${t("selfGovVotes")}`;
          right.appendChild(votesEl);
          if (phase === "voting" && !myVote && sid !== studentId) {
            const voteBtn = document.createElement("button");
            voteBtn.className = "small";
            voteBtn.textContent = t("selfGovVoteBtn");
            voteBtn.onclick = async () => {
              try {
                await updateDoc(doc(db, "elections", active.id), {
                  [`votes.${studentId}`]: sid,
                });
                alert(t("selfGovVoteDone"));
              } catch (e) {
                alert(errorText(e));
              }
            };
            right.appendChild(voteBtn);
          } else if (phase === "voting" && sid === studentId && !myVote) {
            const hint = document.createElement("span");
            hint.className = "hint";
            hint.textContent = t("selfGovCannotVoteSelf");
            right.appendChild(hint);
          }
          row.append(name, right);
          selfgovStudentCandidates.appendChild(row);
        });
    }
  }

  renderStudentStarostaHistory();
}

function renderStudentStarostaHistory() {
  if (!selfgovHistoryList) return;
  const items = lastStarostaHistory
    .filter((h) => !studentClassId || h.data.classId === studentClassId)
    .slice()
    .sort((a, b) => (b.data.fromDate || "").localeCompare(a.data.fromDate || ""));
  selfgovHistoryList.innerHTML = "";
  if (items.length === 0) {
    if (selfgovNoHistoryMsg) selfgovNoHistoryMsg.classList.remove("hidden");
    return;
  }
  if (selfgovNoHistoryMsg) selfgovNoHistoryMsg.classList.add("hidden");
  items.forEach(({ data }) => {
    const div = document.createElement("div");
    div.className = "selfgov-history-item";
    const name = document.createElement("div");
    name.className = "selfgov-history-name";
    name.textContent = data.studentName || data.studentId;
    const dates = document.createElement("div");
    dates.className = "selfgov-history-dates";
    const to = data.toDate || t("selfGovUntilNow");
    dates.textContent = `${t("selfGovFrom")} ${data.fromDate || "?"} ${t("selfGovTo")} ${to}`;
    div.append(name, dates);
    selfgovHistoryList.appendChild(div);
  });
}

if (selfgovHistoryToggle) {
  selfgovHistoryToggle.onclick = () => {
    selfgovHistoryExpanded = !selfgovHistoryExpanded;
    if (selfgovHistoryBody) selfgovHistoryBody.classList.toggle("hidden", !selfgovHistoryExpanded);
    selfgovHistoryToggle.textContent = selfgovHistoryExpanded
      ? t("subjectsCollapseBtn") || "Згорнути"
      : t("subjectsExpandBtn") || "Розгорнути";
  };
}

function subscribeStudentElections() {
  if (unsubscribeElections) unsubscribeElections();
  if (unsubscribeStarostaHistory) unsubscribeStarostaHistory();
  unsubscribeElections = onSnapshot(collection(db, "elections"), (snap) => {
    lastElections = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    if (selfgovPanel && !selfgovPanel.classList.contains("hidden")) renderSelfGovStudent();
  });
  unsubscribeStarostaHistory = onSnapshot(collection(db, "starostaHistory"), (snap) => {
    lastStarostaHistory = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    if (selfgovPanel && !selfgovPanel.classList.contains("hidden")) renderSelfGovStudent();
  });
}



// ==========================================================
// Повідомлення / сповіщення (кабінет учня)
// ==========================================================
let lastNotifications = [];
let unsubscribeNotifications = null;
let messagesPanelOpen = false;

const messagesFab = document.getElementById("messages-fab");
const messagesBadge = document.getElementById("messages-badge");
const messagesPanel = document.getElementById("messages-panel");
const messagesPanelClose = document.getElementById("messages-panel-close");
const messagesList = document.getElementById("messages-list");
const messagesEmpty = document.getElementById("messages-empty");

function showMessagesFab(show) {
  if (messagesFab) messagesFab.classList.toggle("hidden", !show);
  if (!show && messagesPanel) messagesPanel.classList.add("hidden");
}

function closeMessagesPanel() {
  messagesPanelOpen = false;
  if (messagesPanel) messagesPanel.classList.add("hidden");
}

function openMessagesPanel() {
  messagesPanelOpen = true;
  if (messagesPanel) messagesPanel.classList.remove("hidden");
  renderMessagesList();
  markAllNotificationsRead().catch(() => {});
  const list = document.getElementById("messages-list");
  if (list && !document.getElementById("messages-notif-hint")) {
    const hint = document.createElement("p");
    hint.id = "messages-notif-hint";
    hint.className = "hint";
    hint.style.padding = "8px 16px 0";
    hint.textContent = typeof t === "function" ? t("messagesNotifOnlyHint") : "";
    list.parentNode.insertBefore(hint, list);
  } else {
    const hint = document.getElementById("messages-notif-hint");
    if (hint && typeof t === "function") hint.textContent = t("messagesNotifOnlyHint");
  }
}

function renderMessagesList() {
  if (!messagesList) return;
  messagesList.innerHTML = "";
  const items = lastNotifications
    .slice()
    .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
  if (messagesEmpty) messagesEmpty.classList.toggle("hidden", items.length > 0);
  items.forEach(({ id, data }) => {
    const el = document.createElement("div");
    el.className = "message-item" + (data.read ? "" : " unread");
    const title = document.createElement("div");
    title.className = "message-item-title";
    title.textContent = data.title || "";
    const body = document.createElement("div");
    body.className = "message-item-body";
    body.textContent = data.body || "";
    el.append(title, body);
    if (data.senderName) {
      const from = document.createElement("div");
      from.className = "message-item-meta";
      from.style.marginBottom = "4px";
      from.textContent = data.senderName;
      el.insertBefore(from, body);
    }
    if (data.comment) {
      const c = document.createElement("div");
      c.className = "message-item-comment";
      c.textContent = `${t("notifGradeComment")}: ${data.comment}`;
      el.appendChild(c);
    }
    const meta = document.createElement("div");
    meta.className = "message-item-meta";
    const d = data.createdAt ? new Date(data.createdAt) : null;
    meta.textContent = d
      ? d.toLocaleString(currentLang === "uk" ? "uk-UA" : "en-US", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    el.appendChild(meta);
    el.onclick = () => {
      if (!data.read) {
        updateDoc(doc(db, "notifications", id), { read: true }).catch(() => {});
      }
    };
    messagesList.appendChild(el);
  });
  updateMessagesBadge();
}

function updateMessagesBadge() {
  if (!messagesBadge) return;
  const unread = lastNotifications.filter((n) => !n.data.read).length;
  if (unread > 0) {
    messagesBadge.textContent = unread > 99 ? "99+" : String(unread);
    messagesBadge.classList.remove("hidden");
  } else {
    messagesBadge.classList.add("hidden");
  }
}

async function markAllNotificationsRead() {
  const unread = lastNotifications.filter((n) => !n.data.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach(({ id }) => {
    batch.update(doc(db, "notifications", id), { read: true });
  });
  await batch.commit();
}

function subscribeStudentNotifications() {
  if (unsubscribeNotifications) unsubscribeNotifications();
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) return;
  const q = query(collection(db, "notifications"), where("recipientUid", "==", uid));
  unsubscribeNotifications = onSnapshot(
    q,
    (snap) => {
      lastNotifications = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      updateMessagesBadge();
      if (messagesPanelOpen) renderMessagesList();
    },
    (err) => console.warn("notifications", err)
  );
}

if (messagesFab) {
  messagesFab.onclick = () => {
    if (messagesPanelOpen) closeMessagesPanel();
    else openMessagesPanel();
  };
}
if (messagesPanelClose) {
  messagesPanelClose.onclick = () => closeMessagesPanel();
}


// ==========================================================
// Оголошення (кабінет учня)
// ==========================================================
let lastAnnouncements = [];
let unsubscribeAnnouncements = null;

function announcementVisibleToMe(data) {
  const ids = data.classIds;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return true;
  if (!studentClassId) return false;
  return ids.includes(studentClassId);
}

function renderStudentAnnouncements() {
  if (!announcementsListEl) return;
  announcementsListEl.innerHTML = "";
  const items = lastAnnouncements
    .filter((a) => announcementVisibleToMe(a.data))
    .slice()
    .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
  if (noAnnouncementsMsg) noAnnouncementsMsg.classList.toggle("hidden", items.length > 0);
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  items.forEach(({ data }) => {
    const el = document.createElement("div");
    el.className = "announcement-item";
    const header = document.createElement("div");
    header.className = "announcement-item-header";
    const title = document.createElement("h3");
    title.className = "announcement-item-title";
    title.textContent = data.title || "";
    header.appendChild(title);
    el.appendChild(header);
    if (data.body) {
      const body = document.createElement("div");
      body.className = "announcement-item-body";
      body.textContent = data.body;
      el.appendChild(body);
    }
    const meta = document.createElement("div");
    meta.className = "announcement-item-meta";
    const parts = [];
    if (data.authorName) parts.push(`${t("announcementFrom")}: ${data.authorName}`);
    if (data.createdAt) {
      parts.push(
        new Date(data.createdAt).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
    const classIds = data.classIds;
    if (!classIds || classIds.length === 0) {
      const chip = document.createElement("span");
      chip.className = "announcement-item-classes";
      chip.textContent = t("announcementAllClasses");
      meta.appendChild(chip);
    } else if (data.classNames && data.classNames.length) {
      const chip = document.createElement("span");
      chip.className = "announcement-item-classes";
      chip.textContent = data.classNames.join(", ");
      meta.appendChild(chip);
    }
    if (parts.length) {
      const span = document.createElement("span");
      span.textContent = parts.join(" · ");
      meta.appendChild(span);
    }
    el.appendChild(meta);
    announcementsListEl.appendChild(el);
  });
}

function subscribeStudentAnnouncements() {
  if (unsubscribeAnnouncements) unsubscribeAnnouncements();
  unsubscribeAnnouncements = onSnapshot(
    collection(db, "announcements"),
    (snap) => {
      lastAnnouncements = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      if (announcementsPanel && !announcementsPanel.classList.contains("hidden")) {
        renderStudentAnnouncements();
      }
    },
    (err) => console.warn("announcements", err)
  );
}



// ==========================================================
// Історія балів (кабінет учня)
// ==========================================================
let pointsHistoryPanelOpen = false;
let pointsHistoryUnsubscribe = null;

function ensurePointsHistoryPanel() {
  let panel = document.getElementById("points-history-panel");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "points-history-panel";
  panel.className = "points-history-panel hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "points-history-title");
  panel.innerHTML = `
    <div class="points-history-header">
      <h2 id="points-history-title"></h2>
      <button type="button" class="points-history-close" id="points-history-close" aria-label="Close">✕</button>
    </div>
    <div id="points-history-list" class="points-history-list"></div>
    <p id="points-history-empty" class="hint points-history-empty hidden"></p>
  `;
  document.body.appendChild(panel);
  const closeBtn = document.getElementById("points-history-close");
  if (closeBtn) closeBtn.onclick = () => closePointsHistoryPanel();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pointsHistoryPanelOpen) closePointsHistoryPanel();
  });
  return panel;
}

function closePointsHistoryPanel() {
  pointsHistoryPanelOpen = false;
  if (pointsHistoryUnsubscribe) {
    pointsHistoryUnsubscribe();
    pointsHistoryUnsubscribe = null;
  }
  const panel = document.getElementById("points-history-panel");
  if (panel) panel.classList.add("hidden");
}

function openPointsHistoryPanel() {
  if (!studentId) return;
  const panel = ensurePointsHistoryPanel();
  pointsHistoryPanelOpen = true;
  panel.classList.remove("hidden");
  const titleEl = document.getElementById("points-history-title");
  if (titleEl) titleEl.textContent = t("pointsHistoryTitle");
  const emptyEl = document.getElementById("points-history-empty");
  if (emptyEl) emptyEl.textContent = t("pointsHistoryEmpty");
  if (pointsHistoryUnsubscribe) {
    pointsHistoryUnsubscribe();
    pointsHistoryUnsubscribe = null;
  }
  const listEl = document.getElementById("points-history-list");
  if (listEl) listEl.innerHTML = "";
  const q = query(collection(db, "pointsHistory"), where("studentId", "==", studentId));
  pointsHistoryUnsubscribe = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
      renderStudentPointsHistoryList(items);
    },
    (err) => {
      console.warn("pointsHistory", err);
      renderStudentPointsHistoryList([]);
    }
  );
}

function renderStudentPointsHistoryList(items) {
  const listEl = document.getElementById("points-history-list");
  const emptyEl = document.getElementById("points-history-empty");
  if (!listEl) return;
  listEl.innerHTML = "";
  if (emptyEl) emptyEl.classList.toggle("hidden", items.length > 0);
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  items.forEach(({ data }) => {
    const el = document.createElement("div");
    el.className = "points-history-item";
    const delta = data.delta || 0;
    const deltaEl = document.createElement("span");
    deltaEl.className =
      "points-history-delta " + (delta > 0 ? "points-history-delta--up" : "points-history-delta--down");
    deltaEl.textContent = (delta > 0 ? "+" : "") + delta;
    const body = document.createElement("div");
    body.className = "points-history-item-body";
    const balance = document.createElement("div");
    balance.className = "points-history-balance";
    balance.textContent = `${data.pointsBefore ?? "—"} → ${data.pointsAfter ?? "—"}`;
    const meta = document.createElement("div");
    meta.className = "points-history-meta";
    const parts = [];
    if (data.teacherName) parts.push(data.teacherName);
    if (data.createdAt) {
      parts.push(
        new Date(data.createdAt).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
    meta.textContent = parts.join(" · ");
    body.append(balance, meta);
    if (data.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "points-history-note";
      noteEl.textContent = data.note;
      body.appendChild(noteEl);
    }
    el.append(deltaEl, body);
    listEl.appendChild(el);
  });
}

(function bindPointsHeroHistory() {
  const hero = document.querySelector(".points-hero");
  if (!hero) return;
  hero.setAttribute("role", "button");
  hero.setAttribute("tabindex", "0");
  hero.title = (typeof t === "function" && t("pointsHistoryHint")) || "";
  hero.onclick = () => {
    if (pointsHistoryPanelOpen) closePointsHistoryPanel();
    else openPointsHistoryPanel();
  };
  hero.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      hero.click();
    }
  };
})();
