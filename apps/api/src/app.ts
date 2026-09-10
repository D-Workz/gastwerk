/**
 * HTTP composition through buildApp: routes, request protection and error mapping.
 * Business mutations use the shared envelope; some route-local SQL remains here.
 */
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { z } from "zod";
import {
  customizationSchema,
  type Movement,
} from "../../../packages/contracts/src/index";
import { DomainError } from "./catalog/resolve";
import { saveCatalog } from "./catalog/saveCatalog";
import { saveConfiguration } from "./configuration/saveConfiguration";
import { savePreferences } from "./configuration/savePreferences";
import { replace, transition } from "./fulfillment/service";
import { saveUser } from "./identity/saveUser";
import { authenticate, login, tokenHash } from "./identity/service";
import { recordMovement } from "./inventory/recordMovement";
import { env, pool, transaction } from "./persistence/db";
import { preview } from "./service/preview";
import { readState } from "./service/readState";
import { addLine, closeOrder, editLine } from "./service/service";
import { repeatLine, decrementLine, undoRemoval } from "./service/repeat";
import { permit } from "./shared/audit";
import { mutation } from "./shared/mutation";

/**
 * Construct the server without listening. Registers handlers and request hooks;
 * main.ts starts the listener. Importing this module initializes the shared DB pool.
 */
export async function buildApp() {
  const app = Fastify({
    logger: false,
    bodyLimit: 1024 * 1024,
    // runtimeEnvironment validates an explicit IP; production Compose supplies
    // the web gateway address. Network isolation is a deployment obligation.
    trustProxy:
      process.env.NODE_ENV === "production"
        ? [process.env.API_TRUSTED_PROXY!]
        : false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  // Shared error responses
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        code: "validation",
        message: "Check the submitted fields",
        fields: error.flatten(),
      });
    if (error instanceof DomainError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    const dbError = error as { code?: string; statusCode?: number };
    if (dbError.code === "23505")
      return reply.code(409).send({
        code: "conflict",
        message: "This record already exists. Refresh and review.",
      });
    if (dbError.statusCode === 429)
      return reply.code(429).send({
        code: "rate_limit",
        message: "Too many requests. Please wait.",
      });
    request.log.error({
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return reply.code(500).send({
      code: "internal",
      message: "Operation failed. No success was acknowledged; retry safely.",
    });
  });
  // Reject mismatched supplied origins and require the custom header for writes.
  app.addHook("onRequest", async (request) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin &&
      request.headers.origin !== env.APP_ORIGIN
    )
      throw new DomainError("origin", "Untrusted origin", 403);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-requested-with"] !== "venue"
    )
      throw new DomainError("csrf", "Missing request protection", 403);
  });
  // Readiness checks the expected migration marker and policy row, not all schema.
  app.get("/api/health", async () => {
    try {
      const result = await pool.query(
        "SELECT 1 FROM migrations WHERE version=2",
      );
      const configured = await pool.query(
        "SELECT 1 FROM configuration WHERE id=1",
      );
      if (!result.rowCount || !configured.rowCount) throw new Error();
    } catch {
      throw new DomainError(
        "not_ready",
        "Database migrations or configuration are not ready",
        503,
      );
    }
    return { ok: true };
  });
  // Sessions and read projections
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = z
        .object({
          username: z.string().max(100),
          password: z.string().max(200),
        })
        .parse(request.body);
      const result = await login(body.username, body.password);
      reply.setCookie("session", result.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 43200,
      });
      return result.user;
    },
  );
  app.post("/api/logout", async (request, reply) => {
    if (request.cookies.session)
      await pool.query("DELETE FROM sessions WHERE token=$1", [
        tokenHash(request.cookies.session),
      ]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/me", async (request) => authenticate(request));
  app.get("/api/state", async (request) =>
    readState(await authenticate(request)),
  );
  app.post("/api/preview", async (request) => {
    const user = await authenticate(request);
    permit(user, ["waiter"]);
    const body = z
      .object({ input: customizationSchema, lineId: z.string().optional() })
      .parse(request.body);
    return transaction((tx) => preview(tx, body.input, body.lineId));
  });
  // Profile, catalog and administration
  app.post("/api/preferences", async (request) =>
    mutation(request, (tx, user) => savePreferences(tx, user, request.body)),
  );
  app.post("/api/catalog/:kind", async (request) =>
    mutation(request, (tx, user) =>
      saveCatalog(tx, user, request.body, request.params),
    ),
  );
  app.post("/api/configuration", async (request) =>
    mutation(request, (tx, user) => saveConfiguration(tx, user, request.body)),
  );
  app.get("/api/users", async (request) => {
    const user = await authenticate(request);
    permit(user, []);
    return (
      await pool.query(
        "SELECT id,username,role,active FROM users ORDER BY username",
      )
    ).rows;
  });
  app.post("/api/users", async (request) =>
    mutation(request, (tx, user) => saveUser(tx, user, request.body)),
  );
  app.get("/api/inventory", async (request) => {
    const user = await authenticate(request);
    permit(user, []);
    return (
      await pool.query<Movement>(
        'SELECT id,ingredient_id AS "ingredientId",quantity::text,kind,reason,actor,at,line_id AS "lineId" FROM movements ORDER BY at DESC',
      )
    ).rows;
  });
  app.post("/api/inventory", async (request) =>
    mutation(request, (tx, user) => recordMovement(tx, user, request.body)),
  );
  // Order-line mutations
  app.post("/api/lines", async (request) =>
    mutation(request, async (tx, user) => {
      const b = z
        .object({ tableId: z.string(), input: customizationSchema })
        .parse(request.body);
      return addLine(tx, user, b.tableId, b.input);
    }),
  );
  app.post("/api/lines/:id/repeat", async (request) =>
    mutation(request, (tx, user) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { input } = z
        .object({ input: customizationSchema })
        .parse(request.body);
      return repeatLine(tx, user, id, input);
    }),
  );
  for (const action of ["decrement", "undo-removal"] as const) {
    app.post(`/api/lines/:id/${action}`, async (request) =>
      mutation(request, (tx, user) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        const { version } = z
          .object({ version: z.number().int() })
          .parse(request.body);
        return action === "decrement"
          ? decrementLine(tx, user, id, version)
          : undoRemoval(tx, user, id, version);
      }),
    );
  }
  app.post("/api/lines/:id/edit", async (request) =>
    mutation(request, async (tx, user) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const b = z
        .object({
          version: z.number().int(),
          input: customizationSchema,
          split: z.boolean().default(false),
        })
        .parse(request.body);
      return editLine(tx, user, id, b.version, b.input, b.split);
    }),
  );
  app.post("/api/lines/:id/transition", async (request) =>
    mutation(request, async (tx, user) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const b = z
        .object({
          version: z.number().int(),
          state: z.enum([
            "submitted",
            "preparing",
            "ready",
            "served",
            "cancelled",
          ]),
          reason: z.string().max(1000).default(""),
        })
        .parse(request.body);
      return transition(tx, user, id, b.version, b.state, b.reason);
    }),
  );
  app.post("/api/lines/:id/replace", async (request) =>
    mutation(request, async (tx, user) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const b = z
        .object({
          version: z.number().int(),
          input: customizationSchema,
          reason: z.string().min(1).max(1000),
        })
        .parse(request.body);
      return replace(tx, user, id, b.version, b.input, b.reason);
    }),
  );
  app.post("/api/orders/:id/send", async (request) =>
    mutation(request, async (tx, user) => {
      permit(user, ["waiter"]);
      const b = z
        .object({
          lines: z
            .array(z.object({ id: z.string(), version: z.number().int() }))
            .min(1),
        })
        .parse(request.body);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      // Each transition uses this same transaction; any failure rolls back the batch.
      for (const l of [...b.lines].sort((a, b) => a.id.localeCompare(b.id))) {
        const row = (
          await tx.query<{ order_id: string }>(
            "SELECT order_id FROM lines WHERE id=$1",
            [l.id],
          )
        ).rows[0];
        if (row?.order_id !== id)
          throw new DomainError("order", "Line does not belong to order");
        await transition(tx, user, l.id, l.version, "submitted");
      }
      return { ok: true };
    }),
  );
  app.post("/api/orders/:id/close", async (request) =>
    mutation(request, async (tx, user) =>
      closeOrder(
        tx,
        user,
        z.object({ id: z.string() }).parse(request.params).id,
      ),
    ),
  );
  return app;
}
