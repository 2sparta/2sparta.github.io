// ==========================================================
// Конфіг Firebase та спільні хелпери — див. common.js
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
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  deleteField,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  firebaseConfig,
  WEEKDAYS,
  WEEKDAY_BY_JS_INDEX,
  pluralUk,
  emptyGroupSchedule,
  emptySchedule,
  buildScheduleData,
  getDayEffectiveTimes,
  getISOWeekKey,
  getActiveOverride,
  getDayMaxPeriodIndex,
  getDayEntriesList,
  normalizeGroupData,
  generateEntryId,
  generateSixDigitCode,
  parseTimeToMinutes,
  formatDateLocal,
  escapeHtml,
} from "./common.js";

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
    greetingTitle: "Доброго дня!",
    greetingSubtitle: (n) =>
      n === 0
        ? "Сьогодні уроків у розкладі не заплановано."
        : `Сьогодні у вас ${n} ${pluralUk(n, "урок", "уроки", "уроків")} за розкладом.`,
    statStudents: "Учнів",
    statSubjects: "Предметів",
    statLessonsToday: "Уроків сьогодні",
    statLinked: "Прив'язано",
    tabPoints: "Бали",
    tabSchedule: "Розклад",
    tabTasks: "Завдання",
    studentLinkText: "Я учень →",
    addStudentHeading: "Додати учня",
    studentNamePlaceholder: "Ім'я учня",
    addBtn: "Додати",
    studentsListHeading: "Список учнів",
    noStudentsMsg: "Учнів ще немає.",
    studentsSearchPlaceholder: "Пошук за іменем...",
    noStudentsSearchMsg: "Нікого не знайдено.",
    thName: "Ім'я",
    thPoints: "Бали",
    thChange: "Змінити",
    thCode: "Код-запрошення",
    thLinked: "Прив'язаний",
    pointsLabel: "балів",
    codeLabel: "Код-запрошення",
    linked: "Прив'язаний",
    notLinked: "Очікує",
    deleteBtn: "Видалити",
    deleteConfirm: (name) => `Видалити ${name}?`,

    addSubjectHeading: "Додати предмет",
    subjectNamePlaceholder: "Назва предмета",
    subjectLinkPlaceholder: "Посилання на Zoom/Meet (необов'язково)",
    subjectsListHeading: "Список предметів",
    subjectsCollapseBtn: "Згорнути",
    subjectsExpandBtn: "Розгорнути",
    noSubjectsMsg: "Предметів ще немає.",
    deleteSubjectConfirm: (name) => `Видалити предмет "${name}"? Уроки цього предмета залишаться, але без прив'язки.`,
    selectSubjectPlaceholder: "Оберіть предмет",
    addSubjectFirstHint: "Спочатку додайте хоча б один предмет.",

    scheduleHeading: "Розклад",
    groupSwitchLabel: "Клас:",
    group1Label: "Група 1",
    group2Label: "Група 2",
    addClassBtn: "Додати клас",
    deleteClassBtn: "Видалити клас",
    newClassNamePrompt: "Назва нового класу (наприклад, 8-А):",
    addGroupBtn: "Додати групу",
    deleteGroupBtn: "Видалити групу",
    newGroupNamePrompt: "Назва нової групи (наприклад, 1 група):",
    deleteGroupConfirm: (name) => `Видалити групу "${name}"? Учні цієї групи будуть перенесені до іншої групи, а розклад групи буде втрачено.`,
    groupSwitchSubLabel: "Група:",
    studentsSortLabel: "Сортувати:",
    studentsSortName: "За іменем",
    studentsSortPoints: "За балами",
    studentsSortLinked: "За прив'язкою",
    studentsSortGroup: "За групою",
    dayTimesCollapseBtn: "Згорнути",
    dayTimesExpandBtn: "Розгорнути",
    deleteClassConfirm: (name) => `Ви впевнені, що хочете видалити клас "${name}"? Учні цього класу будуть перенесені до іншого класу, а розклад класу буде втрачено. Цю дію не можна скасувати.`,
    deleteClassNoEmail: "У вашого акаунта немає пошти для надсилання коду підтвердження.",
    deleteClassEmailSubject: "Код підтвердження видалення класу — Класний простір",
    deleteClassEmailBody: (code) => `Ваш код підтвердження для видалення класу: ${code}\n\nКод дійсний 10 хвилин. Якщо ви не запитували видалення класу, проігноруйте цей лист.`,
    deleteClassEnterCodePrompt: "Введіть 6-значний код підтвердження, надісланий на вашу пошту:",
    deleteClassCodeExpired: "Термін дії коду сплив. Спробуйте видалити клас ще раз.",
    deleteClassCodeWrong: "Невірний код підтвердження.",
    dayTimesHeading: "Особливий розклад дзвінків для дня",
    dayTimesHint: "Задайте окремий розклад дзвінків для конкретного дня тижня (наприклад, для суботи), який відрізняється від звичайного.",
    dayTimesToggleLabel: "Свій розклад дзвінків для цього дня",
    weekdays: { mon: "Понеділок", tue: "Вівторок", wed: "Середа", thu: "Четвер", fri: "П'ятниця", sat: "Субота", sun: "Неділя" },
    weekdaysShort: { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Нд" },
    addToScheduleBtn: "Додати",
    emptyDayHint: "На цей день предметів ще не додано.",
    periodStartLabel: "Початок уроку",
    periodEndLabel: "Кінець уроку",
    scheduleApplyBtn: "Застосувати розклад",
    scheduleEditBtn: "Змінити розклад",
    scheduleEmptyMsg: "Розклад порожній.",
    joinMeetingBtn: "Приєднатися до зустрічі",
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
      "permission-denied": "Firestore відхилив запис (перевірте правила безпеки).",
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
    greetingTitle: "Good day!",
    greetingSubtitle: (n) =>
      n === 0
        ? "No lessons are scheduled for today."
        : `You have ${n} lesson${n === 1 ? "" : "s"} scheduled today.`,
    statStudents: "Students",
    statSubjects: "Subjects",
    statLessonsToday: "Lessons today",
    statLinked: "Linked",
    tabPoints: "Points",
    tabSchedule: "Schedule",
    tabTasks: "Tasks",
    studentLinkText: "I'm a student →",
    addStudentHeading: "Add a Student",
    studentNamePlaceholder: "Student name",
    addBtn: "Add",
    studentsListHeading: "Student List",
    noStudentsMsg: "No students yet.",
    studentsSearchPlaceholder: "Search by name...",
    noStudentsSearchMsg: "No matches found.",
    thName: "Name",
    thPoints: "Points",
    thChange: "Change",
    thCode: "Invite Code",
    thLinked: "Linked",
    pointsLabel: "points",
    codeLabel: "Invite code",
    linked: "Linked",
    notLinked: "Pending",
    deleteBtn: "Delete",
    deleteConfirm: (name) => `Delete ${name}?`,

    addSubjectHeading: "Add a Subject",
    subjectNamePlaceholder: "Subject name",
    subjectLinkPlaceholder: "Zoom/Meet link (optional)",
    subjectsListHeading: "Subject List",
    subjectsCollapseBtn: "Collapse",
    subjectsExpandBtn: "Expand",
    noSubjectsMsg: "No subjects yet.",
    deleteSubjectConfirm: (name) => `Delete subject "${name}"? Its lessons will remain but unlinked.`,
    selectSubjectPlaceholder: "Choose a subject",
    addSubjectFirstHint: "Add at least one subject first.",

    scheduleHeading: "Schedule",
    groupSwitchLabel: "Class:",
    group1Label: "Group 1",
    group2Label: "Group 2",
    addClassBtn: "Add class",
    deleteClassBtn: "Delete class",
    newClassNamePrompt: "Name of the new class (e.g. 8-A):",
    addGroupBtn: "Add group",
    deleteGroupBtn: "Delete group",
    newGroupNamePrompt: "Name of the new group (e.g. Group 1):",
    deleteGroupConfirm: (name) => `Delete group "${name}"? Its students will be moved to another group, and the group's schedule will be lost.`,
    groupSwitchSubLabel: "Group:",
    studentsSortLabel: "Sort:",
    studentsSortName: "By name",
    studentsSortPoints: "By points",
    studentsSortLinked: "By linked status",
    studentsSortGroup: "By group",
    dayTimesCollapseBtn: "Collapse",
    dayTimesExpandBtn: "Expand",
    deleteClassConfirm: (name) => `Are you sure you want to delete the class "${name}"? Its students will be moved to another class, and the class's schedule will be lost. This cannot be undone.`,
    deleteClassNoEmail: "Your account has no email address to send the confirmation code to.",
    deleteClassEmailSubject: "Class deletion confirmation code — Class Space",
    deleteClassEmailBody: (code) => `Your confirmation code for deleting the class: ${code}\n\nThe code is valid for 10 minutes. If you didn't request this, ignore this email.`,
    deleteClassEnterCodePrompt: "Enter the 6-digit confirmation code sent to your email:",
    deleteClassCodeExpired: "The code has expired. Please try deleting the class again.",
    deleteClassCodeWrong: "Incorrect confirmation code.",
    dayTimesHeading: "Custom bell schedule for a day",
    dayTimesHint: "Set a separate bell schedule for a specific weekday (e.g. Saturday) that differs from the regular one.",
    dayTimesToggleLabel: "Use a custom bell schedule for this day",
    weekdays: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
    weekdaysShort: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
    addToScheduleBtn: "Add",
    emptyDayHint: "No subjects added for this day yet.",
    periodStartLabel: "Lesson start",
    periodEndLabel: "Lesson end",
    scheduleApplyBtn: "Apply schedule",
    scheduleEditBtn: "Change schedule",
    scheduleEmptyMsg: "The schedule is empty.",
    joinMeetingBtn: "Join the meeting",
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
      "permission-denied": "Firestore rejected the write (check security rules).",
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
  updateSubjectsToggleBtn();
  renderClassSwitch();
  renderNewStudentGroupOptions();
  renderStudentsTable();
  renderSubjectsList();
  renderSubjectSelects();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
  updateGreetingDate();
  updateDashboardStats();
  const sortSel = document.getElementById("students-sort-select");
  if (sortSel) sortSel.value = studentsSortMode;
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});

applyStaticTranslations();

// ==========================================================
// Класи та групи.
// Клас (напр. "8-А") — батьківський рівень; група (напр. "1 група")
// — підрівень із власним розкладом. Учні та schedule/week прив'язані
// до id групи (поле students.group = groupId).
// Зберігаються в Firestore: classes / groups.
// ==========================================================
const GROUP_STORAGE_KEY = "schooleballs-group";
const CLASS_STORAGE_KEY = "schooleballs-class";

let lastClasses = []; // [{id, data:{name, createdAt}}] — батьківські класи
let lastGroups = []; // [{id, data:{classId, name, createdAt}}] — групи з розкладом
let currentClassId = localStorage.getItem(CLASS_STORAGE_KEY) || null;
let currentGroup = localStorage.getItem(GROUP_STORAGE_KEY) || "group1";
let classesSeeded = false;
let groupsSeeded = false;
let unsubscribeClasses = null;
let unsubscribeGroups = null;

function classIds() {
  return lastClasses.map((c) => c.id);
}

function groupIds() {
  return lastGroups.map((g) => g.id);
}

function groupsOfClass(classId) {
  return lastGroups.filter((g) => g.data.classId === classId);
}

function getClassName(classId) {
  const found = lastClasses.find((c) => c.id === classId);
  return found ? found.data.name : classId || "";
}

function getGroupName(groupId) {
  const found = lastGroups.find((g) => g.id === groupId);
  return found ? found.data.name : groupId || "";
}

function getGroupLabel(groupId) {
  const found = lastGroups.find((g) => g.id === groupId);
  if (!found) return groupId || "";
  const clsName = getClassName(found.data.classId);
  return clsName ? `${clsName} / ${found.data.name}` : found.data.name;
}

function setCurrentClass(classId) {
  if (!classIds().includes(classId) || classId === currentClassId) {
    // навіть якщо клас той самий — переконаємось, що поточна група з нього
    ensureCurrentGroupInClass();
    return;
  }
  currentClassId = classId;
  localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
  const groups = groupsOfClass(classId);
  if (groups.length && !groups.some((g) => g.id === currentGroup)) {
    currentGroup = groups[0].id;
    localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  }
  renderClassSwitch();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
}

function setGroup(groupId) {
  if (!groupIds().includes(groupId) || groupId === currentGroup) return;
  currentGroup = groupId;
  localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  const g = lastGroups.find((x) => x.id === groupId);
  if (g && g.data.classId !== currentClassId) {
    currentClassId = g.data.classId;
    localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
  }
  renderClassSwitch();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
}

function ensureCurrentGroupInClass() {
  if (!currentClassId || !classIds().includes(currentClassId)) {
    currentClassId = classIds()[0] || null;
    if (currentClassId) localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
  }
  const groups = currentClassId ? groupsOfClass(currentClassId) : lastGroups;
  if (groups.length && !groups.some((g) => g.id === currentGroup)) {
    currentGroup = groups[0].id;
    localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  } else if (!groupIds().includes(currentGroup) && lastGroups.length) {
    currentGroup = lastGroups[0].id;
    localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
    currentClassId = lastGroups[0].data.classId;
    localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
  }
}

// Міграція зі старої схеми (classes = leaf units group1/group2) на
// hierarchy classes → groups. Старі id груп зберігаються, щоб schedule
// і students.group лишилися сумісними.
async function migrateLegacyClassesToGroups(legacyClassDocs) {
  if (groupsSeeded) return;
  groupsSeeded = true;
  try {
    const parentRef = await addDoc(collection(db, "classes"), {
      name: "Основний",
      createdAt: Date.now(),
    });
    const batch = writeBatch(db);
    legacyClassDocs.forEach((d) => {
      batch.set(doc(db, "groups", d.id), {
        classId: parentRef.id,
        name: d.data().name || d.id,
        createdAt: d.data().createdAt || Date.now(),
      });
      // Старі документи classes більше не є батьківськими — видаляємо
      // (батько вже створений вище). Не чіпаємо щойно створений parent.
      if (d.id !== parentRef.id) batch.delete(doc(db, "classes", d.id));
    });
    await batch.commit();
  } catch (e) {
    groupsSeeded = false;
    reportSaveError(e, "Не вдалося мігрувати класи в групи", "Failed to migrate classes to groups");
  }
}

async function seedDefaultClassAndGroups() {
  if (classesSeeded) return;
  classesSeeded = true;
  try {
    await setDoc(doc(db, "classes", "default-class"), {
      name: "Основний",
      createdAt: 1,
    });
    await setDoc(doc(db, "groups", "group1"), {
      classId: "default-class",
      name: "Група 1",
      createdAt: 1,
    });
    await setDoc(doc(db, "groups", "group2"), {
      classId: "default-class",
      name: "Група 2",
      createdAt: 2,
    });
  } catch (e) {
    classesSeeded = false;
    reportSaveError(e, "Не вдалося створити класи за замовчуванням", "Failed to create default classes");
  }
}

function listenToClasses() {
  const q = query(collection(db, "classes"), orderBy("createdAt"));
  unsubscribeClasses = onSnapshot(q, async (snap) => {
    lastClasses = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    // Порожня колекція — засіюємо (разом із групами) один раз.
    if (snap.empty && !classesSeeded) {
      await seedDefaultClassAndGroups();
      return;
    }
    ensureCurrentGroupInClass();
    renderClassSwitch();
    renderNewStudentGroupOptions();
    renderStudentsTable();
    renderSchedule();
    renderLessonsContainer();
    updateLiveStatus();
  });

  // Окремий слухач груп
  const gq = query(collection(db, "groups"), orderBy("createdAt"));
  unsubscribeGroups = onSnapshot(gq, async (snap) => {
    // Якщо груп ще немає, а класи вже є (стара схема) — мігруємо.
    if (snap.empty && !groupsSeeded && lastClasses.length > 0) {
      // Потрібні «сирі» docs класів; перечитаємо
      const classesSnap = await getDocs(query(collection(db, "classes"), orderBy("createdAt")));
      // Якщо classes містить лише щойно засіяний default-class без груп —
      // seedDefaultClassAndGroups уже мав створити групи; інакше legacy.
      const hasDefault = classesSnap.docs.some((d) => d.id === "default-class");
      if (!hasDefault || classesSnap.docs.length > 1) {
        await migrateLegacyClassesToGroups(classesSnap.docs.filter((d) => d.id !== "default-class" || classesSnap.docs.length === 1));
      } else if (!classesSeeded) {
        // default-class є, груп немає — досіюємо групи
        try {
          await setDoc(doc(db, "groups", "group1"), { classId: "default-class", name: "Група 1", createdAt: 1 });
          await setDoc(doc(db, "groups", "group2"), { classId: "default-class", name: "Група 2", createdAt: 2 });
        } catch (e) {
          reportSaveError(e, "Не вдалося створити групи за замовчуванням", "Failed to create default groups");
        }
      }
      return;
    }
    lastGroups = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    ensureCurrentGroupInClass();
    renderClassSwitch();
    renderNewStudentGroupOptions();
    renderStudentsTable();
    // scheduleData будується за group ids
    if (typeof scheduleData !== "undefined") {
      // rebuild will happen via listenToSchedule; just re-render
      renderSchedule();
      renderLessonsContainer();
      updateLiveStatus();
    }
  });
}

function renderClassSwitch() {
  const bar = document.getElementById("group-switch-bar-inner");
  if (!bar) return;
  bar.innerHTML = "";

  // Рівень 1: класи
  const classRow = document.createElement("div");
  classRow.className = "class-group-switch-row";
  const classLabel = document.createElement("span");
  classLabel.className = "group-switch-label";
  classLabel.textContent = t("groupSwitchLabel");
  classRow.appendChild(classLabel);

  const classBtns = document.createElement("div");
  classBtns.className = "group-switch";
  lastClasses.forEach(({ id, data }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-btn" + (id === currentClassId ? " active" : "");
    btn.textContent = data.name;
    btn.onclick = () => setCurrentClass(id);
    classBtns.appendChild(btn);
  });

  const addClassBtn = document.createElement("button");
  addClassBtn.className = "secondary small class-add-btn";
  addClassBtn.type = "button";
  addClassBtn.textContent = "+";
  addClassBtn.title = t("addClassBtn");
  addClassBtn.onclick = addClassFlow;
  classBtns.appendChild(addClassBtn);

  const deleteClassBtn = document.createElement("button");
  deleteClassBtn.className = "secondary small class-delete-btn";
  deleteClassBtn.type = "button";
  deleteClassBtn.textContent = "✕";
  deleteClassBtn.title = t("deleteClassBtn");
  deleteClassBtn.disabled = lastClasses.length <= 1;
  deleteClassBtn.onclick = () => deleteClassFlow(currentClassId);
  classBtns.appendChild(deleteClassBtn);
  classRow.appendChild(classBtns);
  bar.appendChild(classRow);

  // Рівень 2: групи вибраного класу
  const groupRow = document.createElement("div");
  groupRow.className = "class-group-switch-row";
  const groupLabel = document.createElement("span");
  groupLabel.className = "group-switch-label";
  groupLabel.textContent = t("groupSwitchSubLabel");
  groupRow.appendChild(groupLabel);

  const groupBtns = document.createElement("div");
  groupBtns.className = "group-switch";
  const groups = currentClassId ? groupsOfClass(currentClassId) : [];
  groups.forEach(({ id, data }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-btn" + (id === currentGroup ? " active" : "");
    btn.textContent = data.name;
    btn.onclick = () => setGroup(id);
    groupBtns.appendChild(btn);
  });

  const addGroupBtn = document.createElement("button");
  addGroupBtn.className = "secondary small class-add-btn";
  addGroupBtn.type = "button";
  addGroupBtn.textContent = "+";
  addGroupBtn.title = t("addGroupBtn");
  addGroupBtn.disabled = !currentClassId;
  addGroupBtn.onclick = addGroupFlow;
  groupBtns.appendChild(addGroupBtn);

  const deleteGroupBtn = document.createElement("button");
  deleteGroupBtn.className = "secondary small class-delete-btn";
  deleteGroupBtn.type = "button";
  deleteGroupBtn.textContent = "✕";
  deleteGroupBtn.title = t("deleteGroupBtn");
  deleteGroupBtn.disabled = groups.length <= 1;
  deleteGroupBtn.onclick = () => deleteGroupFlow(currentGroup);
  groupBtns.appendChild(deleteGroupBtn);
  groupRow.appendChild(groupBtns);
  bar.appendChild(groupRow);
}

async function addClassFlow() {
  const name = (prompt(t("newClassNamePrompt")) || "").trim();
  if (!name) return;
  try {
    const classRef = await addDoc(collection(db, "classes"), { name, createdAt: Date.now() });
    const groupRef = await addDoc(collection(db, "groups"), {
      classId: classRef.id,
      name: currentLang === "uk" ? "Група 1" : "Group 1",
      createdAt: Date.now(),
    });
    currentClassId = classRef.id;
    currentGroup = groupRef.id;
    localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
    localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  } catch (e) {
    reportSaveError(e, "Не вдалося додати клас", "Failed to add the class");
  }
}

async function addGroupFlow() {
  if (!currentClassId) return;
  const name = (prompt(t("newGroupNamePrompt")) || "").trim();
  if (!name) return;
  try {
    const ref = await addDoc(collection(db, "groups"), {
      classId: currentClassId,
      name,
      createdAt: Date.now(),
    });
    currentGroup = ref.id;
    localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
  } catch (e) {
    reportSaveError(e, "Не вдалося додати групу", "Failed to add the group");
  }
}

async function deleteGroupFlow(groupId) {
  const groups = currentClassId ? groupsOfClass(currentClassId) : lastGroups;
  if (groups.length <= 1) return;
  const grp = lastGroups.find((g) => g.id === groupId);
  if (!grp) return;
  if (!confirm(t("deleteGroupConfirm")(grp.data.name))) return;

  try {
    const fallback = groups.find((g) => g.id !== groupId);
    const fallbackId = fallback ? fallback.id : null;
    const studentsSnap = await getDocs(query(collection(db, "students"), where("group", "==", groupId)));
    const batch = writeBatch(db);
    studentsSnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { group: fallbackId });
    });
    batch.delete(doc(db, "groups", groupId));
    batch.update(doc(db, "schedule", "week"), { [groupId]: deleteField() });
    await batch.commit();
    if (currentGroup === groupId) {
      currentGroup = fallbackId || groupIds()[0] || "group1";
      localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
    }
  } catch (e) {
    reportSaveError(e, "Не вдалося видалити групу", "Failed to delete the group");
  }
}

// Видалення класу — двокроковий процес (підтвердження + код на пошту).
// Разом із класом видаляються всі його групи та їх розклади.
async function deleteClassFlow(classId) {
  if (!classId || lastClasses.length <= 1) return;
  const cls = lastClasses.find((c) => c.id === classId);
  if (!cls) return;

  if (!confirm(t("deleteClassConfirm")(cls.data.name))) return;

  const user = auth.currentUser;
  if (!user || !user.email) {
    alert(t("deleteClassNoEmail"));
    return;
  }

  const code = generateSixDigitCode();
  const requestRef = await addDoc(collection(db, "classDeletionRequests"), {
    classId,
    code,
    teacherUid: user.uid,
    teacherEmail: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  try {
    await addDoc(collection(db, "mail"), {
      to: [user.email],
      message: {
        subject: t("deleteClassEmailSubject"),
        text: t("deleteClassEmailBody")(code),
      },
    });
  } catch (e) {
    reportSaveError(e, "Не вдалося надіслати код підтвердження на пошту", "Failed to send the confirmation code by email");
    await deleteDoc(requestRef).catch(() => {});
    return;
  }

  const entered = (prompt(t("deleteClassEnterCodePrompt")) || "").trim();
  if (!entered) {
    await deleteDoc(requestRef).catch(() => {});
    return;
  }

  const freshSnap = await getDoc(requestRef);
  const reqData = freshSnap.exists() ? freshSnap.data() : null;

  if (!reqData || Date.now() > reqData.expiresAt) {
    alert(t("deleteClassCodeExpired"));
    await deleteDoc(requestRef).catch(() => {});
    return;
  }
  if (entered !== reqData.code) {
    alert(t("deleteClassCodeWrong"));
    await deleteDoc(requestRef).catch(() => {});
    return;
  }

  try {
    const classGroups = groupsOfClass(classId);
    const fallbackClass = lastClasses.find((c) => c.id !== classId);
    const fallbackGroups = fallbackClass ? groupsOfClass(fallbackClass.id) : [];
    const fallbackGroupId = fallbackGroups[0] ? fallbackGroups[0].id : null;

    const batch = writeBatch(db);
    for (const g of classGroups) {
      const studentsSnap = await getDocs(query(collection(db, "students"), where("group", "==", g.id)));
      studentsSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { group: fallbackGroupId });
      });
      batch.delete(doc(db, "groups", g.id));
      batch.update(doc(db, "schedule", "week"), { [g.id]: deleteField() });
    }
    batch.delete(doc(db, "classes", classId));
    await batch.commit();
    await deleteDoc(requestRef).catch(() => {});

    if (currentClassId === classId) {
      currentClassId = fallbackClass ? fallbackClass.id : classIds()[0] || null;
      if (currentClassId) localStorage.setItem(CLASS_STORAGE_KEY, currentClassId);
      currentGroup = fallbackGroupId || groupIds()[0] || "group1";
      localStorage.setItem(GROUP_STORAGE_KEY, currentGroup);
    }
  } catch (e) {
    reportSaveError(e, "Не вдалося видалити клас", "Failed to delete the class");
  }
}

// ---------- DOM refs ----------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const avatarEl = document.getElementById("avatar");
const greetingDateEl = document.getElementById("greeting-date");
const greetingSubtitleEl = document.getElementById("greeting-subtitle");
const quickAddLessonBtn = document.getElementById("quick-add-lesson-btn");
const statStudentsEl = document.getElementById("stat-students");
const statSubjectsEl = document.getElementById("stat-subjects");
const statLessonsTodayEl = document.getElementById("stat-lessons-today");
const statLinkedEl = document.getElementById("stat-linked");
const noStudentsMsg = document.getElementById("no-students-msg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");
const newStudentName = document.getElementById("new-student-name");
const newStudentGroup = document.getElementById("new-student-group");
const addStudentBtn = document.getElementById("add-student-btn");
const studentsTbody = document.getElementById("students-tbody");
const studentsSearchInput = document.getElementById("students-search-input");
const noStudentsSearchMsg = document.getElementById("no-students-search-msg");

const tabPointsBtn = document.getElementById("tab-points-btn");
const tabScheduleBtn = document.getElementById("tab-schedule-btn");
const tabTasksBtn = document.getElementById("tab-tasks-btn");
const pointsPanel = document.getElementById("points-panel");
const schedulePanel = document.getElementById("schedule-panel");
const tasksPanel = document.getElementById("tasks-panel");

const newSubjectName = document.getElementById("new-subject-name");
const newSubjectLink = document.getElementById("new-subject-link");
const addSubjectBtn = document.getElementById("add-subject-btn");
const subjectsList = document.getElementById("subjects-list");
const noSubjectsMsg = document.getElementById("no-subjects-msg");
const subjectsBody = document.getElementById("subjects-body");
const subjectsToggleBtn = document.getElementById("subjects-toggle-btn");

const scheduleDaysEl = document.getElementById("schedule-days");
const scheduleToggleBtn = document.getElementById("schedule-toggle-btn");
const joinMeetingCard = document.getElementById("join-meeting-card");
const joinMeetingWrap = document.getElementById("join-meeting-wrap");
const joinMeetingBtn = document.getElementById("join-meeting-btn");
const liveStatusCard = document.getElementById("live-status-card");
const liveStatusEl = document.getElementById("live-status");

// ---------- Згортання списку предметів ----------
let subjectsCollapsed = false;

function updateSubjectsToggleBtn() {
  if (!subjectsToggleBtn) return;
  subjectsToggleBtn.textContent = subjectsCollapsed ? t("subjectsExpandBtn") : t("subjectsCollapseBtn");
}

if (subjectsToggleBtn) {
  subjectsToggleBtn.onclick = () => {
    subjectsCollapsed = !subjectsCollapsed;
    if (subjectsBody) subjectsBody.classList.toggle("hidden", subjectsCollapsed);
    updateSubjectsToggleBtn();
  };
  updateSubjectsToggleBtn();
}

if (scheduleToggleBtn) {
  scheduleToggleBtn.onclick = async () => {
    const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
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
let studentsSearchQuery = "";
let studentsSortMode = localStorage.getItem("schooleballs-students-sort") || "name";

// ---------- Tabs ----------
// ---------- Dashboard header (привітання, дата, показники) ----------
function updateGreetingDate() {
  if (!greetingDateEl) return;
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  const text = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  greetingDateEl.textContent = text.charAt(0).toUpperCase() + text.slice(1);
}

function updateAvatar(user) {
  if (!avatarEl || !user) return;
  const source = user.email || "?";
  avatarEl.textContent = source.charAt(0).toUpperCase();
  avatarEl.title = user.email || "";
}

function updateDashboardStats() {
  if (statStudentsEl) statStudentsEl.textContent = String(lastStudents.length);
  if (statSubjectsEl) statSubjectsEl.textContent = String(lastSubjects.length);

  const todayStr = formatDateLocal(new Date());
  const lessonsToday = lastLessons.filter((l) => l.data.lessonDate === todayStr).length;
  if (statLessonsTodayEl) statLessonsTodayEl.textContent = String(lessonsToday);
  if (greetingSubtitleEl) greetingSubtitleEl.textContent = t("greetingSubtitle")(lessonsToday);

  const linkedCount = lastStudents.filter((s) => !!s.data.authUid).length;
  if (statLinkedEl) statLinkedEl.textContent = `${linkedCount}/${lastStudents.length}`;
}

if (quickAddLessonBtn) {
  quickAddLessonBtn.onclick = () => {
    showTab("tasks");
    const titleInput = document.getElementById("new-lesson-title");
    if (titleInput) titleInput.focus();
  };
}

// ---------- Tabs ----------
function showTab(tab) {
  tabPointsBtn.classList.toggle("active", tab === "points");
  tabScheduleBtn.classList.toggle("active", tab === "schedule");
  tabTasksBtn.classList.toggle("active", tab === "tasks");
  pointsPanel.classList.toggle("hidden", tab !== "points");
  schedulePanel.classList.toggle("hidden", tab !== "schedule");
  tasksPanel.classList.toggle("hidden", tab !== "tasks");
}
tabPointsBtn.onclick = () => showTab("points");
tabScheduleBtn.onclick = () => showTab("schedule");
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
  updateAvatar(user);
  updateGreetingDate();
  listenToClasses();
  listenToStudents();
  listenToSubjects();
  listenToSchedule();
  listenToLessons();
});

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (unsubscribeClasses) unsubscribeClasses();
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

if (studentsSearchInput) {
  studentsSearchInput.oninput = () => {
    studentsSearchQuery = studentsSearchInput.value.trim().toLowerCase();
    renderStudentsTable();
  };
}
const studentsSortSelect = document.getElementById("students-sort-select");
if (studentsSortSelect) {
  studentsSortSelect.value = studentsSortMode;
  studentsSortSelect.onchange = () => {
    studentsSortMode = studentsSortSelect.value || "name";
    localStorage.setItem("schooleballs-students-sort", studentsSortMode);
    renderStudentsTable();
  };
}

function sortStudentsList(list) {
  const locale = currentLang === "uk" ? "uk" : "en";
  const arr = list.slice();
  if (studentsSortMode === "points") {
    arr.sort((a, b) => (b.data.points || 0) - (a.data.points || 0) || (a.data.name || "").localeCompare(b.data.name || "", locale));
  } else if (studentsSortMode === "linked") {
    arr.sort((a, b) => {
      const la = a.data.authUid ? 0 : 1;
      const lb = b.data.authUid ? 0 : 1;
      return la - lb || (a.data.name || "").localeCompare(b.data.name || "", locale);
    });
  } else if (studentsSortMode === "group") {
    arr.sort((a, b) => getGroupLabel(a.data.group).localeCompare(getGroupLabel(b.data.group), locale) || (a.data.name || "").localeCompare(b.data.name || "", locale));
  } else {
    arr.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", locale));
  }
  return arr;
}

function renderStudentsTable() {
  studentsTbody.innerHTML = "";
  let filtered = studentsSearchQuery
    ? lastStudents.filter(({ data }) => (data.name || "").toLowerCase().includes(studentsSearchQuery))
    : lastStudents.slice();
  filtered = sortStudentsList(filtered);
  filtered.forEach(({ id, data }) => {
    studentsTbody.appendChild(renderStudentRow(id, data));
  });
  if (noStudentsMsg) noStudentsMsg.classList.toggle("hidden", lastStudents.length > 0);
  if (noStudentsSearchMsg) {
    noStudentsSearchMsg.classList.toggle("hidden", !(lastStudents.length > 0 && filtered.length === 0));
  }
  updateDashboardStats();
}

addStudentBtn.onclick = async () => {
  const name = newStudentName.value.trim();
  if (!name) return;
  await addDoc(collection(db, "students"), {
    name,
    points: 0,
    group: newStudentGroup && newStudentGroup.value ? newStudentGroup.value : (groupIds()[0] || currentGroup || "group1"),
    inviteCode: generateInviteCode(),
    authUid: null,
    createdAt: Date.now(),
  });
  newStudentName.value = "";
};

// Перебудовує список класів у селекті форми "Додати учня".
function renderNewStudentGroupOptions() {
  if (!newStudentGroup) return;
  const prevValue = newStudentGroup.value;
  const options = [];
  lastClasses.forEach((cls) => {
    groupsOfClass(cls.id).forEach((g) => {
      options.push({ id: g.id, label: `${cls.data.name} / ${g.data.name}` });
    });
  });
  // fallback: groups without known class
  lastGroups.forEach((g) => {
    if (!options.some((o) => o.id === g.id)) {
      options.push({ id: g.id, label: getGroupLabel(g.id) });
    }
  });
  newStudentGroup.innerHTML = options
    .map(({ id, label }) => `<option value="${id}">${escapeHtml(label)}</option>`)
    .join("");
  if (options.some((o) => o.id === prevValue)) newStudentGroup.value = prevValue;
  else if (options.some((o) => o.id === currentGroup)) newStudentGroup.value = currentGroup;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function renderStudentRow(id, data) {
  const row = document.createElement("div");
  row.className = "student-row";

  // Аватар з першою літерою імені
  const avatar = document.createElement("span");
  avatar.className = "student-avatar";
  avatar.textContent = (data.name || "?").trim().charAt(0).toUpperCase() || "?";

  // Ім'я + бейдж прив'язки
  const identity = document.createElement("div");
  identity.className = "student-identity";

  const nameEl = document.createElement("span");
  nameEl.className = "student-name";
  nameEl.textContent = data.name;

  const linkedBadge = document.createElement("span");
  if (data.authUid) {
    linkedBadge.textContent = t("linked");
    linkedBadge.className = "linked-badge linked";
  } else {
    linkedBadge.textContent = t("notLinked");
    linkedBadge.className = "linked-badge not-linked";
  }

  const codeChip = document.createElement("code");
  codeChip.className = "invite-code";
  codeChip.textContent = data.inviteCode || "—";

  const groupSelect = document.createElement("select");
  groupSelect.className = "student-group-select";
  const groupOptions = [];
  lastClasses.forEach((cls) => {
    groupsOfClass(cls.id).forEach((g) => {
      groupOptions.push({ id: g.id, label: `${cls.data.name} / ${g.data.name}` });
    });
  });
  lastGroups.forEach((g) => {
    if (!groupOptions.some((o) => o.id === g.id)) {
      groupOptions.push({ id: g.id, label: getGroupLabel(g.id) });
    }
  });
  groupSelect.innerHTML = groupOptions
    .map(({ id: gid, label }) => `<option value="${gid}">${escapeHtml(label)}</option>`)
    .join("");
  if (groupOptions.some((o) => o.id === data.group)) groupSelect.value = data.group;
  groupSelect.onchange = () => {
    updateDoc(doc(db, "students", id), { group: groupSelect.value }).catch((e) =>
      reportSaveError(e, "Не вдалося змінити групу", "Failed to change the group")
    );
  };

  const metaRow = document.createElement("div");
  metaRow.className = "student-meta";
  metaRow.append(linkedBadge, groupSelect, codeChip);

  identity.append(nameEl, metaRow);

  // Бали
  const pointsBlock = document.createElement("div");
  pointsBlock.className = "student-points-block";
  const pointsValue = document.createElement("span");
  pointsValue.className = "points";
  pointsValue.textContent = data.points ?? 0;
  const pointsCaption = document.createElement("span");
  pointsCaption.className = "points-caption";
  pointsCaption.textContent = t("pointsLabel");
  pointsBlock.append(pointsValue, pointsCaption);

  // Контроли зміни балів
  const controls = document.createElement("div");
  controls.className = "point-controls";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.textContent = "-1";
  minusBtn.onclick = () => changePoints(id, data.points, -1);

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.textContent = "+1";
  plusBtn.onclick = () => changePoints(id, data.points, +1);

  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.placeholder = "±N";

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "secondary";
  applyBtn.textContent = "OK";
  applyBtn.onclick = () => {
    const delta = parseInt(customInput.value, 10);
    if (!isNaN(delta)) {
      changePoints(id, data.points, delta);
      customInput.value = "";
    }
  };

  controls.append(minusBtn, plusBtn, customInput, applyBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "student-delete-btn";
  deleteBtn.setAttribute("aria-label", t("deleteBtn"));
  deleteBtn.title = t("deleteBtn");
  deleteBtn.textContent = "✕";
  deleteBtn.onclick = () => {
    if (confirm(t("deleteConfirm")(data.name))) deleteDoc(doc(db, "students", id));
  };

  row.append(avatar, identity, pointsBlock, controls, deleteBtn);
  return row;
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
    updateDashboardStats();
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

    const topRow = document.createElement("div");
    topRow.className = "subject-item-top";

    const nameSpan = document.createElement("span");
    nameSpan.className = "subject-item-name";
    nameSpan.textContent = data.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = t("deleteBtn");
    deleteBtn.className = "secondary small";
    deleteBtn.onclick = () => {
      if (confirm(t("deleteSubjectConfirm")(data.name))) deleteDoc(doc(db, "subjects", id));
    };

    topRow.append(nameSpan, deleteBtn);

    const linkInput = document.createElement("input");
    linkInput.type = "url";
    linkInput.className = "subject-item-link";
    linkInput.placeholder = t("subjectLinkPlaceholder");
    linkInput.value = data.meetingLink || "";
    linkInput.onblur = async () => {
      const newLink = linkInput.value.trim();
      if (newLink === (data.meetingLink || "")) return;
      try {
        await updateDoc(doc(db, "subjects", id), { meetingLink: newLink });
      } catch (e) {
        reportSaveError(e, "Не вдалося зберегти посилання", "Failed to save the link");
      }
    };

    li.append(topRow, linkInput);
    subjectsList.appendChild(li);
  });
  noSubjectsMsg.classList.toggle("hidden", lastSubjects.length > 0);
}

addSubjectBtn.onclick = async () => {
  const name = newSubjectName.value.trim();
  if (!name) return;
  const meetingLink = newSubjectLink.value.trim();
  try {
    await addDoc(collection(db, "subjects"), { name, meetingLink, createdAt: Date.now() });
    newSubjectName.value = "";
    newSubjectLink.value = "";
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

// ---------- Schedule (розклад) ----------
function listenToSchedule() {
  unsubscribeSchedule = onSnapshot(doc(db, "schedule", "week"), (snap) => {
    const raw = snap.exists() ? snap.data() : {};
    scheduleData = buildScheduleData(raw, groupIds().length ? groupIds() : classIds());
    renderSchedule();
    renderLessonsContainer();
    updateLiveStatus();
  });
}

function renderSchedule() {
  scheduleDaysEl.innerHTML = "";

  const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
  const applied = !!groupSchedule.applied;

  if (scheduleToggleBtn) {
    scheduleToggleBtn.textContent = applied ? t("scheduleEditBtn") : t("scheduleApplyBtn");
    scheduleToggleBtn.classList.toggle("secondary", applied);
  }

  // У прийнятому розкладі показуємо лише дні (стовпці), де є хоча б один урок.
  const visibleDays = applied
    ? WEEKDAYS.filter((d) => getDayMaxPeriodIndex(groupSchedule[d]) >= 0)
    : WEEKDAYS;

  const overallMaxIndex = Math.max(-1, ...visibleDays.map((d) => getDayMaxPeriodIndex(groupSchedule[d])));
  // У режимі редагування лишаємо ще один порожній рядок для додавання нового уроку;
  // у прийнятому розкладі зайвих рядків не показуємо.
  const rowCount = applied ? overallMaxIndex + 1 : overallMaxIndex + 2;

  if (applied && rowCount <= 0) {
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
      const dayMap = groupSchedule[dayKey] || {};
      const entry = dayMap[r];
      const td = document.createElement("td");
      td.className = "schedule-table-cell";

      if (entry) {
        if (applied) {
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
        } else {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = getSubjectName(entry.subjectId);

          const removeBtn = document.createElement("button");
          removeBtn.className = "chip-remove";
          removeBtn.textContent = "×";
          removeBtn.onclick = async () => {
            try {
              // Видаляємо запис лише цієї конкретної клітинки (день+номер уроку),
              // тому решта уроків дня залишаються на своїх місцях, без зсуву.
              await updateDoc(doc(db, "schedule", "week"), {
                [`${currentGroup}.${dayKey}.${r}`]: deleteField(),
              });
            } catch (e) {
              reportSaveError(e, "Не вдалося оновити розклад", "Failed to update the schedule");
            }
          };

          chip.appendChild(removeBtn);
          td.appendChild(chip);
        }
      } else if (applied) {
        td.classList.add("schedule-table-empty");
        td.textContent = "–";
      } else {
        // Порожня клітинка в режимі редагування — можна додати урок саме сюди,
        // на цей конкретний номер уроку цього дня.
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
              { [currentGroup]: { [dayKey]: { [r]: newEntry } } },
              { merge: true }
            );
          } catch (e) {
            reportSaveError(e, "Не вдалося оновити розклад. Перевірте правила Firestore для колекції schedule", "Failed to update the schedule. Check Firestore Rules for the schedule collection");
          }
        };

        addWrap.append(select, addBtn);
        td.appendChild(addWrap);
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

  scheduleDaysEl.appendChild(renderDayTimesEditor(groupSchedule, Math.max(rowCount, 1)));
}

// ---------- Особливий розклад дзвінків для конкретного дня (напр. субота) ----------
let dayTimesEditorDay = "sat";
let dayTimesCollapsed = localStorage.getItem("schooleballs-daytimes-collapsed") === "1";

function renderDayTimesEditor(groupSchedule, rowCount) {
  const box = document.createElement("section");
  box.className = "card day-times-editor";

  const header = document.createElement("div");
  header.className = "day-times-header";

  const heading = document.createElement("h3");
  heading.textContent = t("dayTimesHeading");

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "secondary small";
  collapseBtn.textContent = dayTimesCollapsed ? t("dayTimesExpandBtn") : t("dayTimesCollapseBtn");

  const body = document.createElement("div");
  body.className = "day-times-body" + (dayTimesCollapsed ? " hidden" : "");

  collapseBtn.onclick = () => {
    dayTimesCollapsed = !dayTimesCollapsed;
    localStorage.setItem("schooleballs-daytimes-collapsed", dayTimesCollapsed ? "1" : "0");
    body.classList.toggle("hidden", dayTimesCollapsed);
    collapseBtn.textContent = dayTimesCollapsed ? t("dayTimesExpandBtn") : t("dayTimesCollapseBtn");
  };

  header.append(heading, collapseBtn);
  box.appendChild(header);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t("dayTimesHint");
  body.appendChild(hint);

  const controlsRow = document.createElement("div");
  controlsRow.className = "day-times-controls";

  const daySelect = document.createElement("select");
  WEEKDAYS.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = t("weekdays")[d];
    if (d === dayTimesEditorDay) opt.selected = true;
    daySelect.appendChild(opt);
  });
  daySelect.onchange = () => {
    dayTimesEditorDay = daySelect.value;
    renderSchedule();
  };
  controlsRow.appendChild(daySelect);

  const dayKey = dayTimesEditorDay;
  const hasCustom = !!(groupSchedule.dayTimes && groupSchedule.dayTimes[dayKey] && Object.keys(groupSchedule.dayTimes[dayKey]).length > 0);

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "day-times-toggle";
  const toggleCheckbox = document.createElement("input");
  toggleCheckbox.type = "checkbox";
  toggleCheckbox.checked = hasCustom;
  toggleCheckbox.onchange = async () => {
    try {
      if (toggleCheckbox.checked) {
        const defaults = groupSchedule.times || {};
        const seeded = {};
        for (let r = 0; r < rowCount; r++) {
          const t0 = defaults[r] || defaults[String(r)] || {};
          seeded[r] = { start: t0.start || null, end: t0.end || null };
        }
        await setDoc(doc(db, "schedule", "week"), { [currentGroup]: { dayTimes: { [dayKey]: seeded } } }, { merge: true });
      } else {
        await updateDoc(doc(db, "schedule", "week"), { [`${currentGroup}.dayTimes.${dayKey}`]: deleteField() });
      }
    } catch (e) {
      reportSaveError(e, "Не вдалося оновити розклад дзвінків", "Failed to update the bell schedule");
    }
  };
  const toggleText = document.createElement("span");
  toggleText.textContent = t("dayTimesToggleLabel");
  toggleLabel.append(toggleCheckbox, toggleText);
  controlsRow.appendChild(toggleLabel);

  body.appendChild(controlsRow);

  if (hasCustom) {
    const grid = document.createElement("div");
    grid.className = "day-times-grid";
    const dayTimesMap = groupSchedule.dayTimes[dayKey] || {};
    for (let r = 0; r < rowCount; r++) {
      const saved = dayTimesMap[r] || dayTimesMap[String(r)] || {};
      const row = document.createElement("div");
      row.className = "day-times-row";

      const label = document.createElement("span");
      label.className = "day-times-row-label";
      label.textContent = String(r + 1);
      row.appendChild(label);

      const startInput = document.createElement("input");
      startInput.type = "time";
      startInput.value = saved.start || "";
      startInput.onblur = async () => {
        const val = startInput.value || null;
        if (val === (saved.start || null)) return;
        try {
          await setDoc(doc(db, "schedule", "week"), { [currentGroup]: { dayTimes: { [dayKey]: { [r]: { start: val } } } } }, { merge: true });
        } catch (e) {
          reportSaveError(e, "Не вдалося зберегти час", "Failed to save the time");
        }
      };

      const endInput = document.createElement("input");
      endInput.type = "time";
      endInput.value = saved.end || "";
      endInput.onblur = async () => {
        const val = endInput.value || null;
        if (val === (saved.end || null)) return;
        try {
          await setDoc(doc(db, "schedule", "week"), { [currentGroup]: { dayTimes: { [dayKey]: { [r]: { end: val } } } } }, { merge: true });
        } catch (e) {
          reportSaveError(e, "Не вдалося зберегти час", "Failed to save the time");
        }
      };

      row.append(startInput, endInput);
      grid.appendChild(row);
    }
    body.appendChild(grid);
  }

  box.appendChild(body);
  return box;
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

// ---------- Кнопка приєднання до зустрічі (Zoom/Meet) ----------
// Показує кнопку лише тоді, коли зараз реально йде урок і в його предмета
// є збережене посилання на зустріч.
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

// ---------- Live status (зараз урок / перерва) ----------
function updateLiveStatus() {
  if (!liveStatusEl) return;

  const now = new Date();
  const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
  const weekdayKey = WEEKDAY_BY_JS_INDEX[now.getDay()];
  const dayEntries = groupSchedule[weekdayKey] || {};
  const periodTimes = getDayEffectiveTimes(groupSchedule, weekdayKey);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const maxPeriodIndex = Math.max(
    0,
    ...WEEKDAYS.map((d) => getDayMaxPeriodIndex(groupSchedule[d]) + 1),
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

// ---------- Lessons (уроки) ----------
function listenToLessons() {
  const q = query(collection(db, "lessons"), orderBy("createdAt", "desc"));
  unsubscribeLessons = onSnapshot(q, (snap) => {
    lastLessons = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    renderLessonsContainer();
    updateDashboardStats();
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
  const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
  const dayEntries = getDayEntriesList(groupSchedule, weekdayKey);

  if (dayEntries.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("noScheduleForDay");
    lessonsContainer.appendChild(hint);
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
