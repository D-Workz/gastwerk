import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "../apps/api/src/catalog/resolve";
import { Customizer } from "../apps/web/src/features/waiter/customize/Customizer";
import { Service } from "../apps/web/src/features/waiter/Service";
import type { AppState } from "../apps/web/src/shared/api/api";
import { messages } from "../apps/web/src/shared/i18n/i18n";
import { defaultPolicy } from "../packages/config/src/index";
import {
  ingredientSchema,
  productSchema,
} from "../packages/contracts/src/index";

const n = (en: string) => ({ de: en, en });

const ingredients = [
  ingredientSchema.parse({
    id: "onion",
    name: n("Onion"),
    unit: "g",
    allergens: [],
  }),
  ingredientSchema.parse({
    id: "cheese",
    name: n("Cheese"),
    unit: "g",
    allergens: ["milk"],
    portions: [
      { id: "slice", name: n("Slice 20 g"), quantity: "20", surcharge: "1" },
    ],
  }),
  ingredientSchema.parse({ id: "pickle", name: n("Pickle"), unit: "g" }),
];
const burger = productSchema.parse({
  id: "burger",
  name: n("Burger"),
  category: "food",
  price: "10",
  station: "kitchen",
  recipe: { onion: "20" },
  quick: ["cheese"],
});
const juice = productSchema.parse({
  ...burger,
  id: "juice",
  name: n("Juice"),
  guided: true,
  groups: [
    {
      id: "style",
      name: n("Style"),
      required: true,
      choices: [{ id: "pure", name: n("Pure"), effects: [] }],
    },
  ],
});
const state: AppState = {
  user: {
    id: "waiter",
    username: "waiter",
    role: "waiter",
    preferences: defaultPolicy.display,
  },
  ingredients: ingredients.map((i) => ({ ...i, version: 1 })),
  products: [burger, juice].map((p) => ({ ...p, version: 1 })),
  tables: [
    {
      id: "t1",
      number: "1",
      area: "Room",
      x: 10,
      y: 10,
      active: true,
      version: 1,
    },
  ],
  configuration: { policy: defaultPolicy, version: 1 },
  lines: [],
  orders: [],
  balances: {},
  history: [],
};

const t = (key: keyof typeof messages.en) => messages.en[key];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      const { input } = JSON.parse(String(options.body));
      try {
        return {
          ok: true,
          json: async () =>
            resolve(
              input.productId === "juice" ? juice : burger,
              ingredients,
              input,
              defaultPolicy,
              1,
            ),
        };
      } catch (e) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ message: (e as Error).message }),
        };
      }
    }),
  );
});
describe("waiter interactions", () => {
  it("removes/restores ingredients, adds a portion and advanced quantity, saves notes", async () => {
    const mutate = vi.fn().mockResolvedValue(true);
    render(
      <Customizer
        product={burger}
        tableId="t1"
        state={state}
        language="en"
        t={t}
        mutate={mutate}
        onClose={() => {}}
      />,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Advanced ingredients" }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Onion Quantity")).toHaveValue(0),
    );
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Onion Quantity")).toHaveValue(20),
    );
    await user.click(screen.getByRole("button", { name: /Slice 20 g/ }));

    await user.type(screen.getByLabelText("Search"), "Pickle");
    await user.clear(screen.getByLabelText("Pickle Quantity"));
    await user.type(screen.getByLabelText("Pickle Quantity"), "15");
    await user.type(screen.getByLabelText("Note"), "Cut in half");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mutate).toHaveBeenCalledWith(
      "/lines",
      expect.objectContaining({
        input: expect.objectContaining({
          note: "Cut in half",
          edits: expect.arrayContaining([
            { ingredientId: "cheese", quantity: "20", portionId: "slice" },
            { ingredientId: "pickle", quantity: "15" },
          ]),
        }),
      }),
      expect.any(Function),
    );
  });
  it("required follow-up blocks confirmation and cancel adds nothing", async () => {
    const mutate = vi.fn(),
      close = vi.fn();
    render(
      <Customizer
        product={juice}
        tableId="t1"
        state={state}
        language="en"
        t={t}
        mutate={mutate}
        onClose={close}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Pure" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Back / cancel" }),
    );
    expect(close).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
  it.each(["list", "tiles"] as const)(
    "Add and Edit share behavior in %s layout",
    async (menu) => {
      const mutate = vi.fn().mockResolvedValue(true);
      render(
        <Service
          state={state}
          language="en"
          t={t}
          mutate={mutate}
          preferences={{ ...defaultPolicy.display, menu }}
          setPreferences={() => {}}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /Table 1/ }));
      await userEvent.click(screen.getByRole("button", { name: "Add Burger" }));
      expect(mutate).toHaveBeenCalledTimes(1);
      await userEvent.click(
        screen.getByRole("button", { name: "Edit Burger" }),
      );
      expect(screen.getByRole("region", { name: "Burger" })).toBeVisible();
      expect(mutate).toHaveBeenCalledTimes(1);
    },
  );
  it("shows failed preview and blocks confirmation while loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(
      <Customizer
        product={burger}
        tableId="t1"
        state={state}
        language="en"
        t={t}
        mutate={vi.fn()}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection failed",
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});

it.each(["de", "en"] as const)(
  "uses sequential size/preparation tiles and retains quantity in %s",
  async (language) => {
    const { ChoiceSteps } =
      await import("../apps/web/src/features/waiter/customize/ChoiceSteps");
    const mutate = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onAdded = vi.fn();
    const sized = productSchema.parse({
      ...juice,
      sizes: [
        {
          id: "small",
          name: { de: "Klein", en: "Small" },
          price: "3",
          recipe: { onion: "10" },
        },
        {
          id: "large",
          name: { de: "Groß", en: "Large" },
          price: "5",
          recipe: { onion: "20" },
        },
      ],
    });
    const translate = (key: keyof typeof messages.en) =>
      messages[language][key];
    render(
      <ChoiceSteps
        product={sized}
        tableId="t1"
        language={language}
        t={translate}
        mutate={mutate}
        onAdded={onAdded}
        onBack={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: translate("increase") }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Small|Klein/ }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pure" }));
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      translate("requestError"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: translate("retry") }),
    );
    expect(mutate).toHaveBeenLastCalledWith(
      "/lines",
      expect.objectContaining({
        input: expect.objectContaining({
          sizeId: "small",
          quantity: 2,
          choices: { style: "pure" },
        }),
      }),
      expect.any(Function),
    );
    expect(onAdded).toHaveBeenCalledTimes(1);
  },
);

it("starts with tables only and preserves menu search through the expanded order", async () => {
  render(
    <Service
      state={state}
      language="en"
      t={t}
      mutate={vi.fn().mockResolvedValue(true)}
      preferences={defaultPolicy.display}
      setPreferences={() => {}}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Add Burger" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Table 1/ }));
  expect(
    screen.queryByRole("button", { name: /Table 1.*Room/ }),
  ).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Search"), "Burger");
  await userEvent.click(screen.getByRole("button", { name: "Order (0)" }));
  expect(screen.getByRole("region", { name: "Order" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Add Burger" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(screen.getByLabelText("Search")).toHaveValue("Burger");
});

it("localizes failed German previews without exposing backend English", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "required", message: "Choose Style" }),
    }),
  );
  render(
    <Customizer
      product={juice}
      tableId="t1"
      state={state}
      language="de"
      t={(key) => messages.de[key]}
      mutate={vi.fn()}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.de.requiredError,
  );
  expect(screen.queryByText("Choose Style")).not.toBeInTheDocument();
});
