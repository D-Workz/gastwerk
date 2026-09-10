/**
 * Authenticated-user state projection through readState. Owns a repeatable-read,
 * read-only transaction; station filtering happens after loading line data.
 */
import type { History, User } from "../../../../packages/contracts/src/index";
import { catalog } from "../catalog/repository";
import { configuration } from "../configuration/repository";
import { balances } from "../inventory/service";
import { transaction } from "../persistence/db";
import { lines, orders } from "./repository";

/**
 * Caller supplies the authenticated user. Station roles see non-draft lines and
 * linked history for their station, and no orders; catalog/config/balances are still
 * returned. Lines/orders are not paginated; only history is limited to 200 rows.
 */
export async function readState(user: User) {
  return transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const cat = await catalog(tx);
    const all = await lines(tx);
    const station = user.role === "kitchen" || user.role === "bar";
    return {
      user,
      ...cat,
      configuration: await configuration(tx),
      lines: station
        ? all.filter(
            (l) =>
              l.state !== "draft" && l.snapshot.product.station === user.role,
          )
        : all,
      orders: station ? [] : await orders(tx),
      balances: await balances(tx),
      history: (
        await tx.query<History>(
          `SELECT h.id,h.line_id AS "lineId",h.actor,h.action,h.at,h.detail FROM history h ${station ? "JOIN lines l ON l.id=h.line_id WHERE l.state <> 'draft' AND l.snapshot->'product'->>'station'=$1" : ""} ORDER BY h.at DESC LIMIT 200`,
          station ? [user.role] : [],
        )
      ).rows,
    };
  });
}
