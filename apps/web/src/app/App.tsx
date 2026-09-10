/** Compose role views and cross-feature navigation; lifecycle and presentation have dedicated modules. */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Preferences,
  User,
} from "../../../../packages/contracts/src/index";
import { Modal } from "../../../../packages/ui/src/index";
import { messages, type Language, type T } from "../shared/i18n/i18n";
import { errorMessage } from "../shared/i18n/errors";
import { useMutation } from "../shared/api/useMutation";
import { Manager } from "../features/manager";
import { Service } from "../features/waiter";
import { Station } from "../features/preparation";
import { SourceBar } from "./SourceBar";
import { sourceUrl } from "./source";
import { AppHeader } from "./AppHeader";
import { LoginScreen } from "./LoginScreen";
import { HistoryView } from "./HistoryView";
import { StockWarnings } from "./StockWarnings";
import { useSession } from "./useSession";

export function App() {
  const [language, setLanguage] = useState<Language>("de");
  const [view, setView] = useState("service");
  const [error, setError] = useState("");
  const navigationGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerGuard = useCallback(
    (guard: (() => Promise<boolean>) | null) => {
      navigationGuard.current = guard;
    },
    [],
  );
  const onAuthenticated = useCallback((user: User) => {
    setLanguage(user.preferences.language);
    setView(
      user.role === "kitchen" || user.role === "bar" ? user.role : "service",
    );
    setError("");
  }, []);
  const { user, state, connected, refresh, login, logout, markDisconnected } =
    useSession(onAuthenticated);
  const t: T = (key) => messages[language][key];
  const {
    mutate,
    pending,
    busy: mutationBusy,
    retry,
  } = useMutation(user?.id, refresh, setError, markDisconnected, t);
  const prefs = state?.user.preferences;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function preferences(next: Preferences) {
    void mutate("/preferences", next).then((ok) => {
      if (ok) setLanguage(next.language);
    });
  }

  async function canNavigate() {
    return !navigationGuard.current || (await navigationGuard.current());
  }

  async function signOut() {
    if (!(await canNavigate())) return;
    try {
      await logout();
    } catch (failure) {
      setError(errorMessage(failure, t));
    }
  }

  return (
    <>
      <SourceBar appName="Gastwerk" sourceUrl={sourceUrl} />
      <AppHeader
        branding={state?.configuration.policy.branding ?? "Gastwerk"}
        user={user}
        language={language}
        t={t}
        onLanguage={(next) => {
          if (prefs) preferences({ ...prefs, language: next });
          else setLanguage(next);
        }}
        onLogout={() => void signOut()}
      />
      {!user ? (
        <LoginScreen login={login} t={t} />
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
                  if (await canNavigate()) setView(v);
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
              <StockWarnings state={state} language={language} t={t} />
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
                <HistoryView state={state} language={language} t={t} />
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
