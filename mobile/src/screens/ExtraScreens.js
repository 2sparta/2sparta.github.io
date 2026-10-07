import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { generateTeacherInvite, listNotices, listTeachers, markNoticesRead } from "../lib/extra";
import { Btn, Card, H1, Muted, Screen, colors, errText } from "../ui";

export function TeachersScreen({ profile }) {
  const [rows, setRows] = useState([]);
  const [code, setCode] = useState("");
  useEffect(() => {
    listTeachers(profile).then(setRows).catch((e) => Alert.alert("Класний простір", errText(e)));
  }, [profile.userId]);
  async function invite() {
    try {
      const res = await generateTeacherInvite(profile);
      setCode(res.code);
    } catch (e) {
      Alert.alert("Класний простір", errText(e));
    }
  }
  return (
    <Screen>
      <H1>Вчителі</H1>
      <Muted>Ті самі вчителі, що й на сайті.</Muted>
      {profile.isAdmin ? <Btn label="Новий код запрошення" onPress={invite} /> : null}
      {code ? (
        <Card>
          <Text style={{ color: colors.muted }}>Код для вчителя</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{code}</Text>
        </Card>
      ) : null}
      {rows.map((t) => (
        <Card key={t.userId}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{t.displayName}</Text>
          <Text style={{ color: colors.muted }}>{t.isAdmin ? "Адміністратор" : "Учитель"}</Text>
        </Card>
      ))}
    </Screen>
  );
}

export function NoticesScreen({ profile }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    listNotices(profile).then(setRows).catch(() => {});
    markNoticesRead(profile).catch(() => {});
  }, [profile.userId]);
  return (
    <Screen>
      <H1>Повідомлення</H1>
      {rows.length === 0 ? <Muted>Повідомлень ще немає.</Muted> : null}
      {rows.map((n) => (
        <Card key={n.id}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{n.title}</Text>
          <Text style={{ color: colors.inkSoft, marginTop: 4 }}>{n.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
