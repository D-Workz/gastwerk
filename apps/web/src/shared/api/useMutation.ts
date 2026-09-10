/**
 * Mutation queue and retry state shared by the browser features through App.
 * This hook calls api, refreshes application state, and stores an unacknowledged
 * operation in per-user sessionStorage so Retry can reuse its request key.
 */
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { errorMessage } from "../i18n/errors";
import type { T } from "../i18n/i18n";
import { api, ApiError, type MutationResult } from "./api";

const operationSchema = z.object({
  path: z.string().startsWith("/"),
  body: z.unknown(),
  key: z.string().uuid(),
});
type Operation = z.infer<typeof operationSchema>;

/**
 * An unacknowledged mutation keeps its caller pending until Retry gets a final
 * result. The same request key is reused; server handling owns deduplication.
 * Restored sessionStorage operations do not restore callbacks across a reload.
 */
export function useMutation(
  userId: string | undefined,
  refresh: () => Promise<void>,
  onError: (message: string) => void,
  onDisconnected: () => void,
  t: T,
) {
  const [pending, setPending] = useState<Operation | null>(null),
    [busy, setBusy] = useState(false);

  const callbacks = useRef(new Map<string, (result: MutationResult) => void>());
  const pendingRef = useRef<Operation | null>(null);
  const lock = useRef(false),
    resolvePending = useRef<((ok: boolean) => void) | null>(null);
  const storageKey = userId ? "venue-retry:" + userId : null;
  useEffect(() => {
    setPending(null);
    pendingRef.current = null;
    if (!storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        pendingRef.current = operationSchema.parse(JSON.parse(raw));
        setPending(pendingRef.current);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  function retain(operation: Operation | null) {
    pendingRef.current = operation;
    setPending(operation);
    if (storageKey) {
      if (operation)
        sessionStorage.setItem(storageKey, JSON.stringify(operation));
      else sessionStorage.removeItem(storageKey);
    }
  }

  /**
   * Return null for a retained transport/5xx failure, leaving resolution to Retry.
   * Other handled failures refresh state and return false.
   */
  async function execute(operation: Operation): Promise<boolean | null> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    onError("");
    try {
      const response = await api<MutationResult>(
        operation.path,
        operation.body,
        operation.key,
      );
      retain(null);
      await refresh();
      callbacks.current.get(operation.key)?.(response);
      callbacks.current.delete(operation.key);
      return true;
    } catch (e) {
      onError(errorMessage(e, t));
      if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
        retain(operation);
        onDisconnected();
        return null;
      }
      retain(null);
      callbacks.current.delete(operation.key);
      await refresh();
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /**
   * Queue intentional actions so an earlier pending retry holds later actions.
   */
  function mutate(
    path: string,
    body: unknown,
    onSuccess?: (result: MutationResult) => void,
  ): Promise<boolean> {
    // Recover the queue tail after rejection without hiding rejection from this caller.
    const next = queue.current.then(() => runMutation(path, body, onSuccess));
    queue.current = next.catch(() => false);
    return next;
  }

  async function runMutation(
    path: string,
    body: unknown,
    onSuccess?: (result: MutationResult) => void,
  ): Promise<boolean> {
    if (pendingRef.current || lock.current) return false;
    const key = crypto.randomUUID();
    if (onSuccess) callbacks.current.set(key, onSuccess);
    const result = await execute({ path, body, key });
    if (result !== null) return result;
    // Suspend this queue entry until retry resolves the retained operation.
    return new Promise<boolean>((resolve) => {
      resolvePending.current = resolve;
    });
  }

  /** Retry the stored operation, preserving its key and any still-mounted caller. */
  async function retry() {
    if (!pending || lock.current) return;
    const result = await execute(pending);
    if (result !== null) {
      resolvePending.current?.(result);
      resolvePending.current = null;
    }
  }

  return { mutate, pending, busy, retry };
}
