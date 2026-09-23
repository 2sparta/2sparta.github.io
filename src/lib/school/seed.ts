import type { Sql } from "@/lib/db";
import {
  DEFAULT_BELLS,
  kyivToday,
  newId,
  studentInviteCode,
  WEEKDAYS,
} from "./ids";

const SUBJECTS = [
  { name: "Українська мова", room: "12" },
  { name: "Математика", room: "21" },
  { name: "Англійська мова", room: "8" },
  { name: "Історія України", room: "15" },
  { name: "Біологія", room: "4" },
];

const STUDENTS: { name: string; points: number }[] = [
  { name: "Максим Коваленко", points: 245 },
  { name: "Оля Шевченко", points: 198 },
  { name: "Андрій Мельник", points: 176 },
  { name: "Софія Бондар", points: 154 },
  { name: "Данило Ткаченко", points: 132 },
  { name: "Марія Іваненко", points: 121 },
];

export async function seedNewSchool(
  sql: Sql,
  schoolId: string,
  adminUserId: string,
  adminName: string,
) {
  const classId = newId();
  const groupId = newId();
  await sql`insert into classes (id, school_id, name) values (${classId}, ${schoolId}, ${"8-А"})`;
  await sql`insert into class_groups (id, class_id, name) values (${groupId}, ${classId}, ${"1 група"})`;

  const subjectIds: string[] = [];
  for (const s of SUBJECTS) {
    const id = newId();
    subjectIds.push(id);
    await sql`insert into subjects (id, school_id, name, room) values (${id}, ${schoolId}, ${s.name}, ${s.room})`;
    await sql`insert into teacher_subjects (user_id, subject_id) values (${adminUserId}, ${id})`;
  }

  const usedCodes = new Set<string>();
  const rosterIds: string[] = [];
  for (const st of STUDENTS) {
    let code = studentInviteCode();
    while (usedCodes.has(code)) code = studentInviteCode();
    usedCodes.add(code);
    const id = newId();
    rosterIds.push(id);
    await sql`insert into roster_students (id, school_id, class_id, group_id, name, points, invite_code, is_starosta)
      values (${id}, ${schoolId}, ${classId}, ${groupId}, ${st.name}, ${st.points}, ${code}, ${st.name.startsWith("Максим")})`;
  }

  const bells = DEFAULT_BELLS.slice(0, 5);
  const workdays = WEEKDAYS.slice(0, 5);
  for (let d = 0; d < workdays.length; d++) {
    const day = workdays[d];
    for (let p = 0; p < bells.length; p++) {
      const subjectId = subjectIds[(p + d) % subjectIds.length];
      await sql`insert into schedule_entries
        (id, school_id, class_id, group_id, weekday, period, start_time, end_time, subject_id)
        values (${newId()}, ${schoolId}, ${classId}, ${groupId}, ${day}, ${p + 1}, ${bells[p].start}, ${bells[p].end}, ${subjectId})`;
    }
  }

  const today = kyivToday();
  const tomorrow = shiftDate(today, 1);
  const lessonSpecs = [
    {
      subject: subjectIds[0],
      title: "Складні речення",
      content: "Опрацювати §14. Вправи 1–4 письмово.",
      date: today,
      hw: tomorrow,
    },
    {
      subject: subjectIds[1],
      title: "Квадратні рівняння",
      content: "Формула коренів. Розв'язати завдання 12–18.",
      date: today,
      hw: tomorrow,
    },
    {
      subject: subjectIds[2],
      title: "Present Perfect",
      content: "Read the text on page 46 and answer the questions.",
      date: today,
      hw: null as string | null,
    },
  ];
  const lessonIds: string[] = [];
  for (const spec of lessonSpecs) {
    const id = newId();
    lessonIds.push(id);
    await sql`insert into lessons
      (id, school_id, subject_id, teacher_id, title, content, lesson_date, has_homework, homework_due)
      values (${id}, ${schoolId}, ${spec.subject}, ${adminUserId}, ${spec.title}, ${spec.content}, ${spec.date}, ${Boolean(spec.hw)}, ${spec.hw})`;
    await sql`insert into lesson_classes (lesson_id, class_id) values (${id}, ${classId})`;
  }

  const sampleGrades: { roster: number; subject: number; value: string }[] = [
    { roster: 0, subject: 0, value: "11" },
    { roster: 0, subject: 1, value: "10" },
    { roster: 0, subject: 2, value: "12" },
    { roster: 0, subject: 3, value: "9" },
    { roster: 0, subject: 4, value: "11" },
    { roster: 1, subject: 0, value: "10" },
    { roster: 1, subject: 1, value: "11" },
    { roster: 2, subject: 1, value: "9" },
    { roster: 2, subject: 2, value: "8" },
  ];
  for (const g of sampleGrades) {
    await sql`insert into grades (id, school_id, roster_id, subject_id, lesson_id, kind, value)
      values (${newId()}, ${schoolId}, ${rosterIds[g.roster]}, ${subjectIds[g.subject]}, ${lessonIds[0]}, ${"lesson"}, ${g.value})`;
  }

  const annId = newId();
  await sql`insert into announcements (id, school_id, author_id, title, body)
    values (${annId}, ${schoolId}, ${adminUserId}, ${"Вітаємо у Класному просторі"},
      ${"Школу створено. Додайте вчителів за кодом на вкладці «Вчителі» та роздайте учням їхні коди-запрошення."})`;

  const chatId = newId();
  await sql`insert into chats (id, school_id, kind, name) values (${chatId}, ${schoolId}, ${"school"}, ${"Вся школа"})`;
  await sql`insert into chat_members (chat_id, user_id) values (${chatId}, ${adminUserId})`;
  await sql`insert into chat_messages (id, chat_id, author_id, body)
    values (${newId()}, ${chatId}, ${adminUserId}, ${adminName ? `Вітаю! Я ${adminName}. Пишіть сюди загальні новини школи.` : "Вітаю в шкільному чаті!"})`;

  const classChat = newId();
  await sql`insert into chats (id, school_id, kind, name, class_id)
    values (${classChat}, ${schoolId}, ${"class"}, ${"8-А"}, ${classId})`;
  await sql`insert into chat_members (chat_id, user_id) values (${classChat}, ${adminUserId})`;
  await sql`insert into chat_messages (id, chat_id, author_id, body)
    values (${newId()}, ${classChat}, ${adminUserId}, ${"Нагадування: завтра контрольна з математики. Повторіть §12."})`;

  const teacherChat = newId();
  await sql`insert into chats (id, school_id, kind, name) values (${teacherChat}, ${schoolId}, ${"teachers"}, ${"Учительський чат"})`;
  await sql`insert into chat_members (chat_id, user_id) values (${teacherChat}, ${adminUserId})`;
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
