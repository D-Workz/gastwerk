import { useState } from "react";
import { type Preferences } from "../../../../../../packages/contracts/src/index";
import { Field } from "../../../../../../packages/ui/src/index";
import type { AppState } from "../../../shared/api/api";
import { type T } from "../../../shared/i18n/i18n";
type Props = {
  state: AppState;
  t: T;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  onSelect: (id: string) => void;
};

export function Tables({
  state,
  t,
  preferences,
  setPreferences,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  return (
    <section className="panel">
      <div className="row between">
        <h2 className="tables-title" tabIndex={-1}>
          {t("tables")}
        </h2>
        <div className="segmented">
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={preferences.tables === mode}
              onClick={() => setPreferences({ ...preferences, tables: mode })}
            >
              {t(mode)}
            </button>
          ))}
        </div>
      </div>
      <Field label={t("search")}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("table")}
        />
      </Field>
      <div
        className={preferences.tables === "map" ? "table-map" : "table-list"}
      >
        {state.tables
          .filter(
            (t) =>
              t.active &&
              (t.number + " " + t.area)
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((table) => {
            const occupied = state.orders.some(
              (o) => o.tableId === table.id && !o.closedAt,
            );
            return (
              <button
                key={table.id}
                className={`table-button ${false ? "selected" : ""}`}
                style={
                  preferences.tables === "map"
                    ? { left: `${table.x}%`, top: `${table.y}%` }
                    : undefined
                }
                onClick={() => onSelect(table.id)}
              >
                <strong>
                  {t("table")} {table.number}
                </strong>
                <small>
                  {table.area} · {t(occupied ? "occupied" : "available")}
                </small>
              </button>
            );
          })}
      </div>
    </section>
  );
}
