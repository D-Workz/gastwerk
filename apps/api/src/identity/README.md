# Identity and sessions

## Purpose and boundaries

Owns login, session authentication and manager user administration. HTTP cookie attributes and request protection are in the API composition root; role permission checks are shared and service-local.

## Start here

- [login, authenticate and tokenHash](service.ts)
- [saveUser](saveUser.ts)
- [permit](../shared/audit.ts)
- [cookie and request hooks](../app.ts)

## Interfaces and dependencies

Login uses the pool directly to verify an Argon2 password and store a hash of a random token. `authenticate` accepts a Fastify request and returns the active user for an unexpired cookie-backed session. Administration receives the mutation transaction client.

## Behavior and invariants

Sessions expire after 12 hours. The cookie is HttpOnly, SameSite=Strict and optionally Secure. Managers bypass the explicit role lists in `permit`; an empty list is manager-only. Updating a user invalidates their sessions; a manager cannot disable or demote their own account. Saved-user audit detail excludes the password. Logout deletes the current session through `app.ts`.

## Making changes

Inspect both `app.ts` protection hooks and each affected service permission check for access changes. Do not rely on hidden frontend navigation. Changing role/session contracts also affects shared contracts and app authentication state.

## Verification

[direct API authentication and permission checks](../../../../tests/api.integration.test.ts); [login across roles](../../../../tests/e2e/workflow.spec.ts).

Run `npm run test:integration` from `gastwerk/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

No dedicated identity-only unit suite was found. Existing permission tests cover representative routes, not a complete role-by-route matrix. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
