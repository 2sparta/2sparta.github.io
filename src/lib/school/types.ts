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
  isStarosta: boolean;
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
  groupId: string | null;
  weekday: string;
  period: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
  room: string;
  meetLink: string;
  customTimes: boolean;
  overrideSubjectId: string | null;
  overrideSubjectName: string | null;
  overrideWeek: string | null;
  shownSubjectId: string | null;
  shownSubjectName: string | null;
  overrideOn: boolean;
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
  publishAt: string | null;
  addedByStarosta: boolean;
  imageUrls: string[];
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
  finalPeriod: string | null;
};

export type Announcement = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
  classIds: string[];
  important: boolean;
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
  deleted: boolean;
  subjectName: string;
  edited: boolean;
  pinned: boolean;
  imageUrls: string[];
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

export type Notice = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  type: string;
};
