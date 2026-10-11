import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clipboardImages,
  consumeImagePaste,
  ImageUploadQueue,
} from "../src/lib/clipboard-images.ts";

const image = (name: string) => new File(["image"], name, { type: "image/png" });
const transfer = (items: unknown[], files: File[] = []) =>
  ({ items, files }) as unknown as DataTransfer;
const item = (file: File) => ({ kind: "file", type: file.type, getAsFile: () => file });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("clipboard extracts real image items once, ignoring text and other files", () => {
  const photo = image("screenshot.png");
  const text = new File(["text"], "note.txt", { type: "text/plain" });
  assert.deepEqual(clipboardImages(transfer([item(photo), item(text)], [photo])), [photo]);
  assert.deepEqual(clipboardImages(transfer([], [photo, text])), [photo]);
  assert.deepEqual(
    clipboardImages(
      transfer([{ kind: "file", type: "image/png", getAsFile: () => null }], [photo]),
    ),
    [photo],
  );
  assert.deepEqual(clipboardImages(null), []);
});
test("text paste retains native behavior; image paste is intercepted", () => {
  let prevented = false;
  let attached: File[] = [];
  const event = {
    clipboardData: transfer([]),
    preventDefault: () => {
      prevented = true;
    },
  };
  assert.equal(
    consumeImagePaste(event, (files) => {
      attached = files;
    }),
    false,
  );
  assert.equal(prevented, false);
  const photo = image("photo.png");
  event.clipboardData = transfer([item(photo)]);
  assert.equal(
    consumeImagePaste(event, (files) => {
      attached = files;
    }),
    true,
  );
  assert.equal(prevented, true);
  assert.deepEqual(attached, [photo]);
});
test("rapid pastes reserve slots and upload sequentially without replacing attachments", async () => {
  const first = deferred();
  const second = deferred();
  const urls = ["existing"];
  const started: string[] = [];
  const busy: boolean[] = [];
  const queue = new ImageUploadQueue({
    upload: (file) => {
      started.push(file.name);
      return started.length === 1 ? first.promise : second.promise;
    },
    getCount: () => urls.length,
    getMax: () => 3,
    onUploaded: (url) => {
      urls.push(url);
    },
    onError: (error) => {
      throw error;
    },
    onBusyChange: (value) => {
      busy.push(value);
    },
  });
  assert.equal(queue.add([image("a.png")]), 1);
  assert.equal(queue.add([image("b.png"), image("overflow.png")]), 1);
  assert.deepEqual(started, ["a.png"]);
  assert.equal(queue.busy, true);
  first.resolve("a");
  await tick();
  assert.deepEqual(started, ["a.png", "b.png"]);
  assert.equal(queue.add([image("overflow.png")]), 0);
  second.resolve("b");
  await tick();
  assert.deepEqual(urls, ["existing", "a", "b"]);
  assert.deepEqual(busy, [true, false]);
});
test("a failed upload preserves earlier successes and does not cancel later images", async () => {
  const urls: string[] = [];
  const failures: unknown[] = [];
  const queue = new ImageUploadQueue({
    upload: async (file) => {
      if (file.name === "bad.png") throw new Error("offline");
      return file.name;
    },
    getCount: () => urls.length,
    getMax: () => 4,
    onUploaded: (url) => {
      urls.push(url);
    },
    onError: (error) => {
      failures.push(error);
    },
    onBusyChange: () => {},
  });
  queue.add([image("a.png"), image("bad.png"), image("c.png")]);
  await tick();
  assert.deepEqual(urls, ["a.png", "c.png"]);
  assert.equal(failures.length, 1);
  assert.equal(queue.busy, false);
  assert.equal(queue.add([image("retry.png")]), 1);
  await tick();
  assert.deepEqual(urls, ["a.png", "c.png", "retry.png"]);
});
test("removing an attachment during upload does not bring it back", async () => {
  const pending = deferred();
  let urls = ["remove-me"];
  const queue = new ImageUploadQueue({
    upload: () => pending.promise,
    getCount: () => urls.length,
    getMax: () => 4,
    onUploaded: (url) => {
      urls = [...urls, url];
    },
    onError: () => {},
    onBusyChange: () => {},
  });
  queue.add([image("a.png")]);
  urls = [];
  pending.resolve("a");
  await tick();
  assert.deepEqual(urls, ["a"]);
});
test("leaving a composer discards late results and queued uploads", async () => {
  const pending = deferred();
  const uploaded: string[] = [];
  const started: string[] = [];
  const queue = new ImageUploadQueue({
    upload: (file) => {
      started.push(file.name);
      return pending.promise;
    },
    getCount: () => 0,
    getMax: () => 4,
    onUploaded: (url) => {
      uploaded.push(url);
    },
    onError: () => {},
    onBusyChange: () => {},
  });
  queue.add([image("first.png"), image("second.png")]);
  queue.dispose();
  pending.resolve("late");
  await tick();
  assert.deepEqual(uploaded, []);
  assert.deepEqual(started, ["first.png"]);
  assert.equal(queue.busy, false);
  assert.equal(queue.add([image("third.png")]), 0);
});
