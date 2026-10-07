import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/lib/firebase";
import { flushQueue, loadProfileCached, nextStep } from "./src/lib/api";
import { JoinSchoolScreen, LinkScreen, LoginScreen, RoleScreen, SetupScreen } from "./src/screens/AuthScreens";
import {
  ChatScreen,
  GradesScreen,
  HomeScreen,
  MoreScreen,
  NewsScreen,
  PointsScreen,
  ScheduleScreen,
  TasksScreen,
} from "./src/screens/SchoolScreens";
import { NoticesScreen, TeachersScreen } from "./src/screens/ExtraScreens";
import { ClubsScreen, HomeworkScreen } from "./src/screens/CommunityScreens";
import { Spinner, colors, Icon } from "./src/ui";

const STUDENT = [
  ["home", "Сьогодні", "home-outline"],
  ["schedule", "Розклад", "calendar-outline"],
  ["tasks", "Завдання", "book-outline"],
  ["homework", "ДЗ", "document-text-outline"],
  ["grades", "Оцінки", "star-outline"],
  ["points", "Бали", "cash-outline"],
  ["news", "Оголошення", "megaphone-outline"],
  ["clubs", "Клуби", "color-palette-outline"],
  ["more", "Самоврядування", "people-outline"],
  ["chat", "Чат", "chatbubble-outline"],
  ["notices", "Повідомлення", "notifications-outline"],
];

const TEACHER = [
  ["home", "Сьогодні", "home-outline"],
  ["points", "Учні", "people-outline"],
  ["schedule", "Розклад", "calendar-outline"],
  ["tasks", "Завдання", "book-outline"],
  ["homework", "ДЗ", "document-text-outline"],
  ["grades", "Оцінки", "star-outline"],
  ["news", "Оголошення", "megaphone-outline"],
  ["clubs", "Клуби", "color-palette-outline"],
  ["more", "Самоврядування", "ribbon-outline"],
  ["chat", "Чат", "chatbubble-outline"],
  ["notices", "Повідомлення", "notifications-outline"],
];

const PARENT = [
  ["home", "Сьогодні", "home-outline"],
  ["schedule", "Розклад", "calendar-outline"],
  ["tasks", "Завдання", "book-outline"],
  ["homework", "ДЗ", "document-text-outline"],
  ["grades", "Оцінки", "star-outline"],
  ["news", "Оголошення", "megaphone-outline"],
];

function screenFor(tab, profile, setTab) {
  if (tab === "schedule") return <ScheduleScreen profile={profile} />;
  if (tab === "tasks") return <TasksScreen profile={profile} />;
  if (tab === "chat") return <ChatScreen profile={profile} />;
  if (tab === "grades") return <GradesScreen profile={profile} />;
  if (tab === "points") return <PointsScreen profile={profile} />;
  if (tab === "news") return <NewsScreen profile={profile} />;
  if (tab === "more") return <MoreScreen profile={profile} onTab={setTab} />;
  if (tab === "notices") return <NoticesScreen profile={profile} />;
  if (tab === "teachers") return <TeachersScreen profile={profile} />;
  if (tab === "clubs") return <ClubsScreen profile={profile} />;
  if (tab === "homework") return <HomeworkScreen profile={profile} />;
  return <HomeScreen profile={profile} onTab={setTab} />;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bootError, setBootError] = useState("");
  const [tab, setTab] = useState("home");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setBooting(false);
        return;
      }
      try {
        const p = await loadProfileCached();
        setProfile(p);
        setBootError("");
        if (nextStep(p) === "app") flushQueue(p).catch(() => {});
      } catch (e) {
        setProfile(null);
        setBootError(e?.message || "Не вдалося відкрити профіль");
      } finally {
        setBooting(false);
      }
    });
  }, []);

  let body = <Spinner />;
  if (!booting && !user) body = <LoginScreen />;
  else if (!booting && user && bootError && !profile) {
    body = (
      <View style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: colors.canvas }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Немає з'єднання</Text>
        <Text style={{ color: colors.muted }}>{bootError}</Text>
      </View>
    );
  } else if (!booting && user && !profile) body = <RoleScreen onDone={setProfile} />;
  else if (profile && nextStep(profile) === "role") body = <RoleScreen onDone={setProfile} />;
  else if (profile && nextStep(profile) === "link") body = <LinkScreen profile={profile} onDone={setProfile} />;
  else if (profile && nextStep(profile) === "school") body = <JoinSchoolScreen profile={profile} onDone={setProfile} />;
  else if (profile && nextStep(profile) === "setup") body = <SetupScreen profile={profile} onDone={setProfile} />;
  else if (profile) {
    const nav = profile.role === "student" ? STUDENT : profile.role === "parent" ? PARENT : TEACHER.filter((item) => item[0] !== "teachers");
    const items = profile.isAdmin ? [...nav.slice(0, 7), ["teachers", "Вчителі", "school-outline"], ...nav.slice(7)] : nav;
    body = (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => setMenu(true)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}>
            <Icon name="menu" size={22} color={colors.paper} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Класний простір</Text>
        </View>
        <View style={{ flex: 1 }}>{screenFor(tab, profile, setTab)}</View>
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper, paddingTop: 6, paddingBottom: 10 }}>
          {[
            ["home", "Сьогодні", "home"],
            ["schedule", "Розклад", "calendar"],
            ["tasks", "Завдання", "book"],
            ["chat", "Чат", "chatbubble"],
          ].map(([id, label, icon]) => {
            const on = tab === id;
            return (
              <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                <Icon name={on ? icon : `${icon}-outline`} size={22} color={on ? colors.forest : colors.muted} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.forest : colors.muted, marginTop: 2 }}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setMenu(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
            <Icon name="grid-outline" size={22} color={colors.muted} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, marginTop: 2 }}>Меню</Text>
          </Pressable>
        </View>
        {menu ? (
          <View style={{ position: "absolute", inset: 0, flexDirection: "row" }}>
            <View style={{ width: 280, backgroundColor: colors.forest, padding: 16, paddingTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="leaf-outline" size={18} color={colors.forest} />
                </View>
                <Text style={{ color: colors.paper, fontWeight: "800", fontSize: 16 }}>Класний простір</Text>
              </View>
              <ScrollView>
                {items.map(([id, label, icon]) => {
                  const on = tab === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        setTab(id);
                        setMenu(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderRadius: 14,
                        paddingVertical: 11,
                        paddingHorizontal: 12,
                        backgroundColor: on ? "rgba(255,255,255,0.15)" : "transparent",
                        marginBottom: 4,
                      }}
                    >
                      <Icon name={icon} size={18} color={on ? "#fff" : "rgba(247,244,236,0.8)"} />
                      <Text style={{ color: on ? "#fff" : "rgba(247,244,236,0.8)", fontWeight: "800" }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ color: "rgba(247,244,236,0.7)", marginTop: 12 }}>
                {profile.role === "teacher" ? "Учитель" : profile.role === "parent" ? "Батьки" : "Учень"}
                {profile.isAdmin ? " · адміністратор" : ""}
              </Text>
            </View>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(12,28,22,0.4)" }} onPress={() => setMenu(false)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: 48, backgroundColor: colors.canvas }}>
      <StatusBar style="dark" />
      {body}
    </View>
  );
}
