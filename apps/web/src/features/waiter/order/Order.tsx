import type {
  Line,
  Order as OrderRecord,
} from "../../../../../../packages/contracts/src/index";
import type { Mutate } from "../../../shared/api/api";
import { euro, type Language, type T } from "../../../shared/i18n/i18n";
import { LineCard } from "../../../shared/ui/LineCard";
import { InlineNote } from "./InlineNote";
import type { Notes } from "./useNotes";

type Props = {
  lines: Line[];
  order?: OrderRecord;
  language: Language;
  t: T;
  mutate: Mutate;
  notes: Notes;
  busy: boolean;
  manager: boolean;
  onEdit: (line: Line, replacement: boolean) => void;
  onRepeat: (line: Line) => void;
  onDecrease: (line: Line) => void;
  onSend: () => void;
  onClose: () => void;
};

export function Order({
  lines,
  order,
  language,
  t,
  mutate,
  notes,
  busy,
  manager,
  onEdit,
  onRepeat,
  onDecrease,
  onSend,
  onClose,
}: Props) {
  const active = lines.filter(
    (l) => l.state !== "cancelled" || notes.entries[l.id],
  );
  const drafts = active.filter((l) => l.state === "draft");
  return (
    <section className="panel order" aria-label={t("order")}>
      <h2 className="order-title" tabIndex={-1}>
        {t("order")}
      </h2>
      {!active.length && <p>{t("empty")}</p>}
      {active.map((line) => (
        <div key={line.id}>
          <LineCard
            line={line}
            language={language}
            t={t}
            mutate={mutate}
            manager={manager}
            onEdit={(replacement) => onEdit(line, replacement)}
          />
          <InlineNote line={line} notes={notes} t={t} />
          <div className="row">
            {line.state !== "cancelled" && (
              <button onClick={() => onRepeat(line)}>{t("oneMore")}</button>
            )}
            {line.state === "draft" && (
              <button
                aria-label={t("decrease")}
                disabled={busy}
                onClick={() => onDecrease(line)}
              >
                −
              </button>
            )}
          </div>
        </div>
      ))}
      {order && (
        <footer>
          <strong>
            {t("order")}: {euro(order.total, language)}
          </strong>
          <p>{t("sendHelp")}</p>
          <button
            className="primary"
            disabled={busy || !drafts.length}
            onClick={onSend}
          >
            {t("send")} ({drafts.length})
          </button>
          <button
            disabled={busy || active.some((l) => l.state !== "served")}
            onClick={onClose}
          >
            {t("close")}
          </button>
        </footer>
      )}
    </section>
  );
}
