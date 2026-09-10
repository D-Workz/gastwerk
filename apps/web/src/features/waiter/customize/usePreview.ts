/**
 * Preview state for the waiter customization flow. Customizer uses this hook to
 * display server-calculated prices and ingredients before confirming an item.
 * Requests go through the feature's api.ts; this hook owns debounce timing,
 * stale-response handling, and the loading/error/retry state consumed by the UI.
 */
import { useEffect, useState } from "react";
import type {
  Customization,
  Snapshot,
} from "../../../../../../packages/contracts/src/index";
import { errorMessage } from "../../../shared/i18n/errors";
import type { T } from "../../../shared/i18n/i18n";
import { previewCustomization } from "./api";

/**
 * Keep input identity stable between edits and replace the object when editing:
 * loading and snapshot visibility compare the result's input by reference.
 * Retry clears the displayed result and schedules another request.
 */
export function usePreview(
  input: Customization,
  lineId: string | undefined,
  t: T,
) {
  const [result, setResult] = useState<{
    input: Customization;
    snapshot: Snapshot | null;
    error: unknown;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    // Coalesce edits made within the debounce window into one preview request.
    const timeout = setTimeout(() => {
      void previewCustomization(input, lineId)
        .then((snapshot) => {
          if (current) setResult({ input, snapshot, error: null });
        })
        .catch((error: unknown) => {
          if (current) setResult({ input, snapshot: null, error });
        });
    }, 180);

    return () => {
      // Ignore an in-flight response after cleanup; the request itself is not aborted.
      current = false;
      clearTimeout(timeout);
    };
  }, [input, lineId, attempt]);

  const loading = result?.input !== input;

  return {
    snapshot: loading ? null : (result?.snapshot ?? null),
    loading,
    error: !loading && result?.error ? errorMessage(result.error, t) : "",
    retry: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
