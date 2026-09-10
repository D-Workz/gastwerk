/**
 * Structured catalog fields within the manager JSON editor. This component
 * reads ingredient, product, or table records and emits updated JSON to Manager;
 * its local shape checks support rendering and do not replace API validation.
 */
import { unitLabel } from "../../shared/i18n/i18n";
import { z } from "zod";
import {
  label,
  type Ingredient,
  type Product,
  type Table,
} from "../../../../../packages/contracts/src/index";
import { Field } from "../../../../../packages/ui/src/index";
import type { AppState } from "../../shared/api/api";
import type { Language, T } from "../../shared/i18n/i18n";

type Props = {
  kind: "ingredient" | "product" | "table";
  value: string;
  onChange: (value: string) => void;
  state: AppState;
  language: Language;
  t: T;
  existing: boolean;
};

/**
 * Return no fields while JSON is invalid or fails the local rendering schema.
 * Updates merge into the original record so advanced fields remain in the JSON.
 */
export function CatalogForm({
  kind,
  value,
  onChange,
  state,
  language,
  t,
  existing,
}: Props) {
  const translated = z.object({ de: z.string(), en: z.string() });
  const base = { id: z.string(), active: z.boolean() };
  const schema =
    kind === "ingredient"
      ? z
          .object({
            ...base,
            name: translated,
            unit: z.enum(["g", "ml", "piece"]),
            category: z.string(),
            cost: z.string().nullable(),
            threshold: z.string().nullable(),
            fractional: z.boolean(),
            allergens: z.array(z.string()).nullable(),
            portions: z.array(
              z.object({
                id: z.string(),
                name: translated,
                quantity: z.string(),
                surcharge: z.string(),
              }),
            ),
          })
          .passthrough()
      : kind === "product"
        ? z
            .object({
              ...base,
              name: translated,
              price: z.string(),
              category: z.string(),
              station: z.enum(["kitchen", "bar"]),
              available: z.boolean(),
              guided: z.boolean(),
              recipe: z.record(z.string(), z.string()),
              quick: z.array(z.string()).nullable(),
            })
            .passthrough()
        : z
            .object({
              ...base,
              number: z.string(),
              area: z.string(),
              x: z.number(),
              y: z.number(),
            })
            .passthrough();
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  if (!schema.safeParse(raw).success) return null;
  const record = raw as Ingredient | Product | Table;

  const update = (patch: object) =>
    onChange(JSON.stringify({ ...record, ...patch }, null, 2));

  return (
    <div className="catalog-form">
      <div className="form-grid">
        <Field label="ID">
          <input
            value={record.id}
            disabled={existing}
            onChange={(e) => update({ id: e.target.value })}
          />
        </Field>
        {"name" in record && (
          <>
            <Field label="Name · Deutsch">
              <input
                value={record.name?.de ?? ""}
                onChange={(e) =>
                  update({ name: { ...record.name, de: e.target.value } })
                }
              />
            </Field>
            <Field label="Name · English">
              <input
                value={record.name?.en ?? ""}
                onChange={(e) =>
                  update({ name: { ...record.name, en: e.target.value } })
                }
              />
            </Field>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={record.active}
            onChange={(e) => update({ active: e.target.checked })}
          />
          {t("active")}
        </label>
      </div>
      {kind === "table" &&
        (() => {
          const table = record as Table;
          return (
            <div className="form-grid">
              {(["number", "area"] as const).map((key) => (
                <Field
                  key={key}
                  label={key === "number" ? t("table") : t("area")}
                >
                  <input
                    value={table[key]}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </Field>
              ))}
              {(["x", "y"] as const).map((key) => (
                <Field key={key} label={`${key.toUpperCase()} (%)`}>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={table[key]}
                    onChange={(e) => update({ [key]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
          );
        })()}
      {kind === "ingredient" &&
        (() => {
          const i = record as Ingredient;
          return (
            <>
              <div className="form-grid">
                <Field label={t("unit")}>
                  <select
                    disabled={existing}
                    value={i.unit}
                    onChange={(e) => update({ unit: e.target.value })}
                  >
                    {["g", "ml", "piece"].map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("category")}>
                  <input
                    value={i.category}
                    onChange={(e) => update({ category: e.target.value })}
                  />
                </Field>
                <Field label={t("cost")}>
                  <input
                    inputMode="decimal"
                    value={i.cost ?? ""}
                    onChange={(e) => update({ cost: e.target.value || null })}
                  />
                </Field>
                <Field label={t("low")}>
                  <input
                    inputMode="decimal"
                    value={i.threshold ?? ""}
                    onChange={(e) =>
                      update({ threshold: e.target.value || null })
                    }
                  />
                </Field>
                <label>
                  <input
                    type="checkbox"
                    checked={i.fractional}
                    onChange={(e) => update({ fractional: e.target.checked })}
                  />
                  {t("fractional")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={i.allergens !== null}
                    onChange={(e) =>
                      update({ allergens: e.target.checked ? [] : null })
                    }
                  />
                  {t("allergensDeclared")}
                </label>
                {i.allergens !== null && (
                  <Field label={t("allergens")}>
                    <input
                      value={i.allergens.join(", ")}
                      onChange={(e) =>
                        update({
                          allergens: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                )}
              </div>
              <h3>{t("portion")}</h3>
              {i.portions?.map((p, index) => (
                <div className="form-grid" key={index}>
                  <Field label="Name · Deutsch">
                    <input
                      value={p.name.de}
                      onChange={(e) =>
                        update({
                          portions: i.portions.map((v, j) =>
                            j === index
                              ? {
                                  ...v,
                                  name: { ...v.name, de: e.target.value },
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Name · English">
                    <input
                      value={p.name.en}
                      onChange={(e) =>
                        update({
                          portions: i.portions.map((v, j) =>
                            j === index
                              ? {
                                  ...v,
                                  name: { ...v.name, en: e.target.value },
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  </Field>
                  {(["quantity", "surcharge"] as const).map((key) => (
                    <Field
                      key={key}
                      label={t(key === "quantity" ? "quantity" : "price")}
                    >
                      <input
                        value={p[key]}
                        onChange={(e) =>
                          update({
                            portions: i.portions.map((v, j) =>
                              j === index ? { ...v, [key]: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </Field>
                  ))}
                  <button
                    onClick={() =>
                      update({
                        portions: i.portions.filter((_, j) => j !== index),
                      })
                    }
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  update({
                    portions: [
                      ...(i.portions ?? []),
                      {
                        id: crypto.randomUUID(),
                        name: { de: "Portion", en: "Portion" },
                        quantity: "1",
                        surcharge: "0",
                      },
                    ],
                  })
                }
              >
                + {t("portion")}
              </button>
            </>
          );
        })()}
      {kind === "product" &&
        (() => {
          const p = record as Product;
          return (
            <>
              <div className="form-grid">
                <Field label={t("price")}>
                  <input
                    value={p.price}
                    onChange={(e) => update({ price: e.target.value })}
                  />
                </Field>
                <Field label={t("category")}>
                  <select
                    value={p.category}
                    onChange={(e) => update({ category: e.target.value })}
                  >
                    {state.configuration.policy.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c.name, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("station")}>
                  <select
                    value={p.station}
                    onChange={(e) => update({ station: e.target.value })}
                  >
                    <option value="kitchen">{t("kitchen")}</option>
                    <option value="bar">{t("bar")}</option>
                  </select>
                </Field>
                <label>
                  <input
                    type="checkbox"
                    checked={p.available}
                    onChange={(e) => update({ available: e.target.checked })}
                  />
                  {t("available")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={p.guided}
                    onChange={(e) => update({ guided: e.target.checked })}
                  />
                  {t("guided")}
                </label>
              </div>
              <h3>{t("recipe")}</h3>
              <div className="form-grid">
                {state.ingredients
                  .filter((i) => i.active)
                  .map((i) => (
                    <Field
                      key={i.id}
                      label={`${label(i.name, language)} (${unitLabel(i.unit, language)})`}
                    >
                      <input
                        value={p.recipe?.[i.id] ?? ""}
                        inputMode="decimal"
                        onChange={(e) => {
                          const recipe = { ...p.recipe };
                          if (e.target.value) recipe[i.id] = e.target.value;
                          else delete recipe[i.id];
                          update({ recipe });
                        }}
                      />
                    </Field>
                  ))}
              </div>
              <h3>{t("quick")}</h3>
              <label>
                <input
                  type="checkbox"
                  checked={p.quick === null}
                  onChange={(e) =>
                    update({ quick: e.target.checked ? null : [] })
                  }
                />
                {t("categoryDefaults")}
              </label>
              {p.quick !== null && (
                <div className="row">
                  {state.ingredients
                    .filter((i) => i.active)
                    .map((i) => (
                      <label key={i.id}>
                        <input
                          type="checkbox"
                          checked={p.quick?.includes(i.id) ?? false}
                          onChange={(e) =>
                            update({
                              quick: e.target.checked
                                ? [...(p.quick ?? []), i.id]
                                : (p.quick ?? []).filter((id) => id !== i.id),
                            })
                          }
                        />
                        {label(i.name, language)}
                      </label>
                    ))}
                </div>
              )}
              <p>{t("advancedOptionsHelp")}</p>
            </>
          );
        })()}
    </div>
  );
}
