/** Schedule refreshes only while authenticated; the session owner handles responses. */
import { useEffect } from "react";

export function usePolling(enabled: boolean, refresh: () => Promise<void>) {
  useEffect(() => {
    if (!enabled) return;
    const poll = () => void refresh();
    const interval = setInterval(poll, 2000);
    window.addEventListener("online", poll);
    window.addEventListener("focus", poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", poll);
      window.removeEventListener("focus", poll);
    };
  }, [enabled, refresh]);
}
