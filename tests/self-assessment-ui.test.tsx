import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SelfAssessmentPanel } from "../src/components/self-assessment";
import { kyivToday } from "../src/lib/school/ids";
const delay = () => new Promise((r) => setTimeout(r, 20));
test("Student sees only eligible lesson marks, disabled permission hides submission, teacher filters pending reviews", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const scope = ["school", "student"];
  client.setQueryData(["me"], {
    profile: { role: "student", userId: "student", schoolId: "school", rosterId: "roster" },
  });
  client.setQueryData(["grading-settings", ...scope], { allowSelfAssessment: true });
  client.setQueryData(
    ["self-assessments", ...scope],
    [
      {
        id: "pending",
        lessonId: "lesson",
        lessonDate: kyivToday(),
        lessonTitle: "Algebra",
        rosterId: "roster",
        value: "10",
        status: "pending",
      },
      { id: "reviewed", lessonId: "reviewed", status: "reviewed", lessonDate: kyivToday() },
    ],
  );
  client.setQueryData(["lessons"], {
    lessons: ["lesson", "reviewed", "official", "future"].map((id) => ({
      id,
      lessonDate: id === "future" ? "2099-01-01" : kyivToday(),
      title: id,
      subjectName: "Math",
    })),
  });
  client.setQueryData(["grades", "self-assessment"], {
    grades: [{ lessonId: "official", kind: "lesson" }],
  });
  client.setQueryData(["students"], [{ id: "roster", name: "Student name" }]);
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SelfAssessmentPanel uk />
        </QueryClientProvider>,
      );
      await delay();
    });
    const lesson = document.querySelector(
      'select[aria-label="Урок для самооцінювання"]',
    ) as HTMLSelectElement;
    assert.deepEqual(
      [...lesson.options].map((o) => o.value),
      ["", "lesson"],
    );
    const mark = document.querySelector('select[aria-label="Власна оцінка"]') as HTMLSelectElement;
    assert.deepEqual(
      [...mark.options].map((o) => o.value),
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    );
    assert.match(document.body.textContent!, /Очікує перевірки/);
    assert.ok(!document.body.textContent!.includes("Підтвердити"));
    await act(async () => {
      client.setQueryData(["grading-settings", ...scope], { allowSelfAssessment: false });
      await delay();
    });
    assert.equal(document.querySelector('select[aria-label="Урок для самооцінювання"]'), null);
    await act(async () => {
      client.setQueryData(["me"], {
        profile: { role: "teacher", userId: "student", schoolId: "school" },
      });
      await delay();
    });
    assert.match(document.body.textContent!, /Student name/);
    assert.equal(
      document.querySelectorAll('select[aria-label="Оцінка після перевірки"]').length,
      1,
    );
    const from = document.querySelector('input[aria-label="Від дати"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(
        from,
        "2099-01-01",
      );
      from.dispatchEvent(new window.Event("input", { bubbles: true }));
      await delay();
    });
    assert.equal(
      document.querySelectorAll('select[aria-label="Оцінка після перевірки"]').length,
      0,
    );
    assert.match(document.body.textContent!, /Немає оцінок/);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
