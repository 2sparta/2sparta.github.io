export type Role = "teacher" | "student";

export type Profile = {
  userId: string;
  role: Role | null;
  displayName: string;
  schoolId: string | null;
  classId: string | null;
  groupId: string | null;
  rosterId: string | null;
  isAdmin: boolean;
  setupComplete: boolean;
  email: string | null;
  schoolName: string | null;
  className: string | null;
  points: number;
  linked: boolean;
};

export type Subject = {
  id: string;
  name: string;
  room: string;
  meetLink: string;
  studentsCanAddHw: boolean;
};

export type SchoolClass = {
  id: string;
  name: string;
  groups: { id: string; name: string }[];
};

export type RosterStudent = {
  id: string;
  name: string;
  classId: string;
  className: string;
  groupId: string | null;
  groupName: string | null;
  points: number;
  inviteCode: string;
  linkedUserId: string | null;
  isStarosta: boolean;
};

export type ScheduleEntry = {
  id: string;
  classId: string;
  weekday: string;
  period: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
  room: string;
};

export type Lesson = {
  id: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  title: string;
  content: string;
  lessonDate: string;
  hasHomework: boolean;
  homeworkDue: string | null;
  classIds: string[];
};

export type Grade = {
  id: string;
  rosterId: string;
  subjectId: string;
  subjectName: string;
  lessonId: string | null;
  kind: "lesson" | "homework" | "final";
  value: string;
  comment: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
  classIds: string[];
};

export type ChatSummary = {
  id: string;
  kind: string;
  name: string;
  lastBody: string | null;
  lastAt: string | null;
};

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type Election = {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
  closed: boolean;
  winnerRosterId: string | null;
  candidates: { rosterId: string; name: string; votes: number }[];
  myCandidate: boolean;
  myVote: string | null;
};
