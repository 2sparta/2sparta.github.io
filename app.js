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
    addLessonHeading: "Додати урок",
    lessonTitlePlaceholder: "Назва уроку",
    lessonLinkPlaceholder: "Посилання (URL)",
    lessonsHeading: "Список уроків",
    noLessons: "Уроків ще немає.",
    openLink: "Відкрити",
    deleteLessonConfirm: (title) => `Видалити урок «${title}»?`,
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
    addLessonHeading: "Add a Lesson",
    lessonTitlePlaceholder: "Lesson title",
    lessonLinkPlaceholder: "Link (URL)",
    lessonsHeading: "Lesson List",
    noLessons: "No lessons yet.",
    openLink: "Open",
    deleteLessonConfirm: (title) => `Delete lesson "${title}"?`,
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
  renderLessonsList();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});

applyStaticTranslations();

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

const newLessonTitle = document.getElementById("new-lesson-title");
const newLessonLink = document.getElementById("new-lesson-link");
const addLessonBtn = document.getElementById("add-lesson-btn");
const lessonsList = document.getElementById("lessons-list");
const noLessonsMsg = document.getElementById("no-lessons-msg");

let unsubscribeStudents = null;
let unsubscribeLessons = null;

// Кешуємо останні дані зі Firestore, щоб мати змогу
// перемалювати таблиці/списки при зміні мови без нового запиту.
let lastStudents = []; // [{id, data}]
let lastLessons = []; // [{id, data}]

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
    // Создаём профиль. Роль по умолчанию НЕ teacher - её нужно выставить
    // вручную в консоли Firebase для первого учителя (см. подсказку на экране).
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
  // Пока идёт процесс регистрации, не даём этому обработчику
  // вмешаться (он бы разлогинил только что созданного пользователя
  // раньше, чем setDoc успеет записать его профиль).
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
  listenToLessons();
});

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (unsubscribeStudents) unsubscribeStudents();
  if (unsubscribeLessons) unsubscribeLessons();
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  showTab("points");
}

function errorText(e) {
  return translations[currentLang].errors[e.code] || e.message;
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
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих символов
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

// ---------- Lessons (завдання) ----------
function listenToLessons() {
  const q = query(collection(db, "lessons"), orderBy("createdAt", "desc"));
  unsubscribeLessons = onSnapshot(q, (snap) => {
    lastLessons = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
    renderLessonsList();
  });
}

function renderLessonsList() {
  lessonsList.innerHTML = "";
  lastLessons.forEach(({ id, data }) => {
    lessonsList.appendChild(renderLessonRow(id, data));
  });
  noLessonsMsg.classList.toggle("hidden", lastLessons.length > 0);
}

addLessonBtn.onclick = async () => {
  const title = newLessonTitle.value.trim();
  let link = newLessonLink.value.trim();
  if (!title) return;
  if (link && !/^https?:\/\//i.test(link)) {
    link = "https://" + link;
  }
  await addDoc(collection(db, "lessons"), {
    title,
    link: link || null,
    createdAt: Date.now(),
  });
  newLessonTitle.value = "";
  newLessonLink.value = "";
};

function renderLessonRow(id, data) {
  const li = document.createElement("li");
  li.className = "lesson-item";

  const main = document.createElement("div");
  main.className = "lesson-main";

  const title = document.createElement("span");
  title.className = "lesson-title";
  title.textContent = data.title;
  main.appendChild(title);

  if (data.link) {
    const link = document.createElement("a");
    link.className = "lesson-link";
    link.href = data.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${t("openLink")} ↗`;
    main.appendChild(link);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("deleteBtn");
  deleteBtn.className = "secondary small";
  deleteBtn.onclick = () => {
    if (confirm(t("deleteLessonConfirm")(data.title))) deleteDoc(doc(db, "lessons", id));
  };

  li.append(main, deleteBtn);
  return li;
}
