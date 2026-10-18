import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SchoolSettingsEditor } from "../src/components/school-settings-editor";
import { HomeFeed } from "../src/components/home-feed";
import { ContentInteractions } from "../src/components/content-interactions";
import { DEFAULT_SETTINGS } from "../src/lib/school/settings";
const delay = () => new Promise((resolve) => setTimeout(resolve, 20));
test("Teacher can preview presets and custom roles; feed and article interactions follow live settings", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const key = ["school-settings", "school", "teacher"];
  const settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    feedMode: "proposals" as const,
    feedLikes: true,
    feedComments: true,
  };
  client.setQueryData(["me"], {
    profile: { role: "teacher", userId: "teacher", schoolId: "school" },
  });
  client.setQueryData(key, { settings, revision: 4 });
  client.setQueryData(
    ["school-posts", "school", "proposals"],
    [
      {
        id: "idea",
        title: "Student idea",
        body: "A school garden",
        authorName: "Student",
        authorId: "student",
        createdAt: Date.now(),
      },
    ],
  );
  for (const target of ["post", "article"])
    client.setQueryData(
      [
        "content-interactions",
        "school",
        "teacher",
        target,
        target === "post" ? "idea" : "article",
        true,
        target === "post",
      ],
      {
        count: 2,
        liked: true,
        comments: [
          { id: "c", authorName: "Student", body: "I support this idea", authorId: "student" },
        ],
      },
    );
  const root = createRoot(document.getElementById("root")!);
  const click = async (element: Element) =>
    act(async () => {
      (element as HTMLElement).click();
      await delay();
    });
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SchoolSettingsEditor uk />
        </QueryClientProvider>,
      );
      await delay();
    });
    const presetButtons = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent === "Обрати пресет",
    );
    await click(presetButtons[1]);
    const label = [...document.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Самооцінювання за урок"),
    )!;
    assert.equal(label.querySelector<HTMLInputElement>("input")!.checked, true);
    assert.match(document.body.textContent!, /Автономне навчання · незбережені зміни/);
    const points = [...document.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Бали та додаткова мотивація"),
    )!;
    assert.equal(points.querySelector<HTMLInputElement>("input")!.checked, false);
    await click(
      [...document.querySelectorAll("button")].find((b) => b.textContent === "Додати посаду")!,
    );
    assert.match(document.body.textContent!, /Власні налаштування/);
    assert.equal(
      client.getQueryData<any>(key).revision,
      4,
      "draft edits never write saved settings",
    );
    await click(
      [...document.querySelectorAll("button")].find((b) => b.textContent === "Скасувати зміни")!,
    );
    assert.ok(!document.body.textContent!.includes("незбережені зміни"));
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <HomeFeed uk />
          <ContentInteractions target="article" id="article" uk />
        </QueryClientProvider>,
      );
      await delay();
    });
    assert.match(document.body.textContent!, /Student idea/);
    assert.equal(document.querySelectorAll('button[aria-label="Подобається"]').length, 2);
    await click(
      [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Коментарі"))!,
    );
    assert.match(document.body.textContent!, /I support this idea/);
    await act(async () => {
      client.setQueryData(key, {
        settings: { ...settings, feedMode: "off", articleLikes: false },
        revision: 5,
      });
      await delay();
    });
    assert.equal(document.querySelector("aside"), null);
    assert.equal(document.querySelectorAll('button[aria-label="Подобається"]').length, 0);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
