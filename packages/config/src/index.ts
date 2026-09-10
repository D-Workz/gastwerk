/**
 * Shared venue policy defaults and environment schema. No I/O occurs here;
 * API deployment/environment.ts reads secrets and supplies production-specific checks.
 */
import { z } from "zod";
import { preferencesSchema } from "../../contracts/src/index";

/**
 * Policy schema version is separate from the database row revision. Parsing fills
 * declared defaults; changing them does not rewrite already persisted policy.
 */
export const policySchema = z.object({
  version: z.literal(1),
  rounding: z.enum(["half-up", "half-even"]).default("half-up"),
  additionPricing: z
    .enum(["per-portion", "proportional"])
    .default("per-portion"),
  removalPricing: z
    .enum(["no-refund", "proportional-refund"])
    .default("no-refund"),
  servedCorrectionReasonMin: z.number().int().min(1).max(100).default(5),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.object({ de: z.string(), en: z.string() }),
        quick: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  display: preferencesSchema.default({
    language: "de",
    tables: "list",
    menu: "tiles",
    density: "comfortable",
    favorites: [],
  }),
  branding: z.string().min(1).max(80).default("Gastwerk"),
});
export type Policy = z.infer<typeof policySchema>;

/**
 * Initial policy for seed/bootstrap; existing configuration rows are preserved there.
 */
export const defaultPolicy = policySchema.parse({ version: 1 });

/**
 * Development-compatible settings. PORT is numerically coerced; COOKIE_SECURE
 * remains a string enum. Production checks belong to runtimeEnvironment.
 */
export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgres://venue:venue_local@localhost:5432/venue"),
  PORT: z.coerce.number().default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  DEMO_PASSWORD: z.string().min(12).optional(),
});
