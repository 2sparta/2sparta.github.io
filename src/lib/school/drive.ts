const URL_KEY = "klasnyi.driveUploadUrl";
const TOKEN_KEY = "klasnyi.driveToken";
const DEFAULT_TOKEN = "cW4arF1fbEqnS9o";
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbwwOruVGbeQo7A7fJoMHLINHaaENEuYrBmzylbuiptuWSJqwZANOK54q_cFfAC4aKwr/exec";

export function driveConfig() {
  if (typeof localStorage === "undefined") return { url: "", token: "" };
  return {
    url: (localStorage.getItem(URL_KEY) || (import.meta.env.VITE_DRIVE_UPLOAD_URL as string | undefined) || DEFAULT_URL).trim(),
    token: (localStorage.getItem(TOKEN_KEY) || (import.meta.env.VITE_DRIVE_TOKEN as string | undefined) || DEFAULT_TOKEN).trim(),
  };
}

export function saveDriveConfig(url: string, token: string) {
  localStorage.setItem(URL_KEY, url.trim());
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export async function uploadDriveImage(file: File): Promise<string> {
  const { url, token } = driveConfig();
  if (!url) throw new Error("NO_URL");
  const packed = await compressImage(file);
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ name: packed.name, mimeType: packed.mimeType, data: packed.data, token }),
  });
  const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!json.ok || !json.url) throw new Error(json.error || "Upload failed");
  return json.url;
}

async function compressImage(file: File): Promise<{ data: string; mimeType: string; name: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode"))), "image/jpeg", 0.82);
  });
  const data = await blobToBase64(blob);
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  return { data, mimeType: "image/jpeg", name };
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      resolve(raw.slice(raw.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
