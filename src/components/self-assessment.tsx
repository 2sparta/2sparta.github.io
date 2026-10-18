import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getGradingSettings,
  listLessons,
  listGrades,
  listSelfAssessments,
  listStudents,
  setSelfAssessment,
  reviewSelfAssessment,
} from "@/lib/school/server";
import { kyivToday } from "@/lib/school/ids";
import { useMeQuery } from "./session-gate";
import { Panel, PanelTitle, Hint, Select, TextInput, PillButton } from "./ui/panel";
import type { SelfAssessment } from "@/lib/school/self-assessment";

export function SelfAssessmentPanel({ uk }: { uk: boolean }) {
  const p = useMeQuery().data?.profile;
  const teacher = p?.role === "teacher";
  const student = p?.role === "student";
  const qc = useQueryClient();
  const scope = [p?.schoolId, p?.userId];
  const settings = useQuery({
    queryKey: ["grading-settings", ...scope],
    queryFn: getGradingSettings,
    enabled: teacher || student,
  });
  const assessments = useQuery({
    queryKey: ["self-assessments", ...scope],
    queryFn: listSelfAssessments,
    enabled: teacher || student,
    refetchInterval: 30_000,
  });
  const lessons = useQuery({ queryKey: ["lessons"], queryFn: listLessons, enabled: student });
  const grades = useQuery({
    queryKey: ["grades", "self-assessment"],
    queryFn: () => listGrades(),
    enabled: student,
  });
  const students = useQuery({ queryKey: ["students"], queryFn: listStudents, enabled: teacher });
  const [lessonId, setLessonId] = useState("");
  const [value, setValue] = useState("10");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(kyivToday());
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["self-assessments"] });
    void qc.invalidateQueries({ queryKey: ["grades"] });
    void qc.invalidateQueries({ queryKey: ["gradebook"] });
  };
  const error = (e: Error) =>
    toast.error(
      e.message === "GRADE_LOCKED"
        ? uk
          ? "Оцінку вже перевірено або виставлено вчителем."
          : "A teacher has already graded or reviewed this lesson."
        : uk
          ? "Не вдалося зберегти. Оновіть сторінку та перевірте дозвіл і підключення."
          : "Could not save. Refresh and check permission and connection.",
    );
  const submit = useMutation({
    mutationFn: () => setSelfAssessment({ data: { lessonId, value } }),
    onSuccess: () => {
      refresh();
      toast.success(uk ? "Надіслано на перевірку" : "Submitted for review");
    },
    onError: error,
  });
  const review = useMutation({
    mutationFn: (data: { id: string; value: string }) => reviewSelfAssessment({ data }),
    onSuccess: refresh,
    onError: error,
  });
  if (!teacher && !student) return null;
  const available = (lessons.data?.lessons ?? []).filter(
    (l) =>
      (!l.workType || l.workType === "lesson") && l.lessonDate <= kyivToday() &&
      !(grades.data?.grades ?? []).some((g) => g.kind === "lesson" && g.lessonId === l.id) &&
      !(assessments.data ?? []).some((a) => a.lessonId === l.id && a.status === "reviewed"),
  );
  const pending = (assessments.data ?? []).filter(
    (a) => a.status === "pending" && (!from || a.lessonDate >= from) && (!to || a.lessonDate <= to),
  );
  return (
    <Panel>
      <PanelTitle>{uk ? "Самооцінювання за урок" : "Lesson self-assessment"}</PanelTitle>
      <Hint>
        {teacher
          ? uk
            ? "Перевірте оцінки за потрібний тиждень. Підтвердьте оцінку або виправте число перед підтвердженням."
            : "Review a week's submissions. Confirm the mark or correct it before confirming."
          : uk
            ? "Тільки власні оцінки 1–12 за опубліковані уроки. До перевірки можна змінювати; вони не входять у середній бал."
            : "Your own marks (1–12) for published lessons. Editable until reviewed; pending marks do not affect averages."}
      </Hint>
      {student && settings.data?.allowSelfAssessment && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Select
            aria-label={uk ? "Урок для самооцінювання" : "Lesson to assess"}
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="max-w-full"
          >
            <option value="">{uk ? "Оберіть урок" : "Choose a lesson"}</option>
            {available.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lessonDate} · {l.subjectName} · {l.title}
              </option>
            ))}
          </Select>
          <Select
            aria-label={uk ? "Власна оцінка" : "Your mark"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </Select>
          <PillButton
            disabled={!lessonId || !available.some((l) => l.id === lessonId) || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {uk ? "Надіслати / змінити" : "Submit / update"}
          </PillButton>
        </div>
      )}
      {student && !settings.isPending && !settings.data?.allowSelfAssessment && (
        <p className="mb-3 text-sm text-muted">
          {uk
            ? "Учитель ще не дозволив самооцінювання в налаштуваннях."
            : "Self-assessment is disabled in school settings."}
        </p>
      )}
      {teacher && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <PillButton
            tone="ghost"
            onClick={() => {
              const monday = new Date(`${kyivToday()}T12:00:00Z`);
              monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
              setFrom(monday.toISOString().slice(0, 10));
              setTo(kyivToday());
            }}
          >
            {uk ? "Цей тиждень" : "This week"}
          </PillButton>
          <PillButton
            tone="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            {uk ? "Усі неперевірені" : "All pending"}
          </PillButton>
          <label>
            {uk ? "Від " : "From "}
            <TextInput
              aria-label={uk ? "Від дати" : "From date"}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {uk ? "До " : "To "}
            <TextInput
              aria-label={uk ? "До дати" : "To date"}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {(assessments.isError || settings.isError) && (
        <p role="alert">
          {uk ? "Не вдалося завантажити самооцінки." : "Could not load self-assessments."}
        </p>
      )}
      {assessments.isPending ? (
        <p>{uk ? "Завантаження…" : "Loading…"}</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted">
          {uk ? "Немає оцінок, що очікують перевірки." : "No marks awaiting review."}
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm"
            >
              <div>
                <strong>
                  {teacher
                    ? students.data?.find((s) => s.id === a.rosterId)?.name || a.rosterId
                    : uk
                      ? "Ваша оцінка"
                      : "Your mark"}{" "}
                  · {a.value}
                </strong>
                <p>
                  {a.lessonDate} · {a.lessonTitle}
                </p>
                <span className="text-xs text-muted">
                  {uk ? "Очікує перевірки" : "Awaiting review"}
                </span>
              </div>
              {teacher && (
                <ReviewMark
                  key={`${a.id}-${a.submittedAt}`}
                  assessment={a}
                  uk={uk}
                  disabled={review.isPending}
                  onReview={(value) => review.mutate({ id: a.id, value })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
function ReviewMark({
  assessment,
  uk,
  disabled,
  onReview,
}: {
  assessment: SelfAssessment;
  uk: boolean;
  disabled: boolean;
  onReview: (value: string) => void;
}) {
  const [value, setValue] = useState(assessment.value);
  return (
    <div className="flex gap-2">
      <Select
        aria-label={uk ? "Оцінка після перевірки" : "Reviewed mark"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1}>{i + 1}</option>
        ))}
      </Select>
      <PillButton disabled={disabled} onClick={() => onReview(value)}>
        {uk ? "Підтвердити" : "Confirm"}
      </PillButton>
    </div>
  );
}
