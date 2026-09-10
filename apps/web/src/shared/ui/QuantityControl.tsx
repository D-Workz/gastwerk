/**
 * Controlled item-count buttons shared by the waiter choice and detail editors.
 * The parent owns the value; buttons emit one-step changes within the configured
 * minimum and the fixed upper bound of 100.
 */
import type { T } from "../i18n/i18n";

type Props = {
  value: number;
  onChange: (value: number) => void;
  t: T;
  disabled?: boolean;
  min?: number;
};

/**
 * Callers supply a valid item count and minimum. Buttons limit emitted steps;
 * this component does not clamp an out-of-range value received through props.
 */
export function QuantityControl({
  value,
  onChange,
  t,
  disabled,
  min = 1,
}: Props) {
  return (
    <div className="quantity-control" role="group" aria-label={t("itemCount")}>
      <span>{t("itemCount")}</span>
      <button
        aria-label={t("decrease")}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        aria-label={t("increase")}
        disabled={disabled || value >= 100}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
