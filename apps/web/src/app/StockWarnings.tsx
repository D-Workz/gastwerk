/** Display server-provided balances; stock permissions and arithmetic stay in the API. */
import { label } from "../../../../packages/contracts/src/index";
import type { AppState } from "../shared/api/api";
import {
  quantity as formatQuantity,
  unitLabel,
  type Language,
  type T,
} from "../shared/i18n/i18n";

type Props = { state: AppState; language: Language; t: T };

export function StockWarnings({ state, language, t }: Props) {
  return (
    <div className="stock-warnings">
      {state.ingredients
        .filter(
          (i) =>
            Number(state.balances[i.id] ?? 0) < 0 ||
            (i.threshold !== null &&
              Number(state.balances[i.id] ?? 0) < Number(i.threshold)),
        )
        .map((i) => (
          <p key={i.id} className="warning">
            {t(Number(state.balances[i.id] ?? 0) < 0 ? "negative" : "low")}:{" "}
            {label(i.name, language)}{" "}
            {formatQuantity(state.balances[i.id] ?? "0", language)}{" "}
            {unitLabel(i.unit, language)}. {t("stockWarning")}
          </p>
        ))}
    </div>
  );
}
