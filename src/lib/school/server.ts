import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { DEFAULT_BELLS, kyivToday, kyivWeekday, newId, studentInviteCode, teacherInviteCode } from "./ids";
import { seedNewSchool } from "./seed";
import type {
  Announcement,
  ChatMessage,
  ChatSummary,
  Election,
  Grade,
  Lesson,
  Profile,
  RosterStudent,
  ScheduleEntry,
  SchoolClass,
  Subject,
} from "./types";

type Row = Record<string, unknown>;

function str(v: unknown, fallback = "") {
  if (v == null) return fallback;
  return String(v);
}
function bool(v: unknown) {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}
function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function iso(v: unknown) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s;
}

async function authUser(sql: Sql, userId: string) {
  const rows = await sql<Row>`select "id", "name", "email", "image" from "user" where "id" = ${userId}`;
  return rows[0] ?? null;
}

async function loadProfile(sql: Sql, userId: string): Promise<Profile> {
  const u = await authUser(sql, userId);
  const rows = await sql<Row>`
    select p.*, s.name as school_name, c.name as class_name, r.points as roster_points, r.linked_user_id
    from profiles p
    left join schools s on s.id = p.school_id
    left join classes c on c.id = p.class_id
    left join roster_students r on r.id = p.roster_id
    where p.user_id = ${userId}
  `;
  const p = rows[0];
  if (!p) {
    return {
      userId,
      role: null,
      displayName: str(u?.name),
      schoolId: null,
      classId: null,
      groupId: null,
      rosterId: null,
      isAdmin: false,
      setupComplete: false,
      email: str(u?.email, "") || null,
      schoolName: null,
      className: null,
      points: 0,
      linked: false,
    };
  }
  return {
    userId,
    role: str(p.role) as Profile["role"],
    displayName: str(p.display_name) || str(u?.name),
    schoolId: p.school_id ? str(p.school_id) : null,
    classId: p.class_id ? str(p.class_id) : null,
    groupId: p.group_id ? str(p.group_id) : null,
    rosterId: p.roster_id ? str(p.roster_id) : null,
    isAdmin: bool(p.is_admin),
    setupComplete: bool(p.setup_complete),
    email: str(u?.email, "") || null,
    schoolName: p.school_name ? str(p.school_name) : null,
    className: p.class_name ? str(p.class_name) : null,
    points: num(p.roster_points),
    linked: Boolean(p.roster_id),
  };
}

function nextStep(p: Profile): "role" | "school" | "setup" | "link" | "app" {
  if (!p.role) return "role";
  if (p.role === "teacher") {
    if (!p.schoolId) return "school";
    if (!p.setupComplete) return "setup";
    return "app";
  }
  if (!p.linked) return "link";
  return "app";
}

async function requireTeacher(sql: Sql, userId: string) {
  const p = await loadProfile(sql, userId);
  if (p.role !== "teacher" || !p.schoolId) throw new Error("Teacher access required");
  return p;
}

async function requireMember(sql: Sql, userId: string) {
  const p = await loadProfile(sql, userId);
  if (!p.schoolId) throw new Error("Join a school first");
  return p;
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await loadProfile(sql, context.userId);
    return { profile, nextStep: nextStep(profile) };
  });

export const chooseRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { role: "teacher" | "student"; displayName?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<Row>`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) return loadProfile(sql, context.userId);
    const u = await authUser(sql, context.userId);
    const name = (data.displayName ?? str(u?.name) ?? "").trim();
    await sql`insert into profiles (user_id, role, display_name, setup_complete)
      values (${context.userId}, ${data.role}, ${name}, ${false})`;
    return loadProfile(sql, context.userId);
  });

export const createSchool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; displayName?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("School name required");
    const u = await authUser(sql, context.userId);
    const display = (data.displayName ?? "").trim() || str(u?.name) || name;
    const schoolId = newId();
    await sql`insert into schools (id, name, admin_user_id) values (${schoolId}, ${name}, ${context.userId})`;
    const existing = await sql<Row>`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`update profiles set role = ${"teacher"}, display_name = ${display}, school_id = ${schoolId},
        is_admin = ${true}, setup_complete = ${true} where user_id = ${context.userId}`;
    } else {
      await sql`insert into profiles (user_id, role, display_name, school_id, is_admin, setup_complete)
        values (${context.userId}, ${"teacher"}, ${display}, ${schoolId}, ${true}, ${true})`;
    }
    await seedNewSchool(sql, schoolId, context.userId, display);
    return loadProfile(sql, context.userId);
  });

export const joinSchool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string; displayName?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const code = data.code.replace(/\s+/g, "").toUpperCase();
    const inv = await sql<Row>`select * from teacher_invites where code = ${code}`;
    if (!inv[0]) throw new Error("CODE_NOT_FOUND");
    if (inv[0].used_by) throw new Error("CODE_USED");
    const schoolId = str(inv[0].school_id);
    const u = await authUser(sql, context.userId);
    const display = (data.displayName ?? "").trim() || str(u?.name);
    await sql`update teacher_invites set used_by = ${context.userId} where code = ${code}`;
    const existing = await sql<Row>`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`update profiles set role = ${"teacher"}, display_name = ${display}, school_id = ${schoolId},
        is_admin = ${false}, setup_complete = ${false} where user_id = ${context.userId}`;
    } else {
      await sql`insert into profiles (user_id, role, display_name, school_id, is_admin, setup_complete)
        values (${context.userId}, ${"teacher"}, ${display}, ${schoolId}, ${false}, ${false})`;
    }
    const chats = await sql<Row>`select id from chats where school_id = ${schoolId} and kind in ('school','teachers')`;
    for (const c of chats) {
      await sql`insert into chat_members (chat_id, user_id) values (${str(c.id)}, ${context.userId})
        on conflict (chat_id, user_id) do nothing`;
    }
    return loadProfile(sql, context.userId);
  });

export const completeSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { displayName: string; isAdmin: boolean; subjectIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const name = data.displayName.trim();
    if (!name) throw new Error("NAME");
    const admin = p.isAdmin ? data.isAdmin : false;
    if (!admin && data.subjectIds.length === 0) throw new Error("SUBJECTS");
    await sql`update profiles set display_name = ${name}, is_admin = ${admin}, setup_complete = ${true}
      where user_id = ${context.userId}`;
    await sql`delete from teacher_subjects where user_id = ${context.userId}`;
    for (const sid of data.subjectIds) {
      await sql`insert into teacher_subjects (user_id, subject_id) values (${context.userId}, ${sid})
        on conflict (user_id, subject_id) do nothing`;
    }
    return loadProfile(sql, context.userId);
  });

export const linkStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const code = data.code.replace(/\s+/g, "");
    const rows = await sql<Row>`select * from roster_students where invite_code = ${code}`;
    const r = rows[0];
    if (!r) throw new Error("CODE_NOT_FOUND");
    if (r.linked_user_id && str(r.linked_user_id) !== context.userId) throw new Error("CODE_USED");
    const u = await authUser(sql, context.userId);
    const display = str(r.name) || str(u?.name);
    await sql`update roster_students set linked_user_id = ${context.userId} where id = ${str(r.id)}`;
    const existing = await sql<Row>`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`update profiles set role = ${"student"}, display_name = ${display}, school_id = ${str(r.school_id)},
        class_id = ${str(r.class_id)}, group_id = ${r.group_id ? str(r.group_id) : null},
        roster_id = ${str(r.id)}, setup_complete = ${true} where user_id = ${context.userId}`;
    } else {
      await sql`insert into profiles (user_id, role, display_name, school_id, class_id, group_id, roster_id, setup_complete)
        values (${context.userId}, ${"student"}, ${display}, ${str(r.school_id)}, ${str(r.class_id)},
          ${r.group_id ? str(r.group_id) : null}, ${str(r.id)}, ${true})`;
    }
    const chats = await sql<Row>`
      select id from chats
      where school_id = ${str(r.school_id)}
        and (kind = ${"school"} or class_id = ${str(r.class_id)})
    `;
    for (const c of chats) {
      await sql`insert into chat_members (chat_id, user_id) values (${str(c.id)}, ${context.userId})
        on conflict (chat_id, user_id) do nothing`;
    }
    return loadProfile(sql, context.userId);
  });

export const enterDemoAsStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existingProfile = await loadProfile(sql, context.userId);
    if (existingProfile.linked && existingProfile.role === "student") return existingProfile;

    const u = await authUser(sql, context.userId);
    const schoolId = newId();
    await sql`insert into schools (id, name, admin_user_id)
      values (${schoolId}, ${"Ліцей №1"}, ${context.userId})`;
    await seedNewSchool(sql, schoolId, context.userId, str(u?.name) || "Класний керівник");

    const max = await sql<Row>`
      select * from roster_students
      where school_id = ${schoolId} and name like ${"Максим%"}
      limit 1
    `;
    const r = max[0];
    if (!r) throw new Error("Demo seed failed");

    await sql`update roster_students set linked_user_id = ${context.userId} where id = ${str(r.id)}`;
    const display = str(r.name);
    const existing = await sql<Row>`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`update profiles set role = ${"student"}, display_name = ${display}, school_id = ${schoolId},
        class_id = ${str(r.class_id)}, group_id = ${r.group_id ? str(r.group_id) : null},
        roster_id = ${str(r.id)}, is_admin = ${false}, setup_complete = ${true}
        where user_id = ${context.userId}`;
    } else {
      await sql`insert into profiles
        (user_id, role, display_name, school_id, class_id, group_id, roster_id, is_admin, setup_complete)
        values (${context.userId}, ${"student"}, ${display}, ${schoolId}, ${str(r.class_id)},
          ${r.group_id ? str(r.group_id) : null}, ${str(r.id)}, ${false}, ${true})`;
    }
    const chats = await sql<Row>`
      select id from chats
      where school_id = ${schoolId} and (kind = ${"school"} or class_id = ${str(r.class_id)})
    `;
    for (const c of chats) {
      await sql`insert into chat_members (chat_id, user_id) values (${str(c.id)}, ${context.userId})
        on conflict (chat_id, user_id) do nothing`;
    }
    const teacherChats = await sql<Row>`
      select id from chats where school_id = ${schoolId} and kind = ${"teachers"}
    `;
    for (const c of teacherChats) {
      await sql`delete from chat_members where chat_id = ${str(c.id)} and user_id = ${context.userId}`;
    }
    return loadProfile(sql, context.userId);
  });

export const getHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await loadProfile(sql, context.userId);
    if (!profile.schoolId) return { profile, nextStep: nextStep(profile), stats: null, today: [], quote: true };
    const schoolId = profile.schoolId;
    const day = kyivWeekday();
    const today = kyivToday();

    const [students, subjects, linked, schedule] = await Promise.all([
      sql<Row>`select count(*)::int as n from roster_students where school_id = ${schoolId}`,
      sql<Row>`select count(*)::int as n from subjects where school_id = ${schoolId}`,
      sql<Row>`select count(*)::int as n from roster_students where school_id = ${schoolId} and linked_user_id is not null`,
      profile.classId
        ? sql<Row>`select se.*, s.name as subject_name, s.room
            from schedule_entries se left join subjects s on s.id = se.subject_id
            where se.class_id = ${profile.classId} and se.weekday = ${day}
            order by se.period`
        : sql<Row>`select se.*, s.name as subject_name, s.room
            from schedule_entries se left join subjects s on s.id = se.subject_id
            where se.school_id = ${schoolId} and se.weekday = ${day}
            order by se.period`,
    ]);

    const todayEntries = schedule.map(mapSchedule);
    const lessonsToday = todayEntries.filter((e) => e.subjectId).length;

    return {
      profile,
      nextStep: nextStep(profile),
      stats: {
        students: num(students[0]?.n),
        subjects: num(subjects[0]?.n),
        lessonsToday,
        linked: num(linked[0]?.n),
        linkedTotal: num(students[0]?.n),
        points: profile.points,
        todayDate: today,
        weekday: day,
      },
      today: todayEntries,
    };
  });

function mapSchedule(r: Row): ScheduleEntry {
  return {
    id: str(r.id),
    classId: str(r.class_id),
    weekday: str(r.weekday),
    period: num(r.period),
    startTime: str(r.start_time),
    endTime: str(r.end_time),
    subjectId: r.subject_id ? str(r.subject_id) : null,
    subjectName: r.subject_name ? str(r.subject_name) : null,
    room: str(r.room),
  };
}

export const listClasses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const classes = await sql<Row>`select * from classes where school_id = ${p.schoolId} order by name`;
    const groups = await sql<Row>`select g.* from class_groups g
      join classes c on c.id = g.class_id where c.school_id = ${p.schoolId}`;
    return classes.map((c) => ({
      id: str(c.id),
      name: str(c.name),
      groups: groups
        .filter((g) => str(g.class_id) === str(c.id))
        .map((g) => ({ id: str(g.id), name: str(g.name) })),
    })) satisfies SchoolClass[];
  });

export const addClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const classId = newId();
    const groupId = newId();
    await sql`insert into classes (id, school_id, name) values (${classId}, ${p.schoolId}, ${name})`;
    await sql`insert into class_groups (id, class_id, name) values (${groupId}, ${classId}, ${"1 група"})`;
    const bells = DEFAULT_BELLS.slice(0, 5);
    for (const day of ["mon", "tue", "wed", "thu", "fri"]) {
      for (let i = 0; i < bells.length; i++) {
        await sql`insert into schedule_entries
          (id, school_id, class_id, group_id, weekday, period, start_time, end_time)
          values (${newId()}, ${p.schoolId}, ${classId}, ${groupId}, ${day}, ${i + 1}, ${bells[i].start}, ${bells[i].end})`;
      }
    }
    return { id: classId };
  });

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rows = await sql<Row>`select * from subjects where school_id = ${p.schoolId} order by name`;
    const mine = await sql<Row>`select subject_id from teacher_subjects where user_id = ${context.userId}`;
    const mineSet = new Set(mine.map((m) => str(m.subject_id)));
    return {
      subjects: rows.map((r) => ({
        id: str(r.id),
        name: str(r.name),
        room: str(r.room),
        meetLink: str(r.meet_link),
        studentsCanAddHw: bool(r.students_can_add_hw),
      })) satisfies Subject[],
      mine: [...mineSet],
    };
  });

export const addSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; room?: string; meetLink?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const id = newId();
    await sql`insert into subjects (id, school_id, name, room, meet_link)
      values (${id}, ${p.schoolId}, ${name}, ${(data.room ?? "").trim()}, ${(data.meetLink ?? "").trim()})`;
    await sql`insert into teacher_subjects (user_id, subject_id) values (${context.userId}, ${id}) on conflict (user_id, subject_id) do nothing`;
    return { id };
  });

export const listStudents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const rows = await sql<Row>`
      select r.*, c.name as class_name, g.name as group_name
      from roster_students r
      join classes c on c.id = r.class_id
      left join class_groups g on g.id = r.group_id
      where r.school_id = ${p.schoolId}
      order by r.points desc, r.name
    `;
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      classId: str(r.class_id),
      className: str(r.class_name),
      groupId: r.group_id ? str(r.group_id) : null,
      groupName: r.group_name ? str(r.group_name) : null,
      points: num(r.points),
      inviteCode: str(r.invite_code),
      linkedUserId: r.linked_user_id ? str(r.linked_user_id) : null,
      isStarosta: bool(r.is_starosta),
    })) satisfies RosterStudent[];
  });

export const addStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; classId: string; groupId?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const id = newId();
    let code = studentInviteCode();
    for (let i = 0; i < 8; i++) {
      const clash = await sql<Row>`select id from roster_students where invite_code = ${code}`;
      if (!clash[0]) break;
      code = studentInviteCode();
    }
    await sql`insert into roster_students (id, school_id, class_id, group_id, name, invite_code)
      values (${id}, ${p.schoolId}, ${data.classId}, ${data.groupId ?? null}, ${name}, ${code})`;
    return { id, inviteCode: code };
  });

export const adjustPoints = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { rosterId: string; delta: number; note?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    await sql`update roster_students set points = points + ${data.delta}
      where id = ${data.rosterId} and school_id = ${p.schoolId}`;
    await sql`insert into points_log (id, roster_id, delta, note, by_user_id)
      values (${newId()}, ${data.rosterId}, ${data.delta}, ${data.note ?? ""}, ${context.userId})`;
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { rosterId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    await sql`delete from roster_students where id = ${data.rosterId} and school_id = ${p.schoolId}`;
    return { ok: true };
  });

export const getSchedule = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { classId?: string } | undefined) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const classId = data?.classId || p.classId;
    if (!classId) {
      const first = await sql<Row>`select id from classes where school_id = ${p.schoolId} order by name limit 1`;
      if (!first[0]) return { classId: null, entries: [] as ScheduleEntry[] };
      const cid = str(first[0].id);
      const rows = await sql<Row>`select se.*, s.name as subject_name, s.room
        from schedule_entries se left join subjects s on s.id = se.subject_id
        where se.class_id = ${cid} order by se.weekday, se.period`;
      return { classId: cid, entries: rows.map(mapSchedule) };
    }
    const rows = await sql<Row>`select se.*, s.name as subject_name, s.room
      from schedule_entries se left join subjects s on s.id = se.subject_id
      where se.class_id = ${classId} and se.school_id = ${p.schoolId}
      order by se.weekday, se.period`;
    return { classId, entries: rows.map(mapSchedule) };
  });

export const setScheduleSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { entryId: string; subjectId: string | null }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    await sql`update schedule_entries set subject_id = ${data.subjectId}
      where id = ${data.entryId} and school_id = ${p.schoolId}`;
    return { ok: true };
  });

export const listLessons = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rows = await sql<Row>`
      select l.*, s.name as subject_name
      from lessons l join subjects s on s.id = l.subject_id
      where l.school_id = ${p.schoolId}
      order by l.lesson_date desc, l.created_at desc
    `;
    const links = await sql<Row>`
      select lc.* from lesson_classes lc
      join lessons l on l.id = lc.lesson_id
      where l.school_id = ${p.schoolId}
    `;
    const byLesson = new Map<string, string[]>();
    for (const l of links) {
      const id = str(l.lesson_id);
      byLesson.set(id, [...(byLesson.get(id) ?? []), str(l.class_id)]);
    }
    let lessons: Lesson[] = rows.map((r) => ({
      id: str(r.id),
      subjectId: str(r.subject_id),
      subjectName: str(r.subject_name),
      teacherId: str(r.teacher_id),
      title: str(r.title),
      content: str(r.content),
      lessonDate: str(r.lesson_date).slice(0, 10),
      hasHomework: bool(r.has_homework),
      homeworkDue: r.homework_due ? str(r.homework_due).slice(0, 10) : null,
      classIds: byLesson.get(str(r.id)) ?? [],
    }));
    if (p.role === "student" && p.classId) {
      lessons = lessons.filter((l) => l.classIds.length === 0 || l.classIds.includes(p.classId!));
    }
    const done = p.rosterId
      ? await sql<Row>`select lesson_id from homework_done where roster_id = ${p.rosterId} and done = true`
      : [];
    return { lessons, doneIds: done.map((d) => str(d.lesson_id)) };
  });

export const addLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      subjectId: string;
      title: string;
      content: string;
      lessonDate: string;
      hasHomework: boolean;
      homeworkDue?: string | null;
      classIds: string[];
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const id = newId();
    const hwDue = data.homeworkDue || null;
    await sql`insert into lessons
      (id, school_id, subject_id, teacher_id, title, content, lesson_date, has_homework, homework_due)
      values (${id}, ${p.schoolId}, ${data.subjectId}, ${context.userId}, ${title}, ${data.content},
        ${data.lessonDate}, ${data.hasHomework || Boolean(hwDue)}, ${hwDue})`;
    for (const cid of data.classIds) {
      await sql`insert into lesson_classes (lesson_id, class_id) values (${id}, ${cid})`;
    }
    return { id };
  });

export const toggleHomeworkDone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { lessonId: string; done: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    if (!p.rosterId) throw new Error("Not linked");
    await sql`insert into homework_done (roster_id, lesson_id, done)
      values (${p.rosterId}, ${data.lessonId}, ${data.done})
      on conflict (roster_id, lesson_id) do update set done = ${data.done}`;
    return { ok: true };
  });

export const listGrades = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { rosterId?: string } | undefined) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rosterId = p.role === "student" ? p.rosterId : data?.rosterId;
    if (!rosterId) return { grades: [] as Grade[] };
    const rows = await sql<Row>`
      select g.*, s.name as subject_name
      from grades g join subjects s on s.id = g.subject_id
      where g.roster_id = ${rosterId} and g.school_id = ${p.schoolId}
      order by g.created_at
    `;
    return {
      grades: rows.map((r) => ({
        id: str(r.id),
        rosterId: str(r.roster_id),
        subjectId: str(r.subject_id),
        subjectName: str(r.subject_name),
        lessonId: r.lesson_id ? str(r.lesson_id) : null,
        kind: str(r.kind) as Grade["kind"],
        value: str(r.value),
        comment: str(r.comment),
        createdAt: iso(r.created_at),
      })),
    };
  });

export const setGrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { rosterId: string; subjectId: string; lessonId?: string | null; kind: "lesson" | "homework"; value: string; comment?: string }) =>
      d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const id = newId();
    await sql`insert into grades (id, school_id, roster_id, subject_id, lesson_id, kind, value, comment)
      values (${id}, ${p.schoolId}, ${data.rosterId}, ${data.subjectId}, ${data.lessonId ?? null},
        ${data.kind}, ${data.value}, ${data.comment ?? ""})`;
    return { id };
  });

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rows = await sql<Row>`
      select a.*, pr.display_name as author_name
      from announcements a
      left join profiles pr on pr.user_id = a.author_id
      where a.school_id = ${p.schoolId}
      order by a.created_at desc
    `;
    const links = await sql<Row>`
      select ac.* from announcement_classes ac
      join announcements a on a.id = ac.announcement_id
      where a.school_id = ${p.schoolId}
    `;
    const by = new Map<string, string[]>();
    for (const l of links) {
      const id = str(l.announcement_id);
      by.set(id, [...(by.get(id) ?? []), str(l.class_id)]);
    }
    let list: Announcement[] = rows.map((r) => ({
      id: str(r.id),
      authorId: str(r.author_id),
      authorName: str(r.author_name) || "—",
      title: str(r.title),
      body: str(r.body),
      createdAt: iso(r.created_at),
      classIds: by.get(str(r.id)) ?? [],
    }));
    if (p.role === "student" && p.classId) {
      list = list.filter((a) => a.classIds.length === 0 || a.classIds.includes(p.classId!));
    }
    return { announcements: list };
  });

export const addAnnouncement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { title: string; body: string; classIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) throw new Error("Required");
    const id = newId();
    await sql`insert into announcements (id, school_id, author_id, title, body)
      values (${id}, ${p.schoolId}, ${context.userId}, ${title}, ${body})`;
    for (const cid of data.classIds) {
      await sql`insert into announcement_classes (announcement_id, class_id) values (${id}, ${cid})`;
    }
    return { id };
  });

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const teachers = await sql<Row>`select * from profiles where school_id = ${p.schoolId} and role = ${"teacher"} order by display_name`;
    const invites = p.isAdmin
      ? await sql<Row>`select * from teacher_invites where school_id = ${p.schoolId} and used_by is null order by created_at desc`
      : [];
    return {
      isAdmin: p.isAdmin,
      teachers: teachers.map((t) => ({
        userId: str(t.user_id),
        displayName: str(t.display_name),
        isAdmin: bool(t.is_admin),
      })),
      invites: invites.map((i) => ({ code: str(i.code), createdAt: iso(i.created_at) })),
    };
  });

export const generateTeacherInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    if (!p.isAdmin) throw new Error("Admin only");
    const code = teacherInviteCode();
    await sql`insert into teacher_invites (code, school_id, created_by)
      values (${code}, ${p.schoolId}, ${context.userId})`;
    return { code };
  });

export const getElection = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { classId?: string } | undefined) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const classId = data?.classId || p.classId;
    if (!classId) return { election: null as Election | null, history: [] as Election[] };
    const rows = await sql<Row>`select * from elections where class_id = ${classId} order by created_at desc`;
    const mapped: Election[] = [];
    for (const e of rows) {
      const cands = await sql<Row>`
        select ec.roster_id, r.name,
          (select count(*)::int from election_votes v where v.election_id = ec.election_id and v.candidate_roster_id = ec.roster_id) as votes
        from election_candidates ec join roster_students r on r.id = ec.roster_id
        where ec.election_id = ${str(e.id)}
      `;
      const myVote = p.rosterId
        ? await sql<Row>`select candidate_roster_id from election_votes where election_id = ${str(e.id)} and voter_roster_id = ${p.rosterId}`
        : [];
      const myCand = p.rosterId
        ? await sql<Row>`select 1 from election_candidates where election_id = ${str(e.id)} and roster_id = ${p.rosterId}`
        : [];
      mapped.push({
        id: str(e.id),
        classId: str(e.class_id),
        startsAt: iso(e.starts_at),
        endsAt: iso(e.ends_at),
        closed: bool(e.closed),
        winnerRosterId: e.winner_roster_id ? str(e.winner_roster_id) : null,
        candidates: cands.map((c) => ({
          rosterId: str(c.roster_id),
          name: str(c.name),
          votes: num(c.votes),
        })),
        myCandidate: Boolean(myCand[0]),
        myVote: myVote[0] ? str(myVote[0].candidate_roster_id) : null,
      });
    }
    const active = mapped.find((e) => !e.closed) ?? null;
    return { election: active, history: mapped.filter((e) => e.closed) };
  });

export const announceElection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { classId: string; startsAt: string; endsAt: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireTeacher(sql, context.userId);
    const open = await sql<Row>`select id from elections where class_id = ${data.classId} and closed = false`;
    if (open[0]) throw new Error("ALREADY");
    const id = newId();
    await sql`insert into elections (id, school_id, class_id, starts_at, ends_at)
      values (${id}, ${p.schoolId}, ${data.classId}, ${data.startsAt}, ${data.endsAt})`;
    return { id };
  });

export const runForElection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { electionId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    if (!p.rosterId) throw new Error("Not linked");
    await sql`insert into election_candidates (election_id, roster_id)
      values (${data.electionId}, ${p.rosterId}) on conflict (election_id, roster_id) do nothing`;
    return { ok: true };
  });

export const voteElection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { electionId: string; candidateId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    if (!p.rosterId) throw new Error("Not linked");
    await sql`insert into election_votes (election_id, voter_roster_id, candidate_roster_id)
      values (${data.electionId}, ${p.rosterId}, ${data.candidateId})
      on conflict (election_id, voter_roster_id) do update set candidate_roster_id = ${data.candidateId}`;
    return { ok: true };
  });

export const closeElection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { electionId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireTeacher(sql, context.userId);
    const votes = await sql<Row>`
      select candidate_roster_id, count(*)::int as n from election_votes
      where election_id = ${data.electionId} group by candidate_roster_id order by n desc limit 1
    `;
    const winner = votes[0] ? str(votes[0].candidate_roster_id) : null;
    await sql`update elections set closed = true, winner_roster_id = ${winner} where id = ${data.electionId}`;
    if (winner) {
      const el = await sql<Row>`select class_id from elections where id = ${data.electionId}`;
      if (el[0]) {
        await sql`update roster_students set is_starosta = false where class_id = ${str(el[0].class_id)}`;
        await sql`update roster_students set is_starosta = true where id = ${winner}`;
      }
    }
    return { winner };
  });

export const listChats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rows = await sql<Row>`
      select c.*,
        (select body from chat_messages m where m.chat_id = c.id order by created_at desc limit 1) as last_body,
        (select created_at from chat_messages m where m.chat_id = c.id order by created_at desc limit 1) as last_at
      from chats c
      join chat_members cm on cm.chat_id = c.id
      where cm.user_id = ${context.userId} and c.school_id = ${p.schoolId}
      order by last_at desc nulls last
    `;
    return {
      chats: rows.map((r) => ({
        id: str(r.id),
        kind: str(r.kind),
        name: str(r.name),
        lastBody: r.last_body ? str(r.last_body) : null,
        lastAt: r.last_at ? iso(r.last_at) : null,
      })) satisfies ChatSummary[],
    };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { chatId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const member = await sql<Row>`select 1 from chat_members where chat_id = ${data.chatId} and user_id = ${context.userId}`;
    if (!member[0]) throw new Error("Forbidden");
    const rows = await sql<Row>`
      select m.*, pr.display_name as author_name
      from chat_messages m
      left join profiles pr on pr.user_id = m.author_id
      where m.chat_id = ${data.chatId}
      order by m.created_at
      limit 200
    `;
    return {
      messages: rows.map((r) => ({
        id: str(r.id),
        authorId: str(r.author_id),
        authorName: str(r.author_name) || "—",
        body: str(r.body),
        createdAt: iso(r.created_at),
      })) satisfies ChatMessage[],
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { chatId: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const member = await sql<Row>`select 1 from chat_members where chat_id = ${data.chatId} and user_id = ${context.userId}`;
    if (!member[0]) throw new Error("Forbidden");
    const body = data.body.trim();
    if (!body) throw new Error("Empty");
    const id = newId();
    await sql`insert into chat_messages (id, chat_id, author_id, body)
      values (${id}, ${data.chatId}, ${context.userId}, ${body})`;
    return { id };
  });

export const startDm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { otherUserId: string; name: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const id = newId();
    await sql`insert into chats (id, school_id, kind, name)
      values (${id}, ${p.schoolId}, ${"dm"}, ${data.name})`;
    await sql`insert into chat_members (chat_id, user_id) values (${id}, ${context.userId})`;
    await sql`insert into chat_members (chat_id, user_id) values (${id}, ${data.otherUserId})`;
    return { id };
  });

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const p = await requireMember(sql, context.userId);
    const rows = await sql<Row>`select user_id, display_name, role from profiles
      where school_id = ${p.schoolId} and user_id <> ${context.userId} order by display_name`;
    return {
      people: rows.map((r) => ({
        userId: str(r.user_id),
        displayName: str(r.display_name),
        role: str(r.role),
      })),
    };
  });

export const listElectives = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Row>`select * from electives where user_id = ${context.userId} order by weekday, start_time`;
    return {
      electives: rows.map((r) => ({
        id: str(r.id),
        name: str(r.name),
        weekday: str(r.weekday),
        startTime: str(r.start_time),
        endTime: str(r.end_time),
      })),
    };
  });

export const addElective = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; weekday: string; startTime: string; endTime: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const id = newId();
    await sql`insert into electives (id, user_id, name, weekday, start_time, end_time)
      values (${id}, ${context.userId}, ${name}, ${data.weekday}, ${data.startTime}, ${data.endTime})`;
    return { id };
  });
