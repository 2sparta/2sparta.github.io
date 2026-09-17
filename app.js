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
  initThemeToggle,
} from "./common.js";

// Тема (світла/темна) застосовується одразу, до будь-якого рендеру,
// щоб уникнути "блимання" світлою темою при завантаженні.
initThemeToggle();

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
    tabPoints: "Учні",
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
    starostaLabel: "Староста",
    starostaTitle: "Староста може додавати домашні завдання з предметів, де це дозволено",
    studentsCanAddHwLabel: "Учні можуть самі записувати ДЗ",
    studentsCanAddHwTitle: "Староста зможе додавати домашні завдання з цього предмета",
    addedByStarostaBadge: "Від старости",

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
    studentClassPlaceholder: "Клас",
    studentGroupPlaceholder: "Група",
    selectClassFirst: "Спочатку оберіть клас",
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
    copyScheduleBtnTitle: "Копіювати розклад",
    pasteScheduleBtnTitle: "Вставити розклад",
    pasteScheduleBtnTitleWithSource: (from) => `Вставити розклад (з: ${from})`,
    pasteScheduleConfirm: (from, to) => `Вставити розклад з "${from}" у "${to}"? Поточний розклад дзвінків і уроків у "${to}" буде замінено.`,
    copyScheduleDone: (from) => `Розклад "${from}" скопійовано. Перейдіть до потрібного класу/групи і натисніть "Вставити".`,
    pasteScheduleDone: "Розклад вставлено.",
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
    assignClassesLabel: "Призначити класам",
    assignClassesHint: "Якщо нічого не вибрано — урок бачать усі класи. Можна обрати кілька.",
    classSearchPlaceholder: "Пошук класу...",
    noClassesForAssign: "Класів ще немає.",
    allClassesLabel: "Усі класи",
    scheduledPublishLabel: "Запланувати (з'явиться учням з)",
    scheduledPublishHint: "Залиште порожнім, щоб урок був видно одразу. Інакше учні побачать його лише після вказаного часу.",
    scheduledBadge: "Заплановано",
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

    tabGrades: "Оцінки",
    gradesBtn: "Оцінки",
    gradesPanelHeading: "Оцінки за завдання",
    gradesPanelHint: "Виставте оцінку (1–12) для кожного учня. Можна окремо за урок і за ДЗ. Порожнє поле — оцінки ще немає.",
    gradeInputPlaceholder: "—",
    gradeSavedHint: "Збережено",
    noStudentsForGrades: "Немає учнів для оцінювання (перевірте призначені класи).",
    gradeTypeLesson: "Урок",
    gradeTypeHomework: "ДЗ",
    teacherGradesHeading: "Оцінки учнів",
    teacherGradesHint: "Оберіть учня, щоб переглянути всі його оцінки за предметами та датами.",
    teacherGradesSelectStudent: "Учень",
    teacherGradesSelectPlaceholder: "Оберіть учня...",
    noGradesMsg: "Оцінок ще немає.",
    gradesAverageLabel: "Середній бал",
    gradesTableSubjectHeader: "Предмет",
    gradesOverallAvg: "Загальний середній",
    gradesCountLabel: "Усього оцінок",
    gradesBestSubject: "Найкращий предмет",
    gradesTrendLabel: "Тренд",
    gradesChartBySubject: "Середній бал за предметами",
    gradesChartTrend: "Динаміка оцінок",
    gradesChartEmpty: "Недостатньо даних для графіка.",
    gradesTrendUp: "Покращення",
    gradesTrendDown: "Погіршення",
    gradesTrendStable: "Стабільно",
    gradesTrendNone: "Немає даних",
    gradesOfMax: "з 12",
    gradesLegendLesson: "Урок",
    gradesLegendHw: "ДЗ",

    tabSelfGov: "Самоврядування",
    selfGovHeading: "Самоврядування",
    selfGovTeacherHint: "Оголосіть вибори старости для поточного класу. До початку виборів учні можуть подати кандидатуру; після початку — голосувати. Після завершення переможець стає старостою автоматично.",
    selfGovAnnounceHeading: "Оголосити вибори",
    selfGovStartLabel: "Початок виборів",
    selfGovEndLabel: "Завершення виборів",
    selfGovAnnounceBtn: "Оголосити вибори",
    selfGovCloseBtn: "Завершити вибори зараз",
    selfGovHistoryHeading: "Історія виборів / старост",
    selfGovNoHistory: "Історії ще немає.",
    selfGovPhaseCandidacy: "Подача кандидатур",
    selfGovPhaseVoting: "Голосування",
    selfGovPhaseClosed: "Завершені",
    selfGovNoActive: "Немає активних виборів для цього класу.",
    selfGovNeedDates: "Вкажіть дату початку і завершення виборів.",
    selfGovStartBeforeEnd: "Дата початку має бути раніше дати завершення.",
    selfGovAnnounced: "Вибори оголошено.",
    selfGovAlreadyActive: "Для цього класу вже є незавершені вибори.",
    selfGovCandidates: "Кандидати",
    selfGovVotes: "голосів",
    selfGovNoCandidates: "Кандидатів ще немає.",
    selfGovWinner: "Переможець",
    selfGovClosedDone: "Вибори завершено. Старосту оновлено.",
    selfGovUntilNow: "досі",
    selfGovFrom: "з",
    selfGovTo: "по",
    selfGovProgress: "Прогрес голосування",
    selfGovTotalVotes: "Усього голосів",
    messagesTitle: "Повідомлення",
    messagesEmpty: "Повідомлень ще немає.",
    messagesComposeHeading: "Написати учню",
    messagesSelectStudent: "Оберіть учня...",
    messagesComposePlaceholder: "Текст повідомлення...",
    messagesSendBtn: "Надіслати",
    messagesSent: "Повідомлення надіслано.",
    messagesNeedRecipient: "Оберіть учня з прив'язаним акаунтом.",
    messagesNeedText: "Введіть текст повідомлення.",
    messagesMarkAllRead: "Позначити всі прочитаними",
    notifNewGrade: (value, subject, typeLabel) => `Нова оцінка: ${value} — ${subject} (${typeLabel})`,
    notifGradeComment: "Коментар учителя",
    notifNewHomework: (subject, title) => `Нове ДЗ: ${subject}${title ? " — " + title : ""}`,
    notifNewLesson: (subject, title) => `Новий урок: ${subject}${title ? " — " + title : ""}`,
    notifElectionAnnounced: "Оголошено вибори старости",
    notifElectionResult: (name) => `Новий староста: ${name}`,
    notifAnnouncement: "Повідомлення від учителя",
    gradeCommentPlaceholder: "Коментар (необов'язково)",
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
    tabPoints: "Students",
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
    starostaLabel: "Class monitor",
    starostaTitle: "The class monitor can add homework for subjects where this is allowed",
    studentsCanAddHwLabel: "Students can write homework themselves",
    studentsCanAddHwTitle: "The class monitor will be able to add homework for this subject",
    addedByStarostaBadge: "By class monitor",

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
    studentClassPlaceholder: "Class",
    studentGroupPlaceholder: "Group",
    selectClassFirst: "Select a class first",
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
    copyScheduleBtnTitle: "Copy schedule",
    pasteScheduleBtnTitle: "Paste schedule",
    pasteScheduleBtnTitleWithSource: (from) => `Paste schedule (from: ${from})`,
    pasteScheduleConfirm: (from, to) => `Paste the schedule from "${from}" into "${to}"? The current bell schedule and lessons in "${to}" will be replaced.`,
    copyScheduleDone: (from) => `Schedule "${from}" copied. Switch to the target class/group and press "Paste".`,
    pasteScheduleDone: "Schedule pasted.",
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
    assignClassesLabel: "Assign to classes",
    assignClassesHint: "If nothing is selected — the lesson is visible to all classes. You can pick several.",
    classSearchPlaceholder: "Search class...",
    noClassesForAssign: "No classes yet.",
    allClassesLabel: "All classes",
    scheduledPublishLabel: "Schedule (visible to students from)",
    scheduledPublishHint: "Leave empty to make the lesson visible immediately. Otherwise students will see it only after the chosen time.",
    scheduledBadge: "Scheduled",
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

    tabGrades: "Grades",
    gradesBtn: "Grades",
    gradesPanelHeading: "Grades for this assignment",
    gradesPanelHint: "Enter a grade (1–12) for each student. You can grade the lesson and homework separately. An empty field means no grade yet.",
    gradeInputPlaceholder: "—",
    gradeSavedHint: "Saved",
    noStudentsForGrades: "No students to grade (check the assigned classes).",
    gradeTypeLesson: "Lesson",
    gradeTypeHomework: "HW",
    teacherGradesHeading: "Student grades",
    teacherGradesHint: "Select a student to view all their grades by subject and date.",
    teacherGradesSelectStudent: "Student",
    teacherGradesSelectPlaceholder: "Choose a student...",
    noGradesMsg: "No grades yet.",
    gradesAverageLabel: "Average",
    gradesTableSubjectHeader: "Subject",
    gradesOverallAvg: "Overall average",
    gradesCountLabel: "Total grades",
    gradesBestSubject: "Best subject",
    gradesTrendLabel: "Trend",
    gradesChartBySubject: "Average by subject",
    gradesChartTrend: "Grade trend",
    gradesChartEmpty: "Not enough data for a chart.",
    gradesTrendUp: "Improving",
    gradesTrendDown: "Declining",
    gradesTrendStable: "Stable",
    gradesTrendNone: "No data",
    gradesOfMax: "of 12",
    gradesLegendLesson: "Lesson",
    gradesLegendHw: "HW",

    tabSelfGov: "Self-government",
    selfGovHeading: "Self-government",
    selfGovTeacherHint: "Announce class monitor elections for the current class. Before the start, students can apply as candidates; after the start they can vote. When elections end, the winner becomes class monitor automatically.",
    selfGovAnnounceHeading: "Announce elections",
    selfGovStartLabel: "Elections start",
    selfGovEndLabel: "Elections end",
    selfGovAnnounceBtn: "Announce elections",
    selfGovCloseBtn: "Close elections now",
    selfGovHistoryHeading: "Election / monitor history",
    selfGovNoHistory: "No history yet.",
    selfGovPhaseCandidacy: "Candidacy",
    selfGovPhaseVoting: "Voting",
    selfGovPhaseClosed: "Closed",
    selfGovNoActive: "No active elections for this class.",
    selfGovNeedDates: "Please set both start and end dates.",
    selfGovStartBeforeEnd: "Start date must be before end date.",
    selfGovAnnounced: "Elections announced.",
    selfGovAlreadyActive: "There are already open elections for this class.",
    selfGovCandidates: "Candidates",
    selfGovVotes: "votes",
    selfGovNoCandidates: "No candidates yet.",
    selfGovWinner: "Winner",
    selfGovClosedDone: "Elections closed. Class monitor updated.",
    selfGovUntilNow: "present",
    selfGovFrom: "from",
    selfGovTo: "to",
    selfGovProgress: "Voting progress",
    selfGovTotalVotes: "Total votes",
    messagesTitle: "Messages",
    messagesEmpty: "No messages yet.",
    messagesComposeHeading: "Message a student",
    messagesSelectStudent: "Select a student...",
    messagesComposePlaceholder: "Message text...",
    messagesSendBtn: "Send",
    messagesSent: "Message sent.",
    messagesNeedRecipient: "Select a linked student.",
    messagesNeedText: "Enter a message.",
    messagesMarkAllRead: "Mark all as read",
    notifNewGrade: (value, subject, typeLabel) => `New grade: ${value} — ${subject} (${typeLabel})`,
    notifGradeComment: "Teacher comment",
    notifNewHomework: (subject, title) => `New homework: ${subject}${title ? " — " + title : ""}`,
    notifNewLesson: (subject, title) => `New lesson: ${subject}${title ? " — " + title : ""}`,
    notifElectionAnnounced: "Class monitor elections announced",
    notifElectionResult: (name) => `New class monitor: ${name}`,
    notifAnnouncement: "Message from teacher",
    gradeCommentPlaceholder: "Comment (optional)",
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
  renderNewStudentClassOptions();
  renderStudentsTable();
  renderSubjectsList();
  renderSubjectSelects();
  renderLessonClassOptions();
  renderSchedule();
  renderLessonsContainer();
  updateLiveStatus();
  updateGreetingDate();
  updateDashboardStats();
  updateScheduleClipboardButtons();
  const sortSel = document.getElementById("students-sort-select");
  if (sortSel) sortSel.value = studentsSortMode;
  if (gradesPanelEl && !gradesPanelEl.classList.contains("hidden")) {
    renderTeacherGradesStudentSelect();
    renderTeacherGradesTable();
  }
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
  updateDashboardStats();
  if (selfgovPanelEl && !selfgovPanelEl.classList.contains("hidden")) renderSelfGovTeacher();
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
  updateDashboardStats();
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
    renderNewStudentClassOptions();
    renderLessonClassOptions();
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
    renderNewStudentClassOptions();
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
const newStudentClass = document.getElementById("new-student-class");
const newStudentGroup = document.getElementById("new-student-group");
const addStudentBtn = document.getElementById("add-student-btn");
const studentsTbody = document.getElementById("students-tbody");
const studentsSearchInput = document.getElementById("students-search-input");
const noStudentsSearchMsg = document.getElementById("no-students-search-msg");

const tabPointsBtn = document.getElementById("tab-points-btn");
const tabScheduleBtn = document.getElementById("tab-schedule-btn");
const tabTasksBtn = document.getElementById("tab-tasks-btn");
const tabGradesBtn = document.getElementById("tab-grades-btn");
const tabSelfGovBtn = document.getElementById("tab-selfgov-btn");
const pointsPanel = document.getElementById("points-panel");
const schedulePanel = document.getElementById("schedule-panel");
const tasksPanel = document.getElementById("tasks-panel");
const gradesPanelEl = document.getElementById("grades-panel");
const selfgovPanelEl = document.getElementById("selfgov-panel");
const teacherGradesStudentSelect = document.getElementById("teacher-grades-student-select");
const teacherGradesTableContainer = document.getElementById("teacher-grades-table-container");
const teacherNoGradesMsg = document.getElementById("teacher-no-grades-msg");
const teacherGradesAnalyticsEl = document.getElementById("teacher-grades-analytics");
const teacherGradesStatOverall = document.getElementById("teacher-grades-stat-overall");
const teacherGradesStatCount = document.getElementById("teacher-grades-stat-count");
const teacherGradesStatBest = document.getElementById("teacher-grades-stat-best");
const teacherGradesStatTrend = document.getElementById("teacher-grades-stat-trend");
const teacherGradesChartBars = document.getElementById("teacher-grades-chart-bars");
const teacherGradesChartEmpty = document.getElementById("teacher-grades-chart-empty");
const teacherGradesChartTrend = document.getElementById("teacher-grades-chart-trend");
let teacherGradesSelectedStudentId = "";
const GRADE_SCALE_MAX = 12;

const newSubjectName = document.getElementById("new-subject-name");
const newSubjectLink = document.getElementById("new-subject-link");
const addSubjectBtn = document.getElementById("add-subject-btn");
const subjectsList = document.getElementById("subjects-list");
const noSubjectsMsg = document.getElementById("no-subjects-msg");
const subjectsBody = document.getElementById("subjects-body");
const subjectsToggleBtn = document.getElementById("subjects-toggle-btn");

const scheduleDaysEl = document.getElementById("schedule-days");
const scheduleToggleBtn = document.getElementById("schedule-toggle-btn");
const scheduleCopyBtn = document.getElementById("schedule-copy-btn");
const schedulePasteBtn = document.getElementById("schedule-paste-btn");
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

// ---------- Копіювати / вставити розклад між групами/класами ----------
// Буфер зберігається в localStorage, щоб не губився, якщо між копіюванням
// і вставкою сторінку перезавантажили (напр. на телефоні).
const SCHEDULE_CLIPBOARD_KEY = "schooleballs-schedule-clipboard";

function loadScheduleClipboard() {
  try {
    const raw = localStorage.getItem(SCHEDULE_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.days) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

let scheduleClipboard = loadScheduleClipboard();

function updateScheduleClipboardButtons() {
  if (scheduleCopyBtn) scheduleCopyBtn.title = t("copyScheduleBtnTitle");
  if (!schedulePasteBtn) return;
  schedulePasteBtn.disabled = !scheduleClipboard;
  schedulePasteBtn.title = scheduleClipboard
    ? t("pasteScheduleBtnTitleWithSource")(scheduleClipboard.sourceLabel)
    : t("pasteScheduleBtnTitle");
}

if (scheduleCopyBtn) {
  scheduleCopyBtn.onclick = () => {
    const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
    const days = {};
    WEEKDAYS.forEach((d) => {
      days[d] = groupSchedule[d] || {};
    });
    scheduleClipboard = {
      sourceGroupId: currentGroup,
      sourceLabel: getGroupLabel(currentGroup),
      days,
      times: groupSchedule.times || {},
      dayTimes: groupSchedule.dayTimes || {},
    };
    try {
      localStorage.setItem(SCHEDULE_CLIPBOARD_KEY, JSON.stringify(scheduleClipboard));
    } catch (e) {
      // localStorage може бути недоступний (приватний режим тощо) —
      // буфер тоді живе лише в пам'яті на час сесії, це не критично.
    }
    updateScheduleClipboardButtons();
    scheduleCopyBtn.classList.add("copied");
    setTimeout(() => scheduleCopyBtn.classList.remove("copied"), 900);
    alert(t("copyScheduleDone")(scheduleClipboard.sourceLabel));
  };
}

if (schedulePasteBtn) {
  schedulePasteBtn.onclick = async () => {
    if (!scheduleClipboard) return;
    const targetLabel = getGroupLabel(currentGroup);
    if (!confirm(t("pasteScheduleConfirm")(scheduleClipboard.sourceLabel, targetLabel))) return;
    const targetSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
    const newGroupData = {
      ...scheduleClipboard.days,
      times: scheduleClipboard.times || {},
      dayTimes: scheduleClipboard.dayTimes || {},
      applied: targetSchedule.applied,
      overrides: targetSchedule.overrides || {},
    };
    try {
      // mergeFields: [currentGroup] замінює весь піддокумент групи цілком
      // (а не глибоко зливає його поля), інакше старі уроки/періоди,
      // яких немає у скопійованому розкладі, лишились би висіти.
      await setDoc(
        doc(db, "schedule", "week"),
        { [currentGroup]: newGroupData },
        { mergeFields: [currentGroup] }
      );
      alert(t("pasteScheduleDone"));
    } catch (e) {
      reportSaveError(e, "Не вдалося вставити розклад", "Failed to paste the schedule");
    }
  };
}

updateScheduleClipboardButtons();

const newLessonSubject = document.getElementById("new-lesson-subject");
const newLessonTitle = document.getElementById("new-lesson-title");
const newLessonContent = document.getElementById("new-lesson-content");
const newLessonDate = document.getElementById("new-lesson-date");
const newLessonHwDate = document.getElementById("new-lesson-hw-date");
const newLessonPublishAt = document.getElementById("new-lesson-publish-at");
const lessonClassSearch = document.getElementById("lesson-class-search");
const lessonClassOptions = document.getElementById("lesson-class-options");
const lessonClassSelected = document.getElementById("lesson-class-selected");
const addLessonBtn = document.getElementById("add-lesson-btn");
const lessonsContainer = document.getElementById("lessons-container");
const noLessonsMsg = document.getElementById("no-lessons-msg");

// Вибрані класи для нового уроку (мультивибір)
let selectedLessonClassIds = new Set();

const viewTodayBtn = document.getElementById("view-today-btn");
const viewTomorrowBtn = document.getElementById("view-tomorrow-btn");
const viewAllBtn = document.getElementById("view-all-btn");
const typeLessonsBtn = document.getElementById("type-lessons-btn");
const typeHomeworkBtn = document.getElementById("type-homework-btn");

// Стан розгортання (щоб не губився при перемальовуванні через onSnapshot)
const expandedLessons = new Set();
const expandedSubjectGroups = new Set();
const expandedGradePanels = new Set(); // id уроків, для яких зараз відкрита панель оцінок

let unsubscribeStudents = null;
let unsubscribeLessons = null;
let unsubscribeSubjects = null;
let unsubscribeSchedule = null;
let unsubscribeGrades = null;
let liveStatusInterval = null;

// Кешуємо останні дані зі Firestore
let lastStudents = []; // [{id, data}]
let lastLessons = []; // [{id, data}]
let lastSubjects = []; // [{id, data}]
let lastGrades = []; // [{id, data:{lessonId, studentId, subjectId, value, date, type?}}]
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

function countScheduleLessonsToday() {
  // Кількість уроків у розкладі поточної групи на сьогодні (те, що відкрито в "Розклад").
  const groupSchedule = scheduleData[currentGroup] || emptyGroupSchedule();
  const weekdayKey = WEEKDAY_BY_JS_INDEX[new Date().getDay()];
  return getDayEntriesList(groupSchedule, weekdayKey).length;
}

function updateDashboardStats() {
  if (statStudentsEl) statStudentsEl.textContent = String(lastStudents.length);
  if (statSubjectsEl) statSubjectsEl.textContent = String(lastSubjects.length);

  const scheduleToday = countScheduleLessonsToday();
  if (statLessonsTodayEl) statLessonsTodayEl.textContent = String(scheduleToday);
  if (greetingSubtitleEl) greetingSubtitleEl.textContent = t("greetingSubtitle")(scheduleToday);

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
  if (tabGradesBtn) tabGradesBtn.classList.toggle("active", tab === "grades");
  if (tabSelfGovBtn) tabSelfGovBtn.classList.toggle("active", tab === "selfgov");
  pointsPanel.classList.toggle("hidden", tab !== "points");
  schedulePanel.classList.toggle("hidden", tab !== "schedule");
  tasksPanel.classList.toggle("hidden", tab !== "tasks");
  if (gradesPanelEl) gradesPanelEl.classList.toggle("hidden", tab !== "grades");
  if (selfgovPanelEl) selfgovPanelEl.classList.toggle("hidden", tab !== "selfgov");
  if (tab === "grades") {
    renderTeacherGradesStudentSelect();
    renderTeacherGradesTable();
  }
  if (tab === "selfgov") {
    renderSelfGovTeacher();
  }
}
tabPointsBtn.onclick = () => showTab("points");
tabScheduleBtn.onclick = () => showTab("schedule");
tabTasksBtn.onclick = () => showTab("tasks");
if (tabGradesBtn) tabGradesBtn.onclick = () => showTab("grades");
if (tabSelfGovBtn) tabSelfGovBtn.onclick = () => showTab("selfgov");

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
  listenToGrades();
  subscribeElectionsAndHistory();
  subscribeTeacherNotifications();
  showMessagesFab(true);
});

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (unsubscribeClasses) unsubscribeClasses();
  if (unsubscribeStudents) unsubscribeStudents();
  if (unsubscribeLessons) unsubscribeLessons();
  if (unsubscribeSubjects) unsubscribeSubjects();
  if (unsubscribeSchedule) unsubscribeSchedule();
  if (unsubscribeGrades) unsubscribeGrades();
  if (unsubscribeElections) { unsubscribeElections(); unsubscribeElections = null; }
  if (unsubscribeStarostaHistory) { unsubscribeStarostaHistory(); unsubscribeStarostaHistory = null; }
  if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    liveStatusInterval = null;
  }
  showMessagesFab(false);
  closeMessagesPanel();
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
  if (gradesPanelEl && !gradesPanelEl.classList.contains("hidden")) {
    renderTeacherGradesStudentSelect();
    renderTeacherGradesTable();
  }
}

addStudentBtn.onclick = async () => {
  const name = newStudentName.value.trim();
  if (!name) return;
  const groupId =
    newStudentGroup && newStudentGroup.value
      ? newStudentGroup.value
      : (groupIds()[0] || currentGroup || "group1");
  if (!groupId) return;
  await addDoc(collection(db, "students"), {
    name,
    points: 0,
    group: groupId,
    inviteCode: generateInviteCode(),
    authUid: null,
    createdAt: Date.now(),
  });
  newStudentName.value = "";
};

// Форма "Додати учня": спочатку клас, потім група цього класу.
function renderNewStudentClassOptions() {
  if (!newStudentClass) return;
  const prevClass = newStudentClass.value;
  newStudentClass.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = t("studentClassPlaceholder");
  ph.disabled = true;
  newStudentClass.appendChild(ph);

  lastClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = cls.data.name || cls.id;
    newStudentClass.appendChild(opt);
  });

  let pick = prevClass;
  if (!lastClasses.some((c) => c.id === pick)) {
    pick = currentClassId && lastClasses.some((c) => c.id === currentClassId)
      ? currentClassId
      : (lastClasses[0] ? lastClasses[0].id : "");
  }
  if (pick) newStudentClass.value = pick;
  else ph.selected = true;

  renderNewStudentGroupOptions();
}

function renderNewStudentGroupOptions() {
  if (!newStudentGroup) return;
  const prevGroup = newStudentGroup.value;
  const classId = newStudentClass ? newStudentClass.value : "";
  newStudentGroup.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = classId ? t("studentGroupPlaceholder") : t("selectClassFirst");
  ph.disabled = true;
  newStudentGroup.appendChild(ph);

  if (!classId) {
    ph.selected = true;
    newStudentGroup.disabled = true;
    return;
  }
  newStudentGroup.disabled = false;

  const groups = groupsOfClass(classId);
  groups.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.data.name || g.id;
    newStudentGroup.appendChild(opt);
  });

  let pick = prevGroup;
  if (!groups.some((g) => g.id === pick)) {
    pick = currentGroup && groups.some((g) => g.id === currentGroup)
      ? currentGroup
      : (groups[0] ? groups[0].id : "");
  }
  if (pick) newStudentGroup.value = pick;
  else ph.selected = true;
}

if (newStudentClass) {
  newStudentClass.onchange = () => renderNewStudentGroupOptions();
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

  // Клас → група (каскад): спочатку клас, потім групи цього класу
  const currentGroupObj = lastGroups.find((g) => g.id === data.group);
  const studentClassId = currentGroupObj ? currentGroupObj.data.classId : (currentClassId || (lastClasses[0] && lastClasses[0].id) || "");

  const classSelect = document.createElement("select");
  classSelect.className = "student-group-select student-class-select";
  classSelect.title = t("studentClassPlaceholder");
  lastClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = cls.data.name || cls.id;
    classSelect.appendChild(opt);
  });
  if (lastClasses.some((c) => c.id === studentClassId)) classSelect.value = studentClassId;

  const groupSelect = document.createElement("select");
  groupSelect.className = "student-group-select";
  groupSelect.title = t("studentGroupPlaceholder");

  function fillGroupSelect(classId, preferredGroupId) {
    groupSelect.innerHTML = "";
    const groups = groupsOfClass(classId);
    groups.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.data.name || g.id;
      groupSelect.appendChild(opt);
    });
    if (groups.some((g) => g.id === preferredGroupId)) groupSelect.value = preferredGroupId;
    else if (groups[0]) groupSelect.value = groups[0].id;
  }
  fillGroupSelect(classSelect.value, data.group);

  classSelect.onchange = () => {
    fillGroupSelect(classSelect.value, null);
    const gid = groupSelect.value;
    if (!gid) return;
    updateDoc(doc(db, "students", id), { group: gid }).catch((e) =>
      reportSaveError(e, "Не вдалося змінити клас/групу", "Failed to change class/group")
    );
  };
  groupSelect.onchange = () => {
    if (!groupSelect.value) return;
    updateDoc(doc(db, "students", id), { group: groupSelect.value }).catch((e) =>
      reportSaveError(e, "Не вдалося змінити групу", "Failed to change the group")
    );
  };

  const starostaLabel = document.createElement("label");
  starostaLabel.className = "starosta-toggle";
  starostaLabel.title = t("starostaTitle");
  const starostaCb = document.createElement("input");
  starostaCb.type = "checkbox";
  starostaCb.checked = !!data.isStarosta;
  starostaCb.onchange = () => {
    updateDoc(doc(db, "students", id), { isStarosta: starostaCb.checked }).catch((e) =>
      reportSaveError(e, "Не вдалося змінити статус старости", "Failed to update class monitor status")
    );
  };
  const starostaText = document.createElement("span");
  starostaText.textContent = t("starostaLabel");
  starostaLabel.append(starostaCb, starostaText);

  const metaRow = document.createElement("div");
  metaRow.className = "student-meta";
  metaRow.append(linkedBadge, starostaLabel, classSelect, groupSelect, codeChip);

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
  const newValue = Math.min(1_000_000, Math.max(0, (currentPoints || 0) + delta));
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

    const hwToggle = document.createElement("label");
    hwToggle.className = "subject-hw-toggle";
    hwToggle.title = t("studentsCanAddHwTitle");
    const hwCb = document.createElement("input");
    hwCb.type = "checkbox";
    hwCb.checked = !!data.studentsCanAddHw;
    hwCb.onchange = async () => {
      try {
        await updateDoc(doc(db, "subjects", id), { studentsCanAddHw: hwCb.checked });
      } catch (e) {
        reportSaveError(e, "Не вдалося зберегти дозвіл на ДЗ", "Failed to save homework permission");
        hwCb.checked = !hwCb.checked;
      }
    };
    const hwText = document.createElement("span");
    hwText.textContent = t("studentsCanAddHwLabel");
    hwToggle.append(hwCb, hwText);

    li.append(topRow, linkInput, hwToggle);
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
      if (dayKey === todayWeekdayKey) td.classList.add("schedule-table-today");

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
    const groupHint = getGroupLabel(currentGroup);
    liveStatusEl.innerHTML = `<div class="live-status-row live-status-idle">${t("noActiveLesson")}${groupHint ? ` <span class="live-status-group">(${escapeHtml(groupHint)})</span>` : ""}</div>`;
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
    const groupHint = getGroupLabel(currentGroup);
    liveStatusEl.innerHTML = `
      <div class="live-status-row live-status-lesson">
        <span class="live-status-dot"></span>
        <span class="live-status-text">
          <span class="live-status-label">${t("liveLessonLabel")}${groupHint ? ` <span class="live-status-group">(${escapeHtml(groupHint)})</span>` : ""}</span>
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
    const groupHint = getGroupLabel(currentGroup);
    liveStatusEl.innerHTML = `
      <div class="live-status-row live-status-break">
        <span class="live-status-dot"></span>
        <span class="live-status-text">
          <span class="live-status-label">${t("liveBreakLabel")}${groupHint ? ` <span class="live-status-group">(${escapeHtml(groupHint)})</span>` : ""}</span>
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

// ---------- Grades (оцінки за уроки/дз) ----------
// Документ id = "<lessonId>_<studentId>_<type>", type ∈ {"lesson","homework"}.
// Старі записи без type (id = "<lessonId>_<studentId>") читаються як type "lesson"
// для сумісності, але нові збереження завжди пишуть з type.
function gradeDocId(lessonId, studentId, type) {
  return `${lessonId}_${studentId}_${type}`;
}

function listenToGrades() {
  const q = query(collection(db, "grades"));
  unsubscribeGrades = onSnapshot(q, (snap) => {
    lastGrades = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    if (expandedGradePanels.size > 0) renderLessonsContainer();
    if (gradesPanelEl && !gradesPanelEl.classList.contains("hidden")) {
      renderTeacherGradesTable();
    }
  });
}

function getGradeValue(lessonId, studentId, type) {
  // Спочатку шукаємо запис з явним type
  let found = lastGrades.find(
    (g) =>
      g.data.lessonId === lessonId &&
      g.data.studentId === studentId &&
      g.data.type === type
  );
  if (found) return found.data.value;
  // Сумісність: старі записи без type (і з id без суфікса) вважаємо оцінкою за урок
  if (type === "lesson") {
    found = lastGrades.find(
      (g) =>
        g.data.lessonId === lessonId &&
        g.data.studentId === studentId &&
        !g.data.type
    );
    if (found) return found.data.value;
  }
  return null;
}

// Учні, яким призначено урок: якщо клас(и) не обрано — усі учні,
// інакше — учні з груп, що належать обраним класам.
function studentsForLesson(lessonData) {
  const assigned = lessonData.assignedClassIds;
  if (!assigned || !Array.isArray(assigned) || assigned.length === 0) {
    return lastStudents.slice();
  }
  const groupIdSet = new Set();
  assigned.forEach((classId) => {
    groupsOfClass(classId).forEach((g) => groupIdSet.add(g.id));
  });
  return lastStudents.filter((s) => groupIdSet.has(s.data.group));
}

async function saveGrade(lessonId, studentId, subjectId, date, rawValue, type, comment) {
  const gradeType = type === "homework" ? "homework" : "lesson";
  const id = gradeDocId(lessonId, studentId, gradeType);
  const trimmed = (rawValue || "").trim();
  const commentTrimmed = (comment || "").trim();
  try {
    if (trimmed === "") {
      await deleteDoc(doc(db, "grades", id));
      // Прибираємо й старий запис без type, якщо це була оцінка за урок
      if (gradeType === "lesson") {
        const legacyId = `${lessonId}_${studentId}`;
        try {
          await deleteDoc(doc(db, "grades", legacyId));
        } catch (_) {
          /* ignore */
        }
      }
      return;
    }
    const value = Math.max(1, Math.min(12, Math.round(Number(trimmed))));
    const payload = {
      lessonId,
      studentId,
      subjectId: subjectId || null,
      date: date || null,
      value,
      type: gradeType,
      updatedAt: Date.now(),
    };
    if (commentTrimmed) payload.comment = commentTrimmed;
    else payload.comment = deleteField();
    await setDoc(doc(db, "grades", id), payload, { merge: true });
    // Сповіщення учню (якщо прив'язаний)
    await notifyStudentAboutGrade(studentId, subjectId, value, gradeType, commentTrimmed);
  } catch (e) {
    reportSaveError(e, "Не вдалося зберегти оцінку. Перевірте правила Firestore для колекції grades", "Failed to save the grade. Check Firestore Rules for the grades collection");
  }
}

async function notifyStudentAboutGrade(studentId, subjectId, value, gradeType, comment) {
  const student = lastStudents.find((s) => s.id === studentId);
  const authUid = student && student.data && student.data.authUid;
  if (!authUid) return;
  const subjectName = getSubjectName(subjectId) || "";
  const typeLabel = gradeType === "homework" ? t("gradeTypeHomework") : t("gradeTypeLesson");
  const title = t("notifNewGrade")(value, subjectName, typeLabel);
  let body = title;
  try {
    await addDoc(collection(db, "notifications"), {
      recipientUid: authUid,
      studentId,
      type: "grade",
      title,
      body,
      comment: comment || null,
      subjectId: subjectId || null,
      value,
      gradeType,
      createdAt: Date.now(),
      read: false,
      senderUid: auth.currentUser ? auth.currentUser.uid : null,
    });
  } catch (e) {
    console.warn("notifyStudentAboutGrade", e);
  }
}

// ---------- Призначення уроку класам (мультивибір + пошук) ----------
function renderLessonClassOptions() {
  if (!lessonClassOptions) return;
  const q = (lessonClassSearch && lessonClassSearch.value ? lessonClassSearch.value : "").trim().toLowerCase();
  lessonClassOptions.innerHTML = "";

  const filtered = lastClasses.filter((c) => {
    if (!q) return true;
    return (c.data.name || "").toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = lastClasses.length === 0 ? t("noClassesForAssign") : t("noStudentsSearchMsg");
    lessonClassOptions.appendChild(empty);
  } else {
    filtered.forEach(({ id, data }) => {
      const label = document.createElement("label");
      label.className = "class-option-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = id;
      cb.checked = selectedLessonClassIds.has(id);
      cb.onchange = () => {
        if (cb.checked) selectedLessonClassIds.add(id);
        else selectedLessonClassIds.delete(id);
        renderLessonClassSelectedChips();
      };
      const nameSpan = document.createElement("span");
      nameSpan.textContent = data.name || id;
      label.append(cb, nameSpan);
      lessonClassOptions.appendChild(label);
    });
  }
  renderLessonClassSelectedChips();
}

function renderLessonClassSelectedChips() {
  if (!lessonClassSelected) return;
  lessonClassSelected.innerHTML = "";
  if (selectedLessonClassIds.size === 0) {
    const all = document.createElement("span");
    all.className = "class-chip class-chip-all";
    all.textContent = t("allClassesLabel");
    lessonClassSelected.appendChild(all);
    return;
  }
  [...selectedLessonClassIds].forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "class-chip";
    chip.textContent = getClassName(id) || id;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "class-chip-remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", t("deleteBtn"));
    removeBtn.onclick = () => {
      selectedLessonClassIds.delete(id);
      renderLessonClassOptions();
    };
    chip.appendChild(removeBtn);
    lessonClassSelected.appendChild(chip);
  });
}

if (lessonClassSearch) {
  lessonClassSearch.addEventListener("input", () => renderLessonClassOptions());
}

function lessonVisibleForCurrentClass(lessonData) {
  const ids = lessonData.assignedClassIds;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return true;
  if (!currentClassId) return true;
  return ids.includes(currentClassId);
}

function parsePublishAtInput(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

addLessonBtn.onclick = async () => {
  const subjectId = newLessonSubject.value;
  const title = newLessonTitle.value.trim();
  const content = newLessonContent.value.trim();
  const lessonDate = newLessonDate.value || null;
  const homeworkDate = newLessonHwDate.value || null;
  const publishAt = newLessonPublishAt ? parsePublishAtInput(newLessonPublishAt.value) : null;
  const assignedClassIds = [...selectedLessonClassIds];

  if (!subjectId) {
    alert(t("selectSubjectPlaceholder"));
    return;
  }
  if (!title) return;

  try {
    const payload = {
      subjectId,
      title,
      content: content || "",
      lessonDate,
      homeworkDate,
      createdAt: Date.now(),
    };
    if (assignedClassIds.length > 0) payload.assignedClassIds = assignedClassIds;
    if (publishAt) payload.publishAt = publishAt;

    await addDoc(collection(db, "lessons"), payload);
    // Сповіщення учням про новий урок / ДЗ
    notifyStudentsAboutLesson(payload).catch((err) => console.warn(err));
    newLessonTitle.value = "";
    newLessonContent.value = "";
    newLessonDate.value = "";
    newLessonHwDate.value = "";
    if (newLessonPublishAt) newLessonPublishAt.value = "";
    selectedLessonClassIds = new Set();
    if (lessonClassSearch) lessonClassSearch.value = "";
    renderLessonClassOptions();
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
  const base =
    currentType === "homework"
      ? lastLessons.filter((l) => !!l.data.homeworkDate)
      : lastLessons;
  return base.filter((l) => lessonVisibleForCurrentClass(l.data));
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
      (l) =>
        l.data.subjectId === subjectId &&
        l.data.lessonDate === targetDateStr &&
        lessonVisibleForCurrentClass(l.data)
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
  const matching = lastLessons.filter(
    (l) => l.data.homeworkDate === targetDateStr && lessonVisibleForCurrentClass(l.data)
  );

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

  const gradesPanel = document.createElement("div");
  gradesPanel.className = "grades-panel hidden";

  const gradesBtn = document.createElement("button");
  gradesBtn.type = "button";
  gradesBtn.textContent = t("gradesBtn");
  gradesBtn.className = "secondary small";
  gradesBtn.onclick = (e) => {
    e.stopPropagation();
    const nowOpen = !expandedGradePanels.has(id);
    if (nowOpen) expandedGradePanels.add(id);
    else expandedGradePanels.delete(id);
    gradesPanel.classList.toggle("hidden", !nowOpen);
    gradesPanel.innerHTML = "";
    if (nowOpen) gradesPanel.appendChild(buildGradesPanel(id, data));
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("deleteBtn");
  deleteBtn.className = "secondary small";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm(t("deleteLessonConfirm")(data.title))) deleteDoc(doc(db, "lessons", id));
  };

  header.append(headerMain, gradesBtn, deleteBtn);

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
  if (data.addedByStarosta) {
    const badge = document.createElement("span");
    badge.className = "date-badge starosta-badge";
    badge.textContent = t("addedByStarostaBadge");
    datesRow.appendChild(badge);
  }
  if (data.publishAt && data.publishAt > Date.now()) {
    const badge = document.createElement("span");
    badge.className = "date-badge scheduled";
    const locale = currentLang === "uk" ? "uk-UA" : "en-US";
    const when = new Date(data.publishAt).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    badge.textContent = `${t("scheduledBadge")}: ${when}`;
    datesRow.appendChild(badge);
  }
  const assigned = data.assignedClassIds;
  if (assigned && Array.isArray(assigned) && assigned.length > 0) {
    const badge = document.createElement("span");
    badge.className = "date-badge class-assign-badge";
    badge.textContent = assigned.map((cid) => getClassName(cid) || cid).join(", ");
    datesRow.appendChild(badge);
  } else {
    const badge = document.createElement("span");
    badge.className = "date-badge class-assign-badge class-assign-all";
    badge.textContent = t("allClassesLabel");
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

  if (expandedGradePanels.has(id)) {
    gradesPanel.classList.remove("hidden");
    gradesPanel.appendChild(buildGradesPanel(id, data));
  }

  li.append(header, datesRow, contentDiv, gradesPanel);
  return li;
}

// Панель виставлення оцінок: окремі поля для оцінки за урок і за ДЗ
// (якщо у записі є відповідна дата). Якщо є лише одна дата — одне поле.
function buildGradesPanel(lessonId, data) {
  const wrap = document.createElement("div");
  wrap.className = "grades-panel-inner";

  const heading = document.createElement("div");
  heading.className = "grades-panel-heading";
  heading.textContent = t("gradesPanelHeading");
  wrap.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint grades-panel-hint";
  hint.textContent = t("gradesPanelHint");
  wrap.appendChild(hint);

  const hasLesson = !!data.lessonDate;
  const hasHw = !!data.homeworkDate;
  // Якщо жодної дати немає — дозволяємо оцінку за урок з сьогоднішньою датою
  const showLesson = hasLesson || !hasHw;
  const showHw = hasHw;

  const students = studentsForLesson(data)
    .slice()
    .sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", currentLang === "uk" ? "uk" : "en"));

  if (students.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = t("noStudentsForGrades");
    wrap.appendChild(empty);
    return wrap;
  }

  if (showLesson && showHw) {
    const colLabels = document.createElement("div");
    colLabels.className = "grades-student-row grades-col-labels";
    const spacer = document.createElement("span");
    spacer.className = "grades-student-name";
    const lessonLbl = document.createElement("span");
    lessonLbl.className = "grade-col-label";
    lessonLbl.textContent = t("gradeTypeLesson");
    const hwLbl = document.createElement("span");
    hwLbl.className = "grade-col-label";
    hwLbl.textContent = t("gradeTypeHomework");
    const hintSpacer = document.createElement("span");
    hintSpacer.className = "grade-saved-hint hidden";
    colLabels.append(spacer, lessonLbl, hwLbl, hintSpacer);
    wrap.appendChild(colLabels);
  }

  const list = document.createElement("div");
  list.className = "grades-student-list";

  function getGradeComment(lessonId, studentId, type) {
    let found = lastGrades.find(
      (g) =>
        g.data.lessonId === lessonId &&
        g.data.studentId === studentId &&
        g.data.type === type
    );
    if (found) return found.data.comment || "";
    if (type === "lesson") {
      found = lastGrades.find(
        (g) =>
          g.data.lessonId === lessonId &&
          g.data.studentId === studentId &&
          !g.data.type
      );
      if (found) return found.data.comment || "";
    }
    return "";
  }

  function makeGradeInput(studentId, type, date) {
    const col = document.createElement("div");
    col.className = "grade-inputs-col";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "12";
    input.step = "1";
    input.inputMode = "numeric";
    input.className = "grade-input";
    input.placeholder = t("gradeInputPlaceholder");
    input.title = type === "homework" ? t("gradeTypeHomework") : t("gradeTypeLesson");
    const currentValue = getGradeValue(lessonId, studentId, type);
    if (currentValue !== null) input.value = currentValue;

    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.className = "grade-comment-input";
    commentInput.placeholder = t("gradeCommentPlaceholder");
    commentInput.value = getGradeComment(lessonId, studentId, type);

    const savedHint = document.createElement("span");
    savedHint.className = "grade-saved-hint hidden";
    savedHint.textContent = t("gradeSavedHint");

    const persist = async () => {
      await saveGrade(
        lessonId,
        studentId,
        data.subjectId,
        date,
        input.value,
        type,
        commentInput.value
      );
      savedHint.classList.remove("hidden");
      setTimeout(() => savedHint.classList.add("hidden"), 1200);
    };

    input.onclick = (e) => e.stopPropagation();
    commentInput.onclick = (e) => e.stopPropagation();
    input.onchange = persist;
    commentInput.onchange = persist;

    col.append(input, commentInput);
    return { col, savedHint };
  }

  students.forEach(({ id: studentId, data: studentData }) => {
    const row = document.createElement("div");
    row.className = "grades-student-row";

    const name = document.createElement("span");
    name.className = "grades-student-name";
    name.textContent = studentData.name;
    row.appendChild(name);

    let lastSavedHint = null;
    if (showLesson) {
      const date = data.lessonDate || formatDateLocal(new Date());
      const { col, savedHint } = makeGradeInput(studentId, "lesson", date);
      row.appendChild(col);
      lastSavedHint = savedHint;
    }
    if (showHw) {
      const date = data.homeworkDate;
      const { col, savedHint } = makeGradeInput(studentId, "homework", date);
      row.appendChild(col);
      lastSavedHint = savedHint;
    }
    if (lastSavedHint) row.appendChild(lastSavedHint);

    list.appendChild(row);
  });

  wrap.appendChild(list);
  return wrap;
}

// ---------- Вкладка "Оцінки" вчителя: вибір учня + таблиця ----------
function renderTeacherGradesStudentSelect() {
  if (!teacherGradesStudentSelect) return;
  const prev = teacherGradesSelectedStudentId || teacherGradesStudentSelect.value;
  teacherGradesStudentSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("teacherGradesSelectPlaceholder");
  teacherGradesStudentSelect.appendChild(placeholder);

  const locale = currentLang === "uk" ? "uk" : "en";
  const sorted = lastStudents
    .slice()
    .sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", locale));
  sorted.forEach(({ id, data }) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.name || id;
    teacherGradesStudentSelect.appendChild(opt);
  });

  const stillValid = prev && lastStudents.some((s) => s.id === prev);
  teacherGradesStudentSelect.value = stillValid ? prev : "";
  teacherGradesSelectedStudentId = teacherGradesStudentSelect.value;
}

function gradeValueClass(value) {
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

function computeGradesAnalyticsFromList(gradesList) {
  const values = gradesList
    .map((g) => Number(g.data.value))
    .filter((v) => !isNaN(v) && v > 0);
  const overall =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const bySubject = {};
  gradesList.forEach((g) => {
    const sid = g.data.subjectId;
    const v = Number(g.data.value);
    if (!sid || isNaN(v) || v <= 0) return;
    if (!bySubject[sid]) bySubject[sid] = [];
    bySubject[sid].push(v);
  });
  const subjectAvgs = Object.keys(bySubject).map((sid) => {
    const arr = bySubject[sid];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { id: sid, name: getSubjectName(sid), avg, count: arr.length };
  });
  subjectAvgs.sort((a, b) => b.avg - a.avg);

  const chronological = gradesList
    .map((g) => ({
      date: g.data.date || "",
      value: Number(g.data.value),
      at: g.data.updatedAt || 0,
    }))
    .filter((x) => x.date && !isNaN(x.value) && x.value > 0)
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

  return { overall, count: values.length, subjectAvgs, chronological, trend };
}

function renderTeacherGradesAnalytics(studentGrades) {
  if (!teacherGradesAnalyticsEl) return;
  if (!studentGrades || studentGrades.length === 0) {
    teacherGradesAnalyticsEl.classList.add("hidden");
    return;
  }
  teacherGradesAnalyticsEl.classList.remove("hidden");
  const stats = computeGradesAnalyticsFromList(studentGrades);

  if (teacherGradesStatOverall) {
    teacherGradesStatOverall.textContent =
      stats.overall != null
        ? `${stats.overall.toFixed(1)} ${t("gradesOfMax") || "з 12"}`
        : "—";
  }
  if (teacherGradesStatCount) teacherGradesStatCount.textContent = String(stats.count);
  if (teacherGradesStatBest) {
    if (stats.subjectAvgs.length > 0) {
      const best = stats.subjectAvgs[0];
      teacherGradesStatBest.textContent = `${best.name} (${best.avg.toFixed(1)})`;
      teacherGradesStatBest.title = best.name;
    } else {
      teacherGradesStatBest.textContent = "—";
      teacherGradesStatBest.title = "";
    }
  }
  if (teacherGradesStatTrend) {
    const map = {
      up: t("gradesTrendUp"),
      down: t("gradesTrendDown"),
      stable: t("gradesTrendStable"),
      none: t("gradesTrendNone"),
    };
    teacherGradesStatTrend.textContent = map[stats.trend] || map.none;
    teacherGradesStatTrend.className =
      "grades-stat-value grades-stat-value--sm" +
      (stats.trend === "up"
        ? " grades-trend-up"
        : stats.trend === "down"
          ? " grades-trend-down"
          : "");
  }

  if (teacherGradesChartBars) {
    teacherGradesChartBars.innerHTML = "";
    if (stats.subjectAvgs.length === 0) {
      if (teacherGradesChartEmpty) teacherGradesChartEmpty.classList.remove("hidden");
    } else {
      if (teacherGradesChartEmpty) teacherGradesChartEmpty.classList.add("hidden");
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
        fill.style.width = `${Math.min(100, (s.avg / GRADE_SCALE_MAX) * 100)}%`;
        if (s.avg >= 10) fill.classList.add("grades-bar-high");
        else if (s.avg >= 7) fill.classList.add("grades-bar-mid");
        else fill.classList.add("grades-bar-low");
        track.appendChild(fill);
        const val = document.createElement("div");
        val.className = "grades-bar-value";
        val.textContent = s.avg.toFixed(1);
        row.append(label, track, val);
        teacherGradesChartBars.appendChild(row);
      });
    }
  }

  if (teacherGradesChartTrend) {
    teacherGradesChartTrend.innerHTML = "";
    const series = stats.chronological;
    if (series.length >= 2) {
      const svgNS = "http://www.w3.org/2000/svg";
      const w = 440;
      const h = 140;
      const padL = 28;
      const padR = 12;
      const padT = 12;
      const padB = 28;
      const n = series.length;
      const xs = series.map((_, i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR));
      const ys = series.map((p) => {
        const ratio = Math.min(1, Math.max(0, p.value / GRADE_SCALE_MAX));
        return padT + (1 - ratio) * (h - padT - padB);
      });
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("class", "grades-trend-svg");
      [3, 6, 9, 12].forEach((g) => {
        const y = padT + (1 - g / GRADE_SCALE_MAX) * (h - padT - padB);
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
      const poly = document.createElementNS(svgNS, "polyline");
      poly.setAttribute("points", xs.map((x, i) => `${x},${ys[i]}`).join(" "));
      poly.setAttribute("class", "grades-trend-line");
      svg.appendChild(poly);
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
      if (series[0]) {
        const t0 = document.createElementNS(svgNS, "text");
        t0.setAttribute("x", String(xs[0]));
        t0.setAttribute("y", String(h - 8));
        t0.setAttribute("text-anchor", n > 1 ? "start" : "middle");
        t0.setAttribute("class", "grades-trend-axis");
        t0.textContent = series[0].date.slice(5);
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
      teacherGradesChartTrend.appendChild(svg);
    }
  }
}

function renderTeacherGradesTable() {
  if (!teacherGradesTableContainer) return;
  teacherGradesTableContainer.innerHTML = "";

  const sid = teacherGradesSelectedStudentId;
  if (!sid) {
    if (teacherGradesAnalyticsEl) teacherGradesAnalyticsEl.classList.add("hidden");
    if (teacherNoGradesMsg) {
      teacherNoGradesMsg.classList.remove("hidden");
      teacherNoGradesMsg.textContent = t("teacherGradesSelectPlaceholder");
    }
    return;
  }

  const studentGrades = lastGrades.filter((g) => g.data.studentId === sid);
  if (studentGrades.length === 0) {
    if (teacherGradesAnalyticsEl) teacherGradesAnalyticsEl.classList.add("hidden");
    if (teacherNoGradesMsg) {
      teacherNoGradesMsg.classList.remove("hidden");
      teacherNoGradesMsg.textContent = t("noGradesMsg");
    }
    return;
  }
  if (teacherNoGradesMsg) teacherNoGradesMsg.classList.add("hidden");

  renderTeacherGradesAnalytics(studentGrades);

  const dateSet = new Set(studentGrades.map((g) => g.data.date).filter(Boolean));
  const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

  const subjectIdsWithGrades = new Set(studentGrades.map((g) => g.data.subjectId).filter(Boolean));
  const subjectOrder = lastSubjects.map((s) => s.id).filter((id) => subjectIdsWithGrades.has(id));
  [...subjectIdsWithGrades]
    .filter((id) => !subjectOrder.includes(id))
    .forEach((id) => subjectOrder.push(id));

  if (dates.length === 0 || subjectOrder.length === 0) {
    if (teacherNoGradesMsg) {
      teacherNoGradesMsg.classList.remove("hidden");
      teacherNoGradesMsg.textContent = t("noGradesMsg");
    }
    return;
  }

  function gradesForCell(subjectId, date) {
    return studentGrades
      .filter((g) => g.data.subjectId === subjectId && g.data.date === date)
      .sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
  }

  const legend = document.createElement("div");
  legend.className = "grades-table-legend";
  legend.innerHTML = `
    <span class="grades-legend-item"><span class="chip grade-cell-chip grade-chip-lesson grade-val-mid">10</span> ${t("gradesLegendLesson") || t("gradeTypeLesson")}</span>
    <span class="grades-legend-item"><span class="chip grade-cell-chip grade-chip-hw grade-val-mid">10</span> ${t("gradesLegendHw") || t("gradeTypeHomework")}</span>
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
          values.push(g.data.value);
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
  teacherGradesTableContainer.appendChild(legend);
  teacherGradesTableContainer.appendChild(wrap);
}

if (teacherGradesStudentSelect) {
  teacherGradesStudentSelect.onchange = () => {
    teacherGradesSelectedStudentId = teacherGradesStudentSelect.value;
    renderTeacherGradesTable();
  };
}


// ==========================================================
// Самоврядування — вибори старости (панель вчителя)
// ==========================================================
const ELECTION_COLORS = [
  "#24866b", "#0e7490", "#c2410c", "#7c3aed", "#b45309",
  "#34b58e", "#6366f1", "#dc2626", "#0891b2", "#a855f7",
];

let lastElections = []; // [{id, data}]
let lastStarostaHistory = []; // [{id, data}]
let unsubscribeElections = null;
let unsubscribeStarostaHistory = null;
let selfgovHistoryExpanded = false;

const selfgovClassNameEl = document.getElementById("selfgov-class-name");
const selfgovAnnounceForm = document.getElementById("selfgov-announce-form");
const electionStartInput = document.getElementById("election-start-input");
const electionEndInput = document.getElementById("election-end-input");
const announceElectionBtn = document.getElementById("announce-election-btn");
const selfgovActiveBlock = document.getElementById("selfgov-active-block");
const selfgovStatusEl = document.getElementById("selfgov-status");
const selfgovPieEl = document.getElementById("selfgov-pie");
const selfgovProgressLegend = document.getElementById("selfgov-progress-legend");
const selfgovCandidatesList = document.getElementById("selfgov-candidates-list");
const closeElectionBtn = document.getElementById("close-election-btn");
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

function getActiveElectionForClass(classId) {
  if (!classId) return null;
  return lastElections.find(
    (e) => e.data.classId === classId && !e.data.closed && electionPhase(e.data) !== "closed"
  ) || null;
}

function countVotes(electionData) {
  const votes = electionData.votes || {};
  const counts = {};
  Object.values(votes).forEach((cid) => {
    counts[cid] = (counts[cid] || 0) + 1;
  });
  return counts;
}

function renderPieChart(pieEl, legendEl, electionData) {
  if (!pieEl || !legendEl) return;
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
    pieEl.style.background = `conic-gradient(var(--color-border) 0deg 360deg)`;
    legendEl.innerHTML = `<div class="hint">${t("selfGovNoCandidates")}</div>`;
    return;
  }

  let deg = 0;
  const parts = [];
  entries.forEach((e) => {
    const slice = (e.votes / total) * 360;
    parts.push(`${e.color} ${deg}deg ${deg + slice}deg`);
    deg += slice;
  });
  pieEl.style.background = `conic-gradient(${parts.join(", ")})`;

  legendEl.innerHTML = "";
  const totalLabel = document.createElement("div");
  totalLabel.className = "hint";
  totalLabel.textContent = `${t("selfGovTotalVotes")}: ${total}`;
  legendEl.appendChild(totalLabel);
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
      legendEl.appendChild(row);
    });
}

function studentsInClass(classId) {
  const groupIdsInClass = new Set(groupsOfClass(classId).map((g) => g.id));
  return lastStudents.filter((s) => groupIdsInClass.has(s.data.group));
}

async function closeElectionAndSetStarosta(electionId, electionData) {
  const candidates = electionData.candidates || {};
  const counts = countVotes(electionData);
  let winnerId = null;
  let maxVotes = -1;
  Object.keys(candidates).forEach((sid) => {
    const v = counts[sid] || 0;
    if (v > maxVotes) {
      maxVotes = v;
      winnerId = sid;
    }
  });
  // Tie: first by name among max
  if (winnerId && maxVotes >= 0) {
    const tied = Object.keys(candidates).filter((sid) => (counts[sid] || 0) === maxVotes);
    if (tied.length > 1) {
      tied.sort((a, b) => (candidates[a].name || "").localeCompare(candidates[b].name || ""));
      winnerId = tied[0];
    }
  }

  const classId = electionData.classId;
  const now = Date.now();
  const todayStr = formatDateLocal(new Date());

  // Close previous open history for this class
  const openHist = lastStarostaHistory.filter(
    (h) => h.data.classId === classId && !h.data.toDate
  );
  for (const h of openHist) {
    await updateDoc(doc(db, "starostaHistory", h.id), { toDate: todayStr });
  }

  // Clear isStarosta for all in class, set winner
  const classStudents = studentsInClass(classId);
  const batch = writeBatch(db);
  classStudents.forEach(({ id }) => {
    batch.update(doc(db, "students", id), { isStarosta: id === winnerId });
  });
  batch.update(doc(db, "elections", electionId), {
    closed: true,
    closedAt: now,
    winnerStudentId: winnerId || null,
  });
  await batch.commit();

  if (winnerId) {
    const winnerName =
      (candidates[winnerId] && candidates[winnerId].name) ||
      (lastStudents.find((s) => s.id === winnerId) || {}).data?.name ||
      winnerId;
    await addDoc(collection(db, "starostaHistory"), {
      classId,
      studentId: winnerId,
      studentName: winnerName,
      fromDate: todayStr,
      toDate: null,
      electionId,
      createdAt: now,
    });
    notifyClassAboutElection(classId, "election_result", winnerName).catch((err) => console.warn(err));
  }
}

function renderSelfGovTeacher() {
  if (!selfgovPanelEl) return;
  const classId = currentClassId;
  if (selfgovClassNameEl) {
    selfgovClassNameEl.textContent = getClassName(classId) || "—";
  }

  // Auto-close expired elections
  lastElections.forEach((e) => {
    if (!e.data.closed && Date.now() >= e.data.endAt) {
      closeElectionAndSetStarosta(e.id, e.data).catch((err) =>
        reportSaveError(err, "Не вдалося завершити вибори", "Failed to close election")
      );
    }
  });

  const active = getActiveElectionForClass(classId);
  if (selfgovAnnounceForm) selfgovAnnounceForm.classList.toggle("hidden", !!active);
  if (selfgovActiveBlock) selfgovActiveBlock.classList.toggle("hidden", !active);

  if (active) {
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
      phase === "voting" ? "election-phase-badge voting" : phase === "closed" ? "election-phase-badge closed" : "election-phase-badge";
    if (selfgovStatusEl) {
      selfgovStatusEl.innerHTML = `${phaseLabel} <span class="${badgeClass}">${phaseLabel}</span><br><span class="hint">${startStr} — ${endStr}</span>`;
    }
    renderPieChart(selfgovPieEl, selfgovProgressLegend, active.data);

    if (selfgovCandidatesList) {
      selfgovCandidatesList.innerHTML = "";
      const candidates = active.data.candidates || {};
      const counts = countVotes(active.data);
      const ids = Object.keys(candidates);
      if (ids.length === 0) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = t("selfGovNoCandidates");
        selfgovCandidatesList.appendChild(p);
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
            const votes = document.createElement("span");
            votes.className = "selfgov-candidate-votes";
            votes.textContent = `${counts[sid] || 0} ${t("selfGovVotes")}`;
            row.append(name, votes);
            selfgovCandidatesList.appendChild(row);
          });
      }
    }
    if (closeElectionBtn) {
      closeElectionBtn.classList.toggle("hidden", phase === "closed");
      closeElectionBtn.onclick = async () => {
        try {
          await closeElectionAndSetStarosta(active.id, active.data);
          alert(t("selfGovClosedDone"));
        } catch (e) {
          reportSaveError(e, "Помилка завершення виборів", "Error closing election");
        }
      };
    }
  }

  renderStarostaHistory(classId);
}

function renderStarostaHistory(classId) {
  if (!selfgovHistoryList) return;
  const items = lastStarostaHistory
    .filter((h) => !classId || h.data.classId === classId)
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
      ? t("subjectsCollapseBtn")
      : t("subjectsExpandBtn");
  };
}

if (announceElectionBtn) {
  announceElectionBtn.onclick = async () => {
    const classId = currentClassId;
    if (!classId) return;
    if (getActiveElectionForClass(classId)) {
      alert(t("selfGovAlreadyActive"));
      return;
    }
    const startVal = electionStartInput ? electionStartInput.value : "";
    const endVal = electionEndInput ? electionEndInput.value : "";
    if (!startVal || !endVal) {
      alert(t("selfGovNeedDates"));
      return;
    }
    const startAt = new Date(startVal).getTime();
    const endAt = new Date(endVal).getTime();
    if (!(startAt < endAt)) {
      alert(t("selfGovStartBeforeEnd"));
      return;
    }
    try {
      await addDoc(collection(db, "elections"), {
        classId,
        startAt,
        endAt,
        createdAt: Date.now(),
        candidates: {},
        votes: {},
        closed: false,
        winnerStudentId: null,
      });
      notifyClassAboutElection(classId, "election_announced").catch((err) => console.warn(err));
      if (electionStartInput) electionStartInput.value = "";
      if (electionEndInput) electionEndInput.value = "";
      alert(t("selfGovAnnounced"));
    } catch (e) {
      reportSaveError(e, "Не вдалося оголосити вибори", "Failed to announce election");
    }
  };
}

function subscribeElectionsAndHistory() {
  if (unsubscribeElections) unsubscribeElections();
  if (unsubscribeStarostaHistory) unsubscribeStarostaHistory();
  unsubscribeElections = onSnapshot(collection(db, "elections"), (snap) => {
    lastElections = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    if (selfgovPanelEl && !selfgovPanelEl.classList.contains("hidden")) {
      renderSelfGovTeacher();
    }
  });
  unsubscribeStarostaHistory = onSnapshot(
    query(collection(db, "starostaHistory"), orderBy("createdAt", "desc")),
    (snap) => {
      lastStarostaHistory = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      if (selfgovPanelEl && !selfgovPanelEl.classList.contains("hidden")) {
        renderSelfGovTeacher();
      }
    },
    () => {
      // fallback without orderBy if index missing
      unsubscribeStarostaHistory = onSnapshot(collection(db, "starostaHistory"), (snap) => {
        lastStarostaHistory = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        if (selfgovPanelEl && !selfgovPanelEl.classList.contains("hidden")) {
          renderSelfGovTeacher();
        }
      });
    }
  );
}

// Hook into auth success — find where students listener starts
const _origSubscribeNote = "subscribeElectionsAndHistory will be called from onAuth";


// ==========================================================
// Повідомлення / сповіщення (панель вчителя)
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
const messagesRecipientSelect = document.getElementById("messages-recipient-select");
const messagesComposeText = document.getElementById("messages-compose-text");
const messagesSendBtn = document.getElementById("messages-send-btn");

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
  renderMessagesRecipientSelect();
  renderMessagesList();
  markAllNotificationsRead().catch(() => {});
}

function renderMessagesRecipientSelect() {
  if (!messagesRecipientSelect) return;
  const prev = messagesRecipientSelect.value;
  messagesRecipientSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = t("messagesSelectStudent");
  messagesRecipientSelect.appendChild(ph);
  const locale = currentLang === "uk" ? "uk" : "en";
  lastStudents
    .filter((s) => s.data && s.data.authUid)
    .slice()
    .sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", locale))
    .forEach(({ id, data }) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.name || id;
      messagesRecipientSelect.appendChild(opt);
    });
  if (prev && [...messagesRecipientSelect.options].some((o) => o.value === prev)) {
    messagesRecipientSelect.value = prev;
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
    title.textContent = data.title || t("notifAnnouncement");
    const body = document.createElement("div");
    body.className = "message-item-body";
    body.textContent = data.body || "";
    el.append(title, body);
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

function subscribeTeacherNotifications() {
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

async function notifyStudentsAboutLesson(payload) {
  const subjectName = getSubjectName(payload.subjectId) || "";
  const hasHw = !!payload.homeworkDate;
  const title = hasHw
    ? t("notifNewHomework")(subjectName, payload.title || "")
    : t("notifNewLesson")(subjectName, payload.title || "");
  const type = hasHw ? "homework" : "lesson";
  let targets = lastStudents.filter((s) => s.data && s.data.authUid);
  if (payload.assignedClassIds && payload.assignedClassIds.length > 0) {
    const groupIds = new Set();
    payload.assignedClassIds.forEach((cid) => {
      groupsOfClass(cid).forEach((g) => groupIds.add(g.id));
    });
    targets = targets.filter((s) => groupIds.has(s.data.group));
  }
  const now = Date.now();
  const senderUid = auth.currentUser ? auth.currentUser.uid : null;
  // Ліміт batch 500 — шлемо по одному для простоти
  for (const s of targets) {
    try {
      await addDoc(collection(db, "notifications"), {
        recipientUid: s.data.authUid,
        studentId: s.id,
        type,
        title,
        body: payload.content || title,
        createdAt: now,
        read: false,
        senderUid,
      });
    } catch (e) {
      console.warn("notify lesson", e);
    }
  }
}

async function notifyClassAboutElection(classId, kind, winnerName) {
  const groupIds = new Set(groupsOfClass(classId).map((g) => g.id));
  const targets = lastStudents.filter(
    (s) => s.data && s.data.authUid && groupIds.has(s.data.group)
  );
  const title =
    kind === "election_result"
      ? t("notifElectionResult")(winnerName || "")
      : t("notifElectionAnnounced");
  const now = Date.now();
  const senderUid = auth.currentUser ? auth.currentUser.uid : null;
  for (const s of targets) {
    try {
      await addDoc(collection(db, "notifications"), {
        recipientUid: s.data.authUid,
        studentId: s.id,
        type: kind,
        title,
        body: title,
        createdAt: now,
        read: false,
        senderUid,
      });
    } catch (e) {
      console.warn("notify election", e);
    }
  }
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
if (messagesSendBtn) {
  messagesSendBtn.onclick = async () => {
    const studentId = messagesRecipientSelect ? messagesRecipientSelect.value : "";
    const text = messagesComposeText ? messagesComposeText.value.trim() : "";
    if (!studentId) {
      alert(t("messagesNeedRecipient"));
      return;
    }
    if (!text) {
      alert(t("messagesNeedText"));
      return;
    }
    const student = lastStudents.find((s) => s.id === studentId);
    const authUid = student && student.data && student.data.authUid;
    if (!authUid) {
      alert(t("messagesNeedRecipient"));
      return;
    }
    try {
      await addDoc(collection(db, "notifications"), {
        recipientUid: authUid,
        studentId,
        type: "announcement",
        title: t("notifAnnouncement"),
        body: text,
        createdAt: Date.now(),
        read: false,
        senderUid: auth.currentUser ? auth.currentUser.uid : null,
      });
      if (messagesComposeText) messagesComposeText.value = "";
      alert(t("messagesSent"));
    } catch (e) {
      reportSaveError(e, "Не вдалося надіслати повідомлення", "Failed to send message");
    }
  };
}
