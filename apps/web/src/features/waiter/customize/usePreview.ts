/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { useEffect, useState } from "react";
import type {
  Customization,
  Snapshot,
} from "../../../../../../packages/contracts/src/index";
import { errorMessage } from "../../../shared/i18n/errors";
import type { T } from "../../../shared/i18n/i18n";
import { previewCustomization } from "./api";

/* --- Public API --- */


/** Ignore stale responses after an edit or unmount; only the latest preview enables Save. */
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
    /**
     * timeout - brief description
     * @param setTimeout(() -
     * @returns
     */
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
