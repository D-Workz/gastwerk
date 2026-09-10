/**
 * Detailed item editor opened by Service for additions, edits, and replacements.
 * It combines choice and ingredient controls with usePreview server snapshots,
 * then submits the selected operation through the supplied mutation function.
 */
import { unitLabel } from "../../../shared/i18n/i18n";
import { useRef, useState } from "react";
import {
  label,
  withChoiceDefaults,
  type Customization,
  type Line,
  type Product,
} from "../../../../../../packages/contracts/src/index";
import { Field } from "../../../../../../packages/ui/src/index";
import { type AppState, type Mutate } from "../../../shared/api/api";
import {
  euro,
  quantity as formatQuantity,
  type Language,
  type T,
} from "../../../shared/i18n/i18n";
import { usePreview } from "./usePreview";
import { QuantityControl } from "../../../shared/ui/QuantityControl";

export function Customizer({
  product,
  line,
  tableId,
  state,
  language,
  t,
  mutate,
  onClose,
  replacement = false,
  initialInput,
  previousUnitPrice,
  onAdded,
  onBusy,
}: {
  product: Product;
  line?: Line;
  tableId: string;
  state: AppState;
  language: Language;
  t: T;
  mutate: Mutate;
  onClose: () => void;
  replacement?: boolean;
  initialInput?: Customization;
  previousUnitPrice?: string;
  onBusy?: (busy: boolean) => void;
  onAdded?: (input: Customization, id?: string) => void;
}) {
  const [input, setInput] = useState<Customization>(
    line?.input ??
      initialInput ??
      withChoiceDefaults(
        {
          productId: product.id,
          quantity: 1,
          choices: Object.fromEntries(
            product.groups
              .filter((g) => g.defaultChoice)
              .map((g) => [g.id, g.defaultChoice!]),
          ),
          edits: [],
          note: "",
        },
        product,
      ),
  );
  const { snapshot, error, loading, retry } = usePreview(
    input,
    line && !replacement ? line.id : undefined,
    t,
  );
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [review, setReview] = useState(false);
  const [split, setSplit] = useState(false);
  const [reason, setReason] = useState("");

  function edit(id: string, quantity: string, portionId?: string) {
    setInput((old) => ({
      ...old,
      edits: [
        ...old.edits.filter((e) => e.ingredientId !== id),
        { ingredientId: id, quantity, ...(portionId ? { portionId } : {}) },
      ],
    }));
  }

  const quick =
    product.quick ??
    state.configuration.policy.categories.find((c) => c.id === product.category)
      ?.quick ??
    [];
  const shown = state.ingredients.filter(
    (i) =>
      i.active &&
      (advanced ||
        quick.includes(i.id) ||
        i.id in product.recipe ||
        Boolean(snapshot?.resolved[i.id]) ||
        input.edits.some((e) => e.ingredientId === i.id)) &&
      (!advanced ||
        ((i.name.de + " " + i.name.en)
          .toLowerCase()
          .includes(search.toLowerCase()) &&
          (!category || i.category === category))),
  );

  /**
   * Require a preview and completed local review, then select add, edit, or
   * replacement transport. Existing-line requests carry the displayed revision.
   */
  async function confirm() {
    if (!snapshot || loading || review || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    onBusy?.(true);
    const path = line
      ? `/lines/${line.id}/${replacement ? "replace" : "edit"}`
      : "/lines";
    const body = line
      ? {
          input,
          version: line.version,
          ...(replacement ? { reason } : { split }),
        }
      : { input, tableId };
    try {
      let addedId: string | undefined;
      if (
        await mutate(path, body, (result) => {
          addedId = result.id;
        })
      ) {
        onBusy?.(false);
        if (!line) onAdded?.(input, addedId);
        onClose();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusy?.(false);
    }
  }

  return (
    <section className="panel" aria-label={label(product.name, language)}>
      <h2 className="customizer-title" tabIndex={-1}>
        {label(product.name, language)}
      </h2>
      {previousUnitPrice && (
        <p className="warning">
          {t("previousPrice")}: {euro(previousUnitPrice, language)} ·{" "}
          {t("reviewRepeat")}
        </p>
      )}
      <fieldset className="customizer" disabled={saving}>
        {replacement && <p className="warning">{t("replacementNotice")}</p>}
        {(product.sizes ?? []).length > 1 && (
          <div className="choice-tiles" role="group" aria-label={t("size")}>
            {product.sizes.map((size) => (
              <button
                key={size.id}
                aria-pressed={input.sizeId === size.id}
                onClick={() => {
                  setInput({ ...input, sizeId: size.id });
                  if (input.edits.length) setReview(true);
                }}
              >
                {label(size.name, language)} · {euro(size.price, language)}
              </button>
            ))}
          </div>
        )}
        {product.groups.map((group) => (
          <fieldset key={group.id}>
            <legend>
              {label(group.name, language)} ·{" "}
              {t(group.required ? "required" : "optional")}
            </legend>
            <div className="choice-tiles">
              {group.choices.map((choice) => (
                <button
                  key={choice.id}
                  aria-pressed={input.choices[group.id] === choice.id}
                  onClick={() => {
                    setInput({
                      ...input,
                      choices: { ...input.choices, [group.id]: choice.id },
                    });
                    if (input.edits.length) setReview(true);
                  }}
                >
                  {label(choice.name, language)}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {review && (
          <div className="warning">
            {t("review")}{" "}
            <button onClick={() => setReview(false)}>{t("reviewed")}</button>
          </div>
        )}
        <div className="row">
          <QuantityControl
            value={input.quantity}
            onChange={(quantity) => setInput({ ...input, quantity })}
            t={t}
            disabled={saving}
          />
          {line && line.input.quantity > 1 && !replacement && (
            <label>
              <input
                type="checkbox"
                checked={split}
                onChange={(e) => {
                  setSplit(e.target.checked);
                  setInput({
                    ...input,
                    quantity: e.target.checked ? 1 : line.input.quantity,
                  });
                }}
              />
              {t("split")}
            </label>
          )}
        </div>
        <h3>{t("ingredients")}</h3>
        <button onClick={() => setAdvanced(!advanced)}>
          {advanced ? t("quick") : t("advanced")}
        </button>
        {advanced && (
          <div className="row">
            <Field label={t("search")}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label={t("category")}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">{t("all")}</option>
                {[...new Set(state.ingredients.map((i) => i.category))].map(
                  (c) => (
                    <option key={c} value={c}>
                      {label(
                        state.configuration.policy.categories.find(
                          (category) => category.id === c,
                        )?.name ?? { de: c, en: c },
                        language,
                      )}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        )}
        {shown.map((i) => {
          const explicit = input.edits.find((e) => e.ingredientId === i.id);
          const amount =
            explicit?.quantity ??
            snapshot?.resolved[i.id] ??
            product.recipe[i.id] ??
            "0";
          return (
            <section className="ingredient" key={i.id}>
              <div>
                <strong>{label(i.name, language)}</strong>
                <small>
                  {i.allergens === null
                    ? t("incomplete")
                    : i.allergens.join(", ") || t("noneKnown")}
                </small>
              </div>
              {advanced && (
                <Field
                  label={`${t("explicitQuantity")} (${unitLabel(i.unit, language)})`}
                >
                  <input
                    aria-label={`${label(i.name, language)} ${t("quantity")}`}
                    type="number"
                    min="0"
                    step={i.unit === "piece" && !i.fractional ? "1" : "0.001"}
                    value={amount}
                    onChange={(e) =>
                      edit(i.id, e.target.value, explicit?.portionId)
                    }
                  />
                </Field>
              )}
              <div className="row">
                {Number(amount) > 0 ? (
                  <button onClick={() => edit(i.id, "0")}>{t("remove")}</button>
                ) : (
                  <button
                    onClick={() => {
                      if (product.recipe[i.id])
                        setInput({
                          ...input,
                          edits: input.edits.filter(
                            (e) => e.ingredientId !== i.id,
                          ),
                        });
                      else if (i.portions[0])
                        edit(i.id, i.portions[0].quantity, i.portions[0].id);
                    }}
                    disabled={!product.recipe[i.id] && !i.portions.length}
                  >
                    {product.recipe[i.id] ? t("restore") : t("add")}
                  </button>
                )}
                {i.portions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => edit(i.id, p.quantity, p.id)}
                  >
                    {label(p.name, language)} ·{" "}
                    {Number(p.surcharge) === 0
                      ? t("noSurcharge")
                      : euro(p.surcharge, language)}
                  </button>
                ))}
                {!i.portions.length && <small>{t("noSurcharge")}</small>}
              </div>
            </section>
          );
        })}
        <Field label={t("note")}>
          <textarea
            value={input.note}
            maxLength={1000}
            onChange={(e) => setInput({ ...input, note: e.target.value })}
          />
        </Field>
        {replacement && (
          <Field label={t("reason")}>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </Field>
        )}
        {loading && <p role="status">{t("loading")}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
            <button onClick={retry}>{t("retry")}</button>
          </p>
        )}
        {snapshot && (
          <div className="preview">
            <strong>
              {t("preview")}: {euro(snapshot.unitPrice, language)} /{" "}
              {t("quantity")} 1
            </strong>
            {advanced && (
              <p>
                {Object.entries(snapshot.resolved)
                  .map(
                    ([id, q]) =>
                      `${label(state.ingredients.find((i) => i.id === id)?.name ?? { de: id, en: id }, language)}: ${formatQuantity(q, language)}`,
                  )
                  .join(" · ")}
              </p>
            )}
            <p>
              {t("allergens")}:{" "}
              {snapshot.allergens.join(", ") || t("noneKnown")}
              {snapshot.incompleteAllergens && ` · ${t("incomplete")}`}
            </p>
            <small>{t("allergenNotice")}</small>
          </div>
        )}
        <footer>
          <button disabled={saving} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="primary"
            disabled={
              !snapshot ||
              loading ||
              saving ||
              review ||
              (replacement && !reason.trim())
            }
            onClick={() => void confirm()}
          >
            {saving ? t("loading") : t("confirm")}
          </button>
        </footer>
      </fieldset>
    </section>
  );
}
