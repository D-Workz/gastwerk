/**
 * Manager workspace composed by App for catalog, policy, inventory, and users.
 * CatalogForm and PolicyForm edit the JSON held here; saves use the supplied
 * mutation function, while supplemental lists use shared API transport.
 */
import { unitLabel } from "../../shared/i18n/i18n";
import { errorMessage } from "../../shared/i18n/errors";
import { PolicyForm } from "./PolicyForm";
import { useEffect, useState } from "react";
import {
  label,
  type Movement,
} from "../../../../../packages/contracts/src/index";
import { Field } from "../../../../../packages/ui/src/index";
import { api, type AppState, type Mutate } from "../../shared/api/api";
import { CatalogForm } from "./CatalogForm";
import {
  date,
  quantity as formatQuantity,
  type Language,
  type T,
} from "../../shared/i18n/i18n";

const templates = {
  ingredient: {
    id: "new-ingredient",
    name: { de: "Neue Zutat", en: "New ingredient" },
    unit: "g",
    category: "food",
    active: true,
    fractional: false,
    cost: null,
    allergens: null,
    threshold: null,
    portions: [],
  },
  product: {
    id: "new-product",
    name: { de: "Neues Produkt", en: "New product" },
    category: "food",
    recipe: {},
    price: "0.00",
    station: "kitchen",
    active: true,
    available: true,
    guided: false,
    groups: [],
    sizes: [],
    quick: null,
  },
  table: {
    id: "new-table",
    number: "3",
    area: "Innen",
    x: 10,
    y: 10,
    active: true,
  },
};

export function Manager({
  state,
  language,
  t,
  mutate,
}: {
  state: AppState;
  language: Language;
  t: T;
  mutate: Mutate;
}) {
  const [tab, setTab] = useState<
    "ingredient" | "product" | "table" | "configuration" | "stock" | "users"
  >("ingredient");
  const [editor, setEditor] = useState("");
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [users, setUsers] = useState<
    { id: string; username: string; role: string; active: boolean }[]
  >([]);
  useEffect(() => {
    if (tab === "stock")
      void api<Movement[]>("/inventory")
        .then(setMovements)
        .catch((e: Error) => setError(errorMessage(e, t)));
    if (tab === "users")
      void api<typeof users>("/users")
        .then(setUsers)
        .catch((e: Error) => setError(errorMessage(e, t)));
  }, [tab, state]);

  function selectTab(next: typeof tab) {
    setTab(next);
    setSelected("");
    setError("");
    setVersion(next === "configuration" ? state.configuration.version : 0);
    setEditor(
      next === "configuration"
        ? JSON.stringify(state.configuration.policy, null, 2)
        : "",
    );
  }

  /**
   * Submit the editor with its captured revision; JSON parsing here does not
   * validate catalog references or grant permission to save.
   */
  async function save() {
    setError("");
    setBusy(true);
    try {
      const data: unknown = JSON.parse(editor);
      const path =
        tab === "configuration" ? "/configuration" : `/catalog/${tab}`;
      if (await mutate(path, { data, version })) {
        setEditor("");
        setSelected("");
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  const records =
    tab === "ingredient"
      ? state.ingredients
      : tab === "product"
        ? state.products
        : state.tables;
  return (
    <section className="panel">
      <h2>{t("manager")}</h2>
      <nav className="tabs">
        {(
          [
            "ingredient",
            "product",
            "table",
            "configuration",
            "stock",
            "users",
          ] as const
        ).map((key) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => selectTab(key)}
          >
            {t(
              key === "ingredient"
                ? "ingredients"
                : key === "product"
                  ? "products"
                  : key === "table"
                    ? "tables"
                    : key,
            )}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {["ingredient", "product", "table", "configuration"].includes(tab) && (
        <div className="manager-grid">
          {tab !== "configuration" && (
            <aside>
              <button
                onClick={() => {
                  setEditor(
                    JSON.stringify(
                      templates[tab as keyof typeof templates],
                      null,
                      2,
                    ),
                  );
                  setVersion(0);
                  setSelected("new");
                }}
              >
                {t("new")}
              </button>
              {records.map((record) => (
                <button
                  className={selected === record.id ? "selected" : ""}
                  key={record.id}
                  onClick={() => {
                    const { version, ...data } = record;
                    setEditor(JSON.stringify(data, null, 2));
                    setVersion(version);
                    setSelected(record.id);
                  }}
                >
                  {"name" in record
                    ? label(record.name, language)
                    : record.number}{" "}
                  · v{record.version}
                </button>
              ))}
            </aside>
          )}
          <div>
            {tab === "configuration" && <p>{t("policyHelp")}</p>}
            {editor && (
              <>
                {tab === "configuration" && (
                  <PolicyForm value={editor} onChange={setEditor} t={t} />
                )}
                {tab !== "configuration" && (
                  <CatalogForm
                    kind={tab as "ingredient" | "product" | "table"}
                    value={editor}
                    onChange={setEditor}
                    state={state}
                    language={language}
                    t={t}
                    existing={version > 0}
                  />
                )}
                <details open={tab === "configuration"}>
                  <summary>{t("advancedRecord")}</summary>
                  <Field label={`${t("json")} · ${t("version")} ${version}`}>
                    <textarea
                      className="json-editor"
                      spellCheck={false}
                      value={editor}
                      onChange={(e) => setEditor(e.target.value)}
                    />
                  </Field>
                </details>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {t("save")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {tab === "stock" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const body = Object.fromEntries(data);
              if (!body.packQuantity) delete body.packQuantity;
              setBusy(true);
              void mutate("/inventory", body)
                .then((ok) => {
                  if (ok) form.reset();
                })
                .finally(() => setBusy(false));
            }}
          >
            <h3>{t("movement")}</h3>
            <div className="form-grid">
              <Field label={t("ingredients")}>
                <select name="ingredientId">
                  {state.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {label(i.name, language)} ({unitLabel(i.unit, language)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("quantity")}>
                <input name="quantity" required inputMode="decimal" />
              </Field>
              <Field label={t("unit")}>
                <select name="unit">
                  {["g", "ml", "piece", "kg", "l", "pack"].map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("packQuantity")}>
                <input name="packQuantity" inputMode="decimal" />
              </Field>
              <Field label={t("kind")}>
                <select name="kind">
                  {(["delivery", "correction", "opening"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("reason")}>
                <input name="reason" required />
              </Field>
            </div>
            <button className="primary" disabled={busy}>
              {t("save")}
            </button>
          </form>
          <h3>{t("stock")}</h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("ingredients")}</th>
                  <th>{t("quantity")}</th>
                  <th>{t("allergens")}</th>
                </tr>
              </thead>
              <tbody>
                {state.ingredients.map((i) => (
                  <tr key={i.id}>
                    <td>{label(i.name, language)}</td>
                    <td>
                      {formatQuantity(state.balances[i.id] ?? "0", language)}{" "}
                      {unitLabel(i.unit, language)}
                    </td>
                    <td>{i.allergens?.join(", ") ?? t("incomplete")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{t("history")}</h3>
            <table>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{date(m.at, language)}</td>
                    <td>{m.ingredientId}</td>
                    <td>{formatQuantity(m.quantity, language)}</td>
                    <td>{m.kind}</td>
                    <td>{m.reason}</td>
                    <td>{m.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "users" && (
        <>
          <div className="row">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelected(u.id);
                  setEditor(JSON.stringify(u, null, 2));
                }}
              >
                {u.username} · {u.role}
              </button>
            ))}
            <button
              onClick={() => {
                setSelected("new");
                setEditor(
                  JSON.stringify(
                    {
                      username: "",
                      password: "",
                      role: "waiter",
                      active: true,
                    },
                    null,
                    2,
                  ),
                );
              }}
            >
              {t("new")}
            </button>
          </div>
          {editor && (
            <>
              <Field label={t("json")}>
                <textarea
                  className="json-editor"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                />
              </Field>
              <button
                disabled={busy}
                onClick={() => {
                  try {
                    const body: unknown = JSON.parse(editor);
                    setBusy(true);
                    void mutate("/users", body)
                      .then((ok) => {
                        if (ok) setEditor("");
                      })
                      .finally(() => setBusy(false));
                  } catch (e) {
                    setError(errorMessage(e, t));
                  }
                }}
              >
                {t("save")}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
