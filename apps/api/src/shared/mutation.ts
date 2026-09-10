/**
 * Authenticated HTTP mutation envelope: transaction ownership and stored-response
 * replay for retry keys. Business validation/authorization stays in the work callback.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { User } from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import { authenticate } from "../identity/service";
import { transaction, type Tx } from "../persistence/db";

/**
 * Authenticate and require a UUID idempotency key. Within one transaction, lock
 * the user/key, replay the stored response for the same fingerprint, or call work
 * and store its result. A different fingerprint for the same key raises 409.
 *
 * Fingerprinting uses method, URL and JSON.stringify(body); property order matters.
 * Authentication runs on replay, but work's permission checks do not run again.
 * work must use the supplied client and leave commit/rollback to this envelope.
 */
export async function mutation(
  request: import("fastify").FastifyRequest,
  work: (tx: Tx, user: User) => Promise<unknown>,
) {
  const user = await authenticate(request);
  const key = z.string().uuid().parse(request.headers["idempotency-key"]);
  const fingerprint = createHash("sha256")
    .update(request.method + request.url + JSON.stringify(request.body ?? {}))
    .digest("hex");
  return transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      user.id + key,
    ]);
    const previous = (
      await tx.query<{ fingerprint: string; response: unknown }>(
        "SELECT fingerprint,response FROM requests WHERE actor=$1 AND key=$2",
        [user.id, key],
      )
    ).rows[0];
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new DomainError(
          "idempotency",
          "Retry key was used for another operation",
          409,
        );
      return previous.response;
    }
    const result = await work(tx, user);
    await tx.query(
      "INSERT INTO requests(actor,key,fingerprint,response) VALUES($1,$2,$3,$4)",
      [user.id, key, fingerprint, JSON.stringify(result)],
    );
    return result;
  });
}
