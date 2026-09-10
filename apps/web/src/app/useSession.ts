/** Own authentication and its server snapshot together, avoiding competing user states. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../../../../packages/contracts/src/index";
import { api, ApiError, type AppState } from "../shared/api/api";
import { usePolling } from "./usePolling";

type Session = { snapshot: null; user: User } | { snapshot: AppState };
export type Credentials = { username: string; password: string };

/**
 * onAuthenticated initializes presentation preferences after restore/login only.
 * Keep it stable. Polls update the user from the snapshot without resetting views.
 * A session generation prevents old requests restoring state after logout/unmount.
 */
export function useSession(onAuthenticated: (user: User) => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const generation = useRef(0);
  const user = session
    ? session.snapshot === null
      ? session.user
      : session.snapshot.user
    : null;
  const state = session?.snapshot ?? null;

  const refresh = useCallback(async () => {
    const current = generation.current;
    try {
      const snapshot = await api<AppState>("/state");
      if (current !== generation.current) return;
      setSession({ snapshot });
      setConnected(true);
    } catch (error) {
      if (current !== generation.current) return;
      setConnected(false);
      // Preserve displayed data on transient errors; an expired session clears it.
      if (error instanceof ApiError && error.status === 401) {
        generation.current++;
        setSession(null);
      }
    }
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    void api<User>("/me")
      .then((restored) => {
        if (current !== generation.current) return;
        setSession({ snapshot: null, user: restored });
        onAuthenticated(restored);
        void refresh();
      })
      .catch(() => {
        // As before, an unavailable initial session leaves the login screen visible.
      });
    return () => {
      generation.current++;
    };
  }, [onAuthenticated, refresh]);

  usePolling(Boolean(user), refresh);

  async function login(credentials: Credentials) {
    const current = ++generation.current;
    const authenticated = await api<User>("/login", credentials);
    if (current !== generation.current) return;
    setSession({ snapshot: null, user: authenticated });
    onAuthenticated(authenticated);
    await refresh();
  }

  async function logout() {
    const current = generation.current;
    await api("/logout", {});
    if (current !== generation.current) return;
    generation.current++;
    setSession(null);
    setConnected(false);
  }

  return {
    user,
    state,
    connected,
    refresh,
    login,
    logout,
    markDisconnected: () => setConnected(false),
  };
}
