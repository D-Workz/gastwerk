# Production initialization and environment

[environment.ts](environment.ts) preserves development defaults, but production requires an external database password file, secure cookie/HTTPS origin and a single trusted gateway IP. Errors omit secret values; PostgreSQL URL credentials are percent-encoded. Session authentication still uses hashed opaque tokens in PostgreSQL, not a signing key.

[migrate.ts](migrate.ts) wraps the existing versioned, locked migration runner as an explicit compiled one-shot command. [bootstrap.ts](bootstrap.ts) locks initialization, refuses any existing users, and creates one manager and initial policy in a transaction. Only this tool mounts the initial administrator password file. It does not insert demo catalog, orders, inventory or extra accounts. Normal production API startup executes neither tool and has no seed bundle.

The [API build](../../../../scripts/build-api.mjs) bundles these entry points and the HTTP server separately. The production [Dockerfile](../../Dockerfile.production) runs compiled code as Node's non-root user. Runtime dependencies remain external to the bundle. [API composition](../app.ts) trusts only the configured gateway; readiness requires migration 2 and configuration row 1. Update readiness expectations with future schema requirements.

See [deployment](../../../../../docs/deployment.md) and [operations](../../../../../docs/operations.md) for file readability, stable storage, explicit commands and rollback constraints. Regression coverage: [environment tests](../../../../tests/deployment.test.ts), [API integration](../../../../tests/api.integration.test.ts), and [local HTTPS fixture](../../../../../deploy/tests/README.md). No tests should target a live database.
