/** Session and polling lifecycles with controlled responses; no database needed. */
import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSession } from "../apps/web/src/app/useSession";
import { api, ApiError, type AppState } from "../apps/web/src/shared/api/api";
import { defaultPolicy } from "../packages/config/src/index";
import type { User } from "../packages/contracts/src/index";

vi.mock("../apps/web/src/shared/api/api", async (original) => ({
  ...(await original<typeof import("../apps/web/src/shared/api/api")>()),
  api: vi.fn(),
}));
const request = vi.mocked(api);
const user: User = {
  id: "waiter",
  username: "waiter",
  role: "waiter",
  preferences: defaultPolicy.display,
};
const snapshot: AppState = {
  user,
  ingredients: [],
  products: [],
  tables: [],
  configuration: { version: 1, policy: defaultPolicy },
  orders: [],
  lines: [],
  balances: {},
  history: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("restores a user before the snapshot loads and takes subsequent user data from that snapshot", async () => {
  const loading = deferred<AppState>();
  const authenticated = vi.fn();
  request.mockResolvedValueOnce(user).mockReturnValueOnce(loading.promise);
  const { result } = renderHook(() => useSession(authenticated));
  await waitFor(() => expect(result.current.user).toEqual(user));
  expect(result.current.state).toBeNull();
  expect(result.current.connected).toBe(false);
  const updated = { ...snapshot, user: { ...user, username: "updated" } };
  await act(async () => loading.resolve(updated));
  expect(result.current.user).toBe(result.current.state?.user);
  expect(result.current.user?.username).toBe("updated");
  expect(authenticated).toHaveBeenCalledTimes(1);
});

it("keeps the snapshot on transient failure and clears it on session expiry", async () => {
  const authenticated = vi.fn();
  request.mockResolvedValueOnce(user).mockResolvedValueOnce(snapshot);
  const { result } = renderHook(() => useSession(authenticated));
  await waitFor(() => expect(result.current.connected).toBe(true));
  request.mockRejectedValueOnce(new ApiError("offline", 0));
  await act(async () => result.current.refresh());
  expect(result.current.state).toEqual(snapshot);
  expect(result.current.connected).toBe(false);
  request.mockRejectedValueOnce(new ApiError("expired", 401));
  await act(async () => result.current.refresh());
  expect(result.current.user).toBeNull();
  expect(result.current.state).toBeNull();
});

it("ignores an old poll after logout and a subsequent login", async () => {
  const authenticated = vi.fn();
  request.mockResolvedValueOnce(user).mockResolvedValueOnce(snapshot);
  const { result } = renderHook(() => useSession(authenticated));
  await waitFor(() => expect(result.current.connected).toBe(true));
  const late = deferred<AppState>();
  request.mockReturnValueOnce(late.promise);
  let polling!: Promise<void>;
  act(() => {
    polling = result.current.refresh();
  });
  request.mockResolvedValueOnce({});
  await act(async () => result.current.logout());
  expect(result.current.user).toBeNull();
  const next = { ...user, id: "bar", username: "bar", role: "bar" as const };
  request
    .mockResolvedValueOnce(next)
    .mockResolvedValueOnce({ ...snapshot, user: next });
  await act(async () =>
    result.current.login({ username: "bar", password: "test" }),
  );
  await act(async () => {
    late.resolve(snapshot);
    await polling;
  });
  expect(result.current.user?.id).toBe("bar");
});

it("polls every two seconds and on focus/online, and removes scheduling after logout", async () => {
  vi.useFakeTimers();
  const authenticated = vi.fn();
  request.mockImplementation(async (path) =>
    path === "/me" ? user : snapshot,
  );
  const { result, unmount } = renderHook(() => useSession(authenticated));
  await act(async () => {});
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(request).toHaveBeenCalledTimes(3);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  expect(request).toHaveBeenCalledTimes(5);
  await act(async () => result.current.logout());
  request.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  expect(request).not.toHaveBeenCalled();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores the discarded StrictMode restore and does not initialize after unmount", async () => {
  const first = deferred<User>();
  const second = deferred<User>();
  const authenticated = vi.fn();
  request
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockResolvedValue(snapshot);
  const { result, unmount } = renderHook(() => useSession(authenticated), {
    wrapper: StrictMode,
  });
  await act(async () => second.resolve(user));
  await act(async () => first.resolve({ ...user, id: "obsolete" }));
  expect(result.current.user?.id).toBe(user.id);
  expect(authenticated).toHaveBeenCalledTimes(1);
  unmount();
  const late = deferred<User>();
  request.mockReturnValueOnce(late.promise);
  const afterUnmount = vi.fn();
  const another = renderHook(() => useSession(afterUnmount));
  another.unmount();
  await act(async () => late.resolve(user));
  expect(afterUnmount).not.toHaveBeenCalled();
});
