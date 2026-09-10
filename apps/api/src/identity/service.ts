/**
 * Database-backed login and session lookup. Cookie attributes and HTTP request
 * protection are configured by app.ts; these functions use the pool directly.
 */
import argon2 from "argon2";
import type { FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import { pool } from "../persistence/db";

/**
 * Database lookup representation of a session token. login stores this hash
 * and returns the raw token for cookie delivery.
 */
export const tokenHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");

/**
 * Verify an active account and store a 12-hour session using a hash of a random
 * token. Return the raw token and user without the password hash. Missing/invalid
 * credentials raise DomainError (401); hash verification and DB errors propagate.
 */
export async function login(username: string, password: string) {
  const row = (
    await pool.query<User & { password: string }>(
      "SELECT id,username,role,preferences,password FROM users WHERE username=$1 AND active=true",
      [username],
    )
  ).rows[0];
  if (!row || !(await argon2.verify(row.password, password)))
    throw new DomainError("login", "Invalid credentials", 401);
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [tokenHash(token), row.id],
  );
  const { password: _, ...user } = row;
  return { token, user };
}

/**
 * Return the active user for an unexpired session cookie, or DomainError (401).
 * Looks up the token hash; does not renew the session or authorize a business action.
 */
export async function authenticate(request: FastifyRequest): Promise<User> {
  const token = request.cookies.session;
  if (!token) throw new DomainError("authentication", "Please sign in", 401);
  const row = (
    await pool.query<User>(
      "SELECT u.id,u.username,u.role,u.preferences FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now() AND u.active=true",
      [tokenHash(token)],
    )
  ).rows[0];
  if (!row) throw new DomainError("authentication", "Session expired", 401);
  return row;
}
