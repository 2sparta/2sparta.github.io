import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, View, Alert } from "react-native";
import {
  WEEKDAYS,
  addAnnouncement,
  addLesson,
  adjustPoints,
  getElection,
  getSchedule,
  kyivClock,
  kyivToday,
  kyivWeekday,
  listActivities,
  listAnnouncements,
  listChats,
  listClasses,
  listGrades,
  listLeaderboard,
  listLessons,
  listMessages,
  listSubjects,
  logout,
  minutesOf,
  sendMessage,
  toggleHomeworkDone,
  voteElection,
} from "../lib/api";
import {
  deleteMessage,
  editMessage,
  pinMessage,
  addStudent,
  addClass,
  addGroup,
  setScheduleSubject,
  setWeekOverride,
  addSchedulePeriod,
  setGrade,
  deleteStudent,
  addActivity,
  runForElection,
  announceElection,
  listPointsHistory,
} from "../lib/extra";
import { Btn, Card, Field, H1, Icon, Muted, OfflineNote, Screen, colors, errText } from "../ui";
import { ScheduleClubs, RewardsBlock, DutyDay } from "./CommunityScreens";
import { setStudentPerms } from "../lib/community";

const DAY = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Нд" };
const FULL = {
  mon: "Понеділок",
  tue: "Вівторок",
  wed: "Середа",
  thu: "Четвер",
  fri: "П'ятниця",
  sat: "Субота",
  sun: "Неділя",
};
const MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  const index = (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][index];
}

function prettyDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function weekKey(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function subjectOn(entry, iso) {
  if (entry.overrideWeek && entry.overrideWeek === weekKey(iso) && (entry.overrideSubjectName || entry.overrideSubjectId)) {
    return entry.overrideSubjectName || entry.overrideSubjectId;
  }
  return entry.subjectName || "";
}

function spanLabel(mins, live) {
  const n = Math.max(0, mins);
  const body = n >= 60 ? `${Math.floor(n / 60)} год ${n % 60 ? `${n % 60} хв` : ""}`.trim() : `${n} хв`;
  return live ? `ще ${body}` : `через ${body}`;
}

function ScrollChips({ items, active, onPick }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onPick(item.id)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: active === item.id ? colors.forest : "#efeae0",
          }}
        >
          <Text style={{ color: active === item.id ? "#f6f3ec" : colors.ink, fontWeight: "800" }}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function useLoad(profile, loader) {
  const [state, setState] = useState({ loading: true, error: "", offline: false, savedAt: 0, data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    loader()
      .then((res) => {
        if (!live) return;
        setState({ loading: false, error: "", offline: res.offline, savedAt: res.savedAt, data: res.data });
      })
      .catch((e) => {
        if (live) setState({ loading: false, error: errText(e), offline: false, savedAt: 0, data: null });
      });
    return () => {
      live = false;
    };
  }, [profile.userId, tick]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}

export function HomeScreen({ profile, onTab }) {
  const first = (profile.displayName || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Доброго ранку" : hour < 18 ? "Добрий день" : "Добрий вечір";
  const tiles = profile.role === "teacher"
    ? [
        ["points", "Учні", "people-outline", "#1b4d3e"],
        ["schedule", "Розклад", "calendar-outline", "#2a6a54"],
        ["tasks", "Завдання", "book-outline", "#5f8a6a"],
        ["homework", "ДЗ", "document-text-outline", "#3d5a4e"],
        ["grades", "Оцінки", "star-outline", "#c17a5a"],
        ["news", "Оголошення", "megaphone-outline", "#8d6a12"],
        ["clubs", "Клуби", "color-palette-outline", "#2a6a54"],
        ["more", "Самоврядування", "ribbon-outline", "#1b4d3e"],
        ["chat", "Чат", "chatbubble-outline", "#3d5a4e"],
        ["notices", "Повідомлення", "notifications-outline", "#8a5228"],
      ]
    : [
        ["schedule", "Розклад", "calendar-outline", "#1b4d3e"],
        ["tasks", "Завдання", "book-outline", "#2a6a54"],
        ["homework", "ДЗ", "document-text-outline", "#3d5a4e"],
        ["grades", "Оцінки", "star-outline", "#c17a5a"],
        ["points", "Бали", "cash-outline", "#8d6a12"],
        ["news", "Оголошення", "megaphone-outline", "#5f8a6a"],
        ["clubs", "Клуби", "color-palette-outline", "#1b4d3e"],
        ["more", "Самоврядування", "people-outline", "#1b4d3e"],
        ["chat", "Чат", "chatbubble-outline", "#3d5a4e"],
        ["notices", "Повідомлення", "notifications-outline", "#8a5228"],
      ];
  const shown = profile.role === "parent" ? tiles.filter(([id]) => ["schedule", "tasks", "homework", "grades", "news"].includes(id)) : tiles;
  return (
    <Screen>
      <View style={{ backgroundColor: colors.forest, borderRadius: 28, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: "rgba(247,244,236,0.75)", fontWeight: "700" }}>{greet}</Text>
        <Text style={{ color: colors.paper, fontSize: 30, fontWeight: "800", marginTop: 2 }}>{first || profile.displayName}</Text>
        <Text style={{ color: "rgba(247,244,236,0.85)", fontWeight: "700", marginTop: 8 }}>
          {profile.role === "teacher" ? "Учитель" : profile.role === "parent" ? "Батьки" : "Учень"}
          {profile.role === "parent" && profile.childName ? ` · ${profile.childName}` : ""}
          {profile.className ? ` · ${profile.className}` : ""}
          {profile.schoolName ? ` · ${profile.schoolName}` : ""}
        </Text>
        {profile.role === "student" ? (
          <Pressable onPress={() => onTab?.("points")} style={{ marginTop: 14, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: "rgba(247,244,236,0.75)", fontSize: 12, fontWeight: "700" }}>Ваші бали</Text>
            <Text style={{ color: colors.paper, fontSize: 28, fontWeight: "800" }}>{profile.points}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {shown.map(([id, label, icon, tint]) => (
          <Pressable
            key={id}
            onPress={() => onTab?.(id)}
            style={{
              width: "47.5%",
              backgroundColor: colors.card,
              borderRadius: 22,
              padding: 14,
              minHeight: 112,
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
              <Icon name={icon} size={20} color="#f7f4ec" />
            </View>
            <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16, marginTop: 14 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

export function ScheduleScreen({ profile }) {
  const [classId, setClassId] = useState(profile.classId || "");
  const classes = useLoad(profile, () => listClasses(profile));
  const q = useLoad(profile, () => getSchedule(profile, classId || undefined));
  const subjects = useLoad(profile, () => listSubjects(profile).then((rows) => ({ data: rows, offline: false, savedAt: 0 })));
  const [pick, setPick] = useState(null);
  const [groupId, setGroupId] = useState(profile.groupId || "");
  const [date, setDate] = useState(kyivToday());
  const [now, setNow] = useState(minutesOf(kyivClock()));
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(1);
  const pager = useRef(null);
  const placed = useRef(false);
  const entries = q.data?.entries || [];
  const todayIso = kyivToday();
  const today = kyivWeekday();
  const classList = classes.data?.classes || [];
  const weekend = ["sat", "sun"].filter((day) => entries.some((e) => e.weekday === day && (e.subjectId || e.subjectName || e.customTimes)));
  const shownDays = [...WEEKDAYS, ...weekend];
  const periods = [...new Set(entries.map((e) => e.period))].sort((a, b) => a - b);
  const dayKey = weekdayOf(date);
  const dayRows = entries.filter((e) => e.weekday === dayKey).sort((a, b) => a.period - b.period);
  const isToday = date === todayIso;

  useEffect(() => {
    const id = setInterval(() => setNow(minutesOf(kyivClock())), 30000);
    return () => clearInterval(id);
  }, []);

  let liveId = "";
  let nextId = "";
  if (isToday && now != null) {
    for (const row of dayRows) {
      const name = subjectOn(row, date);
      if (!name) continue;
      const start = minutesOf(row.startTime);
      const end = minutesOf(row.endTime);
      if (start == null || end == null) continue;
      if (now >= start && now < end) {
        liveId = row.id;
        break;
      }
      if (now < start && !nextId) nextId = row.id;
    }
  }

  function place(nextWidth) {
    if (!nextWidth || placed.current) return;
    placed.current = true;
    requestAnimationFrame(() => pager.current?.scrollTo({ x: nextWidth, animated: false }));
  }

  return (
    <View style={{ flex: 1 }} onLayout={(e) => {
      const next = e.nativeEvent.layout.width;
      setWidth(next);
      place(next);
    }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <H1>Розклад</H1>
        <Muted>{page === 1 ? "Свайпніть вправо — розклад на день" : "Свайпніть вліво — таблиця тижня"}</Muted>
        <ScheduleClubs profile={profile} />
        {profile.role === "teacher" && classList.length > 0 ? (
          <ScrollChips
            items={classList}
            active={classId || classList[0]?.id}
            onPick={(id) => {
              setClassId(id);
              q.reload();
            }}
          />
        ) : null}
        {profile.role === "teacher" ? (
          <Btn
            ghost
            label="Додати урок у розклад"
            onPress={async () => {
              try {
                const klass = classId || classList[0]?.id;
                const group = groupId || classList.find((c) => c.id === klass)?.groups?.[0]?.id;
                await addSchedulePeriod(profile, klass, group);
                q.reload();
              } catch (e) {
                Alert.alert("Класний простір", errText(e));
              }
            }}
          />
        ) : null}
        {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
        {q.error ? <Muted>{q.error}</Muted> : null}
        <Pressable onPress={q.reload} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
          <Text style={{ color: colors.forest, fontWeight: "800" }}>{q.loading ? "Оновлення…" : "Оновити"}</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => {
          if (!width) return;
          setPage(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        <View style={{ width: width || 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Pressable onPress={() => setDate((d) => addDays(d, -1))} style={arrowBtn}>
                <Icon name="chevron-back" size={22} color={colors.forest} />
              </Pressable>
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink }}>{FULL[dayKey]}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>{prettyDate(date)}{isToday ? " · сьогодні" : ""}</Text>
              </View>
              <Pressable onPress={() => setDate((d) => addDays(d, 1))} style={arrowBtn}>
                <Icon name="chevron-forward" size={22} color={colors.forest} />
              </Pressable>
            </View>
            {dayRows.length === 0 ? <Muted>Цього дня уроків немає.</Muted> : null}
            {dayRows.map((e) => {
              const name = subjectOn(e, date);
              const start = minutesOf(e.startTime);
              const end = minutesOf(e.endTime);
              const hint = e.id === liveId && end != null && now != null
                ? spanLabel(end - now, true)
                : e.id === nextId && start != null && now != null
                  ? spanLabel(start - now, false)
                  : "";
              return (
                <Pressable key={e.id} onPress={() => profile.role === "teacher" && setPick(e)}>
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>
                          {e.period}. {name || "—"}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {e.startTime}–{e.endTime}
                          {e.room ? ` · каб. ${e.room}` : ""}
                        </Text>
                      </View>
                      {hint ? <Text style={{ color: colors.forest, fontWeight: "800", fontSize: 13 }}>{hint}</Text> : null}
                    </View>
                    {e.id === liveId && e.meetLink ? (
                      <Btn label="Приєднатися" onPress={() => Linking.openURL(e.meetLink)} />
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
            <DutyDay profile={profile} classId={classId || profile.classId} weekday={dayKey} />
          </ScrollView>
        </View>
        <View style={{ width: width || 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 28 }}>
            <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: "hidden", backgroundColor: colors.card }}>
              <View style={{ flexDirection: "row", backgroundColor: "#e7efe4" }}>
                <Text style={thNum}>№</Text>
                <Text style={thTime}>Час</Text>
                {shownDays.map((day) => (
                  <Text key={day} style={[thDay, day === today && { color: colors.forest }]}>{DAY[day]}</Text>
                ))}
              </View>
              {periods.map((period) => {
                const sample = entries.find((e) => e.period === period && e.startTime);
                return (
                  <View key={period} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
                    <Text style={tdNum}>{period}</Text>
                    <Text style={tdTime}>{sample ? `${sample.startTime}\n${sample.endTime}` : "—"}</Text>
                    {shownDays.map((day) => {
                      const row = entries.find((e) => e.weekday === day && e.period === period);
                      const name = row ? subjectOn(row, todayIso) : "";
                      return (
                        <Pressable
                          key={day}
                          style={[tdDay, day === today && { backgroundColor: "rgba(27,77,62,0.06)" }]}
                          onPress={() => row && profile.role === "teacher" && setPick(row)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.ink }}>{name || "—"}</Text>
                          {row?.room ? <Text style={{ fontSize: 10, color: colors.muted }}>{row.room}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
              {periods.length === 0 ? <Text style={{ padding: 14, color: colors.muted }}>Розклад ще порожній.</Text> : null}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      {pick ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 8 }}>
          <Card>
            <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: 8 }}>
              {DAY[pick.weekday]} · {pick.period} урок
            </Text>
            <ScrollChips
              items={[{ id: "", name: "Вікно" }, ...((subjects.data?.data || subjects.data || []).map((s) => ({ id: s.id, name: s.name })))]}
              active={pick.subjectId || ""}
              onPick={async (id) => {
                try {
                  await setScheduleSubject(profile, pick.id, id || null);
                  setPick(null);
                  q.reload();
                } catch (e) {
                  Alert.alert("Класний простір", errText(e));
                }
              }}
            />
            <Btn
              ghost
              label="Заміна на цей тиждень"
              onPress={async () => {
                try {
                  await setWeekOverride(profile, pick.id, pick.subjectId);
                  setPick(null);
                  q.reload();
                } catch (e) {
                  Alert.alert("Класний простір", errText(e));
                }
              }}
            />
            <Btn ghost label="Закрити" onPress={() => setPick(null)} />
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const arrowBtn = { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" };
const thNum = { width: 28, padding: 6, fontSize: 11, fontWeight: "800", color: "#5c7368" };
const thTime = { width: 52, padding: 6, fontSize: 11, fontWeight: "800", color: "#5c7368" };
const thDay = { flex: 1, padding: 6, fontSize: 11, fontWeight: "800", color: "#1a3d32" };
const tdNum = { width: 28, padding: 6, fontSize: 12, fontWeight: "800", color: "#5c7368" };
const tdTime = { width: 52, padding: 6, fontSize: 10, color: "#5c7368", lineHeight: 13 };
const tdDay = { flex: 1, padding: 6, minHeight: 46 };

export function TasksScreen({ profile }) {
  const q = useLoad(profile, () => listLessons(profile));
  const subjects = useLoad(profile, () => listSubjects(profile).then((rows) => ({ data: rows, offline: false, savedAt: 0 })));
  const classes = useLoad(profile, () => listClasses(profile));
  const [done, setDone] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classIds, setClassIds] = useState(profile.classId ? [profile.classId] : []);
  const [hwDate, setHwDate] = useState("");
  useEffect(() => {
    setDone(q.data?.doneIds || []);
  }, [q.data]);
  const lessons = q.data?.lessons || [];
  const subjectRows = subjects.data?.data || subjects.data || [];
  const classRows = classes.data?.classes || [];

  async function createLesson() {
    try {
      await addLesson(profile, {
        subjectId: subjectId || subjectRows[0]?.id,
        title,
        content,
        lessonDate: kyivToday(),
        homeworkDue: hwDate,
        classIds,
      });
      setTitle("");
      setContent("");
      setHwDate("");
      q.reload();
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }
  async function toggle(lesson) {
    const next = !done.includes(lesson.id);
    setDone((prev) => (next ? [...prev, lesson.id] : prev.filter((id) => id !== lesson.id)));
    try {
      await toggleHomeworkDone(profile, lesson.id, next);
    } catch (e) {
      setDone(q.data?.doneIds || []);
      Alert.alert("Класний простір", errText(e));
    }
  }
  return (
    <Screen refreshing={q.loading} onRefresh={q.reload}>
      <H1>Завдання</H1>
      {profile.role === "teacher" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: 8 }}>Нове завдання</Text>
          <ScrollChips
            items={subjectRows.map((s) => ({ id: s.id, name: s.name }))}
            active={subjectId || subjectRows[0]?.id}
            onPick={setSubjectId}
          />
          <ScrollChips
            items={classRows}
            active=""
            onPick={(id) => setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {classRows.filter((c) => classIds.includes(c.id)).map((c) => (
              <Text key={c.id} style={{ color: colors.forest, fontWeight: "800" }}>{c.name}</Text>
            ))}
          </View>
          <Field placeholder="Назва" value={title} onChangeText={setTitle} />
          <Field placeholder="Опис" value={content} onChangeText={setContent} />
          <Field placeholder="ДЗ здати до (РРРР-ММ-ДД)" value={hwDate} onChangeText={setHwDate} />
          <Btn label="Додати" onPress={createLesson} />
        </Card>
      ) : null}
      {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
      {q.error ? <Muted>{q.error}</Muted> : null}
      {lessons.map((l) => (
        <Card key={l.id}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{l.title}</Text>
          <Text style={{ color: colors.forest, fontWeight: "700" }}>{l.subjectName}</Text>
          {l.content ? <Text style={{ color: colors.ink, marginTop: 4 }}>{l.content}</Text> : null}
          <Text style={{ color: colors.muted, marginTop: 4 }}>
            {l.lessonDate}
            {l.homeworkDue ? ` · ДЗ до ${l.homeworkDue}` : ""}
          </Text>
          {l.imageUrls?.map((url) => (
            <Image key={url} source={{ uri: url }} style={{ width: "100%", height: 160, borderRadius: 12, marginTop: 8 }} />
          ))}
          {profile.role === "student" && l.hasHomework ? (
            <Btn ghost label={done.includes(l.id) ? "Зроблено" : "Позначити зробленим"} onPress={() => toggle(l)} />
          ) : null}
        </Card>
      ))}
      {!q.loading && lessons.length === 0 ? <Muted>Завдань немає.</Muted> : null}
    </Screen>
  );
}

export function GradesScreen({ profile }) {
  const q = useLoad(profile, () => listGrades(profile));
  const people = useLoad(profile, () => listLeaderboard(profile));
  const subjects = useLoad(profile, () => listSubjects(profile).then((rows) => ({ data: rows, offline: false, savedAt: 0 })));
  const grades = q.data?.grades || [];
  const [rosterId, setRosterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [value, setValue] = useState("");
  const subjectRows = subjects.data?.data || subjects.data || [];
  return (
    <Screen refreshing={q.loading} onRefresh={q.reload}>
      <H1>Оцінки</H1>
      {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
      {profile.role === "teacher" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: 8 }}>Нова оцінка</Text>
          <ScrollChips items={(people.data?.people || []).map((p) => ({ id: p.id, name: p.name }))} active={rosterId} onPick={setRosterId} />
          <ScrollChips items={subjectRows.map((s) => ({ id: s.id, name: s.name }))} active={subjectId} onPick={setSubjectId} />
          <Field placeholder="Оцінка" value={value} onChangeText={setValue} />
          <Btn
            label="Зберегти"
            onPress={async () => {
              try {
                await setGrade(profile, {
                  rosterId: rosterId || people.data?.people?.[0]?.id,
                  subjectId: subjectId || subjectRows[0]?.id,
                  value,
                  kind: "lesson",
                });
                setValue("");
                q.reload();
              } catch (e) {
                Alert.alert("Класний простір", errText(e));
              }
            }}
          />
        </Card>
      ) : null}
      {grades.map((g) => (
        <Card key={g.id}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{g.value}</Text>
          <Text style={{ fontWeight: "700", color: colors.forest }}>{g.subjectName}</Text>
          {profile.role === "teacher" && g.studentName ? <Text style={{ color: colors.ink }}>{g.studentName}</Text> : null}
          <Text style={{ color: colors.muted }}>{g.kind === "homework" ? "ДЗ" : g.kind === "final" ? "Підсумок" : "Урок"}</Text>
          {g.comment ? <Text style={{ color: colors.ink, marginTop: 4 }}>{g.comment}</Text> : null}
        </Card>
      ))}
      {!q.loading && grades.length === 0 ? <Muted>Оцінок ще немає.</Muted> : null}
    </Screen>
  );
}

export function PointsScreen({ profile }) {
  const q = useLoad(profile, () => listLeaderboard(profile));
  const classes = useLoad(profile, () => listClasses(profile));
  const people = q.data?.people || [];
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(profile.classId || "");
  const [className, setClassName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [history, setHistory] = useState([]);
  const medal = [colors.gold, colors.silver, colors.bronze];
  async function bump(id, delta) {
    setBusy(id);
    try {
      await adjustPoints(profile, id, delta);
      q.reload();
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <Screen refreshing={q.loading} onRefresh={q.reload}>
      <H1>{profile.role === "teacher" ? "Учні" : "Бали"}</H1>
      {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
      {profile.role === "student" ? (
        <Btn
          ghost
          label="Історія балів"
          onPress={async () => {
            try {
              setHistory(await listPointsHistory(profile));
            } catch (e) {
              Alert.alert("Класний простір", errText(e));
            }
          }}
        />
      ) : (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: 8 }}>Новий учень або клас</Text>
          <ScrollChips items={classes.data?.classes || []} active={classId} onPick={setClassId} />
          <Field placeholder="Ім'я учня" value={name} onChangeText={setName} />
          <Btn
            label="Додати учня"
            onPress={async () => {
              try {
                const res = await addStudent(profile, { name, classId: classId || classes.data?.classes?.[0]?.id });
                Alert.alert("Код учня", res.inviteCode);
                setName("");
                q.reload();
              } catch (e) {
                Alert.alert("Класний простір", errText(e));
              }
            }}
          />
          <Field placeholder="Новий клас, напр. 8-А" value={className} onChangeText={setClassName} />
          <Btn
            ghost
            label="Додати клас"
            onPress={async () => {
              try {
                await addClass(profile, className);
                setClassName("");
                classes.reload();
              } catch (e) {
                Alert.alert("Класний простір", errText(e));
              }
            }}
          />
          <Field placeholder="Нова група" value={groupName} onChangeText={setGroupName} />
          <Btn
            ghost
            label="Додати групу в обраний клас"
            onPress={async () => {
              try {
                await addGroup(profile, classId || classes.data?.classes?.[0]?.id, groupName);
                setGroupName("");
                classes.reload();
              } catch (e) {
                Alert.alert("Класний простір", errText(e));
              }
            }}
          />
        </Card>
      )}
      {history.map((h) => (
        <Card key={h.id}>
          <Text style={{ fontWeight: "800", color: h.delta > 0 ? colors.forest : colors.terra }}>
            {h.delta > 0 ? "+" : ""}
            {h.delta}
          </Text>
          <Text style={{ color: colors.muted }}>{h.byName}</Text>
        </Card>
      ))}
      {people.map((p, i) => (
        <Card key={p.id}>
          <Text style={{ color: medal[i] || colors.muted, fontWeight: "800" }}>{i + 1}</Text>
          <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>{p.name}</Text>
          <Text style={{ color: colors.muted }}>{p.className}</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.forest }}>{p.points}</Text>
          {profile.role === "teacher" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn ghost label="−1" disabled={busy === p.id} onPress={() => bump(p.id, -1)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="+1" disabled={busy === p.id} onPress={() => bump(p.id, 1)} />
              </View>
            </View>
          ) : null}
          {profile.role === "teacher" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  ghost
                  label="Права"
                  onPress={() =>
                    Alert.alert("Права учня", p.name, [
                      { text: "Зробити старостою", onPress: () => setStudentPerms(profile, p.id, { isStarosta: true }).then(() => q.reload()) },
                      { text: "Зняти старосту", onPress: () => setStudentPerms(profile, p.id, { isStarosta: false }).then(() => q.reload()) },
                      { text: "Дозволити ДЗ", onPress: () => setStudentPerms(profile, p.id, { canPostHw: true }).then(() => q.reload()) },
                      { text: "Забрати ДЗ", onPress: () => setStudentPerms(profile, p.id, { canPostHw: false }).then(() => q.reload()) },
                      { text: "Закрити", style: "cancel" },
                    ])
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn ghost label="Видалити" onPress={() => deleteStudent(profile, p.id).then(() => q.reload()).catch((e) => Alert.alert("Класний простір", errText(e)))} />
              </View>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

export function NewsScreen({ profile }) {
  const news = useLoad(profile, () => listAnnouncements(profile));
  const acts = useLoad(profile, () => listActivities(profile));
  const classes = useLoad(profile, () => listClasses(profile));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classIds, setClassIds] = useState(profile.classId ? [profile.classId] : []);
  const [important, setImportant] = useState(false);
  const cards = [...(news.data?.announcements || []), ...(acts.data?.activities || [])];
  const classRows = classes.data?.classes || [];

  async function publish() {
    try {
      await addAnnouncement(profile, { title, body, classIds, important });
      setTitle("");
      setBody("");
      news.reload();
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }

  return (
    <Screen refreshing={news.loading} onRefresh={() => { news.reload(); acts.reload(); }}>
      <H1>Оголошення</H1>
      {news.offline || acts.offline ? <OfflineNote savedAt={news.savedAt || acts.savedAt} /> : null}
      {profile.role === "teacher" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: 8 }}>Нове оголошення</Text>
          <ScrollChips
            items={classRows}
            active=""
            onPick={(id) => setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
          <Field placeholder="Заголовок" value={title} onChangeText={setTitle} />
          <Field placeholder="Текст" value={body} onChangeText={setBody} />
          <Btn ghost label={important ? "Важливо: так" : "Важливо: ні"} onPress={() => setImportant((v) => !v)} />
          <Btn label="Опублікувати" onPress={publish} />
        </Card>
      ) : null}
      {cards.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink }}>
            {a.title}
            {a.important ? "  · важливо" : ""}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{a.authorName}</Text>
          <Text style={{ color: colors.ink, marginTop: 6 }}>{a.body}</Text>
        </Card>
      ))}
      {!news.loading && cards.length === 0 ? <Muted>Оголошень немає.</Muted> : null}
    </Screen>
  );
}

export function ChatScreen({ profile }) {
  const q = useLoad(profile, () => listChats(profile));
  const [chatId, setChatId] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState("");
  const [offline, setOffline] = useState(false);
  const chats = q.data?.chats || [];

  async function open(id) {
    setChatId(id);
    try {
      const res = await listMessages(profile, id);
      setMsgs(res.data.messages);
      setOffline(res.offline);
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }

  async function send() {
    if (!chatId || !text.trim()) return;
    const body = text;
    setText("");
    try {
      const res = await sendMessage(profile, chatId, body);
      if (res.queued) {
        setMsgs((prev) => [...(prev || []), { id: `local-${Date.now()}`, authorId: profile.userId, authorName: profile.displayName, body, createdAt: new Date().toISOString(), queued: true }]);
      } else await open(chatId);
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }

  if (!chatId) {
    return (
      <Screen refreshing={q.loading} onRefresh={q.reload}>
        <H1>Чат</H1>
        {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
        {chats.map((c) => (
          <Pressable key={c.id} onPress={() => open(c.id)}>
            <Card>
              <Text style={{ fontWeight: "800", color: colors.ink }}>{c.name}</Text>
              <Text style={{ color: colors.muted }} numberOfLines={1}>{c.lastBody}</Text>
            </Card>
          </Pressable>
        ))}
        {!q.loading && chats.length === 0 ? <Muted>Чатів ще немає. Вони з'являться після приєднання до школи.</Muted> : null}
      </Screen>
    );
  }
  const title = chats.find((c) => c.id === chatId)?.name || "Чат";
  return (
    <Screen>
      <Btn ghost label="← Чати" onPress={() => setChatId(null)} />
      <H1>{title}</H1>
      {offline ? <OfflineNote /> : null}
      {(msgs || []).map((m) => (
        <Pressable
          key={m.id}
          onLongPress={() => {
            if (m.deleted || m.queued) return;
            Alert.alert(m.authorName, m.body, [
              { text: "Закріпити", onPress: () => pinMessage(profile, m.id, true).then(() => open(chatId)) },
              m.authorId === profile.userId
                ? {
                    text: "Видалити",
                    style: "destructive",
                    onPress: () => deleteMessage(profile, m.id).then(() => open(chatId)),
                  }
                : null,
              { text: "Скасувати", style: "cancel" },
            ].filter(Boolean));
          }}
        >
        <Card>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{m.authorName}</Text>
          {m.subjectName ? <Text style={{ color: colors.forest, fontSize: 12 }}>{m.subjectName}</Text> : null}
          <Text style={{ color: colors.ink }}>{m.deleted ? "Повідомлення видалено" : m.body}</Text>
          {m.queued ? <Text style={{ color: colors.gold }}>Надішлеться, коли з'явиться інтернет</Text> : null}
          {m.imageUrls?.map((url) => (
            <Image key={url} source={{ uri: url }} style={{ width: "100%", height: 140, borderRadius: 12, marginTop: 6 }} />
          ))}
        </Card>
        </Pressable>
      ))}
      <Field placeholder="Повідомлення" value={text} onChangeText={setText} />
      <Btn label="Надіслати" onPress={send} />
    </Screen>
  );
}

export function MoreScreen({ profile, onTab }) {
  const q = useLoad(profile, () => getElection(profile));
  const election = q.data?.election;
  async function vote(id) {
    try {
      await voteElection(profile, election.id, id);
      q.reload();
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }
  return (
    <Screen refreshing={q.loading} onRefresh={q.reload}>
      <H1>Самоврядування</H1>
      <Muted>{profile.email}</Muted>
      {profile.role === "student" ? <Btn ghost label="Податися" onPress={() => election && runForElection(profile, election.id).then(() => q.reload())} /> : null}
      {profile.role === "teacher" && profile.classId ? (
        <Btn ghost label="Оголосити вибори" onPress={() => announceElection(profile, profile.classId).then(() => q.reload()).catch((e) => Alert.alert("Класний простір", errText(e)))} />
      ) : null}
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink, marginBottom: 6 }}>Самоврядування</Text>
        {q.offline ? <OfflineNote savedAt={q.savedAt} /> : null}
        {!election ? <Text style={{ color: colors.muted }}>Відкритих виборів немає.</Text> : null}
        {election?.candidates.map((c) => (
          <Btn
            key={c.rosterId}
            ghost={election.myVote !== c.rosterId}
            label={`${c.name} · ${c.votes}`}
            onPress={() => vote(c.rosterId)}
          />
        ))}
      </Card>
      <RewardsBlock profile={profile} />
      <Btn
        label="Вийти"
        onPress={async () => {
          await logout();
        }}
      />
    </Screen>
  );
}
