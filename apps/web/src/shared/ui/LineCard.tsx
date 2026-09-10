import { unitLabel } from "../i18n/i18n";
import { useState } from "react";
import {
  label,
  type Line,
  type State,
} from "../../../../../packages/contracts/src/index";
import { Field, Modal } from "../../../../../packages/ui/src/index";
import type { Mutate } from "../api/api";
import {
  date,
  euro,
  quantity as formatQuantity,
  type Language,
  type T,
} from "../i18n/i18n";

export function LineCard({
  line,
  language,
  t,
  mutate,
  station = false,
  onEdit,
  manager = false,
}: {
  line: Line;
  language: Language;
  t: T;
  mutate: Mutate;
  station?: boolean;
  onEdit?: (replacement: boolean) => void;
  manager?: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function change(state: State) {
    setBusy(true);
    try {
      if (
        await mutate(`/lines/${line.id}/transition`, {
          version: line.version,
          state,
          reason: reason ?? "",
        })
      )
        setReason(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`line ${line.state}`} data-testid={`line-${line.id}`}>
      <div className="row between">
        <strong>
          {line.input.quantity} × {label(line.snapshot.product.name, language)}
        </strong>
        <span className="badge">{t(line.state)}</span>
      </div>
      {station && (
        <small>
          {t("revision")} {line.version} · {date(line.updatedAt, language)} ·{" "}
          {Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(line.createdAt).getTime()) / 60000,
            ),
          )}{" "}
          {t("age")}
        </small>
      )}
      {line.input.sizeId && (
        <p>
          {label(
            line.snapshot.product.sizes?.find((s) => s.id === line.input.sizeId)
              ?.name ?? { de: "", en: "" },
            language,
          )}
        </p>
      )}
      {Object.entries(line.input.choices).map(([g, c]) => (
        <p key={g}>
          {label(
            line.snapshot.product.groups
              .find((x) => x.id === g)
              ?.choices.find((x) => x.id === c)?.name ?? { de: c, en: c },
            language,
          )}
        </p>
      ))}
      {line.input.edits.map((e) => (
        <p key={e.ingredientId} className="modification">
          {label(
            line.snapshot.ingredients.find((i) => i.id === e.ingredientId)
              ?.name ?? { de: e.ingredientId, en: e.ingredientId },
            language,
          )}{" "}
          → {formatQuantity(e.quantity, language)}
          {e.quantity === "0" ? ` (${t("remove")})` : ""}
        </p>
      ))}
      {station && <p>{line.input.note && <em>“{line.input.note}”</em>}</p>}
      {line.reason && (
        <p className="warning">
          {t("reason")}: {line.reason}
        </p>
      )}
      {station && line.replacementOf && (
        <p>
          {t("replace")}: {line.replacementOf.slice(0, 8)}
        </p>
      )}
      <details>
        <summary>{t("details")}</summary>
        <p>
          {Object.entries(line.snapshot.resolved)
            .map(
              ([id, q]) =>
                `${label(line.snapshot.ingredients.find((i) => i.id === id)?.name ?? { de: id, en: id }, language)} ${formatQuantity(q, language)} ${unitLabel(line.snapshot.ingredients.find((i) => i.id === id)?.unit ?? "", language)}`,
            )
            .join(" · ")}
        </p>
        <p>
          {t("allergens")}:{" "}
          {line.snapshot.allergens.join(", ") || t("noneKnown")}{" "}
          {line.snapshot.incompleteAllergens && t("incomplete")}
        </p>
        <small>{t("allergenNotice")}</small>
        {station && (
          <p>
            {t("createdBy")}: {line.createdBy} · {t("changedBy")}:{" "}
            {line.changedBy}
          </p>
        )}
      </details>
      <div className="row between">
        <strong>
          {euro(line.snapshot.unitPrice, language)} × {line.input.quantity}
        </strong>
        <div className="row">
          {station && line.state === "submitted" && (
            <button
              disabled={busy}
              className="primary"
              onClick={() => void change("preparing")}
            >
              {t("start")}
            </button>
          )}
          {station && line.state === "preparing" && (
            <button
              disabled={busy}
              className="primary"
              onClick={() => void change("ready")}
            >
              {t("markReady")}
            </button>
          )}
          {!station && line.state === "ready" && (
            <button
              disabled={busy}
              className="primary"
              onClick={() => void change("served")}
            >
              {t("serve")}
            </button>
          )}
          {!station && ["draft", "submitted"].includes(line.state) && (
            <button onClick={() => onEdit?.(false)}>{t("edit")}</button>
          )}
          {!station && ["preparing", "ready"].includes(line.state) && (
            <button onClick={() => onEdit?.(true)}>{t("replace")}</button>
          )}
          {!station &&
            line.state !== "cancelled" &&
            (line.state !== "served" || manager) && (
              <button onClick={() => setReason("")}>{t("cancelItem")}</button>
            )}
        </div>
      </div>
      {reason !== null && (
        <Modal title={t("cancelItem")} onClose={() => setReason(null)}>
          <Field label={t("reason")}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button
            disabled={busy || !reason.trim()}
            className="danger"
            onClick={() => void change("cancelled")}
          >
            {t("confirm")}
          </button>
        </Modal>
      )}
    </article>
  );
}
