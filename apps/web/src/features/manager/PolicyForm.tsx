/**
 * Structured policy fields within the manager JSON editor. PolicyForm parses
 * the editor value with the shared policy schema and emits JSON changes;
 * Manager owns submission and the configuration revision.
 */
import { Field } from "../../../../../packages/ui/src/index";
import { policySchema } from "../../../../../packages/config/src/index";
import type { T } from "../../shared/i18n/i18n";

/**
 * Render only valid policy JSON. Field updates serialize the parsed policy,
 * including schema defaults, back to the parent editor. Invalid input remains
 * editable in Manager's advanced JSON field while this form is hidden.
 */
export function PolicyForm({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  t: T;
}) {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) return null;
  const policy = parsed.data;

  function update(patch: object) {
    onChange(JSON.stringify({ ...policy, ...patch }, null, 2));
  }

  return (
    <div className="form-grid">
      <Field label={t("rounding")}>
        <select
          value={policy.rounding}
          onChange={(e) => update({ rounding: e.target.value })}
        >
          <option value="half-up">{t("halfUp")}</option>
          <option value="half-even">{t("halfEven")}</option>
        </select>
      </Field>
      <Field label={t("additionPricing")}>
        <select
          value={policy.additionPricing}
          onChange={(e) => update({ additionPricing: e.target.value })}
        >
          <option value="per-portion">{t("perPortion")}</option>
          <option value="proportional">{t("proportional")}</option>
        </select>
      </Field>
      <Field label={t("removalPricing")}>
        <select
          value={policy.removalPricing}
          onChange={(e) => update({ removalPricing: e.target.value })}
        >
          <option value="no-refund">{t("noRefund")}</option>
          <option value="proportional-refund">{t("proportional")}</option>
        </select>
      </Field>
      <Field label={t("reasonLength")}>
        <input
          type="number"
          min="1"
          max="100"
          value={policy.servedCorrectionReasonMin}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n >= 1 && n <= 100) update({ servedCorrectionReasonMin: n });
          }}
        />
      </Field>
    </div>
  );
}
