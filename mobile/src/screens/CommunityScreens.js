import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Btn, Card, Field, H1, Muted, Screen, colors, errText } from "../ui";
import {
  OFFICES,
  addClassHomework,
  addClub,
  addReward,
  awardReward,
  clubClusters,
  deleteClassHomework,
  deleteClub,
  fundOffice,
  joinClub,
  listClassHomework,
  listClassmates,
  listClubs,
  listRewards,
  listRosterNames,
  officeName,
  pickClub,
  setOffice as saveOffice,
  setStudentPerms,
} from "../lib/community";

const DAYS = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Нд" };

function useRows(profile, loader) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    loader()
      .then((data) => {
        if (live) setRows(data);
      })
      .catch((e) => {
        if (live) setError(errText(e));
      });
    return () => {
      live = false;
    };
  }, [profile.userId, tick]);
  return { rows, error, reload: () => setTick((n) => n + 1) };
}

export function ScheduleClubs({ profile }) {
  const q = useRows(profile, () => listClubs(profile));
  if (profile.role === "teacher") return null;
  const joined = (q.rows?.clubs || []).filter((c) => c.joined);
  if (!joined.length) return null;
  const picks = q.rows?.picks || {};
  return (
    <View style={{ marginBottom: 8 }}>
      {clubClusters(joined).map((group) => {
        const key = group.map((c) => c.id).sort().join(",");
        const chosen = picks[key];
        const conflict = group.length > 1;
        return (
          <Card key={key}>
            {conflict ? <Text style={{ color: colors.forest, fontWeight: "800", marginBottom: 4 }}>У цей час два заняття. Оберіть одне.</Text> : null}
            {group.map((c) => {
              const on = !conflict || chosen === c.id;
              return (
                <View key={c.id} style={{ opacity: conflict && chosen && !on ? 0.45 : 1, marginBottom: 6 }}>
                  <Text style={{ fontWeight: "800", color: colors.ink }}>{c.name}</Text>
                  <Text style={{ color: colors.muted }}>
                    {DAYS[c.weekday] || c.weekday} {c.startTime}–{c.endTime}
                    {c.room ? ` · ${c.room}` : ""}
                  </Text>
                  {conflict && profile.role === "student" ? (
                    <Btn ghost={!(on && chosen)} label="Іду сюди" onPress={() => pickClub(profile, c.id).then(() => q.reload())} />
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}

export function ClubsScreen({ profile }) {
  const q = useRows(profile, () => listClubs(profile));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("club");
  const [weekday, setWeekday] = useState("thu");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [about, setAbout] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const clubs = q.rows?.clubs || [];
  return (
    <Screen>
      <H1>Клуби</H1>
      <Muted>Записані заняття з’являються в розкладі. Якщо два в один час — оберіть одне.</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {clubs.map((c) => {
          const elective = c.kind === "elective";
          return (
            <View key={c.id} style={{ width: "100%", borderRadius: 22, overflow: "hidden", backgroundColor: "#fff", borderWidth: c.joined ? 2 : 1, borderColor: c.joined ? colors.forest : colors.line }}>
              <View style={{ height: 150, backgroundColor: elective ? "#8a5228" : "#1b4d3e" }}>
                {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={{ width: "100%", height: 150 }} /> : (
                  <Text style={{ position: "absolute", left: 16, bottom: 8, fontSize: 64, fontWeight: "800", color: "rgba(255,255,255,0.25)" }}>{c.name.slice(0, 1)}</Text>
                )}
                <Text style={{ position: "absolute", left: 12, top: 12, backgroundColor: elective ? "#f3e2d2" : "#fff", color: elective ? "#8a5228" : colors.forest, fontWeight: "800", fontSize: 11, overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  {elective ? "Факультатив" : "Клуб"}
                </Text>
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 72, backgroundColor: "rgba(0,0,0,0.35)" }} />
                <Text style={{ position: "absolute", left: 12, right: 12, bottom: 10, color: "#fff", fontSize: 20, fontWeight: "800" }}>{c.name}</Text>
              </View>
              <View style={{ padding: 12 }}>
                <Text style={{ fontWeight: "800", color: colors.ink }}>{DAYS[c.weekday] || c.weekday} · {c.startTime}–{c.endTime}</Text>
                {c.about ? <Text style={{ color: colors.inkSoft, marginTop: 4 }}>{c.about}</Text> : null}
                <Text style={{ color: colors.forest, fontWeight: "700", marginTop: 4 }}>{c.memberCount} записаних</Text>
                {profile.role === "student" ? (
                  <Btn ghost={c.joined} label={c.joined ? "Вийти" : "Записатися"} onPress={() => joinClub(profile, c.id, !c.joined).then(() => q.reload())} />
                ) : null}
                {profile.role === "teacher" ? <Btn ghost label="Видалити" onPress={() => deleteClub(profile, c.id).then(() => q.reload())} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      {profile.role === "teacher" ? (
        <Pressable onPress={() => setOpen((v) => !v)} style={{ alignSelf: "center", marginTop: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 32, lineHeight: 34 }}>+</Text>
        </Pressable>
      ) : null}
      {profile.role === "teacher" && open ? (
        <Card>
          <Field placeholder="Назва" value={name} onChangeText={setName} />
          <Field placeholder="Коротко про заняття" value={about} onChangeText={setAbout} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Btn ghost={kind !== "club"} label="Клуб" onPress={() => setKind("club")} /></View>
            <View style={{ flex: 1 }}><Btn ghost={kind !== "elective"} label="Факультатив" onPress={() => setKind("elective")} /></View>
          </View>
          <Field placeholder="День: mon tue wed thu fri sat sun" value={weekday} onChangeText={setWeekday} autoCapitalize="none" />
          <Field placeholder="Початок 15:00" value={start} onChangeText={setStart} />
          <Field placeholder="Кінець 16:00" value={end} onChangeText={setEnd} />
          <Field placeholder="Посилання на фото" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />
          <Btn
            label="Додати"
            disabled={!name.trim()}
            onPress={() => addClub(profile, { name, kind, weekday: weekday.trim(), startTime: start, endTime: end, about, imageUrl }).then(() => { setName(""); setAbout(""); setImageUrl(""); setOpen(false); q.reload(); })}
          />
        </Card>
      ) : null}
      {profile.role === "student" ? <ScheduleClubs profile={profile} /> : null}
    </Screen>
  );
}

export function HomeworkScreen({ profile }) {
  const q = useRows(profile, () => listClassHomework(profile));
  const mates = useRows(profile, () => (profile.isStarosta ? listClassmates(profile) : Promise.resolve({ students: [] })));
  const canPost = profile.role === "student" && (profile.isStarosta || profile.canPostHw);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const posts = q.rows?.posts || [];
  return (
    <Screen>
      <H1>ДЗ</H1>
      <Muted>Оголошення старости. Учні самі до завдань вчителя нічого не додають.</Muted>
      {canPost ? (
        <Card>
          <Field placeholder="Предмет" value={subject} onChangeText={setSubject} />
          <Field placeholder="Завдання" value={title} onChangeText={setTitle} />
          <Field placeholder="Деталі" value={body} onChangeText={setBody} />
          <Field placeholder="Здати до РРРР-ММ-ДД" value={due} onChangeText={setDue} />
          <Btn
            label="Додати ДЗ"
            disabled={!subject.trim() || !title.trim() || !due.trim()}
            onPress={() => addClassHomework(profile, { subjectName: subject, title, body, due }).then(() => { setTitle(""); setBody(""); q.reload(); })}
          />
        </Card>
      ) : null}
      {posts.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{p.title}</Text>
          <Text style={{ color: colors.forest, fontWeight: "700" }}>{p.subjectName}{p.due ? ` · до ${p.due}` : ""}</Text>
          {p.body ? <Text style={{ color: colors.inkSoft }}>{p.body}</Text> : null}
          <Text style={{ color: colors.muted }}>{p.authorName}</Text>
          {profile.role === "teacher" || profile.isStarosta || profile.rosterId === p.authorRosterId ? (
            <Btn ghost label="Видалити" onPress={() => deleteClassHomework(profile, p.id).then(() => q.reload())} />
          ) : null}
        </Card>
      ))}
      {profile.isStarosta ? (
        <View>
          <H1>Хто може додавати ДЗ</H1>
          {(mates.rows?.students || []).filter((s) => s.id !== profile.rosterId).map((s) => (
            <Card key={s.id}>
              <Text style={{ fontWeight: "800" }}>{s.name}</Text>
              <Btn
                ghost={!s.canPostHw}
                label={s.canPostHw ? "Може додавати" : "Дозволити ДЗ"}
                onPress={() => setStudentPerms(profile, s.id, { canPostHw: !s.canPostHw }).then(() => mates.reload())}
              />
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

export function RewardsBlock({ profile, onDone }) {
  const q = useRows(profile, () => listRewards(profile));
  const names = useRows(profile, () => listRosterNames(profile));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [points, setPoints] = useState("10");
  const [who, setWho] = useState("");
  const [holder, setHolder] = useState("");
  const [office, setOffice] = useState("public");
  const [fund, setFund] = useState("50");
  const isHead = profile.role === "student" && profile.office;
  const rewards = q.rows?.rewards || [];
  return (
    <View>
      <H1>Нагороди</H1>
      <Muted>Бюджет посади не входить у топ і його не можна витратити на себе.</Muted>
      {profile.role === "teacher" ? (
        <Card>
          <Field placeholder="Id учня з картки нижче" value={holder} onChangeText={setHolder} />
          {(names.rows?.students || []).slice(0, 12).map((s) => (
            <Pressable key={s.id} onPress={() => setHolder(s.id)}>
              <Text style={{ color: holder === s.id ? colors.forest : colors.ink, fontWeight: "700" }}>{s.name}</Text>
            </Pressable>
          ))}
          {OFFICES.map((o) => (
            <Pressable key={o.id} onPress={() => setOffice(o.id)}>
              <Text style={{ color: office === o.id ? colors.forest : colors.muted, fontSize: 13 }}>{o.name}</Text>
            </Pressable>
          ))}
          <Btn label="Призначити" disabled={!holder} onPress={() => saveOffice(profile, holder, office).then(() => onDone?.())} />
          <Field placeholder="Додати до бюджету" value={fund} onChangeText={setFund} keyboardType="number-pad" />
          <Btn ghost label="Поповнити бюджет" disabled={!holder} onPress={() => fundOffice(profile, holder, Number(fund)).then(() => onDone?.())} />
        </Card>
      ) : null}
      {isHead ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.forest }}>{officeName(profile.office)}</Text>
          <Text style={{ color: colors.muted }}>Бюджет: {profile.budget}</Text>
          <Field placeholder="Назва діяльності" value={title} onChangeText={setTitle} />
          <Field placeholder="Опис" value={body} onChangeText={setBody} />
          <Field placeholder="Нагорода" value={points} onChangeText={setPoints} keyboardType="number-pad" />
          <Btn
            label="Оголосити"
            disabled={!title.trim() || !body.trim()}
            onPress={() => addReward(profile, { title, body, points: Number(points) }).then(() => { setTitle(""); setBody(""); q.reload(); onDone?.(); }).catch(() => {})}
          />
        </Card>
      ) : null}
      {rewards.map((r) => (
        <Card key={r.id}>
          <Text style={{ color: colors.forest, fontWeight: "800", fontSize: 12 }}>{r.officeName}</Text>
          <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink }}>{r.title}</Text>
          <Text style={{ color: colors.inkSoft }}>{r.body}</Text>
          <Text style={{ fontWeight: "800" }}>Нагорода: {r.points}</Text>
          <Text style={{ color: colors.muted }}>{r.authorName}{r.awardedName ? ` · нараховано ${r.awardedName}` : ""}</Text>
          {isHead && r.authorRosterId === profile.rosterId && !r.awardedRosterId ? (
            <View>
              {(names.rows?.students || []).filter((s) => s.id !== profile.rosterId).slice(0, 20).map((s) => (
                <Pressable key={s.id} onPress={() => setWho(s.id)}>
                  <Text style={{ color: who === s.id ? colors.forest : colors.ink }}>{s.name}</Text>
                </Pressable>
              ))}
              <Btn label="Нарахувати" disabled={!who} onPress={() => awardReward(profile, r.id, who).then(() => q.reload())} />
            </View>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
