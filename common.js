// ==========================================================
// Спільні речі для панелі вчителя (app.js) і кабінету учня (student.js):
// конфіг Firebase + чисті функції роботи з розкладом/датами.
// Тримаємо в одному місці, щоб обидві сторінки рахували розклад однаково.
// ==========================================================

export const firebaseConfig = {
  apiKey: "AIzaSyALxxd9W3RH4g17Ygdcy3qlBR4Um6CIQ3g",
  authDomain: "schooleballs.firebaseapp.com",
  projectId: "schooleballs",
  storageBucket: "schooleballs.firebasestorage.app",
  messagingSenderId: "816513463350",
  appId: "1:816513463350:web:d419b07188f9c36ff79497",
  measurementId: "G-K8HGF284FX"
};

// ---------- Тема (світла / темна / ocean / warm) ----------
export const THEME_STORAGE_KEY = "schooleballs-theme";
export const THEME_ORDER = ["light", "ocean", "warm", "dark", "ocean-dark", "warm-dark"];

// Теми, що вважаються "темними" (темний фон, іконка місяця на перемикачі,
// color-scheme: dark для нативних елементів браузера).
const DARK_THEMES = ["dark", "ocean-dark", "warm-dark"];

const THEME_LABELS = {
  light: "Світла",
  ocean: "Океан",
  warm: "Тепла",
  dark: "Темна",
  "ocean-dark": "Океан (темна)",
  "warm-dark": "Тепла (темна)",
};

// Застосовує тему до <html data-theme="..."> і синхронізує стан усіх
// кнопок-перемикачів теми на сторінці (іконка + aria + title).
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = DARK_THEMES.includes(theme);
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.classList.toggle("is-dark", isDark);
    btn.classList.toggle("is-ocean", theme === "ocean");
    btn.classList.toggle("is-warm", theme === "warm");
    btn.classList.toggle("is-ocean-dark", theme === "ocean-dark");
    btn.classList.toggle("is-warm-dark", theme === "warm-dark");
    const label = THEME_LABELS[theme] || theme;
    btn.setAttribute("aria-label", `Тема: ${label}. Натисніть, щоб змінити`);
    btn.title = `Тема: ${label}`;
  });
}

// Викликається один раз при завантаженні сторінки (app.js / student.js):
// читає збережену тему (або системну), застосовує її та вішає обробники
// кліків на всі елементи .theme-toggle-btn, які є в HTML.
// Кнопка циклічно перемикає: light → ocean → warm → dark → ocean-dark → warm-dark → light.
export function initThemeToggle() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  let theme = saved || (systemPrefersDark ? "dark" : "light");
  if (!THEME_ORDER.includes(theme)) theme = "light";

  applyTheme(theme);

  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = THEME_ORDER.indexOf(theme);
      theme = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
    });
  });
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// getDay(): 0=Sun..6=Sat
export const WEEKDAY_BY_JS_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function pluralUk(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function emptyGroupSchedule() {
  return {
    // Кожен день — мапа "номер уроку" → запис {eid, subjectId}.
    // Це дозволяє видаляти/додавати урок у конкретній клітинці, не зсуваючи інші.
    mon: {}, tue: {}, wed: {}, thu: {}, fri: {}, sat: {}, sun: {},
    times: {},
    // Власний ("особливий") розклад дзвінків для конкретного дня тижня,
    // напр. { sat: { 0: {start,end}, 1: {...} } } — якщо для дня задано
    // хоча б один запис, він повністю перекриває спільний times для цього дня.
    dayTimes: {},
    applied: false,
    overrides: {},
  };
}

// ЗАСТАРІЛЕ: раніше було рівно дві фіксовані групи. Лишили для сумісності —
// нові класи тепер зберігаються в колекції Firestore "classes" і схема
// розкладу будується динамічно через buildScheduleData().
export function emptySchedule() {
  return { group1: emptyGroupSchedule(), group2: emptyGroupSchedule() };
}

// Будує scheduleData для довільного набору id класів (замість фіксованих
// group1/group2). raw — вміст документа schedule/week, classIds — масив
// id-шників усіх класів, що зараз існують (з колекції "classes").
export function buildScheduleData(raw, classIds) {
  const result = {};
  const safeRaw = raw || {};
  const ids = classIds && classIds.length ? classIds : ["group1"];
  ids.forEach((id) => {
    result[id] = normalizeGroupData(safeRaw[id]);
  });
  return result;
}

// Повертає ефективну мапу "номер уроку" → {start,end} для конкретного дня:
// якщо для цього дня задано власний розклад дзвінків (dayTimes[dayKey]) —
// повертає його, інакше — спільний groupSchedule.times.
export function getDayEffectiveTimes(groupSchedule, dayKey) {
  const dayOverride = groupSchedule.dayTimes && groupSchedule.dayTimes[dayKey];
  if (dayOverride && Object.keys(dayOverride).length > 0) return dayOverride;
  return groupSchedule.times || {};
}

// Повертає ISO-ключ поточного тижня, напр. "2026-W37".
// Використовується, щоб разові заміни автоматично "спливали" в кінці тижня.
export function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Повертає активну (не протерміновану) разову заміну для клітинки, якщо є.
export function getActiveOverride(groupSchedule, dayKey, r) {
  const dayOverrides = groupSchedule.overrides && groupSchedule.overrides[dayKey];
  if (!dayOverrides) return null;
  const entry = dayOverrides[r] ?? dayOverrides[String(r)];
  if (!entry) return null;
  if (entry.weekKey !== getISOWeekKey(new Date())) return null;
  return entry;
}

// Найбільший заповнений номер уроку (період) для дня, або -1 якщо день порожній.
export function getDayMaxPeriodIndex(dayMap) {
  if (!dayMap) return -1;
  const keys = Object.keys(dayMap);
  if (keys.length === 0) return -1;
  return Math.max(...keys.map((k) => parseInt(k, 10)));
}

// Впорядкований список уроків дня як масив {period, subjectId, eid}.
export function getDayEntriesList(groupSchedule, dayKey) {
  const dayMap = groupSchedule[dayKey] || {};
  return Object.keys(dayMap)
    .map((k) => ({ period: parseInt(k, 10), ...dayMap[k] }))
    .sort((a, b) => a.period - b.period);
}

// Приводить сирі дані одної групи з Firestore до єдиного формату.
export function normalizeGroupData(groupRaw) {
  const base = emptyGroupSchedule();
  if (!groupRaw) return base;
  WEEKDAYS.forEach((dayKey) => {
    const raw = groupRaw[dayKey];
    const dayMap = {};
    if (Array.isArray(raw)) {
      raw.forEach((item, idx) => {
        if (typeof item === "string") {
          dayMap[idx] = { eid: `legacy-${dayKey}-${idx}-${item}`, subjectId: item };
        } else if (item && item.subjectId) {
          dayMap[idx] = { eid: item.eid || `${item.subjectId}-${idx}`, subjectId: item.subjectId };
        }
      });
    } else if (raw && typeof raw === "object") {
      Object.keys(raw).forEach((periodKey) => {
        const item = raw[periodKey];
        if (item && item.subjectId) {
          dayMap[periodKey] = { eid: item.eid || `${item.subjectId}-${periodKey}`, subjectId: item.subjectId };
        }
      });
    }
    base[dayKey] = dayMap;
  });
  base.times = groupRaw.times || {};
  base.dayTimes = groupRaw.dayTimes || {};
  base.applied = !!groupRaw.applied;
  base.overrides = groupRaw.overrides || {};
  return base;
}

export function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateEntryId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseTimeToMinutes(hhmm) {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// ---------- Фон: матове скло + рухомі частинки ----------
export const GLASS_BG_STORAGE_KEY = "schooleballs-glass-bg";

/** Чи увімкнене матове скло (за замовчуванням — так). */
export function isGlassBackgroundEnabled() {
  try {
    const v = localStorage.getItem(GLASS_BG_STORAGE_KEY);
    if (v === null || v === undefined) return true;
    return v !== "0" && v !== "false";
  } catch (e) {
    return true;
  }
}

export function setGlassBackgroundEnabled(enabled) {
  try {
    localStorage.setItem(GLASS_BG_STORAGE_KEY, enabled ? "1" : "0");
  } catch (e) {
    /* ignore */
  }
  applyGlassBackground(enabled);
}

function ensureParticlesLayer(count) {
  let layer = document.getElementById("bg-particles");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "bg-particles";
    layer.setAttribute("aria-hidden", "true");
    document.body.prepend(layer);
  }
  if (layer.childElementCount === 0) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "bg-particle";
      const size = 4 + Math.random() * 14;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      el.style.animationDuration = `${12 + Math.random() * 22}s`;
      el.style.animationDelay = `${-Math.random() * 20}s`;
      el.style.opacity = String(0.15 + Math.random() * 0.35);
      layer.appendChild(el);
    }
  }
  return layer;
}

export function applyGlassBackground(enabled) {
  if (typeof document === "undefined") return;
  const on = !!enabled;
  document.documentElement.classList.toggle("no-glass-bg", !on);
  const layer = document.getElementById("bg-particles");
  if (on) {
    ensureParticlesLayer(28);
    if (layer) layer.classList.remove("hidden");
  } else if (layer) {
    layer.classList.add("hidden");
  }
}

/** Ініціалізація частинок і застосування збереженого стану. */
export function initBackgroundParticles(count = 28) {
  if (typeof document === "undefined") return;
  if (isGlassBackgroundEnabled()) {
    ensureParticlesLayer(count);
    applyGlassBackground(true);
  } else {
    applyGlassBackground(false);
  }
}

/** Панель налаштувань (FAB поруч із повідомленнями). */
export function initSettingsPanel(tFn) {
  if (typeof document === "undefined") return;

  const t = typeof tFn === "function" ? tFn : (k) => k;

  let fab = document.getElementById("settings-fab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "settings-fab";
    fab.className = "settings-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", t("settingsTitle") || "Налаштування");
    fab.title = t("settingsTitle") || "Налаштування";
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.9 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(fab);
  }

  let panel = document.getElementById("settings-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "settings-panel";
    panel.className = "settings-panel hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "settings-panel-title");
    panel.innerHTML = `
      <div class="settings-panel-header">
        <h2 id="settings-panel-title">${t("settingsTitle") || "Налаштування"}</h2>
        <button id="settings-panel-close" class="messages-panel-close" type="button" aria-label="✕">✕</button>
      </div>
      <div class="settings-panel-body">
        <label class="settings-toggle-row">
          <span class="settings-toggle-text">
            <span class="settings-toggle-label">${t("settingsGlassLabel") || "Матове скло на фоні"}</span>
            <span class="settings-toggle-hint">${t("settingsGlassHint") || "Частинки та ефект розмиття карток. Вимкніть для звичайного фону."}</span>
          </span>
          <input type="checkbox" id="settings-glass-toggle" class="settings-toggle-input" />
        </label>
      </div>
    `;
    document.body.appendChild(panel);
  }

  const closeBtn = document.getElementById("settings-panel-close");
  const glassToggle = document.getElementById("settings-glass-toggle");
  const titleEl = document.getElementById("settings-panel-title");
  const labelEl = panel.querySelector(".settings-toggle-label");
  const hintEl = panel.querySelector(".settings-toggle-hint");

  function syncToggle() {
    if (glassToggle) glassToggle.checked = isGlassBackgroundEnabled();
  }

  function openPanel() {
    panel.classList.remove("hidden");
    fab.classList.add("is-open");
    syncToggle();
  }
  function closePanel() {
    panel.classList.add("hidden");
    fab.classList.remove("is-open");
  }

  fab.onclick = () => {
    if (panel.classList.contains("hidden")) openPanel();
    else closePanel();
  };
  if (closeBtn) closeBtn.onclick = () => closePanel();
  if (glassToggle) {
    glassToggle.onchange = () => {
      setGlassBackgroundEnabled(!!glassToggle.checked);
    };
  }

  // Оновлення підписів при зміні мови
  panel._refreshI18n = (tr) => {
    const tt = typeof tr === "function" ? tr : t;
    fab.setAttribute("aria-label", tt("settingsTitle") || "Settings");
    fab.title = tt("settingsTitle") || "Settings";
    if (titleEl) titleEl.textContent = tt("settingsTitle") || "Settings";
    if (labelEl) labelEl.textContent = tt("settingsGlassLabel") || "Frosted glass background";
    if (hintEl) hintEl.textContent = tt("settingsGlassHint") || "Particles and card blur. Turn off for a plain background.";
  };

  syncToggle();
  return { openPanel, closePanel, refreshI18n: panel._refreshI18n };
}
