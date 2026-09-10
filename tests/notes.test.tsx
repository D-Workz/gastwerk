import { act, render, screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineNote } from "../apps/web/src/features/waiter/order/InlineNote";
import { expect, it, vi } from "vitest";
import { useNotes } from "../apps/web/src/features/waiter/order/useNotes";
import { useMutation } from "../apps/web/src/shared/api/useMutation";
import { messages } from "../apps/web/src/shared/i18n/i18n";
import { productSchema, type Line } from "../packages/contracts/src/index";

const line: Line = {
  orderId: "order",
  tableId: "t1",
  createdBy: "waiter",
  changedBy: "waiter",
  createdAt: "2026-09-08T12:00:00Z",
  updatedAt: "2026-09-08T12:00:00Z",
  reason: null,
  replacementOf: null,
  snapshot: {
    product: productSchema.parse({
      id: "apple",
      name: { de: "Apfel", en: "Apple" },
      category: "drinks",
      price: "4",
      station: "bar",
      recipe: {},
    }),
    ingredients: [],
    resolved: {},
    unitPrice: "4.00",
    allergens: [],
    incompleteAllergens: false,
    referenceCost: null,
    policyVersion: 1,
    pricingPolicy: {
      rounding: "half-up",
      additionPricing: "per-portion",
      removalPricing: "no-refund",
    },
  },
  id: "line",
  version: 3,
  state: "draft",
  input: {
    productId: "apple",
    quantity: 1,
    choices: { style: "pure" },
    edits: [],
    note: "",
  },
};

it("flush waits for an in-flight note and retains text after failure", async () => {
  let complete!: (ok: boolean) => void;
  const mutate = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        complete = resolve;
      }),
  );
  const { result } = renderHook(() => useNotes(mutate));
  act(() => result.current.edit(line, "No ice"));
  let save!: Promise<boolean>;
  let flush!: Promise<boolean>;
  act(() => {
    save = result.current.save(line.id);
    flush = result.current.flush();
  });
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(result.current.entries.line?.status).toBe("saving");
  await act(async () => {
    complete(false);
    await save;
    expect(await flush).toBe(false);
  });
  expect(result.current.entries.line?.text).toBe("No ice");
  expect(result.current.entries.line?.status).toBe("error");
  act(() => {
    save = result.current.save(line.id);
  });
  await act(async () => {
    complete(true);
    expect(await save).toBe(true);
  });
  expect(result.current.hasPending()).toBe(false);
});

it("never silently amends a submitted note on navigation", async () => {
  const mutate = vi.fn().mockResolvedValue(true);
  const { result } = renderHook(() => useNotes(mutate));
  act(() =>
    result.current.edit({ ...line, state: "submitted" }, "Explicit amendment"),
  );
  expect(await result.current.flush()).toBe(false);
  expect(mutate).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.save(line.id);
  });
  expect(mutate).toHaveBeenCalledWith("/lines/line/edit", {
    version: 3,
    input: { ...line.input, note: "Explicit amendment" },
  });
});

it("queues rapid intentional mutations and retries a lost response with the same key", async () => {
  sessionStorage.clear();
  const requests: { key: string; body: string }[] = [];
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      requests.push({
        key: (options.headers as Record<string, string>)["Idempotency-Key"]!,
        body: String(options.body),
      });
      if (fail) {
        fail = false;
        throw new Error("lost");
      }
      return { ok: true, json: async () => ({ id: "line" }) };
    }),
  );
  const { result } = renderHook(() =>
    useMutation(
      "waiter",
      async () => {},
      () => {},
      () => {},
      (key) => messages.en[key],
    ),
  );
  let first!: Promise<boolean>;
  let second!: Promise<boolean>;
  await act(async () => {
    first = result.current.mutate("/lines/line/repeat", { input: line.input });
    second = result.current.mutate("/lines/line/repeat", { input: line.input });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(requests).toHaveLength(1);
  expect(result.current.pending).not.toBeNull();
  await act(async () => {
    await result.current.retry();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });
  expect(requests).toHaveLength(3);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[2]!.key).not.toBe(requests[1]!.key);
});

it("retains entered text when preparation starts during a submitted note edit", async () => {
  const mutate = vi.fn().mockResolvedValue(false);
  function Note({ current }: { current: Line }) {
    const notes = useNotes(mutate);
    return (
      <InlineNote line={current} notes={notes} t={(key) => messages.en[key]} />
    );
  }
  const { rerender } = render(
    <Note current={{ ...line, state: "submitted" }} />,
  );
  await userEvent.click(screen.getByRole("button", { name: /^Note:/ }));
  await userEvent.type(screen.getByRole("textbox"), "Retain this note");
  rerender(<Note current={{ ...line, state: "preparing", version: 4 }} />);
  expect(screen.getByRole("textbox")).toHaveValue("Retain this note");
  expect(screen.getByText(messages.en.retainNoteHelp)).toBeVisible();
  expect(mutate).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.en.discardNote }),
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
