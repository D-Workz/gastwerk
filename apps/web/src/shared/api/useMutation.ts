/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { errorMessage } from "../i18n/errors";
import type { T } from "../i18n/i18n";
import { api, ApiError, type MutationResult } from "./api";

/* --- Public API --- */

const operationSchema = z.object({
  path: z.string().startsWith("/"),
  body: z.unknown(),
  key: z.string().uuid(),
});
type Operation = z.infer<typeof operationSchema>;

/** A retry resolves the original caller, so a customized item cannot be added twice after a lost response. */
export function useMutation(
  userId: string | undefined,
  refresh: () => Promise<void>,
  onError: (message: string) => void,
  onDisconnected: () => void,
  t: T,
) {
  const [pending, setPending] = useState<Operation | null>(null),
    [busy, setBusy] = useState(false);
  /**
   * callbacks - brief description
   * @param useRef(new -
   * @param (result -
   * @returns
   */
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
  /**
   * retain - brief description
   * @param operation -
   * @returns
   */
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
   * execute - brief description
   * @param operation -
   * @returns
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

   * mutate - brief description

   * @param path -

   * @param body -

   * @param onSuccess? -

   * @returns

   */

  function mutate(
    path: string,
    body: unknown,
    onSuccess?: (result: MutationResult) => void,
  ): Promise<boolean> {
    /**
     * next - brief description
     * @param queue.current.then(() -
     * @returns
     */
    const next = queue.current.then(() => runMutation(path, body, onSuccess));
    queue.current = next.catch(() => false);
    return next;
  }

  /**

   * runMutation - brief description

   * @param path -

   * @param body -

   * @param onSuccess? -

   * @returns

   */

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
    return new Promise<boolean>((resolve) => {
      resolvePending.current = resolve;
    });
  }
  /**
   * retry - brief description
   * @returns
   */
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
