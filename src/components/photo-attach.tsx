import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { uploadDriveImage } from "@/lib/school/drive";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export function PhotoAttach({
  urls,
  onChange,
  disabled,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const room = 4 - urls.length;
    if (room <= 0) return;
    setBusy(true);
    try {
      const next = [...urls];
      for (const file of [...list].slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        next.push(await uploadDriveImage(file));
      }
      onChange(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message === "NO_URL" ? t.driveNeedUrl : t.driveFail);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled || busy || urls.length >= 4}
        onClick={() => input.current?.click()}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-3 text-xs font-bold text-ink disabled:opacity-40"
      >
        <ImagePlus className="size-4" />
        {busy ? t.driveUploading : t.driveAddPhoto}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
      {urls.map((url) => (
        <span key={url} className="relative">
          <img src={url} alt="" className="size-14 rounded-xl object-cover" />
          <button
            type="button"
            className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-paper"
            onClick={() => onChange(urls.filter((u) => u !== url))}
            aria-label={t.delete}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function PhotoStrip({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" className="max-h-48 max-w-full rounded-xl object-cover" />
        </a>
      ))}
    </div>
  );
}
