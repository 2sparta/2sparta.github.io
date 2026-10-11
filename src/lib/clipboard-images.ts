export type ImagePasteEvent = {
  clipboardData: Pick<DataTransfer, "items" | "files"> | null;
  preventDefault: () => void;
};

/** Prefer items; files is a fallback, not a second copy of the same image. */
export function clipboardImages(data: ImagePasteEvent["clipboardData"]): File[] {
  if (!data) return [];
  const images = Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  return [...new Set(images.length ? images : Array.from(data.files ?? []))].filter((file) =>
    file.type.startsWith("image/"),
  );
}

export function consumeImagePaste(event: ImagePasteEvent, add: (files: File[]) => void) {
  const files = clipboardImages(event.clipboardData);
  if (!files.length) return false;
  event.preventDefault();
  add(files);
  return true;
}

type UploadOptions = {
  upload: (file: File) => Promise<string>;
  getCount: () => number;
  getMax: () => number;
  onUploaded: (url: string, file: File) => void;
  onError: (error: unknown) => void;
  onBusyChange: (busy: boolean) => void;
};

/** Reserve slots immediately so rapid pastes cannot overwrite or exceed attachments. */
export class ImageUploadQueue {
  private files: File[] = [];
  private pending = 0;
  private disposed = false;
  private options: UploadOptions;

  constructor(options: UploadOptions) {
    this.options = options;
  }

  get busy() {
    return this.pending > 0;
  }

  add(files: File[]) {
    if (this.disposed) return 0;
    const images = files.filter((file) => file.type.startsWith("image/"));
    const room = Math.max(0, this.options.getMax() - this.options.getCount() - this.pending);
    const accepted = images.slice(0, room);
    const wasBusy = this.busy;
    this.files.push(...accepted);
    this.pending += accepted.length;
    if (!wasBusy && this.busy) {
      this.options.onBusyChange(true);
      void this.drain();
    }
    return accepted.length;
  }

  dispose() {
    this.disposed = true;
    this.files = [];
    this.pending = 0;
    this.options.onBusyChange(false);
  }

  private async drain() {
    while (this.files.length && !this.disposed) {
      const file = this.files.shift()!;
      try {
        const url = await this.options.upload(file);
        if (!this.disposed) this.options.onUploaded(url, file);
      } catch (error) {
        if (!this.disposed) this.options.onError(error);
      } finally {
        if (!this.disposed) this.pending--;
      }
    }
    if (!this.disposed) this.options.onBusyChange(false);
  }
}
