/** Read-only closed orders and audit history from the current server snapshot. */
import { label } from "../../../../packages/contracts/src/index";
import type { AppState } from "../shared/api/api";
import { date, euro, type Language, type T } from "../shared/i18n/i18n";

type Props = { state: AppState; language: Language; t: T };

export function HistoryView({ state, language, t }: Props) {
  return (
    <section className="panel">
      <h2>{t("history")}</h2>
      {state.orders
        .filter((o) => o.closedAt)
        .map((o) => (
          <details key={o.id}>
            <summary>
              {t("table")}{" "}
              {state.tables.find((t) => t.id === o.tableId)?.number} ·{" "}
              {date(o.closedAt!, language)} · {euro(o.total, language)}
            </summary>
            {state.lines
              .filter((l) => l.orderId === o.id)
              .map((l) => (
                <p key={l.id}>
                  {l.input.quantity} ×{" "}
                  {label(l.snapshot.product.name, language)} · {t(l.state)} ·{" "}
                  {l.input.note}
                </p>
              ))}
          </details>
        ))}
      {state.history.map((h) => (
        <details key={h.id}>
          <summary>
            {date(h.at, language)} · {h.action} · {h.actor}
          </summary>
          <pre>{JSON.stringify(h.detail, null, 2)}</pre>
        </details>
      ))}
    </section>
  );
}
