import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/lib/firebase";
import { flushQueue, loadProfileCached, logout, nextStep } from "./src/lib/api";
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
    const roleLabel = profile.role === "teacher" ? "Учитель" : profile.role === "parent" ? "Батьки" : "Учень";
    const letter = (profile.displayName || "?").trim().charAt(0).toUpperCase();
    const dock = [
      ["home", "Сьогодні", "home"],
      ["schedule", "Розклад", "calendar"],
      ["tasks", "Завдання", "book"],
      profile.role === "parent" ? ["grades", "Оцінки", "star"] : ["chat", "Чат", "chatbubble"],
    ];
    body = (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 8, paddingTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.1, color: colors.forestMid }}>КЛАСНИЙ ПРОСТІР</Text>
            <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 1 }}>{profile.displayName || "Профіль"}</Text>
          </View>
          <Pressable
            onPress={() => setMenu(true)}
            style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.paper, fontWeight: "800", fontSize: 18 }}>{letter}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{screenFor(tab, profile, setTab)}</View>
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.paper, borderRadius: 22, borderWidth: 1, borderColor: colors.line, paddingVertical: 6, paddingHorizontal: 4 }}>
            {dock.map(([id, label, icon]) => {
              const on = tab === id;
              return (
                <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 16, backgroundColor: on ? "rgba(27,77,62,0.1)" : "transparent" }}>
                  <Icon name={on ? icon : `${icon}-outline`} size={21} color={on ? colors.forest : colors.muted} />
                  <Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.forest : colors.muted, marginTop: 2 }}>{label}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setMenu(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
              <Icon name="grid-outline" size={21} color={menu ? colors.forest : colors.muted} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: menu ? colors.forest : colors.muted, marginTop: 2 }}>Меню</Text>
            </Pressable>
          </View>
        </View>
        {menu ? (
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
            <View style={{ width: 300, backgroundColor: colors.forest, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 14, marginBottom: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Text style={{ color: colors.forest, fontWeight: "800", fontSize: 20 }}>{letter}</Text>
                </View>
                <Text style={{ color: colors.paper, fontWeight: "800", fontSize: 18 }} numberOfLines={1}>{profile.displayName || "Профіль"}</Text>
                <Text style={{ color: "rgba(247,244,236,0.75)", marginTop: 2, fontWeight: "700" }}>
                  {roleLabel}
                  {profile.className ? ` · ${profile.className}` : ""}
                  {profile.isAdmin ? " · адміністратор" : ""}
                </Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
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
                        borderRadius: 16,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        backgroundColor: on ? "rgba(255,255,255,0.16)" : "transparent",
                        marginBottom: 2,
                      }}
                    >
                      <Icon name={icon} size={18} color={on ? "#fff" : "rgba(247,244,236,0.82)"} />
                      <Text style={{ color: on ? "#fff" : "rgba(247,244,236,0.82)", fontWeight: "800", fontSize: 15 }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => logout().catch(() => {})}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, padding: 12 }}
              >
                <Icon name="log-out-outline" size={18} color="rgba(247,244,236,0.85)" />
                <Text style={{ color: "rgba(247,244,236,0.85)", fontWeight: "800" }}>Вийти</Text>
              </Pressable>
            </View>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(12,28,22,0.45)" }} onPress={() => setMenu(false)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style="dark" />
      {body}
    </SafeAreaView>
  );
}
