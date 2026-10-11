import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const previewIndex = previewUrl ? urls.indexOf(previewUrl) : -1;
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
    <Dialog.Root
      open={previewIndex >= 0}
      onOpenChange={(open) => {
        if (!open) setPreviewUrl(null);
      }}
    >
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
            <button
              type="button"
              onClick={(e) => {
                previewTrigger.current = e.currentTarget;
                setPreviewUrl(url);
              }}
              aria-label={t.drivePreviewPhoto.replace("{index}", String(urls.indexOf(url) + 1))}
              className="block rounded-xl outline-none ring-forest-mid hover:ring-2 focus-visible:ring-2"
            >
              <img src={url} alt="" className="size-14 rounded-xl object-cover" />
            </button>
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
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (previewTrigger.current?.isConnected) previewTrigger.current.focus();
          }}
          className="fixed top-1/2 left-1/2 z-[101] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl bg-surface p-3 shadow-2xl outline-none sm:p-4"
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <Dialog.Title className="font-display text-sm font-bold text-ink">
              {t.drivePhotoCounter
                .replace("{current}", String(previewIndex + 1))
                .replace("{total}", String(urls.length))}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t.driveClosePreview}
                className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink hover:bg-cream focus-visible:outline-2 focus-visible:outline-forest-mid"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          {previewIndex >= 0 && (
            <img
              src={urls[previewIndex]}
              alt={t.drivePreviewPhoto.replace("{index}", String(previewIndex + 1))}
              className="min-h-0 max-h-[72dvh] w-full rounded-xl object-contain"
            />
          )}
          {urls.length > 1 && (
            <div className="flex shrink-0 justify-between gap-3">
              <button
                type="button"
                aria-label={t.drivePreviousPhoto}
                disabled={previewIndex <= 0}
                onClick={() => setPreviewUrl(urls[previewIndex - 1])}
                className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-bold text-ink disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                {t.drivePreviousPhoto}
              </button>
              <button
                type="button"
                aria-label={t.driveNextPhoto}
                disabled={previewIndex >= urls.length - 1}
                onClick={() => setPreviewUrl(urls[previewIndex + 1])}
                className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-bold text-ink disabled:opacity-40"
              >
                {t.driveNextPhoto}
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
