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
  generateTeacherInviteCode,
  parseTimeToMinutes,
  formatDateLocal,
  escapeHtml,
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

// Профіль поточного вчителя/адміна (users/{uid})
let currentUserProfile = null;
function isAdmin() {
  return !!(currentUserProfile && currentUserProfile.role === "admin");
}
function teacherSubjectIds() {
  const ids = currentUserProfile && currentUserProfile.subjectIds;
  return Array.isArray(ids) ? ids : [];
}
function teacherOwnsSubject(subjectId) {
  if (isAdmin()) return true;
  if (!subjectId) return false;
  return teacherSubjectIds().includes(subjectId);
}
function lessonOwnedByTeacher(lessonData) {
  if (isAdmin()) return true;
  return teacherOwnsSubject(lessonData && lessonData.subjectId);
}
function myDisplayName() {
  if (currentUserProfile && currentUserProfile.displayName) return currentUserProfile.displayName;
  const u = auth.currentUser;
  return (u && u.email) || "Teacher";
}
function profileNeedsSetup(data) {
  if (!data) return true;
  if (data.role === "admin") {
    return !data.displayName || !String(data.displayName).trim();
  }
  if (data.role === "teacher" || data.role === "pending-teacher") {
    const nameOk = data.displayName && String(data.displayName).trim();
    const subjectsOk = Array.isArray(data.subjectIds) && data.subjectIds.length > 0;
    return !(nameOk && subjectsOk);
  }
  return true;
}

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
      "Після реєстрації оберіть або створіть школу — роль призначається автоматично. " +
      "Нових учителів запрошуйте 16-символьним кодом на вкладці «Вчителі».",
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
    subjectRoomPlaceholder: "Кабінет (необов'язково)",
    roomLabel: "Кабінет",
    roomShort: "каб.",
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
    gradesPanelHint: "Виставте оцінку (1–12) або «Н» (відсутність) для кожного учня. Можна окремо за урок і за ДЗ. Порожнє поле — оцінки ще немає.",
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
    gradesAbsencesLabel: "Пропуски (Н)",
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
    gradesPeriodLabel: "Період",
    gradesPeriodAll: "Увесь час",
    gradesPeriodThisMonth: "Цей місяць",
    gradesPeriodLastMonth: "Минулий місяць",
    gradesPeriodSemester1: "1 семестр",
    gradesPeriodSemester2: "2 семестр",
    gradesPeriodCustom: "Довільний період",
    gradesPeriodFrom: "З",
    gradesPeriodTo: "По",
    gradesLegendLesson: "Урок",
    gradesLegendHw: "ДЗ",
    homeworkNoDueDate: "ДЗ без дати здачі",
    hasHomeworkLabel: "Є домашнє завдання",
    hasHomeworkHint: "Увімкніть, щоб додати ДЗ без дати здачі. Якщо вказано дату — ДЗ з’явиться автоматично.",
    homeworkDateOptionalHint: "Необов’язково — можна залишити порожнім",
    finalGradesHeading: "Підсумкові оцінки",
    finalGradesHint: "Семестрові та річні оцінки. «Авто» — округлене середнє поточних оцінок за період.",
    finalGradesNoSubjects: "Немає предметів для підсумкових оцінок.",
    finalPeriod_semester1: "1 семестр",
    finalPeriod_semester2: "2 семестр",
    finalPeriod_year: "Рік",
    finalGradeAutoBtn: "Авто",
    finalGradeAutoTitle: "Виставити за середнім балом",
    finalGradeNoAvg: "Недостатньо оцінок для розрахунку середнього.",

    tabAnnouncements: "Оголошення",
    announcementsHeading: "Оголошення",
    addAnnouncementHeading: "Додати оголошення",
    announcementsTeacherHint: "Оголошення побачать усі учні або лише обрані класи. Учні отримають сповіщення.",
    announcementTitlePlaceholder: "Заголовок",
    announcementBodyPlaceholder: "Текст оголошення",
    announcementClassesHint: "Якщо нічого не вибрано — оголошення для всіх класів.",
    noAnnouncementsMsg: "Оголошень ще немає.",
    announcementAllClasses: "Усі класи",
    announcementFrom: "Від",
    announcementNeedTitle: "Вкажіть заголовок оголошення.",
    announcementNeedBody: "Введіть текст оголошення.",
    announcementAdded: "Оголошення додано.",
    announcementDeleteConfirm: "Видалити це оголошення?",
    notifNewAnnouncement: (title) => `Оголошення: ${title}`,

    tabSelfGov: "Самоврядування",
    tabChat: "Чат",
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
    messagesComposeHeading: "Написати повідомлення",
    messagesSelectStudent: "Оберіть одержувача...",
    messagesSelectRecipient: "Оберіть одержувача...",
    messagesGroupStudents: "Учні",
    messagesGroupTeachers: "Вчителі",
    messagesComposePlaceholder: "Текст повідомлення...",
    messagesSendBtn: "Надіслати",
    messagesSent: "Повідомлення надіслано.",
    messagesNeedRecipient: "Оберіть учня з прив'язаним акаунтом або колегу.",
    messagesNeedText: "Введіть текст повідомлення.",
    messagesMarkAllRead: "Позначити всі прочитаними",
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
    chatSubjectHintTeacher: "Необов'язково: позначте предмет — учні зможуть фільтрувати стрічку (замість окремих груп у Telegram).",
    chatSubjectHintStudent: "Фільтр за предметом зверху, якщо в чаті багато повідомлень.",
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
    messagesNotifOnlyHint: "Тут лише системні сповіщення (оцінки, ДЗ, оголошення). Писати людям — у чаті.",
    notifNewGrade: (value, subject, typeLabel) => `Нова оцінка: ${value} — ${subject} (${typeLabel})`,
    notifGradeComment: "Коментар учителя",
    notifNewHomework: (subject, title) => `Нове ДЗ: ${subject}${title ? " — " + title : ""}`,
    notifNewLesson: (subject, title) => `Новий урок: ${subject}${title ? " — " + title : ""}`,
    notifElectionAnnounced: "Оголошено вибори старости",
    notifElectionResult: (name) => `Новий староста: ${name}`,
    notifAnnouncement: "Повідомлення від учителя",
    notifTeacherMessage: "Повідомлення від колеги",
    gradeCommentPlaceholder: "Коментар (необов'язково)",
    registerSuccess: () =>
      "Акаунт створено. Увійдіть і оберіть або створіть школу.",
    noTeacherRole:
      "У цього акаунта немає прав вчителя. Зареєструйтеся як вчитель або увійдіть іншим акаунтом.",
    schoolHeading: "Оберіть школу",
    schoolHint: "Створіть нову школу (ви станете адміністратором) або приєднайтеся за кодом-запрошенням від адміністратора.",
    schoolModeLabel: "Що зробити",
    schoolModeCreate: "Створити школу",
    schoolModeCreateDesc: "Ви станете адміністратором і зможете запрошувати вчителів",
    schoolModeJoin: "Приєднатися за кодом",
    schoolModeJoinDesc: "Введіть 16-символьний код, який дав адміністратор школи",
    schoolNameLabel: "Назва школи",
    schoolNamePlaceholder: "Наприклад, Ліцей №1",
    schoolInviteLabel: "Код-запрошення",
    schoolInvitePlaceholder: "16 символів",
    schoolContinueBtn: "Продовжити",
    schoolNeedName: "Вкажіть назву школи.",
    schoolNeedCode: "Введіть код-запрошення.",
    schoolCodeNotFound: "Код не знайдено. Перевірте, чи правильно він введений.",
    schoolCodeUsed: "Цей код вже використано. Попросіть новий у адміністратора.",
    schoolCreated: "Школу створено.",
    schoolJoined: "Ви приєдналися до школи.",
    tabTeachers: "Вчителі",
    teachersInviteHeading: "Запросити вчителя",
    teachersInviteHint: "Згенеруйте 16-символьний код і передайте його новому вчителю. Після реєстрації він введе код на екрані вибору школи.",
    teachersGenerateBtn: "Згенерувати код",
    teachersInviteGeneratedHint: "Скопіюйте код і надішліть учителю. Код одноразовий.",
    teachersPendingInvitesHeading: "Невикористані коди",
    noTeacherInvitesMsg: "Немає активних кодів-запрошень.",
    teachersListHeading: "Вчителі школи",
    teachersListHint: "Усі вчителі та адміністратори, прив'язані до вашої школи.",
    noTeachersMsg: "Поки що лише ви.",
    teacherRoleAdmin: "Адміністратор",
    teacherRoleTeacher: "Вчитель",
    teacherRolePending: "Очікує",
    teacherInviteDelete: "Видалити код",
    teacherInviteCopied: "Код скопійовано",
    teacherInviteCreatedAt: "Створено",
    teacherEmailLabel: "Email",
    teachersOnlyAdmin: "Ця вкладка доступна лише адміністратору школи.",
    setupHeading: "Налаштування профілю",
    setupHint: "Вкажіть ПІБ (буде видно учням у повідомленнях) та оберіть предмети, які ви викладаєте. Або увійдіть як адміністратор з повним доступом.",
    setupNameLabel: "ПІБ",
    setupNamePlaceholder: "Прізвище Ім'я По батькові",
    setupRoleLabel: "Роль",
    setupRoleTeacher: "Вчитель",
    setupRoleTeacherDesc: "Керуєте уроками й оцінками зі своїх предметів",
    setupRoleAdmin: "Адміністратор",
    setupRoleAdminDesc: "Повний доступ до всіх класів, предметів і налаштувань",
    setupSubjectsLabel: "Мої предмети",
    setupSubjectsHint: "Оберіть один або кілька предметів. Уроки інших предметів вам будуть недоступні.",
    setupSubjectsSelected: (n) => n === 0 ? "Нічого не обрано" : `Обрано: ${n}`,
    setupNoSubjects: "Предметів у системі ще немає. Зверніться до адміністратора або створіть предмети після входу як адмін.",
    setupSaveBtn: "Зберегти і продовжити",
    setupNeedName: "Вкажіть ПІБ.",
    setupNeedSubjects: "Оберіть хоча б один предмет (або роль адміністратора).",
    setupSaved: "Профіль збережено.",
    teacherOnlySubjectsHint: "Показано лише ваші предмети.",
    pointsLeaderboardHeading: "Топ за балами",
    pointsLeaderboardHint: "Рейтинг учнів за балами",
    pointsLeaderboardEmpty: "Ще немає учнів з балами.",
    pointsLeaderboardPoints: "балів",
    pointsLeaderboardRank: "Місце",
    pointsHistoryBtnTitle: "Історія балів",
    pointsHistoryTitle: "Історія балів",
    pointsHistoryEmpty: "Історії змін балів ще немає.",
    pointsHistoryDelta: "Зміна",
    pointsHistoryBalance: "Баланс",
    pointsHistoryBy: "Хто",
    pointsHistoryWhen: "Коли",
    pointsHistoryClose: "Закрити",
    pointsHistoryNotePlaceholder: "Примітка (необов'язково)",
    pointsHistoryNote: "Примітка",
    lbModeSchool: "Вся школа",
    lbModeClass: "Клас",
    settingsBellTab: "Розклад дзвінків",
    settingsBellHeading: "Розклад дзвінків за замовчуванням",
    settingsBellHint: "Ці часи застосовуються до нових класів і груп. Можна також застосувати їх до всіх уже існуючих розкладів. Окремий клас після цього можна змінити вручну на вкладці «Розклад».",
    settingsBellPeriodsLabel: "Звичайний розклад дзвінків",
    settingsBellDayTimesLabel: "Особливий розклад дзвінків для дня",
    settingsBellDayTimesHint: "Наприклад, скорочені уроки в суботу. Якщо для дня нічого не задано — використовується звичайний розклад.",
    settingsBellApplyAllBtn: "Застосувати до всіх класів",
    settingsBellApplyAllConfirm: "Замінити розклад дзвінків (і особливий розклад днів) у всіх існуючих класах/групах на ці значення? Уроки в розкладі не зміняться. Окремі класи потім можна знову відредагувати.",
    settingsBellApplyAllDone: "Розклад дзвінків застосовано до всіх класів.",
    settingsBellSaved: "Збережено.",
    settingsBellAddPeriod: "Додати урок",
    settingsBellClearDay: "Скинути особливий розклад цього дня",
    settingsBellUseCustomDay: "Свій розклад для цього дня",
    settingsTitle: "Налаштування",
    settingsBack: "Назад",
    settingsTabAppearance: "Оформлення",
    settingsGlassLabel: "Матове скло на фоні",
    settingsGlassHint: "Частинки та ефект розмиття карток. Вимкніть для звичайного фону.",
    settingsAppearanceHint: "Тема та режим фону змінюються кнопками в шапці (поруч із мовою).",
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
      "After registration, create or join a school — your role is assigned automatically. " +
      "Invite new teachers with a 16-character code on the Teachers tab.",
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
    subjectRoomPlaceholder: "Room (optional)",
    roomLabel: "Room",
    roomShort: "rm.",
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
    gradesPanelHint: "Enter a grade (1–12) or «Н» (absent) for each student. You can grade the lesson and homework separately. An empty field means no grade yet.",
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
    gradesAbsencesLabel: "Absences (Н)",
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
    gradesPeriodLabel: "Period",
    gradesPeriodAll: "All time",
    gradesPeriodThisMonth: "This month",
    gradesPeriodLastMonth: "Last month",
    gradesPeriodSemester1: "1st semester",
    gradesPeriodSemester2: "2nd semester",
    gradesPeriodCustom: "Custom range",
    gradesPeriodFrom: "From",
    gradesPeriodTo: "To",
    gradesLegendLesson: "Lesson",
    gradesLegendHw: "HW",
    homeworkNoDueDate: "HW with no due date",
    hasHomeworkLabel: "Has homework",
    hasHomeworkHint: "Enable to add homework without a due date. Filling in a due date also marks homework.",
    homeworkDateOptionalHint: "Optional — can be left empty",
    finalGradesHeading: "Final grades",
    finalGradesHint: "Semester and year grades. “Auto” fills the rounded average of current grades for the period.",
    finalGradesNoSubjects: "No subjects for final grades.",
    finalPeriod_semester1: "1st semester",
    finalPeriod_semester2: "2nd semester",
    finalPeriod_year: "Year",
    finalGradeAutoBtn: "Auto",
    finalGradeAutoTitle: "Set from average",
    finalGradeNoAvg: "Not enough grades to compute an average.",

    tabAnnouncements: "Announcements",
    announcementsHeading: "Announcements",
    addAnnouncementHeading: "Add announcement",
    announcementsTeacherHint: "Announcements are visible to all students or only selected classes. Students will get a notification.",
    announcementTitlePlaceholder: "Title",
    announcementBodyPlaceholder: "Announcement text",
    announcementClassesHint: "If nothing is selected — the announcement is for all classes.",
    noAnnouncementsMsg: "No announcements yet.",
    announcementAllClasses: "All classes",
    announcementFrom: "From",
    announcementNeedTitle: "Enter an announcement title.",
    announcementNeedBody: "Enter the announcement text.",
    announcementAdded: "Announcement added.",
    announcementDeleteConfirm: "Delete this announcement?",
    notifNewAnnouncement: (title) => `Announcement: ${title}`,

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
    messagesComposeHeading: "Send a message",
    messagesSelectStudent: "Select recipient...",
    messagesSelectRecipient: "Select recipient...",
    messagesGroupStudents: "Students",
    messagesGroupTeachers: "Teachers",
    messagesComposePlaceholder: "Message text...",
    messagesSendBtn: "Send",
    messagesSent: "Message sent.",
    messagesNeedRecipient: "Select a linked student or a colleague.",
    messagesNeedText: "Enter a message.",
    messagesMarkAllRead: "Mark all as read",
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
    chatSubjectHintTeacher: "Optional: tag a subject so students can filter the thread (instead of separate Telegram groups).",
    chatSubjectHintStudent: "Filter by subject above if the chat is busy.",
    chatSendError: "Failed to send message.",
    messagesNotifOnlyHint: "System notifications only (grades, homework, announcements). To write to people, use Chat.",
    notifNewGrade: (value, subject, typeLabel) => `New grade: ${value} — ${subject} (${typeLabel})`,
    notifGradeComment: "Teacher comment",
    notifNewHomework: (subject, title) => `New homework: ${subject}${title ? " — " + title : ""}`,
    notifNewLesson: (subject, title) => `New lesson: ${subject}${title ? " — " + title : ""}`,
    notifElectionAnnounced: "Class monitor elections announced",
    notifElectionResult: (name) => `New class monitor: ${name}`,
    notifAnnouncement: "Message from teacher",
    notifTeacherMessage: "Message from colleague",
    gradeCommentPlaceholder: "Comment (optional)",
    registerSuccess: () =>
      "Account created. Sign in and create or join a school.",
    noTeacherRole:
      "This account doesn't have teacher rights. Register as a teacher or use a different account.",
    schoolHeading: "Choose a school",
    schoolHint: "Create a new school (you become the administrator) or join with an invite code from an admin.",
    schoolModeLabel: "What to do",
    schoolModeCreate: "Create a school",
    schoolModeCreateDesc: "You become the admin and can invite teachers",
    schoolModeJoin: "Join with a code",
    schoolModeJoinDesc: "Enter the 16-character code from the school admin",
    schoolNameLabel: "School name",
    schoolNamePlaceholder: "e.g. Lyceum No. 1",
    schoolInviteLabel: "Invite code",
    schoolInvitePlaceholder: "16 characters",
    schoolContinueBtn: "Continue",
    schoolNeedName: "Enter the school name.",
    schoolNeedCode: "Enter the invite code.",
    schoolCodeNotFound: "Code not found. Check that it's typed correctly.",
    schoolCodeUsed: "This code has already been used. Ask the admin for a new one.",
    schoolCreated: "School created.",
    schoolJoined: "You joined the school.",
    tabTeachers: "Teachers",
    teachersInviteHeading: "Invite a teacher",
    teachersInviteHint: "Generate a 16-character code and share it with the new teacher. After registration they enter it on the school selection screen.",
    teachersGenerateBtn: "Generate code",
    teachersInviteGeneratedHint: "Copy the code and send it to the teacher. The code is single-use.",
    teachersPendingInvitesHeading: "Unused codes",
    noTeacherInvitesMsg: "No active invite codes.",
    teachersListHeading: "School teachers",
    teachersListHint: "All teachers and admins linked to your school.",
    noTeachersMsg: "Just you for now.",
    teacherRoleAdmin: "Administrator",
    teacherRoleTeacher: "Teacher",
    teacherRolePending: "Pending",
    teacherInviteDelete: "Delete code",
    teacherInviteCopied: "Code copied",
    teacherInviteCreatedAt: "Created",
    teacherEmailLabel: "Email",
    teachersOnlyAdmin: "This tab is only available to the school administrator.",
    setupHeading: "Profile setup",
    setupHint: "Enter your full name (shown to students in messages) and select the subjects you teach. Or sign in as an administrator with full access.",
    setupNameLabel: "Full name",
    setupNamePlaceholder: "Full name",
    setupRoleLabel: "Role",
    setupRoleTeacher: "Teacher",
    setupRoleTeacherDesc: "Manage lessons and grades for your subjects",
    setupRoleAdmin: "Administrator",
    setupRoleAdminDesc: "Full access to all classes, subjects and settings",
    setupSubjectsLabel: "My subjects",
    setupSubjectsHint: "Select one or more subjects. Lessons for other subjects will be hidden.",
    setupSubjectsSelected: (n) => n === 0 ? "None selected" : `Selected: ${n}`,
    setupNoSubjects: "No subjects in the system yet. Ask an admin or create subjects after signing in as admin.",
    setupSaveBtn: "Save and continue",
    setupNeedName: "Please enter your full name.",
    setupNeedSubjects: "Select at least one subject (or choose administrator).",
    setupSaved: "Profile saved.",
    teacherOnlySubjectsHint: "Only your subjects are shown.",
    pointsLeaderboardHeading: "Points leaderboard",
    pointsLeaderboardHint: "Student ranking by points",
    pointsLeaderboardEmpty: "No students with points yet.",
    pointsLeaderboardPoints: "points",
    pointsLeaderboardRank: "Rank",
    pointsHistoryBtnTitle: "Points history",
    pointsHistoryTitle: "Points history",
    pointsHistoryEmpty: "No points changes yet.",
    pointsHistoryDelta: "Change",
    pointsHistoryBalance: "Balance",
    pointsHistoryBy: "By",
    pointsHistoryWhen: "When",
    pointsHistoryClose: "Close",
    pointsHistoryNotePlaceholder: "Note (optional)",
    pointsHistoryNote: "Note",
    lbModeSchool: "Whole school",
    lbModeClass: "Class",
    settingsBellTab: "Bell schedule",
    settingsBellHeading: "Default bell schedule",
    settingsBellHint: "These times apply to new classes and groups. You can also apply them to all existing schedules. Individual classes can still be edited on the Schedule tab.",
    settingsBellPeriodsLabel: "Regular bell schedule",
    settingsBellDayTimesLabel: "Custom bell schedule for a day",
    settingsBellDayTimesHint: "E.g. shorter lessons on Saturday. If a day has no custom times, the regular schedule is used.",
    settingsBellApplyAllBtn: "Apply to all classes",
    settingsBellApplyAllConfirm: "Replace the bell schedule (and custom day schedules) in all existing classes/groups with these values? Lessons in the grid will not change. You can still edit individual classes afterwards.",
    settingsBellApplyAllDone: "Bell schedule applied to all classes.",
    settingsBellSaved: "Saved.",
    settingsBellAddPeriod: "Add period",
    settingsBellClearDay: "Clear custom schedule for this day",
    settingsBellUseCustomDay: "Custom schedule for this day",
    settingsTitle: "Settings",
    settingsBack: "Back",
    settingsTabAppearance: "Appearance",
    settingsGlassLabel: "Frosted glass background",
    settingsGlassHint: "Particles and card blur. Turn off for a plain background.",
    settingsAppearanceHint: "Theme and background mode are controlled by the buttons in the header.",
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
  ensureSettingsPanel();
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
ensureSettingsPanel();

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
    if (leaderboardMode === "class") populateLbClassSelect();
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
    await seedGroupScheduleFromDefaults(groupRef.id);
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
    await seedGroupScheduleFromDefaults(ref.id);
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

const schoolScreen = document.getElementById("school-screen");
const schoolNameInput = document.getElementById("school-name-input");
const schoolInviteInput = document.getElementById("school-invite-input");
const schoolCreateBlock = document.getElementById("school-create-block");
const schoolJoinBlock = document.getElementById("school-join-block");
const schoolContinueBtn = document.getElementById("school-continue-btn");
const schoolLogoutBtn = document.getElementById("school-logout-btn");
const schoolError = document.getElementById("school-error");

const setupScreen = document.getElementById("setup-screen");
const setupDisplayName = document.getElementById("setup-display-name");
const setupSubjectsList = document.getElementById("setup-subjects-list");
const setupNoSubjects = document.getElementById("setup-no-subjects");
const setupSubjectsBlock = document.getElementById("setup-subjects-block");
const setupSubjectsCount = document.getElementById("setup-subjects-count");
const pointsLeaderboardEl = document.getElementById("points-leaderboard");
const pointsLeaderboardEmpty = document.getElementById("points-leaderboard-empty");
const lbModeSchoolBtn = document.getElementById("lb-mode-school-btn");
const lbModeClassBtn = document.getElementById("lb-mode-class-btn");
const lbClassPicker = document.getElementById("lb-class-picker");
const lbClassSelect = document.getElementById("lb-class-select");
let leaderboardMode = "school"; // "school" | "class"
let leaderboardClassId = null;
const setupSaveBtn = document.getElementById("setup-save-btn");
const setupLogoutBtn = document.getElementById("setup-logout-btn");
const setupError = document.getElementById("setup-error");
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
const tabAnnouncementsBtn = document.getElementById("tab-announcements-btn");
const tabSelfGovBtn = document.getElementById("tab-selfgov-btn");
const tabTeachersBtn = document.getElementById("tab-teachers-btn");
const tabChatBtn = document.getElementById("tab-chat-btn");
const chatPanelEl = document.getElementById("chat-panel");
const pointsPanel = document.getElementById("points-panel");
const schedulePanel = document.getElementById("schedule-panel");
const tasksPanel = document.getElementById("tasks-panel");
const gradesPanelEl = document.getElementById("grades-panel");
const announcementsPanelEl = document.getElementById("announcements-panel");
const selfgovPanelEl = document.getElementById("selfgov-panel");
const teachersPanelEl = document.getElementById("teachers-panel");
const generateTeacherInviteBtn = document.getElementById("generate-teacher-invite-btn");
const teacherInviteCodeDisplay = document.getElementById("teacher-invite-code-display");
const teacherInviteGeneratedHint = document.getElementById("teacher-invite-generated-hint");
const teacherInvitesListEl = document.getElementById("teacher-invites-list");
const noTeacherInvitesMsg = document.getElementById("no-teacher-invites-msg");
const teachersListEl = document.getElementById("teachers-list");
const noTeachersMsg = document.getElementById("no-teachers-msg");
const teacherGradesStudentSelect = document.getElementById("teacher-grades-student-select");
const teacherGradesTableContainer = document.getElementById("teacher-grades-table-container");
const teacherNoGradesMsg = document.getElementById("teacher-no-grades-msg");
const teacherGradesAnalyticsEl = document.getElementById("teacher-grades-analytics");
const teacherGradesStatOverall = document.getElementById("teacher-grades-stat-overall");
const teacherGradesStatCount = document.getElementById("teacher-grades-stat-count");
const teacherGradesStatAbsences = document.getElementById("teacher-grades-stat-absences");
const teacherGradesStatBest = document.getElementById("teacher-grades-stat-best");
const teacherGradesStatTrend = document.getElementById("teacher-grades-stat-trend");
const teacherGradesChartBars = document.getElementById("teacher-grades-chart-bars");
const teacherGradesChartEmpty = document.getElementById("teacher-grades-chart-empty");
const teacherGradesChartTrend = document.getElementById("teacher-grades-chart-trend");
let teacherGradesSelectedStudentId = "";
let teacherGradesPeriod = "all";
let teacherGradesFrom = "";
let teacherGradesTo = "";
const teacherGradesPeriodSelect = document.getElementById("teacher-grades-period-select");
const teacherGradesCustomRange = document.getElementById("teacher-grades-custom-range");
const teacherGradesFromInput = document.getElementById("teacher-grades-from");
const teacherGradesToInput = document.getElementById("teacher-grades-to");
const GRADE_SCALE_MAX = 12;

const newSubjectName = document.getElementById("new-subject-name");
const newSubjectLink = document.getElementById("new-subject-link");
const newSubjectRoom = document.getElementById("new-subject-room");
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
const newLessonHasHw = document.getElementById("new-lesson-has-hw");
if (newLessonHwDate && newLessonHasHw) {
  newLessonHwDate.addEventListener("change", () => {
    if (newLessonHwDate.value) newLessonHasHw.checked = true;
  });
}
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
  const source = myDisplayName() || user.email || "?";
  avatarEl.textContent = source.charAt(0).toUpperCase();
  avatarEl.title = myDisplayName() + (user.email ? ` (${user.email})` : "");
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
  if (tabAnnouncementsBtn) tabAnnouncementsBtn.classList.toggle("active", tab === "announcements");
  if (tabSelfGovBtn) tabSelfGovBtn.classList.toggle("active", tab === "selfgov");
  if (tabTeachersBtn) tabTeachersBtn.classList.toggle("active", tab === "teachers");
  if (tabChatBtn) tabChatBtn.classList.toggle("active", tab === "chat");
  pointsPanel.classList.toggle("hidden", tab !== "points");
  schedulePanel.classList.toggle("hidden", tab !== "schedule");
  tasksPanel.classList.toggle("hidden", tab !== "tasks");
  if (gradesPanelEl) gradesPanelEl.classList.toggle("hidden", tab !== "grades");
  if (announcementsPanelEl) announcementsPanelEl.classList.toggle("hidden", tab !== "announcements");
  if (selfgovPanelEl) selfgovPanelEl.classList.toggle("hidden", tab !== "selfgov");
  if (teachersPanelEl) teachersPanelEl.classList.toggle("hidden", tab !== "teachers");
  if (chatPanelEl) chatPanelEl.classList.toggle("hidden", tab !== "chat");
  document.body.classList.toggle("chat-tab-open", tab === "chat");
  const greeting = document.querySelector(".greeting-card");
  const stats = document.querySelector(".stats-grid");
  if (greeting) greeting.classList.toggle("hidden", tab === "chat");
  if (stats) stats.classList.toggle("hidden", tab === "chat");
  if (tab === "grades") {
    renderTeacherGradesStudentSelect();
    renderTeacherGradesTable();
  }
  if (tab === "announcements") {
    renderAnnouncementClassOptions();
    renderTeacherAnnouncements();
  }
  if (tab === "selfgov") {
    renderSelfGovTeacher();
  }
  if (tab === "teachers") {
    renderTeachersTab();
  }
  if (tab === "chat") {
    const api = ensureChatApi();
    if (api && api.onTabActivated) api.onTabActivated();
    else if (api && api.start) api.start();
  } else {
    const api = chatApi;
    if (api && api.onTabDeactivated) api.onTabDeactivated();
  }
}
tabPointsBtn.onclick = () => showTab("points");
tabScheduleBtn.onclick = () => showTab("schedule");
tabTasksBtn.onclick = () => showTab("tasks");
if (tabGradesBtn) tabGradesBtn.onclick = () => showTab("grades");
if (tabAnnouncementsBtn) tabAnnouncementsBtn.onclick = () => showTab("announcements");
if (tabSelfGovBtn) tabSelfGovBtn.onclick = () => showTab("selfgov");
if (tabTeachersBtn) tabTeachersBtn.onclick = () => showTab("teachers");
if (tabChatBtn) tabChatBtn.onclick = () => showTab("chat");

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
      schoolId: null,
    });
    authError.textContent = t("registerSuccess")();
    await signOut(auth);
  } catch (e) {
    authError.textContent = errorText(e);
  } finally {
    isRegistering = false;
  }
};

logoutBtn.onclick = () => signOut(auth);

function needsSchool(data) {
  return !data || !data.schoolId;
}

onAuthStateChanged(auth, async (user) => {
  if (isRegistering) return;

  if (!user) {
    currentUserProfile = null;
    showAuthScreen();
    return;
  }
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : null;
  const role = data ? data.role : null;

  if (role !== "teacher" && role !== "admin" && role !== "pending-teacher") {
    authError.textContent = t("noTeacherRole");
    await signOut(auth);
    return;
  }

  currentUserProfile = { ...(data || {}), uid: user.uid };

  if (needsSchool(currentUserProfile)) {
    showSchoolScreen();
    return;
  }

  if (profileNeedsSetup(currentUserProfile)) {
    showSetupScreen();
    listenToSubjects();
    return;
  }

  enterApp(user);
});

function enterApp(user) {
  showAppScreen();
  updateAvatar(user);
  updateGreetingDate();
  if (tabTeachersBtn) {
    tabTeachersBtn.classList.toggle("hidden", !isAdmin());
  }
  listenToClasses();
  listenToStudents();
  listenToSubjects();
  listenToSchedule();
  listenToLessons();
  listenToGrades();
  subscribeElectionsAndHistory();
  subscribeTeacherNotifications();
  subscribeTeacherAnnouncements();
  subscribeScheduleDefaults();
  initBellScheduleSettings();
  subscribeTeachersData();
  showMessagesFab(true);
  try {
    ensureChatApi().start();
  } catch (e) {
    console.warn("chat start", e);
  }
}

function showSchoolScreen() {
  if (authScreen) authScreen.classList.add("hidden");
  if (appScreen) appScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.add("hidden");
  if (schoolScreen) schoolScreen.classList.remove("hidden");
  if (schoolError) schoolError.textContent = "";
  if (schoolNameInput) schoolNameInput.value = "";
  if (schoolInviteInput) schoolInviteInput.value = "";
  const createRadio = document.querySelector('input[name="school-mode"][value="create"]');
  if (createRadio) createRadio.checked = true;
  toggleSchoolModeBlocks();
}

function toggleSchoolModeBlocks() {
  const mode = document.querySelector('input[name="school-mode"]:checked');
  const isJoin = mode && mode.value === "join";
  if (schoolCreateBlock) schoolCreateBlock.classList.toggle("hidden", isJoin);
  if (schoolJoinBlock) schoolJoinBlock.classList.toggle("hidden", !isJoin);
}

document.querySelectorAll('input[name="school-mode"]').forEach((r) => {
  r.addEventListener("change", toggleSchoolModeBlocks);
});

if (schoolLogoutBtn) {
  schoolLogoutBtn.onclick = () => signOut(auth);
}

if (schoolContinueBtn) {
  schoolContinueBtn.onclick = async () => {
    if (schoolError) schoolError.textContent = "";
    const modeEl = document.querySelector('input[name="school-mode"]:checked');
    const mode = modeEl ? modeEl.value : "create";
    const uid = auth.currentUser && auth.currentUser.uid;
    if (!uid) return;
    try {
      if (mode === "create") {
        const name = schoolNameInput ? schoolNameInput.value.trim() : "";
        if (!name) {
          if (schoolError) schoolError.textContent = t("schoolNeedName");
          return;
        }
        const schoolRef = await addDoc(collection(db, "schools"), {
          name,
          createdBy: uid,
          createdAt: Date.now(),
          creatorEmail: (auth.currentUser && auth.currentUser.email) || null,
        });
        await setDoc(
          doc(db, "users", uid),
          {
            role: "admin",
            schoolId: schoolRef.id,
            schoolName: name,
            email: (auth.currentUser && auth.currentUser.email) || null,
          },
          { merge: true }
        );
        currentUserProfile = {
          ...(currentUserProfile || {}),
          role: "admin",
          schoolId: schoolRef.id,
          schoolName: name,
          uid,
        };
      } else {
        const raw = schoolInviteInput
          ? schoolInviteInput.value.trim().toUpperCase().replace(/\s+/g, "")
          : "";
        if (!raw || raw.length < 8) {
          if (schoolError) schoolError.textContent = t("schoolNeedCode");
          return;
        }
        const inviteRef = doc(db, "teacherInvites", raw);
        const inviteSnap = await getDoc(inviteRef);
        if (!inviteSnap.exists()) {
          if (schoolError) schoolError.textContent = t("schoolCodeNotFound");
          return;
        }
        const inv = inviteSnap.data();
        if (inv.usedBy) {
          if (schoolError) schoolError.textContent = t("schoolCodeUsed");
          return;
        }
        await updateDoc(inviteRef, {
          usedBy: uid,
          usedAt: Date.now(),
          usedEmail: (auth.currentUser && auth.currentUser.email) || null,
        });
        await setDoc(
          doc(db, "users", uid),
          {
            role: "teacher",
            schoolId: inv.schoolId,
            schoolName: inv.schoolName || null,
            email: (auth.currentUser && auth.currentUser.email) || null,
            invitedBy: inv.createdBy || null,
          },
          { merge: true }
        );
        currentUserProfile = {
          ...(currentUserProfile || {}),
          role: "teacher",
          schoolId: inv.schoolId,
          schoolName: inv.schoolName || null,
          uid,
        };
      }
      if (schoolScreen) schoolScreen.classList.add("hidden");
      if (profileNeedsSetup(currentUserProfile)) {
        showSetupScreen();
        listenToSubjects();
      } else {
        enterApp(auth.currentUser);
      }
    } catch (e) {
      if (schoolError) schoolError.textContent = errorText(e);
    }
  };
}

function showSetupScreen() {
  if (authScreen) authScreen.classList.add("hidden");
  if (appScreen) appScreen.classList.add("hidden");
  if (schoolScreen) schoolScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.remove("hidden");
  if (setupError) setupError.textContent = "";
  if (setupDisplayName) {
    setupDisplayName.value = (currentUserProfile && currentUserProfile.displayName) || "";
  }
  const role = (currentUserProfile && currentUserProfile.role) || "teacher";
  const roleVal = role === "admin" ? "admin" : "teacher";
  const roleLocked = !!(currentUserProfile && currentUserProfile.schoolId);
  document.querySelectorAll('input[name="setup-role"]').forEach((r) => {
    r.checked = r.value === roleVal;
    r.disabled = roleLocked;
  });
  const roleBlock = document.querySelector(".setup-role-block");
  if (roleBlock) roleBlock.classList.toggle("is-locked", roleLocked);
  toggleSetupSubjectsVisibility();
  renderSetupSubjectsList();
  document.querySelectorAll('input[name="setup-role"]').forEach((r) => {
    r.onchange = () => toggleSetupSubjectsVisibility();
  });
}

function toggleSetupSubjectsVisibility() {
  const roleInput = document.querySelector('input[name="setup-role"]:checked');
  const isAdm = roleInput && roleInput.value === "admin";
  if (setupSubjectsBlock) setupSubjectsBlock.classList.toggle("hidden", !!isAdm);
}

function updateSetupSubjectsCount() {
  if (!setupSubjectsCount || !setupSubjectsList) return;
  const n = setupSubjectsList.querySelectorAll('input[type="checkbox"]:checked').length;
  const fn = translations[currentLang] && translations[currentLang].setupSubjectsSelected;
  setupSubjectsCount.textContent = typeof fn === "function" ? fn(n) : (n === 0 ? "—" : String(n));
  setupSubjectsCount.classList.toggle("is-empty", n === 0);
  setupSubjectsCount.classList.toggle("is-filled", n > 0);
}

function renderSetupSubjectsList() {
  if (!setupSubjectsList) return;
  setupSubjectsList.innerHTML = "";
  const selected = new Set(
    currentUserProfile && Array.isArray(currentUserProfile.subjectIds)
      ? currentUserProfile.subjectIds
      : []
  );
  if (lastSubjects.length === 0) {
    if (setupNoSubjects) setupNoSubjects.classList.remove("hidden");
    updateSetupSubjectsCount();
    return;
  }
  if (setupNoSubjects) setupNoSubjects.classList.add("hidden");
  lastSubjects.forEach(({ id, data }) => {
    const label = document.createElement("label");
    label.className = "setup-subject-chip";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = id;
    cb.checked = selected.has(id);
    cb.addEventListener("change", () => {
      label.classList.toggle("is-selected", cb.checked);
      updateSetupSubjectsCount();
    });
    const check = document.createElement("span");
    check.className = "setup-subject-check";
    check.setAttribute("aria-hidden", "true");
    check.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const name = document.createElement("span");
    name.className = "setup-subject-name";
    name.textContent = data.name || id;
    label.classList.toggle("is-selected", cb.checked);
    label.append(cb, check, name);
    setupSubjectsList.appendChild(label);
  });
  updateSetupSubjectsCount();
}

if (setupSaveBtn) {
  setupSaveBtn.onclick = async () => {
    if (setupError) setupError.textContent = "";
    const name = setupDisplayName ? setupDisplayName.value.trim() : "";
    if (!name) {
      if (setupError) setupError.textContent = t("setupNeedName");
      return;
    }
    const roleInput = document.querySelector('input[name="setup-role"]:checked');
    const role = roleInput ? roleInput.value : "teacher";
    let subjectIds = [];
    if (role === "teacher") {
      subjectIds = setupSubjectsList
        ? [...setupSubjectsList.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value)
        : [];
      if (subjectIds.length === 0) {
        if (setupError) setupError.textContent = t("setupNeedSubjects");
        return;
      }
    }
    const uid = auth.currentUser && auth.currentUser.uid;
    if (!uid) return;
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          role,
          displayName: name,
          subjectIds: role === "admin" ? [] : subjectIds,
          email: auth.currentUser.email || null,
          profileCompletedAt: Date.now(),
        },
        { merge: true }
      );
      currentUserProfile = {
        ...(currentUserProfile || {}),
        role,
        displayName: name,
        subjectIds: role === "admin" ? [] : subjectIds,
        uid,
      };
      if (setupScreen) setupScreen.classList.add("hidden");
      enterApp(auth.currentUser);
    } catch (e) {
      if (setupError) setupError.textContent = errorText(e);
    }
  };
}
if (setupLogoutBtn) {
  setupLogoutBtn.onclick = () => signOut(auth);
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.add("hidden");
  if (schoolScreen) schoolScreen.classList.add("hidden");
  currentUserProfile = null;
  if (unsubscribeClasses) unsubscribeClasses();
  if (unsubscribeStudents) unsubscribeStudents();
  if (unsubscribeLessons) unsubscribeLessons();
  if (unsubscribeSubjects) unsubscribeSubjects();
  if (unsubscribeSchedule) unsubscribeSchedule();
  if (unsubscribeGrades) unsubscribeGrades();
  if (unsubscribeElections) { unsubscribeElections(); unsubscribeElections = null; }
  if (unsubscribeStarostaHistory) { unsubscribeStarostaHistory(); unsubscribeStarostaHistory = null; }
  if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
  if (unsubscribeTeacherInvites) { unsubscribeTeacherInvites(); unsubscribeTeacherInvites = null; }
  if (unsubscribeSchoolTeachers) { unsubscribeSchoolTeachers(); unsubscribeSchoolTeachers = null; }
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    liveStatusInterval = null;
  }
  showMessagesFab(false);
  closeMessagesPanel();
  if (chatApi) {
    try { chatApi.stop(); } catch (e) { console.warn(e); }
  }
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.add("hidden");
  if (schoolScreen) schoolScreen.classList.add("hidden");
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

function populateLbClassSelect() {
  if (!lbClassSelect) return;
  const prev = leaderboardClassId || lbClassSelect.value || currentClassId;
  lbClassSelect.innerHTML = "";
  const locale = currentLang === "uk" ? "uk" : "en";
  const classes = lastClasses.slice().sort((a, b) =>
    (a.data.name || "").localeCompare(b.data.name || "", locale)
  );
  if (classes.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "—";
    lbClassSelect.appendChild(opt);
    return;
  }
  classes.forEach(({ id, data }) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.name || id;
    lbClassSelect.appendChild(opt);
  });
  if (prev && [...lbClassSelect.options].some((o) => o.value === prev)) {
    lbClassSelect.value = prev;
    leaderboardClassId = prev;
  } else {
    leaderboardClassId = classes[0].id;
    lbClassSelect.value = leaderboardClassId;
  }
}

function setLeaderboardMode(mode) {
  leaderboardMode = mode === "class" ? "class" : "school";
  if (lbModeSchoolBtn) lbModeSchoolBtn.classList.toggle("active", leaderboardMode === "school");
  if (lbModeClassBtn) lbModeClassBtn.classList.toggle("active", leaderboardMode === "class");
  if (lbClassPicker) lbClassPicker.classList.toggle("hidden", leaderboardMode !== "class");
  if (leaderboardMode === "class") populateLbClassSelect();
  renderPointsLeaderboard();
}

if (lbModeSchoolBtn) lbModeSchoolBtn.onclick = () => setLeaderboardMode("school");
if (lbModeClassBtn) lbModeClassBtn.onclick = () => setLeaderboardMode("class");
if (lbClassSelect) {
  lbClassSelect.onchange = () => {
    leaderboardClassId = lbClassSelect.value || null;
    renderPointsLeaderboard();
  };
}

function renderPointsLeaderboard() {
  if (!pointsLeaderboardEl) return;
  pointsLeaderboardEl.innerHTML = "";
  let pool = lastStudents;
  if (leaderboardMode === "class") {
    const classId = leaderboardClassId || (lbClassSelect && lbClassSelect.value) || currentClassId;
    if (classId) {
      const groupIdsInClass = new Set(groupsOfClass(classId).map((g) => g.id));
      pool = lastStudents.filter((s) => groupIdsInClass.has(s.data.group));
    } else {
      pool = [];
    }
  }
  const ranked = pool
    .filter((s) => (s.data.points || 0) > 0)
    .slice()
    .sort(
      (a, b) =>
        (b.data.points || 0) - (a.data.points || 0) ||
        (a.data.name || "").localeCompare(b.data.name || "", currentLang === "uk" ? "uk" : "en")
    )
    .slice(0, 10);
  if (pointsLeaderboardEmpty) {
    pointsLeaderboardEmpty.classList.toggle("hidden", ranked.length > 0);
  }
  if (ranked.length === 0) return;
  ranked.forEach(({ data }, index) => {
    const pts = data.points || 0;
    const row = document.createElement("div");
    row.className = "points-leader-row" + (index < 3 ? ` rank-${index + 1}` : "");
    const rank = document.createElement("span");
    rank.className = "points-leader-rank";
    if (index === 0) rank.textContent = "🥇";
    else if (index === 1) rank.textContent = "🥈";
    else if (index === 2) rank.textContent = "🥉";
    else rank.textContent = String(index + 1);
    const avatar = document.createElement("span");
    avatar.className = "points-leader-avatar";
    const nameStr = data.name || "?";
    avatar.textContent = nameStr.trim().charAt(0).toUpperCase() || "?";
    const info = document.createElement("div");
    info.className = "points-leader-info";
    const nameEl = document.createElement("span");
    nameEl.className = "points-leader-name";
    nameEl.textContent = nameStr;
    const meta = document.createElement("span");
    meta.className = "points-leader-meta";
    meta.textContent = getGroupLabel(data.group) || "";
    info.append(nameEl, meta);
    const score = document.createElement("span");
    score.className = "points-leader-score";
    const unit = document.createElement("span");
    unit.className = "points-leader-unit";
    unit.textContent = t("pointsLeaderboardPoints") || t("pointsLabel");
    const strong = document.createElement("strong");
    strong.textContent = String(pts);
    score.append(strong, document.createTextNode(" "), unit);
    row.append(rank, avatar, info, score);
    pointsLeaderboardEl.appendChild(row);
  });
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
  renderPointsLeaderboard();
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

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "points-note-input";
  noteInput.placeholder = t("pointsHistoryNotePlaceholder");
  noteInput.maxLength = 200;

  const takeNote = () => {
    const n = noteInput.value.trim();
    noteInput.value = "";
    return n || null;
  };

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.textContent = "-1";
  minusBtn.onclick = () => changePoints(id, data.points, -1, takeNote());

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.textContent = "+1";
  plusBtn.onclick = () => changePoints(id, data.points, +1, takeNote());

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
      changePoints(id, data.points, delta, takeNote());
      customInput.value = "";
    }
  };

  const historyBtn = document.createElement("button");
  historyBtn.type = "button";
  historyBtn.className = "secondary small points-history-btn";
  historyBtn.textContent = "⏱";
  historyBtn.title = t("pointsHistoryBtnTitle");
  historyBtn.setAttribute("aria-label", t("pointsHistoryBtnTitle"));
  historyBtn.onclick = () => openPointsHistoryPanel(id, data.name || "");

  controls.append(minusBtn, plusBtn, customInput, applyBtn, noteInput, historyBtn);

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

async function changePoints(id, currentPoints, delta, note) {
  if (!delta) return;
  const before = currentPoints || 0;
  const newValue = Math.min(1_000_000, Math.max(0, before + delta));
  const actualDelta = newValue - before;
  if (actualDelta === 0) return;
  const student = lastStudents.find((s) => s.id === id);
  const studentName = (student && student.data && student.data.name) || "";
  try {
    await updateDoc(doc(db, "students", id), { points: newValue });
    await addDoc(collection(db, "pointsHistory"), {
      studentId: id,
      studentName,
      delta: actualDelta,
      pointsBefore: before,
      pointsAfter: newValue,
      teacherUid: auth.currentUser ? auth.currentUser.uid : null,
      teacherName: myDisplayName(),
      note: note && String(note).trim() ? String(note).trim() : null,
      createdAt: Date.now(),
    });
  } catch (e) {
    reportSaveError(e, "Не вдалося змінити бали", "Failed to update points");
  }
}

// ---------- Історія балів (панель вчителя) ----------
let pointsHistoryPanelOpen = false;
let pointsHistoryUnsubscribe = null;
let pointsHistoryStudentId = null;

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
    <p id="points-history-subtitle" class="hint points-history-subtitle"></p>
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
  pointsHistoryStudentId = null;
  if (pointsHistoryUnsubscribe) {
    pointsHistoryUnsubscribe();
    pointsHistoryUnsubscribe = null;
  }
  const panel = document.getElementById("points-history-panel");
  if (panel) panel.classList.add("hidden");
}

function openPointsHistoryPanel(studentId, studentName) {
  const panel = ensurePointsHistoryPanel();
  pointsHistoryPanelOpen = true;
  pointsHistoryStudentId = studentId;
  panel.classList.remove("hidden");
  const titleEl = document.getElementById("points-history-title");
  const subEl = document.getElementById("points-history-subtitle");
  if (titleEl) titleEl.textContent = t("pointsHistoryTitle");
  if (subEl) subEl.textContent = studentName || "";
  const emptyEl = document.getElementById("points-history-empty");
  if (emptyEl) emptyEl.textContent = t("pointsHistoryEmpty");
  if (pointsHistoryUnsubscribe) {
    pointsHistoryUnsubscribe();
    pointsHistoryUnsubscribe = null;
  }
  const listEl = document.getElementById("points-history-list");
  if (listEl) listEl.innerHTML = "";
  const q = query(
    collection(db, "pointsHistory"),
    where("studentId", "==", studentId)
  );
  pointsHistoryUnsubscribe = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
      renderPointsHistoryList(items);
    },
    (err) => {
      console.warn("pointsHistory", err);
      renderPointsHistoryList([]);
    }
  );
}

function renderPointsHistoryList(items) {
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

// ---------- Subjects (предмети) ----------
function listenToSubjects() {
  const q = query(collection(db, "subjects"), orderBy("name"));
  unsubscribeSubjects = onSnapshot(q, (snap) => {
    lastSubjects = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    if (setupScreen && !setupScreen.classList.contains("hidden")) {
      renderSetupSubjectsList();
    }
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
  subjectsList.innerHTML = "";
  const subjects = isAdmin()
    ? lastSubjects
    : lastSubjects.filter((s) => teacherOwnsSubject(s.id));
  subjects.forEach(({ id, data }) => {
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

    const roomInput = document.createElement("input");
    roomInput.type = "text";
    roomInput.className = "subject-item-room";
    roomInput.placeholder = t("subjectRoomPlaceholder");
    roomInput.value = data.room || "";
    roomInput.setAttribute("aria-label", t("roomLabel"));
    roomInput.onblur = async () => {
      const newRoom = roomInput.value.trim();
      if (newRoom === (data.room || "")) return;
      try {
        await updateDoc(doc(db, "subjects", id), { room: newRoom });
      } catch (e) {
        reportSaveError(e, "Не вдалося зберегти кабінет", "Failed to save room number");
      }
    };

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

    li.append(topRow, roomInput, linkInput, hwToggle);
    subjectsList.appendChild(li);
  });
  noSubjectsMsg.classList.toggle("hidden", lastSubjects.length > 0);
}

addSubjectBtn.onclick = async () => {
  const name = newSubjectName.value.trim();
  if (!name) return;
  const meetingLink = newSubjectLink.value.trim();
  const room = newSubjectRoom ? newSubjectRoom.value.trim() : "";
  try {
    const ref = await addDoc(collection(db, "subjects"), { name, meetingLink, room, createdAt: Date.now() });
    // Якщо вчитель (не адмін) — додаємо новий предмет до його subjectIds
    if (!isAdmin() && auth.currentUser) {
      const next = [...new Set([...teacherSubjectIds(), ref.id])];
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { subjectIds: next },
        { merge: true }
      );
      if (currentUserProfile) currentUserProfile.subjectIds = next;
    }
    newSubjectName.value = "";
    newSubjectLink.value = "";
    if (newSubjectRoom) newSubjectRoom.value = "";
  } catch (e) {
    reportSaveError(e, "Не вдалося додати предмет. Перевірте правила Firestore для колекції subjects", "Failed to add the subject. Check Firestore Rules for the subjects collection");
  }
};

function renderSubjectSelects() {
  const forLesson = isAdmin()
    ? lastSubjects
    : lastSubjects.filter((s) => teacherOwnsSubject(s.id));
  const options = forLesson.map((s) => `<option value="${s.id}">${escapeHtml(s.data.name)}</option>`).join("");
  const placeholder = `<option value="" disabled ${forLesson.length ? "" : "selected"}>${t("selectSubjectPlaceholder")}</option>`;

  // Форма додавання уроку (лише предмети вчителя)
  const prevLessonSelectValue = newLessonSubject.value;
  newLessonSubject.innerHTML = placeholder + options;
  if (forLesson.some((s) => s.id === prevLessonSelectValue)) {
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
  const periodTimes = (groupSchedule.times && Object.keys(groupSchedule.times).length)
    ? groupSchedule.times
    : (lastScheduleDefaults.times || {});

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
        const defaults =
          (groupSchedule.times && Object.keys(groupSchedule.times).length
            ? groupSchedule.times
            : lastScheduleDefaults.times) || {};
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
  const periodTimes = getDayEffectiveTimes(groupSchedule, weekdayKey, lastScheduleDefaults);
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

function finalGradeDocId(studentId, subjectId, period) {
  return `final_${studentId}_${subjectId}_${period}`;
}

/** Урок має ДЗ: є дата здачі або явний прапорець hasHomework (ДЗ без дати). */
function lessonHasHomework(data) {
  if (!data) return false;
  return !!(data.homeworkDate || data.hasHomework);
}

const FINAL_GRADE_PERIODS = ["semester1", "semester2", "year"];

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

/** Парсить введену оцінку: 1–12 або «Н» (відсутність). Повертає число, "Н" або null (невалідно / порожньо). */
function parseGradeInput(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (trimmed === "") return null;
  // н / Н / n (латиниця) → «Н»
  if (/^[нНnN]$/u.test(trimmed)) return "Н";
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 12) return null;
  return rounded;
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
    const value = parseGradeInput(trimmed);
    if (value === null) {
      // Невалідне значення — не зберігаємо
      return;
    }
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


function getFinalGradeValue(studentId, subjectId, period) {
  const found = lastGrades.find(
    (g) =>
      g.data.type === "final" &&
      g.data.studentId === studentId &&
      g.data.subjectId === subjectId &&
      g.data.period === period
  );
  return found ? found.data.value : null;
}

/** Середній бал за урок/ДЗ предмета в межах семестру (або всіх оцінок, якщо period=year). */
function computeSubjectAverageForPeriod(studentId, subjectId, period) {
  let grades = lastGrades.filter(
    (g) =>
      g.data.studentId === studentId &&
      g.data.subjectId === subjectId &&
      g.data.type !== "final" &&
      isNumericGrade(g.data.value)
  );
  if (period === "semester1" || period === "semester2") {
    const [from, to] = getGradesPeriodRange(period, null, null);
    grades = grades.filter((g) => {
      const d = g.data.date;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  if (grades.length === 0) return null;
  const sum = grades.reduce((a, g) => a + Number(g.data.value), 0);
  return Math.round((sum / grades.length) * 10) / 10;
}

async function saveFinalGrade(studentId, subjectId, period, rawValue, auto = false) {
  if (!FINAL_GRADE_PERIODS.includes(period)) return;
  const id = finalGradeDocId(studentId, subjectId, period);
  const trimmed = (rawValue === null || rawValue === undefined) ? "" : String(rawValue).trim();
  try {
    if (trimmed === "") {
      await deleteDoc(doc(db, "grades", id));
      return;
    }
    const value = parseGradeInput(trimmed);
    if (value === null || value === "Н") {
      return;
    }
    await setDoc(
      doc(db, "grades", id),
      {
        studentId,
        subjectId: subjectId || null,
        type: "final",
        period,
        value,
        auto: !!auto,
        date: null,
        updatedAt: Date.now(),
        teacherId: auth.currentUser ? auth.currentUser.uid : null,
      },
      { merge: true }
    );
  } catch (e) {
    reportSaveError(e, "Не вдалося зберегти підсумкову оцінку", "Failed to save final grade");
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
  const hasHwCheckbox = document.getElementById("new-lesson-has-hw");
  const hasHomework = !!(homeworkDate || (hasHwCheckbox && hasHwCheckbox.checked));
  const publishAt = newLessonPublishAt ? parsePublishAtInput(newLessonPublishAt.value) : null;
  const assignedClassIds = [...selectedLessonClassIds];

  if (!subjectId) {
    alert(t("selectSubjectPlaceholder"));
    return;
  }
  if (!teacherOwnsSubject(subjectId)) {
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
      hasHomework: hasHomework || false,
      createdAt: Date.now(),
      teacherId: auth.currentUser ? auth.currentUser.uid : null,
      teacherName: myDisplayName(),
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
    if (hasHwCheckbox) hasHwCheckbox.checked = false;
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
      ? lastLessons.filter((l) => lessonHasHomework(l.data))
      : lastLessons;
  return base.filter(
    (l) => lessonVisibleForCurrentClass(l.data) && lessonOwnedByTeacher(l.data)
  );
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
        lessonVisibleForCurrentClass(l.data) &&
        lessonOwnedByTeacher(l.data)
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
    (l) =>
      l.data.homeworkDate === targetDateStr &&
      lessonVisibleForCurrentClass(l.data) &&
      lessonOwnedByTeacher(l.data)
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
  const hasHw = lessonHasHomework(data);
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

  function makeGradeInput(studentId, type, date, rowIndex) {
    const col = document.createElement("div");
    col.className = "grade-inputs-col";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.className = "grade-input";
    input.placeholder = t("gradeInputPlaceholder");
    input.title = type === "homework" ? t("gradeTypeHomework") : t("gradeTypeLesson");
    input.setAttribute("aria-label", input.title);
    input.dataset.gradeRow = String(rowIndex);
    input.dataset.gradeType = type;
    const currentValue = getGradeValue(lessonId, studentId, type);
    if (currentValue !== null && currentValue !== undefined) input.value = String(currentValue);

    // Автоматично н/n → Н під час введення
    input.addEventListener("input", () => {
      const v = input.value;
      if (/^[нn]$/u.test(v.trim())) {
        input.value = "Н";
      }
    });

    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.className = "grade-comment-input";
    commentInput.placeholder = t("gradeCommentPlaceholder");
    commentInput.value = getGradeComment(lessonId, studentId, type);

    const savedHint = document.createElement("span");
    savedHint.className = "grade-saved-hint hidden";
    savedHint.textContent = t("gradeSavedHint");

    const persist = async () => {
      const parsed = parseGradeInput(input.value);
      if (input.value.trim() !== "" && parsed === null) {
        // Невалідне — відновлюємо попереднє значення
        const prev = getGradeValue(lessonId, studentId, type);
        input.value = prev !== null && prev !== undefined ? String(prev) : "";
        return;
      }
      if (parsed === "Н") input.value = "Н";
      else if (typeof parsed === "number") input.value = String(parsed);
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
    input.onblur = () => {
      const parsed = parseGradeInput(input.value);
      if (parsed === "Н") input.value = "Н";
      else if (typeof parsed === "number") input.value = String(parsed);
    };
    commentInput.onchange = persist;

    // Швидке виставлення з клавіатури: Enter/↓ → наступний учень, ↑ → попередній
    input.addEventListener("keydown", (e) => {
      const key = e.key;
      if (key !== "Enter" && key !== "ArrowDown" && key !== "ArrowUp") return;
      e.preventDefault();
      const row = parseInt(input.dataset.gradeRow, 10);
      const gType = input.dataset.gradeType;
      const delta = key === "ArrowUp" ? -1 : 1;
      const next = list.querySelector(
        `.grade-input[data-grade-row="${row + delta}"][data-grade-type="${gType}"]`
      );
      if (next) {
        persist();
        next.focus();
        next.select();
      } else if (key === "Enter" || key === "ArrowDown") {
        persist();
      }
    });

    col.append(input, commentInput);
    return { col, savedHint, input };
  }

  students.forEach(({ id: studentId, data: studentData }, rowIndex) => {
    const row = document.createElement("div");
    row.className = "grades-student-row";

    const name = document.createElement("span");
    name.className = "grades-student-name";
    name.textContent = studentData.name;
    row.appendChild(name);

    let lastSavedHint = null;
    if (showLesson) {
      const date = data.lessonDate || formatDateLocal(new Date());
      const { col, savedHint } = makeGradeInput(studentId, "lesson", date, rowIndex);
      row.appendChild(col);
      lastSavedHint = savedHint;
    }
    if (showHw) {
      const date = data.homeworkDate || null;
      const { col, savedHint } = makeGradeInput(studentId, "homework", date, rowIndex);
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

function isAbsenceGrade(value) {
  if (value == null) return false;
  const s = String(value).trim().toUpperCase();
  return s === "Н" || s === "H" || s === "N";
}

function computeGradesAnalyticsFromList(gradesList) {
  const values = gradesList
    .map((g) => Number(g.data.value))
    .filter((v) => !isNaN(v) && v >= 1 && v <= 12);
  const overall =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const absences = gradesList.filter((g) => isAbsenceGrade(g.data.value)).length;

  const bySubject = {};
  gradesList.forEach((g) => {
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

  const chronological = gradesList
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
  if (teacherGradesStatAbsences) teacherGradesStatAbsences.textContent = String(stats.absences || 0);
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


/** Повертає [fromIso, toIso] включно для обраного періоду оцінок (шкільний рік: 1 сем. вересень–грудень, 2 сем. січень–травень). */
function getGradesPeriodRange(period, fromCustom, toCustom) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-11
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

function syncTeacherGradesCustomRangeVisibility() {
  if (!teacherGradesCustomRange) return;
  teacherGradesCustomRange.classList.toggle("hidden", teacherGradesPeriod !== "custom");
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

  const studentGradesAll = lastGrades.filter(
    (g) => g.data.studentId === sid && g.data.type !== "final"
  );
  const studentFinalGrades = lastGrades.filter(
    (g) => g.data.studentId === sid && g.data.type === "final"
  );
  const studentGrades = filterGradesByPeriod(
    studentGradesAll,
    teacherGradesPeriod,
    teacherGradesFrom,
    teacherGradesTo
  );
  if (studentGrades.length === 0 && studentFinalGrades.length === 0) {
    if (teacherGradesAnalyticsEl) teacherGradesAnalyticsEl.classList.add("hidden");
    if (teacherNoGradesMsg) {
      teacherNoGradesMsg.classList.remove("hidden");
      teacherNoGradesMsg.textContent = t("noGradesMsg");
    }
    return;
  }
  if (teacherNoGradesMsg) teacherNoGradesMsg.classList.add("hidden");

  if (studentGrades.length > 0) {
    renderTeacherGradesAnalytics(studentGrades);
  } else if (teacherGradesAnalyticsEl) {
    teacherGradesAnalyticsEl.classList.add("hidden");
  }

  const dateSet = new Set(studentGrades.map((g) => g.data.date).filter(Boolean));
  const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

  const subjectIdsWithGrades = new Set(studentGrades.map((g) => g.data.subjectId).filter(Boolean));
  const subjectOrder = lastSubjects.map((s) => s.id).filter((id) => subjectIdsWithGrades.has(id));
  [...subjectIdsWithGrades]
    .filter((id) => !subjectOrder.includes(id))
    .forEach((id) => subjectOrder.push(id));

  if (dates.length === 0 || subjectOrder.length === 0) {
    if (teacherNoGradesMsg) teacherNoGradesMsg.classList.add("hidden");
    renderFinalGradesSection(sid, studentGradesAll);
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
  teacherGradesTableContainer.appendChild(legend);
  teacherGradesTableContainer.appendChild(wrap);

  renderFinalGradesSection(sid, studentGradesAll);
}

function renderFinalGradesSection(studentId, currentGradesForAvg) {
  if (!teacherGradesTableContainer) return;
  const section = document.createElement("div");
  section.className = "final-grades-section";
  const heading = document.createElement("h3");
  heading.className = "final-grades-heading";
  heading.textContent = t("finalGradesHeading");
  section.appendChild(heading);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t("finalGradesHint");
  section.appendChild(hint);

  const subjectIds = new Set(
    (currentGradesForAvg || [])
      .map((g) => g.data.subjectId)
      .filter(Boolean)
  );
  lastSubjects.forEach((subj) => {
    if (teacherOwnsSubject(subj.id)) subjectIds.add(subj.id);
  });
  lastGrades
    .filter((g) => g.data.type === "final" && g.data.studentId === studentId)
    .forEach((g) => {
      if (g.data.subjectId) subjectIds.add(g.data.subjectId);
    });

  const ordered = lastSubjects.map((subj) => subj.id).filter((id) => subjectIds.has(id));
  [...subjectIds].filter((id) => !ordered.includes(id)).forEach((id) => ordered.push(id));

  if (ordered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = t("finalGradesNoSubjects");
    section.appendChild(empty);
    teacherGradesTableContainer.appendChild(section);
    return;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "schedule-table-wrap final-grades-table-wrap";
  const table = document.createElement("table");
  table.className = "schedule-table final-grades-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.textContent = t("gradesTableSubjectHeader");
  headRow.appendChild(corner);
  FINAL_GRADE_PERIODS.forEach((p) => {
    const th = document.createElement("th");
    th.textContent = t("finalPeriod_" + p);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  ordered.forEach((subjectId) => {
    if (!teacherOwnsSubject(subjectId) && !isAdmin()) return;
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "grades-table-subject";
    th.textContent = getSubjectName(subjectId);
    tr.appendChild(th);
    FINAL_GRADE_PERIODS.forEach((period) => {
      const td = document.createElement("td");
      td.className = "final-grade-cell";
      const cell = document.createElement("div");
      cell.className = "final-grade-cell-inner";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "grade-input final-grade-input";
      input.placeholder = "—";
      input.autocomplete = "off";
      const cur = getFinalGradeValue(studentId, subjectId, period);
      if (cur !== null && cur !== undefined) input.value = String(cur);
      const autoBtn = document.createElement("button");
      autoBtn.type = "button";
      autoBtn.className = "secondary small final-grade-auto-btn";
      autoBtn.textContent = t("finalGradeAutoBtn");
      autoBtn.title = t("finalGradeAutoTitle");
      autoBtn.onclick = async (e) => {
        e.preventDefault();
        const avg = computeSubjectAverageForPeriod(studentId, subjectId, period);
        if (avg === null) {
          alert(t("finalGradeNoAvg"));
          return;
        }
        const rounded = Math.round(avg);
        input.value = String(rounded);
        await saveFinalGrade(studentId, subjectId, period, String(rounded), true);
        input.classList.add("final-grade-auto");
      };
      const persist = async () => {
        const parsed = parseGradeInput(input.value);
        if (input.value.trim() !== "" && (parsed === null || parsed === "Н")) {
          const prev = getFinalGradeValue(studentId, subjectId, period);
          input.value = prev !== null && prev !== undefined ? String(prev) : "";
          return;
        }
        if (typeof parsed === "number") input.value = String(parsed);
        await saveFinalGrade(studentId, subjectId, period, input.value, false);
        input.classList.remove("final-grade-auto");
      };
      input.onchange = persist;
      input.onblur = () => {
        const parsed = parseGradeInput(input.value);
        if (typeof parsed === "number") input.value = String(parsed);
      };
      cell.append(input, autoBtn);
      td.appendChild(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  teacherGradesTableContainer.appendChild(section);
}

if (teacherGradesStudentSelect) {
  teacherGradesStudentSelect.onchange = () => {
    teacherGradesSelectedStudentId = teacherGradesStudentSelect.value;
    renderTeacherGradesTable();
  };

if (teacherGradesPeriodSelect) {
  teacherGradesPeriodSelect.value = teacherGradesPeriod;
  teacherGradesPeriodSelect.onchange = () => {
    teacherGradesPeriod = teacherGradesPeriodSelect.value || "all";
    syncTeacherGradesCustomRangeVisibility();
    renderTeacherGradesTable();
  };
}
if (teacherGradesFromInput) {
  teacherGradesFromInput.onchange = () => {
    teacherGradesFrom = teacherGradesFromInput.value || "";
    if (teacherGradesPeriod === "custom") renderTeacherGradesTable();
  };
}
if (teacherGradesToInput) {
  teacherGradesToInput.onchange = () => {
    teacherGradesTo = teacherGradesToInput.value || "";
    if (teacherGradesPeriod === "custom") renderTeacherGradesTable();
  };
}
syncTeacherGradesCustomRangeVisibility();
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

// ---------- Чат ----------
let chatApi = null;
function ensureChatApi() {
  if (chatApi) return chatApi;
  chatApi = initChat({
    db,
    getUser: () => auth.currentUser,
    getProfile: () => currentUserProfile,
    t: (k) => (typeof t === "function" ? t(k) : k),
    currentLang: () => (typeof currentLang !== "undefined" ? currentLang : "uk"),
    getStudents: () => lastStudents || [],
    getTeachers: () => lastSchoolTeachers || [],
    getSubjects: () => lastSubjects || [],
    getClasses: () => lastClasses || [],
    getGroups: () => lastGroups || [],
    isTeacherSide: true,
  });
  return chatApi;
}

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
  // Compose перенесено в чат — лише системні сповіщення
  renderMessagesList();
  markAllNotificationsRead().catch(() => {});
  // Підказка один раз
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

function renderMessagesRecipientSelect() {
  if (!messagesRecipientSelect) return;
  const prev = messagesRecipientSelect.value;
  messagesRecipientSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = t("messagesSelectRecipient") || t("messagesSelectStudent");
  messagesRecipientSelect.appendChild(ph);
  const locale = currentLang === "uk" ? "uk" : "en";

  // Учні з прив'язаним акаунтом
  const students = lastStudents
    .filter((s) => s.data && s.data.authUid)
    .slice()
    .sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", locale));
  if (students.length > 0) {
    const og = document.createElement("optgroup");
    og.label = t("messagesGroupStudents") || "Students";
    students.forEach(({ id, data }) => {
      const opt = document.createElement("option");
      opt.value = `student:${id}`;
      opt.textContent = data.name || id;
      og.appendChild(opt);
    });
    messagesRecipientSelect.appendChild(og);
  }

  // Колеги тієї ж школи (без себе)
  const myUid = auth.currentUser && auth.currentUser.uid;
  const teachers = (lastSchoolTeachers || [])
    .filter((u) => u.id && u.id !== myUid && (u.data.role === "teacher" || u.data.role === "admin"))
    .slice()
    .sort((a, b) =>
      String(a.data.displayName || a.data.email || "").localeCompare(
        String(b.data.displayName || b.data.email || ""),
        locale
      )
    );
  if (teachers.length > 0) {
    const og = document.createElement("optgroup");
    og.label = t("messagesGroupTeachers") || "Teachers";
    teachers.forEach(({ id, data }) => {
      const opt = document.createElement("option");
      opt.value = `teacher:${id}`;
      const name = (data.displayName && String(data.displayName).trim()) || data.email || id;
      const role =
        data.role === "admin"
          ? t("teacherRoleAdmin") || "Admin"
          : t("teacherRoleTeacher") || "Teacher";
      opt.textContent = `${name} (${role})`;
      og.appendChild(opt);
    });
    messagesRecipientSelect.appendChild(og);
  }

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
  const hasHw = lessonHasHomework(payload);
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
  const senderName = payload.teacherName || myDisplayName();
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
        senderName,
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
    const raw = messagesRecipientSelect ? messagesRecipientSelect.value : "";
    const text = messagesComposeText ? messagesComposeText.value.trim() : "";
    if (!raw) {
      alert(t("messagesNeedRecipient"));
      return;
    }
    if (!text) {
      alert(t("messagesNeedText"));
      return;
    }

    let recipientUid = null;
    let studentId = null;
    let notifType = "announcement";
    let title = t("notifAnnouncement");

    if (raw.startsWith("student:")) {
      studentId = raw.slice("student:".length);
      const student = lastStudents.find((s) => s.id === studentId);
      recipientUid = student && student.data && student.data.authUid;
      notifType = "announcement";
      title = t("notifAnnouncement");
    } else if (raw.startsWith("teacher:")) {
      recipientUid = raw.slice("teacher:".length);
      studentId = null;
      notifType = "teacher_message";
      title = t("notifTeacherMessage") || t("notifAnnouncement");
    } else {
      // Зворотна сумісність: старе значення = id учня
      studentId = raw;
      const student = lastStudents.find((s) => s.id === studentId);
      recipientUid = student && student.data && student.data.authUid;
      notifType = "announcement";
      title = t("notifAnnouncement");
    }

    if (!recipientUid) {
      alert(t("messagesNeedRecipient"));
      return;
    }
    if (recipientUid === (auth.currentUser && auth.currentUser.uid)) {
      alert(t("messagesNeedRecipient"));
      return;
    }

    try {
      const payload = {
        recipientUid,
        type: notifType,
        title,
        body: text,
        createdAt: Date.now(),
        read: false,
        senderUid: auth.currentUser ? auth.currentUser.uid : null,
        senderName: myDisplayName(),
      };
      if (studentId) payload.studentId = studentId;
      await addDoc(collection(db, "notifications"), payload);
      if (messagesComposeText) messagesComposeText.value = "";
      alert(t("messagesSent"));
    } catch (e) {
      reportSaveError(e, "Не вдалося надіслати повідомлення", "Failed to send message");
    }
  };
}


// ==========================================================
// Глобальний розклад дзвінків (schedule/defaults) + налаштування
// ==========================================================
let lastScheduleDefaults = { times: {}, dayTimes: {} };
let unsubscribeScheduleDefaults = null;
let bellSettingsDay = "sat";
const BELL_DEFAULT_PERIODS = 8;

function subscribeScheduleDefaults() {
  if (unsubscribeScheduleDefaults) unsubscribeScheduleDefaults();
  unsubscribeScheduleDefaults = onSnapshot(doc(db, "schedule", "defaults"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    lastScheduleDefaults = {
      times: data.times && typeof data.times === "object" ? data.times : {},
      dayTimes: data.dayTimes && typeof data.dayTimes === "object" ? data.dayTimes : {},
    };
    // Перемалювати live-статус і розклад, якщо відкриті
    try {
      updateLiveStatus();
      if (typeof renderSchedule === "function") renderSchedule();
    } catch (_) {}
    renderBellSettingsEditors();
  });
}

async function seedGroupScheduleFromDefaults(groupId) {
  if (!groupId) return;
  const times = lastScheduleDefaults.times || {};
  const dayTimes = lastScheduleDefaults.dayTimes || {};
  if (Object.keys(times).length === 0 && Object.keys(dayTimes).length === 0) return;
  try {
    await setDoc(
      doc(db, "schedule", "week"),
      {
        [groupId]: {
          times: { ...times },
          dayTimes: JSON.parse(JSON.stringify(dayTimes)),
          applied: false,
          overrides: {},
        },
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("seedGroupScheduleFromDefaults", e);
  }
}

async function saveScheduleDefaults(partial) {
  const next = {
    times: partial.times !== undefined ? partial.times : lastScheduleDefaults.times || {},
    dayTimes: partial.dayTimes !== undefined ? partial.dayTimes : lastScheduleDefaults.dayTimes || {},
  };
  await setDoc(doc(db, "schedule", "defaults"), next, { merge: true });
}

async function applyBellDefaultsToAllGroups() {
  if (!confirm(t("settingsBellApplyAllConfirm"))) return;
  const times = lastScheduleDefaults.times || {};
  const dayTimes = lastScheduleDefaults.dayTimes || {};
  const ids = groupIds().length ? groupIds() : Object.keys(scheduleData || {});
  if (ids.length === 0) {
    alert(t("settingsBellApplyAllDone"));
    return;
  }
  try {
    // Пишемо по групах: піддокумент кожної групи замінюється ЦІЛКОМ
    // (times/dayTimes перезаписуються, а не глибоко зливаються), інакше
    // старі періоди (наприклад times[5]..times[7]), яких немає в нових
    // дефолтах, лишилися б висіти в Firestore.
    const weekRef = doc(db, "schedule", "week");
    const weekSnap = await getDoc(weekRef);
    const existing = weekSnap.exists() ? weekSnap.data() : {};
    for (const gid of ids) {
      const prev = existing[gid] && typeof existing[gid] === "object" ? existing[gid] : {};
      await setDoc(
        weekRef,
        {
          [gid]: {
            ...prev,
            times: { ...times },
            dayTimes: JSON.parse(JSON.stringify(dayTimes)),
          },
        },
        { mergeFields: [gid] }
      );
    }
    alert(t("settingsBellApplyAllDone"));
  } catch (e) {
    reportSaveError(e, "Не вдалося застосувати розклад дзвінків", "Failed to apply bell schedule");
  }
}

function maxPeriodCountFromTimes(timesMap) {
  if (!timesMap || !Object.keys(timesMap).length) return BELL_DEFAULT_PERIODS;
  const max = Math.max(...Object.keys(timesMap).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n)));
  return Math.max(BELL_DEFAULT_PERIODS, max + 1);
}

function renderBellPeriodRows(container, timesMap, onChange) {
  // Якщо користувач саме редагує час усередині цього контейнера (наприклад,
  // клацнув у <input type="time">), не перемальовуємо рядки: onSnapshot із
  // сервера інакше скидає innerHTML і "з'їдає" фокус/незбережене введення.
  if (container.contains(document.activeElement)) return;
  container.innerHTML = "";
  const count = maxPeriodCountFromTimes(timesMap);
  for (let r = 0; r < count; r++) {
    const saved = timesMap[r] || timesMap[String(r)] || {};
    const row = document.createElement("div");
    row.className = "day-times-row settings-bell-row";
    const label = document.createElement("span");
    label.className = "day-times-row-label";
    label.textContent = String(r + 1);
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.value = saved.start || "";
    startInput.setAttribute("aria-label", t("periodStartLabel"));
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.value = saved.end || "";
    endInput.setAttribute("aria-label", t("periodEndLabel"));
    const persist = async () => {
      const next = { ...(timesMap || {}) };
      const start = startInput.value || null;
      const end = endInput.value || null;
      if (!start && !end) {
        delete next[r];
        delete next[String(r)];
      } else {
        next[r] = { start, end };
        delete next[String(r)];
      }
      await onChange(next);
    };
    startInput.onchange = persist;
    endInput.onchange = persist;
    row.append(label, startInput, endInput);
    container.appendChild(row);
  }
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "secondary small";
  addBtn.textContent = t("settingsBellAddPeriod");
  addBtn.onclick = async () => {
    const next = { ...(timesMap || {}) };
    const keys = Object.keys(next).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
    const nextIdx = keys.length ? Math.max(...keys) + 1 : count;
    next[nextIdx] = { start: null, end: null };
    await onChange(next);
  };
  container.appendChild(addBtn);
}

function renderBellSettingsEditors() {
  const periodsEl = document.getElementById("settings-bell-periods");
  const dayGridEl = document.getElementById("settings-bell-day-grid");
  const daySelect = document.getElementById("settings-bell-day-select");
  const dayToggle = document.getElementById("settings-bell-day-toggle");
  if (!periodsEl) return;

  renderBellPeriodRows(periodsEl, lastScheduleDefaults.times || {}, async (nextTimes) => {
    try {
      await saveScheduleDefaults({ times: nextTimes });
    } catch (e) {
      reportSaveError(e, "Не вдалося зберегти розклад дзвінків", "Failed to save bell schedule");
    }
  });

  if (daySelect) {
    const prev = daySelect.value || bellSettingsDay;
    if (!daySelect.options.length) {
      WEEKDAYS.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = t("weekdays")[d];
        daySelect.appendChild(opt);
      });
    } else {
      [...daySelect.options].forEach((opt) => {
        opt.textContent = t("weekdays")[opt.value] || opt.value;
      });
    }
    daySelect.value = prev;
    bellSettingsDay = daySelect.value;
  }

  const dayKey = bellSettingsDay;
  const dayMap =
    (lastScheduleDefaults.dayTimes && lastScheduleDefaults.dayTimes[dayKey]) || {};
  const hasCustom = Object.keys(dayMap).length > 0;

  if (dayToggle) {
    dayToggle.checked = hasCustom;
  }
  if (dayGridEl) {
    if (!hasCustom) {
      dayGridEl.innerHTML = "";
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = t("settingsBellDayTimesHint");
      dayGridEl.appendChild(hint);
    } else {
      renderBellPeriodRows(dayGridEl, dayMap, async (nextDayMap) => {
        try {
          const dayTimes = {
            ...(lastScheduleDefaults.dayTimes || {}),
            [dayKey]: nextDayMap,
          };
          await saveScheduleDefaults({ dayTimes });
        } catch (e) {
          reportSaveError(e, "Не вдалося зберегти особливий розклад", "Failed to save custom day schedule");
        }
      });
    }
  }
}

function initBellScheduleSettings() {
  ensureSettingsPanel();
  if (!settingsPanelApi || !settingsPanelApi.addSection) return;
  if (document.getElementById("settings-section-bell")) {
    renderBellSettingsEditors();
    return;
  }

  settingsPanelApi.addSection({
    id: "bell",
    tabLabel: t("settingsBellTab"),
    title: t("settingsBellHeading"),
    buildContent: (body) => {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = t("settingsBellHint");
      body.appendChild(hint);

      const periodsTitle = document.createElement("h3");
      periodsTitle.className = "settings-section-title";
      periodsTitle.style.fontSize = "14px";
      periodsTitle.textContent = t("settingsBellPeriodsLabel");
      body.appendChild(periodsTitle);

      const periods = document.createElement("div");
      periods.id = "settings-bell-periods";
      periods.className = "day-times-grid settings-bell-grid";
      body.appendChild(periods);

      const dayTitle = document.createElement("h3");
      dayTitle.className = "settings-section-title";
      dayTitle.style.fontSize = "14px";
      dayTitle.style.marginTop = "18px";
      dayTitle.textContent = t("settingsBellDayTimesLabel");
      body.appendChild(dayTitle);

      const dayHint = document.createElement("p");
      dayHint.className = "hint";
      dayHint.textContent = t("settingsBellDayTimesHint");
      body.appendChild(dayHint);

      const controls = document.createElement("div");
      controls.className = "day-times-controls";
      controls.style.marginBottom = "10px";

      const daySelect = document.createElement("select");
      daySelect.id = "settings-bell-day-select";
      WEEKDAYS.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = t("weekdays")[d];
        if (d === bellSettingsDay) opt.selected = true;
        daySelect.appendChild(opt);
      });
      daySelect.onchange = () => {
        bellSettingsDay = daySelect.value;
        renderBellSettingsEditors();
      };
      controls.appendChild(daySelect);

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "day-times-toggle";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.id = "settings-bell-day-toggle";
      toggle.onchange = async () => {
        const dayKey = bellSettingsDay;
        try {
          if (toggle.checked) {
            const base = lastScheduleDefaults.times || {};
            const copy = {};
            Object.keys(base).forEach((k) => {
              copy[k] = { ...(base[k] || {}) };
            });
            if (Object.keys(copy).length === 0) {
              for (let i = 0; i < BELL_DEFAULT_PERIODS; i++) copy[i] = { start: null, end: null };
            }
            const dayTimes = { ...(lastScheduleDefaults.dayTimes || {}), [dayKey]: copy };
            await saveScheduleDefaults({ dayTimes });
          } else {
            const dayTimes = { ...(lastScheduleDefaults.dayTimes || {}) };
            delete dayTimes[dayKey];
            await saveScheduleDefaults({ dayTimes });
          }
        } catch (e) {
          reportSaveError(e, "Не вдалося оновити особливий розклад", "Failed to update custom day schedule");
        }
      };
      const toggleText = document.createElement("span");
      toggleText.textContent = t("settingsBellUseCustomDay");
      toggleLabel.append(toggle, toggleText);
      controls.appendChild(toggleLabel);
      body.appendChild(controls);

      const dayGrid = document.createElement("div");
      dayGrid.id = "settings-bell-day-grid";
      dayGrid.className = "day-times-grid settings-bell-grid";
      body.appendChild(dayGrid);

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.id = "settings-bell-apply-all";
      applyBtn.style.marginTop = "16px";
      applyBtn.textContent = t("settingsBellApplyAllBtn");
      applyBtn.onclick = () => applyBellDefaultsToAllGroups();
      body.appendChild(applyBtn);
    },
  });

  renderBellSettingsEditors();
}

// Оновити підписи секції дзвінків при зміні мови
const _origApplyStaticForBell = typeof applyStaticTranslations === "function" ? null : null;


// ==========================================================
// Оголошення (панель вчителя)
// ==========================================================
let lastAnnouncements = [];
let unsubscribeAnnouncements = null;
let selectedAnnouncementClassIds = new Set();

const newAnnouncementTitle = document.getElementById("new-announcement-title");
const newAnnouncementBody = document.getElementById("new-announcement-body");
const addAnnouncementBtn = document.getElementById("add-announcement-btn");
const announcementClassOptions = document.getElementById("announcement-class-options");
const announcementClassSelected = document.getElementById("announcement-class-selected");
const announcementsListEl = document.getElementById("announcements-list");
const noAnnouncementsMsg = document.getElementById("no-announcements-msg");

function renderAnnouncementClassOptions() {
  if (!announcementClassOptions) return;
  announcementClassOptions.innerHTML = "";
  if (lastClasses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = t("noClassesForAssign");
    announcementClassOptions.appendChild(empty);
  } else {
    lastClasses.forEach(({ id, data }) => {
      const label = document.createElement("label");
      label.className = "class-option-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = id;
      cb.checked = selectedAnnouncementClassIds.has(id);
      cb.onchange = () => {
        if (cb.checked) selectedAnnouncementClassIds.add(id);
        else selectedAnnouncementClassIds.delete(id);
        renderAnnouncementClassSelectedChips();
      };
      const nameSpan = document.createElement("span");
      nameSpan.textContent = data.name || id;
      label.append(cb, nameSpan);
      announcementClassOptions.appendChild(label);
    });
  }
  renderAnnouncementClassSelectedChips();
}

function renderAnnouncementClassSelectedChips() {
  if (!announcementClassSelected) return;
  announcementClassSelected.innerHTML = "";
  if (selectedAnnouncementClassIds.size === 0) {
    const all = document.createElement("span");
    all.className = "class-chip class-chip-all";
    all.textContent = t("allClassesLabel") || t("announcementAllClasses");
    announcementClassSelected.appendChild(all);
    return;
  }
  [...selectedAnnouncementClassIds].forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "class-chip";
    chip.textContent = getClassName(id) || id;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "class-chip-remove";
    x.textContent = "×";
    x.onclick = () => {
      selectedAnnouncementClassIds.delete(id);
      renderAnnouncementClassOptions();
    };
    chip.appendChild(x);
    announcementClassSelected.appendChild(chip);
  });
}

function renderTeacherAnnouncements() {
  if (!announcementsListEl) return;
  announcementsListEl.innerHTML = "";
  const items = lastAnnouncements
    .slice()
    .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
  if (noAnnouncementsMsg) noAnnouncementsMsg.classList.toggle("hidden", items.length > 0);
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  items.forEach(({ id, data }) => {
    const el = document.createElement("div");
    el.className = "announcement-item";
    const header = document.createElement("div");
    header.className = "announcement-item-header";
    const title = document.createElement("h3");
    title.className = "announcement-item-title";
    title.textContent = data.title || "";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "announcement-delete-btn";
    delBtn.textContent = "✕";
    delBtn.setAttribute("aria-label", t("deleteBtn"));
    delBtn.onclick = async () => {
      if (!confirm(t("announcementDeleteConfirm"))) return;
      try {
        await deleteDoc(doc(db, "announcements", id));
      } catch (e) {
        reportSaveError(e, "Не вдалося видалити оголошення", "Failed to delete announcement");
      }
    };
    header.append(title, delBtn);
    el.appendChild(header);
    if (data.body) {
      const body = document.createElement("div");
      body.className = "announcement-item-body";
      body.textContent = data.body;
      el.appendChild(body);
    }
    const meta = document.createElement("div");
    meta.className = "announcement-item-meta";
    const classIds = data.classIds;
    if (!classIds || classIds.length === 0) {
      const chip = document.createElement("span");
      chip.className = "announcement-item-classes";
      chip.textContent = t("announcementAllClasses");
      meta.appendChild(chip);
    } else {
      const names = (data.classNames && data.classNames.length)
        ? data.classNames
        : classIds.map((cid) => getClassName(cid) || cid);
      const chip = document.createElement("span");
      chip.className = "announcement-item-classes";
      chip.textContent = names.join(", ");
      meta.appendChild(chip);
    }
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
    if (parts.length) {
      const span = document.createElement("span");
      span.textContent = parts.join(" · ");
      meta.appendChild(span);
    }
    el.appendChild(meta);
    announcementsListEl.appendChild(el);
  });
}

async function notifyStudentsAboutAnnouncement(payload) {
  let targets = lastStudents.filter((s) => s.data && s.data.authUid);
  if (payload.classIds && payload.classIds.length > 0) {
    const groupIds = new Set();
    payload.classIds.forEach((cid) => {
      groupsOfClass(cid).forEach((g) => groupIds.add(g.id));
    });
    targets = targets.filter((s) => groupIds.has(s.data.group));
  }
  const now = Date.now();
  const senderUid = auth.currentUser ? auth.currentUser.uid : null;
  const senderName = payload.authorName || myDisplayName();
  const title = t("notifNewAnnouncement")(payload.title || "");
  for (const s of targets) {
    try {
      await addDoc(collection(db, "notifications"), {
        recipientUid: s.data.authUid,
        studentId: s.id,
        type: "announcement",
        title,
        body: payload.body || title,
        createdAt: now,
        read: false,
        senderUid,
        senderName,
      });
    } catch (e) {
      console.warn("notify announcement", e);
    }
  }
}

if (addAnnouncementBtn) {
  addAnnouncementBtn.onclick = async () => {
    const title = newAnnouncementTitle ? newAnnouncementTitle.value.trim() : "";
    const body = newAnnouncementBody ? newAnnouncementBody.value.trim() : "";
    if (!title) {
      alert(t("announcementNeedTitle"));
      return;
    }
    if (!body) {
      alert(t("announcementNeedBody"));
      return;
    }
    const classIds = [...selectedAnnouncementClassIds];
    const classNames = classIds.map((id) => getClassName(id) || id);
    const authorName = myDisplayName();
    try {
      await addDoc(collection(db, "announcements"), {
        title,
        body,
        classIds,
        classNames,
        authorUid: auth.currentUser ? auth.currentUser.uid : null,
        authorName,
        createdAt: Date.now(),
      });
      if (newAnnouncementTitle) newAnnouncementTitle.value = "";
      if (newAnnouncementBody) newAnnouncementBody.value = "";
      selectedAnnouncementClassIds = new Set();
      renderAnnouncementClassOptions();
      await notifyStudentsAboutAnnouncement({ title, body, classIds, authorName });
      alert(t("announcementAdded"));
    } catch (e) {
      reportSaveError(e, "Не вдалося додати оголошення", "Failed to add announcement");
    }
  };
}

function subscribeTeacherAnnouncements() {
  if (unsubscribeAnnouncements) unsubscribeAnnouncements();
  unsubscribeAnnouncements = onSnapshot(
    collection(db, "announcements"),
    (snap) => {
      lastAnnouncements = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      if (announcementsPanelEl && !announcementsPanelEl.classList.contains("hidden")) {
        renderTeacherAnnouncements();
      }
    },
    (err) => console.warn("announcements", err)
  );
}


// ==========================================================
// Вкладка «Вчителі» (лише для адміна школи)
// ==========================================================
let lastTeacherInvites = [];
let lastSchoolTeachers = [];
let unsubscribeTeacherInvites = null;
let unsubscribeSchoolTeachers = null;

function mySchoolId() {
  return (currentUserProfile && currentUserProfile.schoolId) || null;
}

function subscribeTeachersData() {
  if (!mySchoolId()) return;
  if (unsubscribeTeacherInvites) unsubscribeTeacherInvites();
  if (unsubscribeSchoolTeachers) unsubscribeSchoolTeachers();

  const schoolId = mySchoolId();
  // Список колег потрібен усім учителям школи (для повідомлень).
  // Коди-запрошення — лише адміністратору.
  if (isAdmin()) {
    unsubscribeTeacherInvites = onSnapshot(
      query(collection(db, "teacherInvites"), where("schoolId", "==", schoolId)),
      (snap) => {
        lastTeacherInvites = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        if (teachersPanelEl && !teachersPanelEl.classList.contains("hidden")) {
          renderTeacherInvitesList();
        }
      },
      (err) => console.warn("teacherInvites", err)
    );
  }

  unsubscribeSchoolTeachers = onSnapshot(
    query(collection(db, "users"), where("schoolId", "==", schoolId)),
    (snap) => {
      lastSchoolTeachers = snap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .filter((u) => {
          const r = u.data.role;
          return r === "teacher" || r === "admin" || r === "pending-teacher";
        });
      if (teachersPanelEl && !teachersPanelEl.classList.contains("hidden")) {
        renderSchoolTeachersList();
      }
      // Оновити список одержувачів у панелі повідомлень, якщо відкрита
      if (messagesPanelOpen) renderMessagesRecipientSelect();
    },
    (err) => console.warn("schoolTeachers", err)
  );
}

function renderTeachersTab() {
  if (!isAdmin()) {
    if (teachersListEl) {
      teachersListEl.innerHTML = `<p class="hint">${t("teachersOnlyAdmin")}</p>`;
    }
    return;
  }
  renderTeacherInvitesList();
  renderSchoolTeachersList();
}

function renderTeacherInvitesList() {
  if (!teacherInvitesListEl) return;
  teacherInvitesListEl.innerHTML = "";
  const pending = lastTeacherInvites
    .filter((i) => !i.data.usedBy)
    .slice()
    .sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
  if (noTeacherInvitesMsg) noTeacherInvitesMsg.classList.toggle("hidden", pending.length > 0);
  const locale = currentLang === "uk" ? "uk-UA" : "en-US";
  pending.forEach(({ id, data }) => {
    const row = document.createElement("div");
    row.className = "student-row teacher-invite-row";
    const identity = document.createElement("div");
    identity.className = "student-identity";
    const code = document.createElement("code");
    code.className = "invite-code teacher-invite-code-display";
    code.textContent = id;
    code.style.cursor = "pointer";
    code.onclick = async () => {
      try {
        await navigator.clipboard.writeText(id);
      } catch (_) {}
    };
    const meta = document.createElement("span");
    meta.className = "hint";
    const when = data.createdAt
      ? new Date(data.createdAt).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    meta.textContent = `${t("teacherInviteCreatedAt")}: ${when}`;
    identity.append(code, meta);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "student-delete-btn";
    del.textContent = "✕";
    del.title = t("teacherInviteDelete");
    del.onclick = async () => {
      try {
        await deleteDoc(doc(db, "teacherInvites", id));
      } catch (e) {
        reportSaveError(e, "Не вдалося видалити код", "Failed to delete invite code");
      }
    };
    row.append(identity, del);
    teacherInvitesListEl.appendChild(row);
  });
}

function renderSchoolTeachersList() {
  if (!teachersListEl) return;
  teachersListEl.innerHTML = "";
  const items = lastSchoolTeachers
    .slice()
    .sort((a, b) => {
      const ar = a.data.role === "admin" ? 0 : 1;
      const br = b.data.role === "admin" ? 0 : 1;
      if (ar !== br) return ar - br;
      return String(a.data.displayName || a.data.email || "").localeCompare(
        String(b.data.displayName || b.data.email || ""),
        "uk"
      );
    });
  if (noTeachersMsg) noTeachersMsg.classList.toggle("hidden", items.length > 0);
  items.forEach(({ id, data }) => {
    const row = document.createElement("div");
    row.className = "student-row";
    const avatar = document.createElement("span");
    avatar.className = "student-avatar";
    const nameStr = (data.displayName || data.email || "?").trim();
    avatar.textContent = nameStr.charAt(0).toUpperCase() || "?";
    const identity = document.createElement("div");
    identity.className = "student-identity";
    const nameEl = document.createElement("span");
    nameEl.className = "student-name";
    nameEl.textContent = data.displayName || t("teacherRolePending");
    const meta = document.createElement("div");
    meta.className = "student-meta";
    const roleBadge = document.createElement("span");
    roleBadge.className = "linked-badge " + (data.role === "admin" ? "linked" : "not-linked");
    if (data.role === "admin") roleBadge.textContent = t("teacherRoleAdmin");
    else if (data.role === "teacher") roleBadge.textContent = t("teacherRoleTeacher");
    else roleBadge.textContent = t("teacherRolePending");
    meta.appendChild(roleBadge);
    if (data.email) {
      const email = document.createElement("span");
      email.className = "hint";
      email.textContent = data.email;
      meta.appendChild(email);
    }
    if (id === (auth.currentUser && auth.currentUser.uid)) {
      const me = document.createElement("span");
      me.className = "hint";
      me.textContent = "• you";
      meta.appendChild(me);
    }
    identity.append(nameEl, meta);
    row.append(avatar, identity);
    teachersListEl.appendChild(row);
  });
}

if (generateTeacherInviteBtn) {
  generateTeacherInviteBtn.onclick = async () => {
    if (!isAdmin() || !mySchoolId()) {
      alert(t("teachersOnlyAdmin"));
      return;
    }
    try {
      let code = generateTeacherInviteCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await getDoc(doc(db, "teacherInvites", code));
        if (!existing.exists()) break;
        code = generateTeacherInviteCode();
      }
      await setDoc(doc(db, "teacherInvites", code), {
        schoolId: mySchoolId(),
        schoolName: (currentUserProfile && currentUserProfile.schoolName) || null,
        createdBy: auth.currentUser.uid,
        createdAt: Date.now(),
        usedBy: null,
        usedAt: null,
      });
      if (teacherInviteCodeDisplay) {
        teacherInviteCodeDisplay.textContent = code;
      }
      if (teacherInviteGeneratedHint) teacherInviteGeneratedHint.classList.remove("hidden");
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {}
    } catch (e) {
      reportSaveError(e, "Не вдалося створити код", "Failed to create invite code");
    }
  };
}
