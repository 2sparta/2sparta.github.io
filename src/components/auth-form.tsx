import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { STRINGS, type Lang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { AuthCard, AuthLayout, Field, PrimaryButton, SecondaryButton } from "./auth-layout";

export function AuthForm({ role }: { role: "teacher" | "student" }) {
  const { lang } = usePrefs();
  const t = STRINGS[lang];
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const callbackURL = role === "teacher" ? "/onboarding/school" : "/onboarding/link";

  async function afterAuth() {
    try {
      sessionStorage.setItem("kp-intended-role", role);
    } catch {
      /* ignore */
    }
    await navigate({ to: "/onboarding/role" });
  }

  async function onLogin() {
    setError("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) {
        setError(mapAuthError(err.message ?? "", lang));
        return;
      }
      await afterAuth();
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : "", lang));
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setError("");
    if (password.length < 8) {
      setError(t.weakPassword);
      return;
    }
    setBusy(true);
    try {
      const name = email.split("@")[0] || "User";
      const { error: err } = await authClient.signUp.email({ email, password, name });
      if (err) {
        setError(mapAuthError(err.message ?? "", lang));
        return;
      }
      await afterAuth();
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : "", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant={role === "student" ? "forest" : "cream"}>
      <AuthCard>
        <h1 className="mb-5 text-center font-display text-[clamp(22px,3vw,28px)] font-extrabold tracking-tight text-ink">
          {role === "teacher" ? t.teacherAuthTitle : t.studentAuthTitle}
        </h1>
        <Field
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" strokeWidth="2" />
              <path d="M5 7l7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          type="email"
          autoComplete="username"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
          type="password"
          autoComplete="current-password"
          placeholder={t.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PrimaryButton type="button" disabled={busy} onClick={onLogin}>
          {t.loginBtn}
        </PrimaryButton>
        <SecondaryButton type="button" disabled={busy} onClick={onRegister}>
          {t.registerBtn}
        </SecondaryButton>
        {role === "teacher" && (
          <p className="mt-3 text-center text-[12.5px] leading-relaxed text-muted">{t.teacherHint}</p>
        )}
        {error && <p className="mt-2 text-center text-sm text-terracotta">{error}</p>}
        <p className="mt-3 text-center text-sm text-muted">
          {role === "teacher" ? (
            <Link to="/student" className="font-extrabold text-forest-mid no-underline hover:underline">
              {t.studentLink}
            </Link>
          ) : (
            <Link to="/login" className="font-extrabold text-forest-mid no-underline hover:underline">
              {t.teacherLink}
            </Link>
          )}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-xs text-muted">{t.orContinue}</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
        <div className="mt-3 grid gap-2">
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem("kp-intended-role", role);
                } catch {
                  /* ignore */
                }
                void signIn(p.providerId, { callbackURL });
              }}
              className="h-11 rounded-full border border-forest/20 bg-white/50 font-display text-sm font-bold text-ink hover:bg-white"
            >
              {p.providerId.includes("google") ? t.continueGoogle : t.continueX}
            </button>
          ))}
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

function mapAuthError(msg: string | undefined, lang: Lang) {
  const t = STRINGS[lang];
  const m = (msg ?? "").toLowerCase();
  if (m.includes("already") || m.includes("exists")) return t.emailInUse;
  if (m.includes("password") && m.includes("8")) return t.weakPassword;
  return t.authError;
}
