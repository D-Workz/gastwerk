/**
 * Playwright workflows spanning manager setup, waiter ordering, and preparation.
 * Browser sessions exercise German/English flows, retries, and viewport layouts
 * against the configured test services and the database reset by e2e/setup.ts.
 */
import { expect, test, type Page } from "@playwright/test";
import type { AppState } from "../../apps/web/src/shared/api/api";

/**
 * Seeded users restore their German preference at login; switch back to English
 * after authentication so callers can use the English control labels.
 */
async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByLabel("Sprache / Language").selectOption("en");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-demo-change-me");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Abmelden", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Sprache / Language").selectOption("en");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

async function state(page: Page) {
  return (await page.request.get("/api/state")).json() as Promise<AppState>;
}

test("manager setup, customized service across browsers, consumption, closure and reconnection", async ({
  browser,
}) => {
  const managerContext = await browser.newContext(),
    waiterContext = await browser.newContext(),
    barContext = await browser.newContext();
  const manager = await managerContext.newPage(),
    waiter = await waiterContext.newPage(),
    bar = await barContext.newPage();
  await login(manager, "manager");
  await manager
    .getByRole("button", { name: "Management", exact: true })
    .click();
  await manager.getByRole("button", { name: "Inventory", exact: true }).click();
  const initial = (await state(manager)).balances;
  await manager
    .getByLabel("Ingredients", { exact: true })
    .selectOption("juice");
  await manager.getByLabel("Quantity", { exact: true }).fill("1");
  await manager.getByLabel("Unit", { exact: true }).selectOption("l");
  await manager.getByLabel("Reason", { exact: true }).fill("E2E delivery");
  await manager.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(async () => Number((await state(manager)).balances.juice))
    .toBe(Number(initial.juice) + 1000);
  await login(waiter, "waiter");
  await login(bar, "bar");
  await waiter.getByRole("button", { name: /Table 1/ }).click();
  await waiter
    .getByRole("button", { name: "Edit House burger", exact: true })
    .click();
  const dialog = waiter.getByRole("region", { name: "House burger" });
  await dialog
    .getByRole("button", { name: "Slice 20 g · €1.00", exact: true })
    .click();
  await dialog
    .locator(".ingredient")
    .filter({ hasText: "Onions" })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Advanced ingredients", exact: true })
    .click();
  await dialog.getByLabel("Search", { exact: true }).fill("Pickles");
  await dialog.getByLabel("Pickles Quantity").fill("15");
  await dialog.getByLabel("Note", { exact: true }).fill("Cut in half");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    waiter.getByText("Added to order", { exact: true }),
  ).toBeVisible();
  await waiter
    .getByRole("button", { name: "Add Apple juice 500 ml", exact: true })
    .click();
  await waiter.getByRole("button", { name: "Sparkling", exact: true }).click();
  await waiter.reload();
  await waiter.getByRole("button", { name: /Table 1/ }).click();
  await waiter.getByRole("button", { name: /^Order \(/ }).click();
  await expect(
    waiter.getByRole("button", { name: "Note: Cut in half" }),
  ).toBeVisible();
  await expect(
    bar.getByRole("button", { name: "Start preparing" }),
  ).toHaveCount(0);
  await waiter
    .getByRole("button", { name: "Send order (2)", exact: true })
    .click();
  await expect(
    bar.getByRole("button", { name: "Start preparing", exact: true }),
  ).toBeVisible({ timeout: 3000 });
  await expect(bar.getByText("Sparkling", { exact: true })).toBeVisible();
  await bar
    .getByRole("button", { name: "Start preparing", exact: true })
    .click();
  await expect
    .poll(async () => Number((await state(manager)).balances.juice))
    .toBe(Number(initial.juice) + 750);
  await expect
    .poll(async () => Number((await state(manager)).balances.sparkling))
    .toBe(Number(initial.sparkling) - 250);
  await bar.getByRole("button", { name: "Mark ready", exact: true }).click();
  await manager.getByRole("button", { name: "Kitchen", exact: true }).click();
  await expect(manager.getByText("“Cut in half”")).toBeVisible();
  await manager
    .getByRole("button", { name: "Start preparing", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Mark ready", exact: true })
    .click();
  await expect(
    waiter.getByRole("button", { name: "Mark served", exact: true }),
  ).toHaveCount(2);
  await waiter
    .getByRole("button", { name: "Mark served", exact: true })
    .first()
    .click();
  await expect(
    waiter.getByRole("button", { name: "Mark served", exact: true }),
  ).toHaveCount(1);
  await waiter
    .getByRole("button", { name: "Mark served", exact: true })
    .click();
  await waiter
    .getByRole("button", { name: "Close order", exact: true })
    .click();
  await expect(
    waiter.getByRole("button", { name: /Table 1.*Available/ }),
  ).toBeVisible();
  await waiter
    .getByRole("button", { name: "List", exact: true })
    .last()
    .click();
  await waiter.getByRole("button", { name: "Map", exact: true }).click();
  await waiter.getByRole("button", { name: "Sign out", exact: true }).click();
  await waiter.getByLabel("Username", { exact: true }).fill("waiter");
  await waiter
    .getByLabel("Password", { exact: true })
    .fill("local-demo-change-me");
  await waiter.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    waiter.getByRole("button", { name: "Map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await waiterContext.setOffline(true);
  await expect(waiter.getByRole("status")).toContainText("Disconnected", {
    timeout: 15000,
  });
  await waiterContext.setOffline(false);
  await expect(waiter.getByRole("status")).toContainText("Connected", {
    timeout: 15000,
  });
  await waiter.screenshot({
    path: "test-results/waiter-desktop.png",
    fullPage: true,
  });
  await waiter.setViewportSize({ width: 390, height: 844 });
  await waiter.getByRole("button", { name: /Table 1/ }).click();
  await waiter.screenshot({
    path: "test-results/waiter-mobile.png",
    fullPage: true,
  });
  expect(
    await waiter.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await managerContext.close();
  await waiterContext.close();
  await barContext.close();
});

test("a lost add acknowledgement retries once, including after browser refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Username", { exact: true })
    .count()
    .then(async (count) => {
      if (!count)
        await page.getByLabel("Sprache / Language").selectOption("en");
    });
  await page.getByLabel("Username", { exact: true }).fill("waiter");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-demo-change-me");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: /Table 2/ }).click();
  const before = (await state(page)).lines.length;
  await page.route(
    "**/api/lines",
    async (route) => {
      await route.fetch();
      await route.abort("connectionfailed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Edit House burger", exact: true })
    .click();
  await page
    .getByRole("region", { name: "House burger" })
    .getByLabel("Note", { exact: true })
    .fill("Lost response");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Retry", exact: true })
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).lines.length).toBe(before + 1);
  await page.route(
    "**/api/lines",
    async (route) => {
      await route.fetch();
      await route.abort("connectionfailed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Add House burger", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Retry", exact: true })
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).lines.length).toBe(before + 2);
});

test("German ordering and preparation preserve translated content and close service", async ({
  browser,
}) => {
  const waiterContext = await browser.newContext(),
    barContext = await browser.newContext();
  const waiter = await waiterContext.newPage(),
    bar = await barContext.newPage();
  for (const [page, role] of [
    [waiter, "waiter"],
    [bar, "bar"],
  ] as const) {
    await page.goto("/");
    await page.getByLabel("Benutzername", { exact: true }).fill(role);
    await page
      .getByLabel("Passwort", { exact: true })
      .fill("local-demo-change-me");
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Sprache / Language").selectOption("de");
    await expect(
      page.getByRole("button", { name: "Abmelden", exact: true }),
    ).toBeVisible();
  }
  await waiter.getByRole("button", { name: /Tisch 1/ }).click();
  await waiter
    .getByRole("button", { name: "Hinzufügen Apfelsaft 0,5 l", exact: true })
    .click();
  await waiter.getByRole("button", { name: "Pur", exact: true }).click();
  await waiter.getByRole("button", { name: /^Bestellung \(/ }).click();
  await waiter
    .getByRole("button", { name: "Bestellung senden (1)", exact: true })
    .click();
  await expect(
    bar.getByRole("button", { name: "Zubereitung starten", exact: true }),
  ).toBeVisible({ timeout: 3000 });
  await expect(bar.getByText("Pur", { exact: true })).toBeVisible();
  await bar
    .getByRole("button", { name: "Zubereitung starten", exact: true })
    .click();
  await bar
    .getByRole("button", { name: "Als bereit markieren", exact: true })
    .click();
  await waiter.getByRole("button", { name: "Servieren", exact: true }).click();
  await waiter
    .getByRole("button", { name: "Bestellung abschließen", exact: true })
    .click();
  await expect(
    waiter.getByRole("button", { name: /Tisch 1.*Frei/ }),
  ).toBeVisible();
  await waiterContext.close();
  await barContext.close();
});

for (const [width, height, language] of [
  [390, 844, "de"],
  [820, 1180, "en"],
  [1440, 1000, "en"],
] as const) {
  test(`touch workflow, pending notes and repeats at ${width}px (${language})`, async ({
    page,
  }) => {
    const de = language === "de";
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByLabel("Sprache / Language").selectOption("en");
    await page.getByLabel("Username", { exact: true }).fill("waiter");
    await page
      .getByLabel("Password", { exact: true })
      .fill("local-demo-change-me");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".table-list, .table-map")).toBeVisible();
    await page.getByLabel("Sprache / Language").selectOption(language);
    await page
      .getByRole("button", { name: de ? /Tisch 2/ : /Table 2/ })
      .click();
    await page
      .getByLabel(de ? "Suchen" : "Search", { exact: true })
      .fill("demo");
    await page
      .getByRole("button", {
        name: de
          ? "Hinzufügen Apfelsaft – Größen-Demo"
          : "Add Apple juice – size demo",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: de ? "Anzahl erhöhen" : "Increase item count",
      })
      .click();
    await page.getByRole("button", { name: de ? /Klein/ : /Small/ }).click();
    const option = page.getByRole("button", {
      name: de ? "Sprudel" : "Sparkling",
      exact: true,
    });
    const box = await option.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await option.focus();
    await expect(option).toBeFocused();
    await page.screenshot({
      path: `test-results/choices-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: de ? /^Bestellung \(/ : /^Order \(/ }),
    ).toBeVisible();
    await expect(
      page.getByLabel(de ? "Suchen" : "Search", { exact: true }),
    ).toHaveValue("demo");
    const added = (await state(page)).lines
      .filter((l) => l.input.productId === "apple-sizes-demo")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
    expect(added.input.quantity).toBe(2);
    expect(added.snapshot.unitPrice).toBe("3.00");
    await page
      .getByRole("button", { name: de ? /^Bestellung \(/ : /^Order \(/ })
      .click();
    const item = page
      .locator(".order > div")
      .filter({ has: page.getByTestId(`line-${added.id}`) });
    await item.getByRole("button", { name: de ? /^Notiz:/ : /^Note:/ }).click();
    const text = `Note ${width}`;
    await item.getByRole("textbox").fill(text);
    await page.route(
      `**/api/lines/${added.id}/edit`,
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "validation",
            message: "Raw English failure",
          }),
        });
      },
      { times: 1 },
    );
    await item
      .getByRole("button", { name: de ? "Speichern" : "Save", exact: true })
      .click();
    await expect(item.getByRole("alert")).toBeVisible();
    await page.route(
      `**/api/lines/${added.id}/edit`,
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "validation",
            message: "Raw English failure",
          }),
        });
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: de ? /^Bestellung senden/ : /^Send order/ })
      .click();
    await expect(item.getByRole("textbox")).toHaveValue(text);
    expect(
      (await state(page)).lines.find((l) => l.id === added.id)!.state,
    ).toBe("draft");
    await page.route(
      `**/api/lines/${added.id}/edit`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.continue();
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: de ? /^Bestellung senden/ : /^Send order/ })
      .click();
    await expect
      .poll(
        async () =>
          (await state(page)).lines.find((l) => l.id === added.id)?.input.note,
      )
      .toBe(text);
    await expect(item.getByText("Raw English failure")).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await state(page)).lines.find((l) => l.id === added.id)?.state,
      )
      .toBe("submitted");
    await item
      .getByRole("button", {
        name: de ? "+ Noch eins" : "+ One more",
        exact: true,
      })
      .click({ clickCount: 3 });
    await expect
      .poll(async () =>
        (await state(page)).lines
          .filter((l) => l.state === "draft" && l.input.note === text)
          .reduce((n, l) => n + l.input.quantity, 0),
      )
      .toBe(3);
    expect(
      (await state(page)).lines.find((l) => l.id === added.id)!.input.quantity,
    ).toBe(2);
    await page.screenshot({
      path: `test-results/order-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goBack();
    await expect(
      page.getByLabel(de ? "Suchen" : "Search", { exact: true }),
    ).toHaveValue("demo");
  });
}
