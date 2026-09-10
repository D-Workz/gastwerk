/**
 * Guided size and preparation selection within the waiter workspace. Service
 * opens this view for products with choices; the last selection submits an item
 * through Mutate, and a failed save retains the selections for retry.
 */
import { useEffect, useRef, useState } from "react";
import {
  label,
  withChoiceDefaults,
  type Customization,
  type Product,
} from "../../../../../../packages/contracts/src/index";
import type { Mutate } from "../../../shared/api/api";
import { euro, type Language, type T } from "../../../shared/i18n/i18n";
import { QuantityControl } from "../../../shared/ui/QuantityControl";

type Props = {
  product: Product;
  tableId: string;
  language: Language;
  t: T;
  mutate: Mutate;
  onAdded: (input: Customization, id?: string) => void;
  onBusy?: (busy: boolean) => void;
  onBack: () => void;
};

export function ChoiceSteps({
  product,
  tableId,
  language,
  t,
  mutate,
  onAdded,
  onBack,
  onBusy,
}: Props) {
  const [input, setInput] = useState<Customization>(
    withChoiceDefaults(
      { productId: product.id, quantity: 1, choices: {}, edits: [], note: "" },
      product,
    ),
  );
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const sizes = product.sizes ?? [];
  const steps = [
    ...(sizes.length > 1 ? ["size"] : []),
    ...product.groups.map((g) => g.id),
  ];
  const selectingSize = sizes.length > 1 && step === 0;
  const group = product.groups[step - (sizes.length > 1 ? 1 : 0)];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  /**
   * Intermediate selections advance locally; the final step sends the item.
   * The ref blocks additional submissions before React renders the busy state.
   */
  async function choose(next: Customization) {
    if (lock.current) return;
    setInput(next);
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    lock.current = true;
    setSaving(true);
    onBusy?.(true);
    try {
      let addedId: string | undefined;
      const ok = await mutate("/lines", { tableId, input: next }, (result) => {
        addedId = result.id;
      });
      setFailed(!ok);
      if (ok) {
        onBusy?.(false);
        onAdded(next, addedId);
      }
    } finally {
      lock.current = false;
      setSaving(false);
      onBusy?.(false);
    }
  }

  return (
    <section
      className="panel choices"
      aria-label={label(product.name, language)}
    >
      <h2 tabIndex={-1} ref={heading}>
        {label(product.name, language)}
      </h2>
      <QuantityControl
        value={input.quantity}
        onChange={(quantity) => setInput({ ...input, quantity })}
        t={t}
        disabled={saving}
      />
      <p>
        {sizes.find((s) => s.id === input.sizeId) &&
          label(sizes.find((s) => s.id === input.sizeId)!.name, language)}{" "}
        {product.groups
          .map((g) => g.choices.find((c) => c.id === input.choices[g.id]))
          .filter(Boolean)
          .map((c) => label(c!.name, language))
          .join(" · ")}
      </p>
      <h3>
        {selectingSize ? t("size") : group && label(group.name, language)}
      </h3>
      <div className="choice-tiles">
        {selectingSize &&
          sizes.map((size) => (
            <button
              key={size.id}
              disabled={saving}
              aria-pressed={input.sizeId === size.id}
              onClick={() => void choose({ ...input, sizeId: size.id })}
            >
              <strong>{label(size.name, language)}</strong>
              <span>
                {size.volume} · {euro(size.price, language)}
              </span>
            </button>
          ))}
        {group?.choices.map((choice) => (
          <button
            key={choice.id}
            disabled={saving}
            aria-pressed={input.choices[group.id] === choice.id}
            onClick={() =>
              void choose({
                ...input,
                choices: { ...input.choices, [group.id]: choice.id },
              })
            }
          >
            {label(choice.name, language)}
          </button>
        ))}
        {group && !group.required && (
          <button
            disabled={saving}
            onClick={() => {
              const choices = { ...input.choices };
              delete choices[group.id];
              void choose({ ...input, choices });
            }}
          >
            {t("skip")}
          </button>
        )}
      </div>
      {saving && <p role="status">{t("loading")}</p>}
      {failed && (
        <div role="alert">
          <p>{t("requestError")}</p>
          <button onClick={() => void choose(input)}>{t("retry")}</button>
        </div>
      )}
      <button
        disabled={saving}
        onClick={() => {
          if (step) setStep(step - 1);
          else onBack();
        }}
      >
        {t("back")}
      </button>
    </section>
  );
}
