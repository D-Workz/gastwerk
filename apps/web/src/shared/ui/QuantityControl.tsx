import type { T } from "../i18n/i18n";

type Props = {
  value: number;
  onChange: (value: number) => void;
  t: T;
  disabled?: boolean;
  min?: number;
};

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
