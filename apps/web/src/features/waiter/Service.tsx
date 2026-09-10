/**
 * Waiter workspace coordinator for tables, menu, customization, and orders.
 * Service connects the child views to shared mutations and useNotes, and owns
 * navigation guards, send/repeat actions, and the latest undo callback.
 */
import { useEffect, useRef, useState } from "react";
import {
  withChoiceDefaults,
  type Customization,
  type Line,
  type Preferences,
  type Product,
} from "../../../../../packages/contracts/src/index";
import { type AppState, type Mutate } from "../../shared/api/api";
import type { Language, T } from "../../shared/i18n/i18n";
import { Customizer } from "./customize/Customizer";
import { ChoiceSteps } from "./customize/ChoiceSteps";
import { Tables } from "./tables/Tables";
import { Menu } from "./menu/Menu";
import { Order } from "./order/Order";
import { useNotes } from "./order/useNotes";
import "./waiter.css";

type Props = {
  state: AppState;
  language: Language;
  t: T;
  mutate: Mutate;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  registerGuard?: (guard: (() => Promise<boolean>) | null) => void;
};
type Screen = "tables" | "menu" | "choices" | "edit" | "order";
type Custom = {
  previousUnitPrice?: string;
  product: Product;
  line?: Line;
  replacement?: boolean;
  initialInput?: Customization;
};

export function Service({
  state,
  language,
  t,
  mutate,
  preferences,
  setPreferences,
  registerGuard,
}: Props) {
  const [tableId, setTableId] = useState("");
  const [screen, setScreen] = useState<Screen>("tables");
  const [custom, setCustom] = useState<Custom | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<(() => Promise<boolean>) | null>(null);
  const notes = useNotes(mutate);
  const workspace = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const adding = useRef(false);
  // A failed async action may need catalog data refreshed while it was waiting.
  const latest = useRef(state);
  latest.current = state;
  const table = state.tables.find((v) => v.id === tableId);
  const order = state.orders.find((o) => o.tableId === tableId && !o.closedAt);
  const lines = state.lines.filter((l) => l.orderId === order?.id);
  const active = lines.filter((l) => l.state !== "cancelled");
  const draftCount = active
    .filter((l) => l.state === "draft")
    .reduce((n, l) => n + l.input.quantity, 0);
  const guard = useRef<() => Promise<boolean>>(async () => true);
  guard.current = async () => {
    if (adding.current) return false;
    const ok = await notes.flush();
    if (!ok) setNotice(t("noteFailed"));
    return ok;
  };

  useEffect(() => {
    const selector =
      screen === "menu"
        ? ".menu-title"
        : screen === "order"
          ? ".order-title"
          : screen === "edit"
            ? ".customizer-title"
            : ".tables-title";
    workspace.current
      ?.querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: true });
  }, [screen]);

  useEffect(() => {
    // The registered callback reads the latest guard without reinstalling listeners.
    registerGuard?.(() => guard.current());

    const back = (event: PopStateEvent) => {
      void guard.current().then((ok) => {
        if (ok) {
          // Browser Back restores tables/menu, not every intermediate editor step.
          const destination = event.state?.waiter;
          setScreen(
            destination === "tables" || !destination ? "tables" : "menu",
          );
          setCustom(null);
        } else window.history.pushState({}, "");
      });
    };

    const unload = (event: BeforeUnloadEvent) => {
      if (notes.hasPending()) event.preventDefault();
    };

    window.addEventListener("popstate", back);
    window.addEventListener("beforeunload", unload);
    return () => {
      registerGuard?.(null);
      window.removeEventListener("popstate", back);
      window.removeEventListener("beforeunload", unload);
    };
  }, [registerGuard]);

  /**
   * Consult the current note/add guard before changing screens or browser history.
   */
  async function navigate(next: Screen) {
    if (!(await guard.current())) return;
    if (screen === "menu") scroll.current = window.scrollY;
    window.history.pushState({ waiter: next }, "");
    setScreen(next);
    if (next === "menu")
      requestAnimationFrame(() => window.scrollTo(0, scroll.current));
    else window.scrollTo(0, 0);
  }

  function added(_input: Customization, id?: string) {
    setNotice(t("added"));
    if (id)
      setUndo(
        () => () =>
          mutate(`/lines/${id}/transition`, {
            version: 1,
            state: "cancelled",
            reason: "Undo addition",
          }),
      );
  }

  /**
   * Products with multiple sizes or any groups enter the choice flow, regardless
   * of the guided flag. Otherwise add a draft immediately with configured defaults.
   */
  async function add(product: Product) {
    if (adding.current) return;
    if ((product.sizes?.length ?? 0) > 1 || product.groups.length) {
      setCustom({ product });
      await navigate("choices");
      return;
    }
    adding.current = true;
    setBusy(true);
    const input = withChoiceDefaults(
      { productId: product.id, quantity: 1, choices: {}, edits: [], note: "" },
      product,
    );
    try {
      let id: string | undefined;
      if (
        await mutate("/lines", { tableId, input }, (result) => {
          id = result.id;
        })
      )
        added(input, id);
    } finally {
      adding.current = false;
      setBusy(false);
    }
  }

  async function edit(customization: Custom) {
    if (!(await guard.current())) return;
    setCustom(customization);
    await navigate("edit");
  }

  /**
   * Flush notes before repeating. Any false mutation result opens the review
   * flow when the product is still present in the latest application state.
   */
  async function repeat(line: Line) {
    const input = {
      ...line.input,
      note: notes.entries[line.id]?.text ?? line.input.note,
    };
    if (!(await notes.flush())) {
      setNotice(t("noteFailed"));
      return;
    }
    const ok = await mutate(`/lines/${line.id}/repeat`, { input });
    if (!ok) {
      const product = latest.current.products.find(
        (p) => p.id === line.input.productId,
      );
      setNotice(t("reviewRepeat"));
      if (product)
        await edit({
          product,
          previousUnitPrice: line.snapshot.unitPrice,
          initialInput: { ...line.input, quantity: 1 },
        });
    }
  }

  /**
   * Anticipate one revision increment if a retained note is saved first. The
   * server still checks this expected revision; the client does not reserve it.
   */
  async function decrease(line: Line) {
    const version = notes.entries[line.id]
      ? notes.entries[line.id]!.version + 1
      : line.version;
    if (!(await notes.flush())) return;
    setBusy(true);
    try {
      if (
        (await mutate(`/lines/${line.id}/decrement`, { version })) &&
        line.input.quantity === 1
      )
        setUndo(
          () => () =>
            mutate(`/lines/${line.id}/undo-removal`, { version: version + 1 }),
        );
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    // Capture draft revisions, allowing one increment for each pending note save.
    const drafts = lines
      .filter((l) => l.state === "draft")
      .map((l) => ({
        id: l.id,
        version: notes.entries[l.id]
          ? notes.entries[l.id]!.version + 1
          : l.version,
      }));
    try {
      if (!(await notes.flush())) {
        setNotice(t("noteFailed"));
        return;
      }
      if (order && drafts.length)
        await mutate(`/orders/${order.id}/send`, { lines: drafts });
    } catch {
      setNotice(t("connectionError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={workspace} className="waiter-workspace" data-screen={screen}>
      {screen === "tables" && (
        <Tables
          state={state}
          t={t}
          preferences={preferences}
          setPreferences={setPreferences}
          onSelect={(id) => {
            setTableId(id);
            void navigate("menu");
          }}
        />
      )}
      {table && screen !== "tables" && (
        <>
          <nav className="workspace-nav" aria-label={t("table")}>
            <strong>
              {t("table")} {table.number}
            </strong>
            <button onClick={() => void navigate("tables")}>
              {t("tables")}
            </button>
            {screen !== "menu" && (
              <button onClick={() => void navigate("menu")}>{t("menu")}</button>
            )}
            {screen === "menu" && (
              <button
                className="order-handle"
                onClick={() => void navigate("order")}
              >
                {t("order")} ({active.reduce((n, l) => n + l.input.quantity, 0)}
                ) {draftCount > 0 && `· ${t("draft")} (${draftCount})`}
              </button>
            )}
          </nav>
          {notice && <div role="status">{notice}</div>}
          {undo && (
            <button
              onClick={() => {
                setBusy(true);
                void undo()
                  .then((ok) => {
                    if (ok) setUndo(null);
                  })
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
            >
              {t("undo")}
            </button>
          )}
          {/* Preserve menu filters while an order/editor is open; Tables unmounts it. */}
          <div hidden={screen !== "menu"}>
            <Menu
              state={state}
              language={language}
              t={t}
              preferences={preferences}
              setPreferences={setPreferences}
              busy={busy}
              onAdd={(p) => void add(p)}
              onEdit={(product) => void edit({ product })}
            />
          </div>
          {screen === "choices" && custom && (
            <ChoiceSteps
              onBusy={(value) => {
                adding.current = value;
              }}
              product={custom.product}
              tableId={tableId}
              language={language}
              t={t}
              mutate={mutate}
              onBack={() => void navigate("menu")}
              onAdded={(input, id) => {
                added(input, id);
                void navigate("menu");
              }}
            />
          )}
          {screen === "edit" && custom && (
            <Customizer
              onBusy={(value) => {
                adding.current = value;
              }}
              {...custom}
              tableId={tableId}
              state={state}
              language={language}
              t={t}
              mutate={mutate}
              onClose={() => void navigate(custom.line ? "order" : "menu")}
              onAdded={added}
            />
          )}
          {screen === "order" && (
            <Order
              lines={lines}
              order={order}
              language={language}
              t={t}
              mutate={mutate}
              notes={notes}
              busy={busy}
              manager={state.user.role === "manager"}
              onEdit={(line, replacement) =>
                void edit({ product: line.snapshot.product, line, replacement })
              }
              onRepeat={(line) => void repeat(line)}
              onDecrease={(line) => void decrease(line)}
              onSend={() => void send()}
              onClose={() => {
                if (order)
                  void mutate(`/orders/${order.id}/close`, {}).then((ok) => {
                    if (ok) void navigate("tables");
                  });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
