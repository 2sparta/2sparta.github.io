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
// 1) dayTimes[dayKey] групи (особливий розклад дня),
// 2) times групи,
// 3) якщо передано globalDefaults — dayTimes/times з schedule/defaults.
export function getDayEffectiveTimes(groupSchedule, dayKey, globalDefaults) {
  const dayOverride = groupSchedule && groupSchedule.dayTimes && groupSchedule.dayTimes[dayKey];
  if (dayOverride && Object.keys(dayOverride).length > 0) return dayOverride;
  const groupTimes = groupSchedule && groupSchedule.times;
  if (groupTimes && Object.keys(groupTimes).length > 0) return groupTimes;
  if (globalDefaults) {
    const gDay = globalDefaults.dayTimes && globalDefaults.dayTimes[dayKey];
    if (gDay && Object.keys(gDay).length > 0) return gDay;
    if (globalDefaults.times && Object.keys(globalDefaults.times).length > 0) {
      return globalDefaults.times;
    }
  }
  return (groupSchedule && groupSchedule.times) || {};
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

/** 16-символьний код-запрошення для вчителя (без неоднозначних символів 0/O, 1/I). */
export function generateTeacherInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

const SPARKLE_SVG =
  '<svg class="sparkle-svg" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M93.781 51.578C95 50.969 96 49.359 96 48c0-1.375-1-2.969-2.219-3.578 0 0-22.868-1.514-31.781-10.422-8.915-8.91-10.438-31.781-10.438-31.781C50.969 1 49.375 0 48 0s-2.969 1-3.594 2.219c0 0-1.5 22.87-10.406 31.781-8.908 8.913-31.781 10.422-31.781 10.422C1 45.031 0 46.625 0 48c0 1.359 1 2.969 2.219 3.578 0 0 22.873 1.51 31.781 10.422 8.906 8.911 10.406 31.781 10.406 31.781C45.031 95 46.625 96 48 96s2.969-1 3.562-2.219c0 0 1.523-22.871 10.438-31.781 8.913-8.908 31.781-10.422 31.781-10.422Z"/></svg>';

/**
 * Crystal Glow для заголовка привітання (адаптація Originkit Sparkle під сайт).
 * Безпечно для i18n: текст екранується.
 */
export function setSparkleGreeting(el, text) {
  if (!el) return;
  const safe = escapeHtml(String(text || ""));
  el.classList.add("sparkle-greeting");
  el.innerHTML =
    SPARKLE_SVG.repeat(5) +
    `<span class="sparkle-greeting-base">${safe}</span>` +
    `<span class="sparkle-greeting-shine" aria-hidden="true">${safe}</span>`;
  el.classList.remove("is-sparkling");
  void el.offsetWidth;
  el.classList.add("is-sparkling");
  window.setTimeout(() => el.classList.remove("is-sparkling"), 900);
}

/** Чи є значення оцінки числовим балом (1–12), а не "Н" (відсутність) чи іншим нечисловим маркером. */
export function isNumericGrade(value) {
  if (value === "Н" || value === "н" || String(value).toUpperCase() === "Н") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 12;
}


// ---------- Фон: glass / network / plain + 3D swarm (hyperfield / earth / saturn) ----------
export const GLASS_BG_STORAGE_KEY = "schooleballs-glass-bg"; // legacy
export const BG_MODE_STORAGE_KEY = "schooleballs-bg-mode";
export const BG_MODES = ["glass", "network", "plain", "hyperfield", "earth", "saturn"];

const BG_MODE_LABELS = {
  glass: { uk: "Матове скло", en: "Frosted glass" },
  network: { uk: "Particle Network", en: "Particle Network" },
  plain: { uk: "Звичайний фон", en: "Plain background" },
  hyperfield: { uk: "Гіперполе", en: "Hyperfield" },
  earth: { uk: "Земля", en: "Earth" },
  saturn: { uk: "Сатурн", en: "Saturn" },
};

/** Three.js сцени з окремих HTML (iframe, pointer-events: none). */
const SWARM_BG_SOURCES = {
  hyperfield: "chat_gpt.html",
  earth: "earth_with_cloud.html",
  saturn: "rainbow_saturn.html",
};
const SWARM_BG_MODES = new Set(["hyperfield", "earth", "saturn"]);

/** Поточний режим фону. Міграція зі старого ключа glass on/off. */
export function getBackgroundMode() {
  try {
    const v = localStorage.getItem(BG_MODE_STORAGE_KEY);
    if (v && BG_MODES.includes(v)) return v;
    // legacy: schooleballs-glass-bg
    const legacy = localStorage.getItem(GLASS_BG_STORAGE_KEY);
    if (legacy === "0" || legacy === "false") return "plain";
    return "glass";
  } catch (e) {
    return "glass";
  }
}

export function setBackgroundMode(mode) {
  const m = BG_MODES.includes(mode) ? mode : "glass";
  try {
    localStorage.setItem(BG_MODE_STORAGE_KEY, m);
    // sync legacy key
    localStorage.setItem(GLASS_BG_STORAGE_KEY, m === "glass" ? "1" : "0");
  } catch (e) {
    /* ignore */
  }
  applyBackgroundMode(m);
  return m;
}

/** @deprecated — сумісність */
export function isGlassBackgroundEnabled() {
  return getBackgroundMode() === "glass";
}

/** @deprecated — сумісність */
export function setGlassBackgroundEnabled(enabled) {
  setBackgroundMode(enabled ? "glass" : "plain");
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

// ---------- Particle Network (canvas) ----------
let networkState = null; // { canvas, ctx, particles, raf, w, h, mouse, onResize, onMove, onLeave }

function stopParticleNetwork() {
  if (!networkState) return;
  if (networkState.raf) cancelAnimationFrame(networkState.raf);
  if (networkState.onResize) window.removeEventListener("resize", networkState.onResize);
  if (networkState.onMove) window.removeEventListener("mousemove", networkState.onMove);
  if (networkState.onLeave) window.removeEventListener("mouseleave", networkState.onLeave);
  if (networkState.canvas && networkState.canvas.parentNode) {
    networkState.canvas.parentNode.removeChild(networkState.canvas);
  }
  networkState = null;
}

function startParticleNetwork() {
  if (typeof document === "undefined") return;
  if (networkState) return;

  const canvas = document.createElement("canvas");
  canvas.id = "bg-network-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const mouse = { x: null, y: null };
  let w = 0;
  let h = 0;
  let particles = [];

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(40, Math.min(110, Math.floor((w * h) / 16000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r: 1.2 + Math.random() * 1.8,
      });
    }
  }

  function accentColor(alpha) {
    const styles = getComputedStyle(document.documentElement);
    const c = styles.getPropertyValue("--color-accent").trim() || "#24866b";
    // parse #rrggbb
    if (c[0] === "#" && (c.length === 7 || c.length === 4)) {
      let r, g, b;
      if (c.length === 7) {
        r = parseInt(c.slice(1, 3), 16);
        g = parseInt(c.slice(3, 5), 16);
        b = parseInt(c.slice(5, 7), 16);
      } else {
        r = parseInt(c[1] + c[1], 16);
        g = parseInt(c[2] + c[2], 16);
        b = parseInt(c[3] + c[3], 16);
      }
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(36,134,107,${alpha})`;
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const linkDist = Math.min(140, Math.max(90, w * 0.09));
    const mouseDist = linkDist * 1.35;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));
    }

    // links
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < linkDist) {
          const alpha = 0.08 + (1 - d / linkDist) * 0.28;
          ctx.beginPath();
          ctx.strokeStyle = accentColor(alpha);
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (mouse.x != null) {
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < mouseDist) {
          const alpha = 0.12 + (1 - d / mouseDist) * 0.35;
          ctx.beginPath();
          ctx.strokeStyle = accentColor(alpha);
          ctx.lineWidth = 1.2;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
          // gentle pull
          a.vx += (-dx / mouseDist) * 0.02;
          a.vy += (-dy / mouseDist) * 0.02;
          const speed = Math.hypot(a.vx, a.vy);
          if (speed > 1.2) {
            a.vx = (a.vx / speed) * 1.2;
            a.vy = (a.vy / speed) * 1.2;
          }
        }
      }
    }

    // dots
    ctx.fillStyle = accentColor(0.55);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    networkState.raf = requestAnimationFrame(frame);
  }

  function onResize() {
    resize();
  }
  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onLeave() {
    mouse.x = null;
    mouse.y = null;
  }

  resize();
  networkState = {
    canvas,
    ctx,
    particles,
    raf: 0,
    w,
    h,
    mouse,
    onResize,
    onMove,
    onLeave,
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseleave", onLeave);
  networkState.raf = requestAnimationFrame(frame);
}

function stopSwarmBackground() {
  const frame = document.getElementById("bg-swarm-iframe");
  if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
}

function startSwarmBackground(mode) {
  if (typeof document === "undefined") return;
  const src = SWARM_BG_SOURCES[mode];
  if (!src) return;
  let frame = document.getElementById("bg-swarm-iframe");
  if (frame) {
    if (frame.dataset.mode === mode) return;
    frame.src = src;
    frame.dataset.mode = mode;
    return;
  }
  frame = document.createElement("iframe");
  frame.id = "bg-swarm-iframe";
  frame.dataset.mode = mode;
  frame.src = src;
  frame.title = "Background animation";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  frame.loading = "lazy";
  document.body.prepend(frame);
}

export function applyBackgroundMode(mode) {
  if (typeof document === "undefined") return;
  const m = BG_MODES.includes(mode) ? mode : getBackgroundMode();
  const root = document.documentElement;
  root.setAttribute("data-bg-mode", m);
  root.classList.toggle("no-glass-bg", m !== "glass");
  root.classList.toggle("bg-mode-network", m === "network");
  root.classList.toggle("bg-mode-plain", m === "plain");
  root.classList.toggle("bg-mode-glass", m === "glass");
  root.classList.toggle("bg-mode-swarm", SWARM_BG_MODES.has(m));
  root.classList.toggle("bg-mode-hyperfield", m === "hyperfield");
  root.classList.toggle("bg-mode-earth", m === "earth");
  root.classList.toggle("bg-mode-saturn", m === "saturn");

  const layer = document.getElementById("bg-particles");
  if (m === "glass") {
    ensureParticlesLayer(28);
    const l = document.getElementById("bg-particles");
    if (l) l.classList.remove("hidden");
    stopParticleNetwork();
    stopSwarmBackground();
  } else if (m === "network") {
    if (layer) layer.classList.add("hidden");
    stopSwarmBackground();
    startParticleNetwork();
  } else if (SWARM_BG_MODES.has(m)) {
    if (layer) layer.classList.add("hidden");
    stopParticleNetwork();
    startSwarmBackground(m);
  } else {
    if (layer) layer.classList.add("hidden");
    stopParticleNetwork();
    stopSwarmBackground();
  }

  // sync toggle buttons
  document.querySelectorAll(".bg-mode-toggle-btn").forEach((btn) => {
    btn.classList.remove(
      "is-glass",
      "is-network",
      "is-plain",
      "is-hyperfield",
      "is-earth",
      "is-saturn"
    );
    btn.classList.add(`is-${m}`);
    const lang = (localStorage.getItem("schooleballs-lang") || "uk").startsWith("en") ? "en" : "uk";
    const label = (BG_MODE_LABELS[m] && BG_MODE_LABELS[m][lang]) || m;
    btn.setAttribute("aria-label", `Фон: ${label}. Натисніть, щоб змінити`);
    btn.title = label;
  });
}

/** @deprecated alias */
export function applyGlassBackground(enabled) {
  applyBackgroundMode(enabled ? "glass" : "plain");
}

/** Ініціалізація фону + кнопок перемикача режиму. */
export function initBackgroundParticles(count = 28) {
  if (typeof document === "undefined") return;
  // ensure buttons exist next to theme toggles if not in HTML
  ensureBgModeButtons();
  const mode = getBackgroundMode();
  if (mode === "glass") ensureParticlesLayer(count);
  applyBackgroundMode(mode);

  document.querySelectorAll(".bg-mode-toggle-btn").forEach((btn) => {
    if (btn.dataset.bgBound) return;
    btn.dataset.bgBound = "1";
    btn.addEventListener("click", () => {
      const cur = getBackgroundMode();
      const idx = BG_MODES.indexOf(cur);
      const next = BG_MODES[(idx + 1) % BG_MODES.length];
      setBackgroundMode(next);
    });
  });
}

function ensureBgModeButtons() {
  const svgGlass = `<svg class="icon-bg-glass" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 14c3-1 5-4 5-7 0 0 5 2 5 7 0 3-2 6-5 6s-5-3-5-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 8c1.5.5 3 2 3 4.5 0 2-1 4-3 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="11" r="1.2" fill="currentColor"/></svg>`;
  const svgNetwork = `<svg class="icon-bg-network" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="6" cy="7" r="2" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="2" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="16" r="1.5" stroke="currentColor" stroke-width="2"/><path d="M8 8l3.2 7.2M16.2 7.2l-3 7.5M16.5 8.2l1.8 6.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const svgPlain = `<svg class="icon-bg-plain" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 15h16" stroke="currentColor" stroke-width="2"/></svg>`;
  const svgHyper = `<svg class="icon-bg-hyperfield" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg>`;
  const svgEarth = `<svg class="icon-bg-earth" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z" stroke="currentColor" stroke-width="2"/><path d="M5 8.5c2 .8 4 .8 6 0s4-.8 6 0M5 15.5c2-.8 4-.8 6 0s4 .8 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const svgSaturn = `<svg class="icon-bg-saturn" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="10" ry="3.5" stroke="currentColor" stroke-width="1.6" transform="rotate(-20 12 12)"/></svg>`;

  const allIcons = svgGlass + svgNetwork + svgPlain + svgHyper + svgEarth + svgSaturn;
  document.querySelectorAll(".theme-toggle-btn").forEach((themeBtn) => {
    const parent = themeBtn.parentElement;
    if (!parent) return;
    let btn = parent.querySelector(".bg-mode-toggle-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bg-mode-toggle-btn";
      btn.setAttribute("aria-label", "Режим фону");
      parent.insertBefore(btn, themeBtn);
    }
    if (!btn.querySelector(".icon-bg-hyperfield") || !btn.querySelector(".icon-bg-earth") || !btn.querySelector(".icon-bg-saturn")) {
      btn.innerHTML = allIcons;
    }
  });
}

/** Повноекранні налаштування (FAB + екран з вкладками зліва, як у кабінеті). */
export function initSettingsPanel(tFn) {
  if (typeof document === "undefined") return;

  const t = typeof tFn === "function" ? tFn : (k) => k;
  const GEAR_SPIN_MS = 420;
  const TRANSITION_MS = 320;

  let fab = document.getElementById("settings-fab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "settings-fab";
    fab.className = "settings-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", t("settingsTitle") || "Налаштування");
    fab.title = t("settingsTitle") || "Налаштування";
    fab.innerHTML = `<svg class="settings-fab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.9 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(fab);
  }

  let screen = document.getElementById("settings-screen");
  if (!screen) {
    screen = document.createElement("div");
    screen.id = "settings-screen";
    screen.className = "settings-screen";
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-labelledby", "settings-screen-title");
    screen.setAttribute("aria-hidden", "true");
    screen.innerHTML = `
      <div class="settings-screen-inner">
        <header class="settings-screen-header">
          <div class="settings-screen-header-left">
            <button id="settings-back-btn" class="settings-back-btn" type="button" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span id="settings-back-label">${t("settingsBack") || "Назад"}</span>
            </button>
            <h1 id="settings-screen-title" class="settings-screen-title">${t("settingsTitle") || "Налаштування"}</h1>
          </div>
        </header>
        <div class="settings-screen-body">
          <nav class="settings-tabs" id="settings-tabs" aria-label="Settings sections">
            <button type="button" class="settings-tab-btn active" data-settings-section="appearance">
              ${t("settingsTabAppearance") || "Оформлення"}
            </button>
          </nav>
          <div class="settings-main" id="settings-main">
            <section id="settings-section-appearance" class="settings-section card" data-settings-section="appearance">
              <h2 class="settings-section-title">${t("settingsTabAppearance") || "Оформлення"}</h2>
              <p class="hint settings-appearance-hint">${t("settingsAppearanceHint") || "Тема та режим фону змінюються кнопками в шапці (поруч із мовою)."}</p>
            </section>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(screen);
  }

  // Прибрати стару плаваючу панель, якщо лишилась після попередньої версії
  const legacyPanel = document.getElementById("settings-panel");
  if (legacyPanel) legacyPanel.remove();

  const backBtn = document.getElementById("settings-back-btn");
  const titleEl = document.getElementById("settings-screen-title");
  const backLabelEl = document.getElementById("settings-back-label");
  const tabsNav = document.getElementById("settings-tabs");
  const settingsMain = document.getElementById("settings-main");
  const appearanceHintEl = screen.querySelector(".settings-appearance-hint");
  const appearanceTabBtn = screen.querySelector('.settings-tab-btn[data-settings-section="appearance"]');
  const appearanceSectionTitle = screen.querySelector("#settings-section-appearance .settings-section-title");

  let isOpen = false;
  let isAnimating = false;

  function syncToggle() {
    /* bg mode lives in header buttons now */
  }

  function setActiveTab(sectionId) {
    if (!tabsNav) return;
    tabsNav.querySelectorAll(".settings-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-settings-section") === sectionId);
    });
  }

  function scrollToSection(sectionId) {
    const el = document.getElementById(`settings-section-${sectionId}`);
    if (!el || !settingsMain) return;
    setActiveTab(sectionId);
    const top = el.offsetTop - 12;
    settingsMain.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function spinGear(direction) {
    fab.classList.remove("is-spinning");
    void fab.offsetWidth;
    if (direction === "open") {
      fab.classList.add("is-spinning");
      fab.classList.add("is-open");
      window.setTimeout(() => fab.classList.remove("is-spinning"), GEAR_SPIN_MS + 40);
    } else {
      fab.classList.remove("is-open");
    }
  }

  function openPanel() {
    if (isOpen || isAnimating) return;
    isAnimating = true;
    spinGear("open");
    syncToggle();

    window.setTimeout(() => {
      screen.setAttribute("aria-hidden", "false");
      screen.classList.add("is-visible");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          screen.classList.add("is-open");
          document.body.classList.add("settings-open");
        });
      });
      isOpen = true;
      window.setTimeout(() => {
        isAnimating = false;
      }, TRANSITION_MS + 40);
    }, Math.min(GEAR_SPIN_MS * 0.55, 280));
  }

  function closePanel() {
    if (!isOpen || isAnimating) return;
    isAnimating = true;
    spinGear("close");
    screen.classList.remove("is-open");
    document.body.classList.remove("settings-open");
    window.setTimeout(() => {
      screen.classList.remove("is-visible");
      screen.setAttribute("aria-hidden", "true");
      isOpen = false;
      isAnimating = false;
    }, TRANSITION_MS + 40);
  }

  fab.onclick = () => {
    if (isOpen) closePanel();
    else openPanel();
  };
  if (backBtn) backBtn.onclick = () => closePanel();

  if (tabsNav) {
    tabsNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".settings-tab-btn");
      if (!btn) return;
      const sectionId = btn.getAttribute("data-settings-section");
      if (sectionId) scrollToSection(sectionId);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closePanel();
    }
  });

  function refreshI18n(tr) {
    const tt = typeof tr === "function" ? tr : t;
    fab.setAttribute("aria-label", tt("settingsTitle") || "Settings");
    fab.title = tt("settingsTitle") || "Settings";
    if (titleEl) titleEl.textContent = tt("settingsTitle") || "Settings";
    if (backLabelEl) backLabelEl.textContent = tt("settingsBack") || "Back";
    if (appearanceHintEl) {
      appearanceHintEl.textContent =
        tt("settingsAppearanceHint") || "Theme and background mode are controlled by the buttons in the header.";
    }
    if (appearanceTabBtn) {
      appearanceTabBtn.textContent = tt("settingsTabAppearance") || "Appearance";
    }
    if (appearanceSectionTitle) {
      appearanceSectionTitle.textContent = tt("settingsTabAppearance") || "Appearance";
    }
  }

  /** Додає нову вкладку/секцію в екран налаштувань (напр. розклад дзвінків для вчителя). */
  function addSection({ id, tabLabel, title, buildContent }) {
    if (!id || !tabsNav || !settingsMain) return null;
    if (document.getElementById(`settings-section-${id}`)) {
      return document.getElementById(`settings-section-${id}`);
    }
    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.className = "settings-tab-btn";
    tabBtn.setAttribute("data-settings-section", id);
    tabBtn.textContent = tabLabel || id;
    tabsNav.appendChild(tabBtn);

    const section = document.createElement("section");
    section.id = `settings-section-${id}`;
    section.className = "settings-section card";
    section.setAttribute("data-settings-section", id);
    const h2 = document.createElement("h2");
    h2.className = "settings-section-title";
    h2.textContent = title || tabLabel || id;
    section.appendChild(h2);
    const body = document.createElement("div");
    body.className = "settings-section-body";
    section.appendChild(body);
    settingsMain.appendChild(section);
    if (typeof buildContent === "function") buildContent(body, section);
    return section;
  }

  syncToggle();
  return { openPanel, closePanel, refreshI18n, addSection };
}

