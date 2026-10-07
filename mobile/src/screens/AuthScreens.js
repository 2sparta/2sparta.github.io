import { useEffect, useState } from "react";
import { Text } from "react-native";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { chooseRole, completeSetup, joinSchool, linkParent, linkStudent, listSubjects } from "../lib/api";
import { Btn, Card, Field, H1, Muted, Screen, colors, errText } from "../ui";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Класний простір</H1>
      <Muted>Той самий акаунт, що й на сайті.</Muted>
      <Card>
        <Field autoCapitalize="none" keyboardType="email-address" placeholder="Пошта" value={email} onChangeText={setEmail} />
        <Field secureTextEntry placeholder="Пароль" value={password} onChangeText={setPassword} />
        {error ? <Text style={{ color: colors.terra, marginBottom: 8 }}>{error}</Text> : null}
        <Btn label={busy ? "…" : mode === "login" ? "Увійти" : "Створити акаунт"} disabled={busy || !email || !password} onPress={submit} />
        <Btn
          ghost
          label={mode === "login" ? "Немає акаунта? Реєстрація" : "Вже є акаунт? Увійти"}
          onPress={() => setMode(mode === "login" ? "register" : "login")}
        />
      </Card>
    </Screen>
  );
}

export function RoleScreen({ onDone }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function pick(role) {
    setError("");
    try {
      onDone(await chooseRole(role, name));
    } catch (e) {
      setError(errText(e));
    }
  }
  return (
    <Screen>
      <H1>Хто ви?</H1>
      <Muted>Це лише для нового акаунта. Далі школа прив'язується кодом.</Muted>
      <Field placeholder="Ім'я та прізвище" value={name} onChangeText={setName} />
      {error ? <Text style={{ color: colors.terra }}>{error}</Text> : null}
      <Btn label="Я учень" onPress={() => pick("student")} />
      <Btn ghost label="Я вчитель" onPress={() => pick("teacher")} />
      <Btn ghost label="Я батько або мати" onPress={() => pick("parent")} />
    </Screen>
  );
}

export function LinkScreen({ profile, onDone }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setError("");
    try {
      onDone(await (profile?.role === "parent" ? linkParent(code) : linkStudent(code)));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <H1>{profile?.role === "parent" ? "Код дитини" : "Код учня"}</H1>
      <Muted>{profile?.role === "parent" ? "Код дитини від класного керівника. Акаунт учня не займається." : "Код дає класний керівник. Той самий, що на сайті."}</Muted>
      <Field placeholder="Код" value={code} onChangeText={setCode} keyboardType="number-pad" />
      {error ? <Text style={{ color: colors.terra, marginBottom: 8 }}>{error}</Text> : null}
      <Btn label={busy ? "…" : "Приєднатися"} disabled={busy || !code.trim()} onPress={go} />
    </Screen>
  );
}

export function JoinSchoolScreen({ profile, onDone }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setError("");
    try {
      onDone(await joinSchool(code, profile.displayName));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <H1>Код школи</H1>
      <Muted>Код-запрошення від адміністратора. Нову школу зручніше створити на сайті.</Muted>
      <Field autoCapitalize="characters" placeholder="Код" value={code} onChangeText={setCode} />
      {error ? <Text style={{ color: colors.terra, marginBottom: 8 }}>{error}</Text> : null}
      <Btn label={busy ? "…" : "Приєднатися"} disabled={busy || !code.trim()} onPress={go} />
    </Screen>
  );
}

export function SetupScreen({ profile, onDone }) {
  const [name, setName] = useState(profile.displayName || "");
  const [admin, setAdmin] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    listSubjects(profile)
      .then((rows) => {
        if (live) {
          setSubjects(rows);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setError(errText(e));
      });
    return () => {
      live = false;
    };
  }, [profile]);

  function toggle(id) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setError("");
    try {
      onDone(await completeSetup(profile, { displayName: name, isAdmin: admin, subjectIds: admin ? [] : picked }));
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <Screen>
      <H1>Профіль учителя</H1>
      <Field placeholder="Ім'я" value={name} onChangeText={setName} />
      <Btn ghost label={admin ? "Адміністратор" : "Звичайний учитель"} onPress={() => setAdmin((v) => !v)} />
      {!admin &&
        subjects.map((s) => (
          <Btn key={s.id} ghost label={`${picked.includes(s.id) ? "✓ " : ""}${s.name}`} onPress={() => toggle(s.id)} />
        ))}
      {error ? <Text style={{ color: colors.terra, marginVertical: 8 }}>{error}</Text> : null}
      <Btn label="Продовжити" onPress={save} />
    </Screen>
  );
}
