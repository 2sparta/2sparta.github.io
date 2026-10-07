import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

export function Icon({ name, size = 20, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const colors = {
  ink: "#1a3d32",
  inkSoft: "#3d5a4e",
  forest: "#1b4d3e",
  forestMid: "#2a6a54",
  paper: "#f7f4ec",
  canvas: "#eef3ea",
  card: "#f7f4ec",
  line: "rgba(26,61,50,0.12)",
  muted: "#5c7368",
  terra: "#c17a5a",
  gold: "#8d6a12",
  silver: "#5c6770",
  bronze: "#8a5228",
  white: "#ffffff",
};

export function Screen({ children, refreshing, onRefresh }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      refreshControl={undefined}
      keyboardShouldPersistTaps="handled"
    >
      {onRefresh ? (
        <Pressable onPress={onRefresh} style={styles.refresh}>
          <Text style={styles.refreshText}>{refreshing ? "Оновлення…" : "Оновити"}</Text>
        </Pressable>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function H1({ children }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

export function Field(props) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.field} {...props} />;
}

export function Btn({ label, onPress, disabled, ghost }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, ghost && styles.ghost, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.btnText, ghost && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function OfflineNote({ savedAt }) {
  const when = savedAt ? new Date(savedAt).toLocaleString("uk-UA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "";
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>Немає інтернету. Показано збережене{when ? ` · ${when}` : ""}.</Text>
    </View>
  );
}

export function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <ActivityIndicator color={colors.forest} />
    </View>
  );
}

export function errText(e) {
  const msg = e?.code === "OFFLINE" || e?.message === "OFFLINE" ? "Потрібен інтернет." : e?.message || "Помилка";
  if (msg === "CODE_NOT_FOUND") return "Код не знайдено.";
  if (msg === "CODE_USED") return "Цей код уже використано.";
  if (msg === "SUBJECTS") return "Оберіть предмет або роль адміністратора.";
  if (msg === "NAME") return "Вкажіть ім'я.";
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) return "Невірна пошта або пароль.";
  if (msg.includes("auth/email-already-in-use")) return "Така пошта вже зареєстрована.";
  if (msg.includes("auth/weak-password")) return "Пароль закороткий.";
  return msg;
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.4, marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  field: {
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    color: colors.ink,
    fontSize: 16,
  },
  btn: { backgroundColor: colors.forestMid, borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  ghost: { backgroundColor: colors.canvas },
  btnText: { color: colors.paper, fontWeight: "800" },
  note: { backgroundColor: "#f3e6c8", borderRadius: 12, padding: 10, marginBottom: 10 },
  noteText: { color: "#6a5314", fontSize: 13, fontWeight: "700" },
  refresh: { alignSelf: "flex-start", marginBottom: 8 },
  refreshText: { color: colors.forest, fontWeight: "800" },
});
