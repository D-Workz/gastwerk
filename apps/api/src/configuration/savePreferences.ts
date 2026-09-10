/**
 * Whole-document preference updates for the authenticated user.
 * The HTTP mutation envelope supplies the user and transaction.
 */
import {
  preferencesSchema,
  type User,
} from "../../../../packages/contracts/src/index";
import type { Tx } from "../persistence/db";

/**
 * Parse defaults and replace the current user's preferences; no row revision is
 * required. Returns the parsed document, not proof that an UPDATE matched a row.
 * The caller supplies the authenticated user; this helper does not authenticate.
 */
export async function savePreferences(tx: Tx, user: User, payload: unknown) {
  const preferences = preferencesSchema.parse(payload);
  await tx.query("UPDATE users SET preferences=$2 WHERE id=$1", [
    user.id,
    preferences,
  ]);
  return preferences;
}
