/**
 * Manager user administration through saveUser. The caller owns the transaction
 * covering the user write, session invalidation and password-free audit detail.
 */
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type User } from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import { configuration } from "../configuration/repository";
import type { Tx } from "../persistence/db";
import { audit, permit } from "../shared/audit";

/**
 * Require manager permission. A truthy id updates an existing user and removes
 * that user's sessions; omission creates a user and requires a password. New users
 * receive current policy display defaults. Self-disable/demotion is rejected.
 * Schema, password-hashing and database errors propagate; audit omits the password.
 */
export async function saveUser(tx: Tx, user: User, payload: unknown) {
  permit(user, []);
  const b = z
    .object({
      id: z.string().optional(),
      username: z.string().min(1).max(100),
      password: z.string().min(12).max(200).optional(),
      role: z.enum(["manager", "waiter", "kitchen", "bar"]),
      active: z.boolean(),
    })
    .parse(payload);
  if (b.id === user.id && (!b.active || b.role !== "manager"))
    throw new DomainError("self", "Cannot disable or demote your own account");
  const password = b.password ? await argon2.hash(b.password) : null;
  if (b.id) {
    const result = await tx.query(
      "UPDATE users SET username=$2,role=$3,active=$4,password=COALESCE($5,password) WHERE id=$1",
      [b.id, b.username, b.role, b.active, password],
    );
    if (!result.rowCount)
      throw new DomainError("missing", "User not found", 404);
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [b.id]);
  } else {
    if (!password) throw new DomainError("password", "Password required");
    const cfg = await configuration(tx);
    await tx.query(
      "INSERT INTO users(id,username,password,role,preferences,active) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        b.username,
        password,
        b.role,
        cfg.policy.display,
        b.active,
      ],
    );
  }
  await audit(tx, user.id, "user-saved", {
    id: b.id,
    username: b.username,
    role: b.role,
    active: b.active,
  });
  return { ok: true };
}
