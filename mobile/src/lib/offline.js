import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Офлайн-кеш лише для вже прочитаних даних цього акаунта.
 * Паролі й чужі коди запрошень сюди не пишемо.
 * При виході кеш і черга цього uid стираються.
 * Запис у Firestore все одно проходить правила безпеки, коли з'явиться мережа.
 */

export async function isOnline() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("https://connectivitycheck.gstatic.com/generate_204", {
      method: "HEAD",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

function cacheKey(uid, key) {
  return `kp-cache:${uid}:${key}`;
}

export async function readCache(uid, key) {
  if (!uid) return null;
  const raw = await AsyncStorage.getItem(cacheKey(uid, key));
  if (!raw) return null;
  try {
    const packed = JSON.parse(raw);
    if (!packed || typeof packed.at !== "number") return null;
    if (Date.now() - packed.at > MAX_AGE) return null;
    return packed;
  } catch {
    return null;
  }
}

export async function writeCache(uid, key, data) {
  if (!uid) return;
  await AsyncStorage.setItem(cacheKey(uid, key), JSON.stringify({ at: Date.now(), data }));
}

export async function cached(uid, key, loader) {
  const online = await isOnline();
  if (!online) {
    const hit = await readCache(uid, key);
    if (hit) return { data: hit.data, offline: true, savedAt: hit.at };
    const err = new Error("OFFLINE");
    err.code = "OFFLINE";
    throw err;
  }
  try {
    const data = await loader();
    await writeCache(uid, key, data);
    return { data, offline: false, savedAt: Date.now() };
  } catch (err) {
    const hit = await readCache(uid, key);
    if (hit) return { data: hit.data, offline: true, savedAt: hit.at };
    throw err;
  }
}

function queueKey(uid) {
  return `kp-queue:${uid}`;
}

export async function enqueue(uid, item) {
  const raw = await AsyncStorage.getItem(queueKey(uid));
  const list = raw ? JSON.parse(raw) : [];
  list.push({ ...item, at: Date.now() });
  await AsyncStorage.setItem(queueKey(uid), JSON.stringify(list.slice(-40)));
}

export async function readQueue(uid) {
  const raw = await AsyncStorage.getItem(queueKey(uid));
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function writeQueue(uid, list) {
  await AsyncStorage.setItem(queueKey(uid), JSON.stringify(list));
}

export async function wipeUser(uid) {
  if (!uid) return;
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter((k) => k.startsWith(`kp-cache:${uid}:`) || k === queueKey(uid));
  if (mine.length) await AsyncStorage.multiRemove(mine);
}
