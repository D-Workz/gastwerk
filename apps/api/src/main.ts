/**
 * HTTP process entry point. Starts listening and closes the server/pool on signals.
 * Database migration and seeding are separate entry points.
 */
import { buildApp } from "./app";
import { env, pool } from "./persistence/db";

const app = await buildApp();
await app.listen({ host: "0.0.0.0", port: env.PORT });

for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void app.close().then(() => pool.end());
  });
