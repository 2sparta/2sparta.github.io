-- Класний простір — school LMS schema

create table if not exists schools (
  id text primary key,
  name text not null,
  admin_user_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id text primary key,
  role text not null check (role in ('teacher', 'student')),
  display_name text not null default '',
  school_id text references schools(id) on delete set null,
  class_id text,
  group_id text,
  roster_id text,
  is_admin boolean not null default false,
  setup_complete boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_school_id_idx on profiles (school_id);

create table if not exists teacher_invites (
  code text primary key,
  school_id text not null references schools(id) on delete cascade,
  created_by text not null,
  used_by text,
  created_at timestamptz not null default now()
);
create index if not exists teacher_invites_school_idx on teacher_invites (school_id);

create table if not exists classes (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists classes_school_idx on classes (school_id);

create table if not exists class_groups (
  id text primary key,
  class_id text not null references classes(id) on delete cascade,
  name text not null
);

create table if not exists subjects (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  name text not null,
  room text not null default '',
  meet_link text not null default '',
  students_can_add_hw boolean not null default false
);
create index if not exists subjects_school_idx on subjects (school_id);

create table if not exists teacher_subjects (
  user_id text not null,
  subject_id text not null references subjects(id) on delete cascade,
  primary key (user_id, subject_id)
);

create table if not exists roster_students (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  group_id text,
  name text not null,
  points integer not null default 0,
  invite_code text not null unique,
  linked_user_id text,
  is_starosta boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists roster_school_idx on roster_students (school_id);
create index if not exists roster_code_idx on roster_students (invite_code);

create table if not exists schedule_entries (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  group_id text,
  weekday text not null,
  period integer not null,
  start_time text not null,
  end_time text not null,
  subject_id text
);
create index if not exists schedule_class_idx on schedule_entries (class_id, weekday);

create table if not exists lessons (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  subject_id text not null,
  teacher_id text not null,
  title text not null,
  content text not null default '',
  lesson_date date not null,
  has_homework boolean not null default false,
  homework_due date,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists lessons_school_date_idx on lessons (school_id, lesson_date);

create table if not exists lesson_classes (
  lesson_id text not null references lessons(id) on delete cascade,
  class_id text not null,
  primary key (lesson_id, class_id)
);

create table if not exists grades (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  roster_id text not null references roster_students(id) on delete cascade,
  subject_id text not null,
  lesson_id text,
  kind text not null check (kind in ('lesson', 'homework', 'final')),
  value text not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists grades_roster_idx on grades (roster_id);

create table if not exists homework_done (
  roster_id text not null,
  lesson_id text not null,
  done boolean not null default true,
  primary key (roster_id, lesson_id)
);

create table if not exists announcements (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  author_id text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists announcement_classes (
  announcement_id text not null references announcements(id) on delete cascade,
  class_id text not null,
  primary key (announcement_id, class_id)
);

create table if not exists elections (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  class_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed boolean not null default false,
  winner_roster_id text,
  created_at timestamptz not null default now()
);

create table if not exists election_candidates (
  election_id text not null references elections(id) on delete cascade,
  roster_id text not null,
  primary key (election_id, roster_id)
);

create table if not exists election_votes (
  election_id text not null references elections(id) on delete cascade,
  voter_roster_id text not null,
  candidate_roster_id text not null,
  primary key (election_id, voter_roster_id)
);

create table if not exists chats (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  kind text not null,
  name text not null default '',
  class_id text,
  created_at timestamptz not null default now()
);

create table if not exists chat_members (
  chat_id text not null references chats(id) on delete cascade,
  user_id text not null,
  primary key (chat_id, user_id)
);

create table if not exists chat_messages (
  id text primary key,
  chat_id text not null references chats(id) on delete cascade,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_chat_idx on chat_messages (chat_id, created_at);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists electives (
  id text primary key,
  user_id text not null,
  name text not null,
  weekday text not null,
  start_time text not null,
  end_time text not null
);

create table if not exists points_log (
  id text primary key,
  roster_id text not null references roster_students(id) on delete cascade,
  delta integer not null,
  note text not null default '',
  by_user_id text not null,
  created_at timestamptz not null default now()
);
