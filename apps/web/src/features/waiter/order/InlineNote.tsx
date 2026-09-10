/**
 * Inline note editor used by Order. Draft text and save/retry state live in
 * useNotes so they can outlive this view; this component owns expansion,
 * explicit amendment controls, and display of retained text on locked items.
 */
import { useState } from "react";
import type { Line } from "../../../../../../packages/contracts/src/index";
import type { T } from "../../../shared/i18n/i18n";
import type { Notes } from "./useNotes";

export function InlineNote({
  line,
  notes,
  t,
}: {
  line: Line;
  notes: Notes;
  t: T;
}) {
  const [expanded, setExpanded] = useState(false);
  const entry = notes.entries[line.id];
  const editable = ["draft", "submitted"].includes(line.state);
  if (!editable)
    return (
      <div>
        <p>{line.input.note}</p>
        {entry && (
          <div role="alert">
            <p>{t("noteFailed")}</p>
            <textarea aria-label={t("note")} readOnly value={entry.text} />
            <p>{t("retainNoteHelp")}</p>
            <button onClick={() => notes.discard(line.id)}>
              {t("discardNote")}
            </button>
          </div>
        )}
        {["preparing", "ready"].includes(line.state) && (
          <small>{t("noteLocked")}</small>
        )}
      </div>
    );
  return (
    <div className="inline-note">
      {!expanded && !entry ? (
        <button onClick={() => setExpanded(true)}>
          {t("note")}: {line.input.note || "…"}
        </button>
      ) : (
        <>
          <label>
            {t("note")}
            <textarea
              autoFocus
              value={entry?.text ?? line.input.note}
              maxLength={1000}
              disabled={entry?.status === "saving"}
              onChange={(e) => notes.edit(line, e.target.value)}
              onBlur={() => {
                if (line.state === "draft") void notes.save(line.id);
              }}
            />
          </label>
          {line.state === "submitted" && <p>{t("amendHelp")}</p>}
          <button
            disabled={entry?.status === "saving"}
            onClick={() =>
              void notes.save(line.id).then((ok) => {
                if (ok) setExpanded(false);
              })
            }
          >
            {t(line.state === "submitted" ? "amendNote" : "save")}
          </button>
        </>
      )}
      {entry?.status === "saving" && <p role="status">{t("savingNote")}</p>}
      {entry?.status === "error" && (
        <div role="alert">
          <p>{t("noteFailed")}</p>
          <p>
            {t("saved")}: {line.input.note || "—"}
          </p>
          <button
            onClick={() => {
              notes.review(line);
              void notes.save(line.id);
            }}
          >
            {t("reviewed")} · {t("retry")}
          </button>
        </div>
      )}
    </div>
  );
}
