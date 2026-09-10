/** App composition contracts; feature internals have their own component/browser tests. */
import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../apps/web/src/app/App";
import { api, ApiError, type AppState } from "../apps/web/src/shared/api/api";
import { defaultPolicy } from "../packages/config/src/index";

const guard = vi.hoisted(() => ({ allow: true }));
vi.mock("../apps/web/src/features/waiter", () => ({
  Service: function Service({
    registerGuard,
  }: {
    registerGuard: (guard: (() => Promise<boolean>) | null) => void;
  }) {
    useEffect(() => {
      registerGuard(async () => guard.allow);
      return () => registerGuard(null);
    }, [registerGuard]);
    return <p>Waiter workspace fixture</p>;
  },
}));
vi.mock("../apps/web/src/shared/api/api", async (original) => ({
  ...(await original<typeof import("../apps/web/src/shared/api/api")>()),
  api: vi.fn(),
}));
const request = vi.mocked(api);
const state: AppState = {
  user: {
    id: "manager",
    username: "manager",
    role: "manager",
    preferences: { ...defaultPolicy.display, language: "en" },
  },
  configuration: { version: 1, policy: defaultPolicy },
  ingredients: [],
  products: [],
  tables: [],
  lines: [],
  orders: [],
  balances: {},
  history: [
    {
      id: "h",
      lineId: null,
      actor: "manager",
      action: "Fixture audit action",
      at: "2026-09-10T12:00:00Z",
      detail: {},
    },
  ],
};

afterEach(() => {
  vi.resetAllMocks();
  guard.allow = true;
  sessionStorage.clear();
});

it("displays a failed login, then applies the authenticated language and role", async () => {
  request.mockRejectedValueOnce(new ApiError("no session", 401));
  render(<App />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("/me"));
  request.mockRejectedValueOnce(new ApiError("invalid", 401));
  fireEvent.change(screen.getByLabelText("Passwort"), {
    target: { value: "wrong" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Anmelden" }).closest("form")!,
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Vorgang fehlgeschlagen",
    ),
  );
  const bar = { ...state.user, role: "bar" as const };
  request
    .mockResolvedValueOnce(bar)
    .mockResolvedValueOnce({ ...state, user: bar });
  fireEvent.submit(
    screen.getByRole("button", { name: "Anmelden" }).closest("form")!,
  );
  await screen.findByRole("heading", { name: "Bar" });
  expect(document.documentElement.lang).toBe("en");
  expect(
    screen.getAllByRole("region", { name: "Project source" }),
  ).toHaveLength(1);
});

it("honors the waiter guard for view changes and logout, and keeps the selected view after refresh", async () => {
  request.mockImplementation(async (path) =>
    path === "/me" ? state.user : state,
  );
  render(<App />);
  await screen.findByText("Waiter workspace fixture");
  guard.allow = false;
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(screen.getByText("Waiter workspace fixture")).toBeVisible(),
  );
  expect(request.mock.calls.some(([path]) => path === "/logout")).toBe(false);
  guard.allow = true;
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  await screen.findByText(/Fixture audit action/);
  fireEvent.focus(window);
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "History" })).toBeVisible(),
  );
  expect(screen.getByRole("button", { name: "History" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("heading", { name: "Sign in" });
});

it("keeps a failed logout in the authenticated screen with a visible error", async () => {
  request.mockImplementation(async (path) => {
    if (path === "/logout") throw new ApiError("offline", 0);
    return path === "/me" ? state.user : state;
  });
  render(<App />);
  await screen.findByText("Waiter workspace fixture");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Connection failed"),
  );
  expect(screen.getByText("Waiter workspace fixture")).toBeVisible();
});

it("retries a lost preference acknowledgement with the same key and refreshes the shared user", async () => {
  let failed = false;
  let current = state;
  request.mockImplementation(async (path, body) => {
    if (path === "/me") return state.user;
    if (path === "/preferences") {
      if (!failed) {
        failed = true;
        throw new ApiError("lost response", 0);
      }
      current = {
        ...state,
        user: {
          ...state.user,
          preferences: body as typeof state.user.preferences,
        },
      };
      return {};
    }
    return current;
  });
  render(<App />);
  await screen.findByText("Waiter workspace fixture");
  fireEvent.change(screen.getByLabelText("Sprache / Language"), {
    target: { value: "de" },
  });
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Retry");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.documentElement.lang).toBe("de");
  const attempts = request.mock.calls.filter(
    ([path]) => path === "/preferences",
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[0]?.[2]).toBeTruthy();
  expect(attempts[0]?.[2]).toBe(attempts[1]?.[2]);
});
