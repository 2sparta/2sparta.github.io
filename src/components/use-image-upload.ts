import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { consumeImagePaste, ImageUploadQueue, type ImagePasteEvent } from "@/lib/clipboard-images";
import { uploadDriveImage } from "@/lib/school/drive";
import { STRINGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export function useImageUpload(options: {
  getCount: () => number;
  max: number;
  disabled?: boolean;
  onUploaded: (url: string, file: File) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = STRINGS[usePrefs((s) => s.lang)];
  const latest = useRef({ ...options, t });
  latest.current = { ...options, t };
  const queue = useRef<ImageUploadQueue | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const uploads = new ImageUploadQueue({
      upload: uploadDriveImage,
      getCount: () => latest.current.getCount(),
      getMax: () => latest.current.max,
      onUploaded: (url, file) => latest.current.onUploaded(url, file),
      onError: (error) =>
        toast.error(
          error instanceof Error && error.message === "NO_URL"
            ? latest.current.t.driveNeedUrl
            : latest.current.t.driveFail,
        ),
      onBusyChange: (value) => {
        setBusy(value);
        latest.current.onBusyChange?.(value);
      },
    });
    queue.current = uploads;
    return () => {
      uploads.dispose();
      queue.current = null;
    };
  }, []);
  const add = (files: File[]) => {
    if (latest.current.disabled) return;
    const images = files.filter((file) => file.type.startsWith("image/"));
    const accepted = queue.current?.add(images) ?? 0;
    if (accepted < images.length)
      toast.info(latest.current.t.drivePhotoLimit.replace("{max}", String(latest.current.max)));
  };
  const onPaste = (event: ImagePasteEvent) => {
    if (latest.current.disabled) return;
    consumeImagePaste(event, add);
  };
  return { busy, add, onPaste, isBusy: () => queue.current?.busy ?? false };
}
