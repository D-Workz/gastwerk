import type { AppState, Mutate } from "../../shared/api/api";
import { date, type Language, type T } from "../../shared/i18n/i18n";
import { LineCard } from "../../shared/ui/LineCard";

export function Station({
  state,
  station,
  language,
  t,
  mutate,
}: {
  state: AppState;
  station: "kitchen" | "bar";
  language: Language;
  t: T;
  mutate: Mutate;
}) {
  const lines = state.lines.filter(
    (l) =>
      l.snapshot.product.station === station &&
      l.state !== "draft" &&
      l.state !== "served",
  );
  return (
    <>
      <div className="row between">
        <h2>{t(station)}</h2>
        <span>
          {lines.filter((l) => l.state !== "cancelled").length} {t("record")}
        </span>
      </div>
      <div className="station-grid">
        {lines.map((line) => (
          <section key={line.id} className="panel">
            <h3>
              {t("table")}{" "}
              {state.tables.find((t) => t.id === line.tableId)?.number ??
                line.tableId}
            </h3>
            <LineCard
              line={line}
              language={language}
              t={t}
              mutate={mutate}
              station
            />
          </section>
        ))}
      </div>
      <section className="panel">
        <h3>{t("stationChanges")}</h3>
        {state.history
          .filter(
            (h) =>
              [
                "amended",
                "cancelled",
                "replacement-submitted",
                "split",
                "split-source",
              ].includes(h.action) && lines.some((l) => l.id === h.lineId),
          )
          .slice(0, 30)
          .map((h) => (
            <p key={h.id}>
              {date(h.at, language)} · {h.action} · {h.lineId?.slice(0, 8)} ·{" "}
              {h.actor}
            </p>
          ))}
      </section>
    </>
  );
}
