import { useEffect, useRef, type RefObject } from "react";
import { ImagePlus, X } from "lucide-react";
import { useImageUpload } from "./use-image-upload";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export function PhotoAttach({
  urls,
  onChange,
  disabled,
  max = 4,
  pasteScopeRef,
  onBusyChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  max?: number;
  pasteScopeRef?: RefObject<HTMLElement | null>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const input = useRef<HTMLInputElement>(null);
  const currentUrls = useRef(urls);
  currentUrls.current = urls;
  const change = (next: string[]) => {
    currentUrls.current = next;
    onChange(next);
  };
  const { busy, add, onPaste } = useImageUpload({
    getCount: () => currentUrls.current.length,
    max,
    disabled,
    onBusyChange,
    onUploaded: (url) => change([...currentUrls.current, url]),
  });
  const paste = useRef(onPaste);
  paste.current = onPaste;
  useEffect(() => {
    const scope = pasteScopeRef?.current;
    if (!scope) return;
    const handler = (event: ClipboardEvent) => paste.current(event);
    scope.addEventListener("paste", handler);
    return () => scope.removeEventListener("paste", handler);
  }, [pasteScopeRef]);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={busy}>
      <button
        type="button"
        disabled={disabled || busy || urls.length >= max}
        onClick={() => input.current?.click()}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-3 text-xs font-bold text-ink disabled:opacity-40"
      >
        <ImagePlus className="size-4" />
        {busy ? t.driveUploading : t.driveAddPhoto}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max > 1}
        hidden
        disabled={disabled}
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {urls.map((url) => (
        <span key={url} className="relative">
          <img src={url} alt="" className="size-14 rounded-xl object-cover" />
          <button
            type="button"
            className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-paper"
            disabled={disabled}
            onClick={() => change(currentUrls.current.filter((u) => u !== url))}
            aria-label={t.delete}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <span role="status" className="w-full text-xs text-muted">
        {busy ? t.driveUploading : t.drivePasteHint}
      </span>
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
