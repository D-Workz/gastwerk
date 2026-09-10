/**
 * Browser application shell, mounted by main.tsx. App restores the session,
 * polls server state, and composes waiter, manager, and preparation views.
 * It owns language preferences, guarded navigation, and shared mutation retries.
 */
import { unitLabel } from "../shared/i18n/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  label,
  type Preferences,
  type User,
} from "../../../../packages/contracts/src/index";
import { Field, Modal } from "../../../../packages/ui/src/index";
import { ApiError, api, type AppState } from "../shared/api/api";
import {
  date,
  euro,
  quantity as formatQuantity,
  messages,
  type Language,
  type T,
} from "../shared/i18n/i18n";
import { Manager } from "../features/manager";
import { Service } from "../features/waiter";
import { Station } from "../features/preparation";
import { errorMessage } from "../shared/i18n/errors";
import { useMutation } from "../shared/api/useMutation";

export function App() {
  const navigationGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerGuard = useCallback(
    (guard: (() => Promise<boolean>) | null) => {
      navigationGuard.current = guard;
    },
    [],
  );
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [language, setLanguage] = useState<Language>("de");
  const [view, setView] = useState("service");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const t: T = (key) => messages[language][key];

  const refresh = useCallback(async () => {
    try {
      const next = await api<AppState>("/state");
      setState(next);
      setUser(next.user);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setState(null);
      }
    }
  }, []);
  useEffect(() => {
    void api<User>("/me")
      .then((u) => {
        setUser(u);
        setLanguage(u.preferences.language);
        setView(u.role === "kitchen" || u.role === "bar" ? u.role : "service");
        void refresh();
      })
      .catch(() => {});
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => void refresh(), 2000);

    const online = () => void refresh();

    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", online);
    };
  }, [Boolean(user), refresh]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const {
    mutate,
    pending,
    busy: mutationBusy,
    retry,
  } = useMutation(user?.id, refresh, setError, () => setConnected(false), t);

  function preferences(p: Preferences) {
    void mutate("/preferences", p).then((ok) => {
      if (ok) setLanguage(p.language);
    });
  }

  const prefs = state?.user.preferences;
  return (
    <>
      <header className="app-header">
        <a className="brand" href="/">
          {state?.configuration.policy.branding ?? "Gastwerk"}
          <small>RESTAURANT OPERATIONS</small>
        </a>
        <div className="row">
          <select
            aria-label="Sprache / Language"
            value={language}
            onChange={(e) => {
              const next = e.target.value as Language;
              if (prefs) preferences({ ...prefs, language: next });
              else setLanguage(next);
            }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          {user && (
            <>
              <span>
                {user.username} · {t(user.role)}
              </span>
              <button
                onClick={async () => {
                  if (
                    navigationGuard.current &&
                    !(await navigationGuard.current())
                  )
                    return;
                  void api("/logout", {}).then(() => {
                    setUser(null);
                    setState(null);
                  });
                }}
              >
                {t("signOut")}
              </button>
            </>
          )}
        </div>
      </header>
      {!user ? (
        <main className="login panel">
          <small>GASTWERK / 01</small>
          <h1>{t("signIn")}</h1>
          <p>{t("demo")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              void api<User>("/login", Object.fromEntries(data))
                .then((u) => {
                  setUser(u);
                  setLanguage(u.preferences.language);
                  setView(
                    u.role === "kitchen" || u.role === "bar"
                      ? u.role
                      : "service",
                  );
                  return refresh();
                })
                .catch((e: Error) => setError(errorMessage(e, t)))
                .finally(() => setBusy(false));
            }}
          >
            <Field label={t("username")}>
              <input
                name="username"
                autoComplete="username"
                required
                defaultValue="waiter"
              />
            </Field>
            <Field label={t("password")}>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <button className="primary" disabled={busy}>
              {busy ? t("loading") : t("signIn")}
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <small>manager · waiter · kitchen · bar</small>
        </main>
      ) : (
        <main className={prefs?.density ?? "comfortable"}>
          <div
            role="status"
            className={`connection ${connected ? "online" : "offline"}`}
          >
            {t(connected ? "connected" : "disconnected")}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {pending && (
            <Modal title={t("retry")} onClose={() => {}}>
              <p className="warning">{t("pending")}</p>
              <button disabled={mutationBusy} onClick={() => void retry()}>
                {t("retry")}
              </button>
            </Modal>
          )}
          <nav className="main-nav">
            {(user.role === "manager"
              ? ["service", "kitchen", "bar", "manager", "history"]
              : user.role === "waiter"
                ? ["service"]
                : [user.role]
            ).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={async () => {
                  if (
                    !navigationGuard.current ||
                    (await navigationGuard.current())
                  )
                    setView(v);
                }}
              >
                {t(v as keyof typeof messages.en)}
              </button>
            ))}
            {prefs && (
              <select
                aria-label={t("comfortable")}
                value={prefs.density}
                onChange={(e) =>
                  preferences({
                    ...prefs,
                    density: e.target.value as Preferences["density"],
                  })
                }
              >
                <option value="comfortable">{t("comfortable")}</option>
                <option value="compact">{t("compact")}</option>
              </select>
            )}
          </nav>
          {state && prefs ? (
            <>
              <div className="stock-warnings">
                {state.ingredients
                  .filter(
                    (i) =>
                      Number(state.balances[i.id] ?? 0) < 0 ||
                      (i.threshold !== null &&
                        Number(state.balances[i.id] ?? 0) <
                          Number(i.threshold)),
                  )
                  .map((i) => (
                    <p key={i.id} className="warning">
                      {t(
                        Number(state.balances[i.id] ?? 0) < 0
                          ? "negative"
                          : "low",
                      )}
                      : {label(i.name, language)}{" "}
                      {formatQuantity(state.balances[i.id] ?? "0", language)}{" "}
                      {unitLabel(i.unit, language)}. {t("stockWarning")}
                    </p>
                  ))}
              </div>
              {view === "service" && (
                <Service
                  state={state}
                  language={language}
                  t={t}
                  mutate={mutate}
                  preferences={prefs}
                  setPreferences={preferences}
                  registerGuard={registerGuard}
                />
              )}{" "}
              {(view === "kitchen" || view === "bar") && (
                <Station
                  state={state}
                  station={view}
                  language={language}
                  t={t}
                  mutate={mutate}
                />
              )}{" "}
              {view === "manager" && (
                <Manager
                  state={state}
                  language={language}
                  t={t}
                  mutate={mutate}
                />
              )}{" "}
              {view === "history" && (
                <section className="panel">
                  <h2>{t("history")}</h2>
                  {state.orders
                    .filter((o) => o.closedAt)
                    .map((o) => (
                      <details key={o.id}>
                        <summary>
                          {t("table")}{" "}
                          {state.tables.find((t) => t.id === o.tableId)?.number}{" "}
                          · {date(o.closedAt!, language)} ·{" "}
                          {euro(o.total, language)}
                        </summary>
                        {state.lines
                          .filter((l) => l.orderId === o.id)
                          .map((l) => (
                            <p key={l.id}>
                              {l.input.quantity} ×{" "}
                              {label(l.snapshot.product.name, language)} ·{" "}
                              {t(l.state)} · {l.input.note}
                            </p>
                          ))}
                      </details>
                    ))}
                  {state.history.map((h) => (
                    <details key={h.id}>
                      <summary>
                        {date(h.at, language)} · {h.action} · {h.actor}
                      </summary>
                      <pre>{JSON.stringify(h.detail, null, 2)}</pre>
                    </details>
                  ))}
                </section>
              )}
            </>
          ) : (
            <p>{t("loading")}</p>
          )}
        </main>
      )}
    </>
  );
}
