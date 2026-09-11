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

let unsubscribeStudents = null;

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
    authError.textContent =
      "Аккаунт создан. Теперь в Firebase Console → Firestore → users → " +
      cred.user.uid + " поставьте role = teacher, затем войдите снова.";
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
    authError.textContent =
      "У этого аккаунта нет прав учителя (role != teacher). " +
      "Проверьте роль в Firestore или используйте другой аккаунт.";
    await signOut(auth);
    return;
  }

  showAppScreen();
  listenToStudents();
});

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  if (unsubscribeStudents) unsubscribeStudents();
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function errorText(e) {
  const map = {
    "auth/invalid-email": "Некорректный email.",
    "auth/user-not-found": "Пользователь не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/email-already-in-use": "Этот email уже зарегистрирован.",
    "auth/weak-password": "Пароль слишком простой (минимум 6 символов).",
    "auth/invalid-credential": "Неверный email или пароль.",
  };
  return map[e.code] || e.message;
}

// ---------- Students ----------
function listenToStudents() {
  const q = query(collection(db, "students"), orderBy("name"));
  unsubscribeStudents = onSnapshot(q, (snap) => {
    studentsTbody.innerHTML = "";
    snap.forEach((docSnap) => {
      studentsTbody.appendChild(renderStudentRow(docSnap.id, docSnap.data()));
    });
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
    linkedTd.textContent = "Привязан";
    linkedTd.className = "linked";
  } else {
    linkedTd.textContent = "Ожидает";
    linkedTd.className = "not-linked";
  }

  const deleteTd = document.createElement("td");
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Удалить";
  deleteBtn.className = "secondary small";
  deleteBtn.onclick = () => {
    if (confirm(`Удалить ${data.name}?`)) deleteDoc(doc(db, "students", id));
  };
  deleteTd.appendChild(deleteBtn);

  tr.append(nameTd, pointsTd, controlsTd, codeTd, linkedTd, deleteTd);
  return tr;
}

async function changePoints(id, currentPoints, delta) {
  const newValue = Math.max(0, (currentPoints || 0) + delta);
  await updateDoc(doc(db, "students", id), { points: newValue });
}
