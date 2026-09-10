/** Login form state and errors; authentication transport belongs to useSession. */
import { useState } from "react";
import { Field } from "../../../../packages/ui/src/index";
import { errorMessage } from "../shared/i18n/errors";
import type { T } from "../shared/i18n/i18n";
import type { Credentials } from "./useSession";

type Props = { login: (credentials: Credentials) => Promise<void>; t: T };

export function LoginScreen({ login, t }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login panel">
      <small>GASTWERK / 01</small>
      <h1>{t("signIn")}</h1>
      <p>{t("demo")}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          void login({
            username: String(data.get("username")),
            password: String(data.get("password")),
          })
            .catch((failure: unknown) => setError(errorMessage(failure, t)))
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
  );
}
