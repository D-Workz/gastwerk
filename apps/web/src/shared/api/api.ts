/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import type { Policy } from "../../../../../packages/config/src/index";
import type {
  History,
  Ingredient,
  Line,
  Order,
  Product,
  Table,
  User,
} from "../../../../../packages/contracts/src/index";

/* --- Public API --- */

export type AppState = {
  user: User;
  ingredients: (Ingredient & { version: number })[];
  products: (Product & { version: number })[];
  tables: (Table & { version: number })[];
  configuration: { policy: Policy; version: number };
  lines: Line[];
  orders: Order[];
  balances: Record<string, string>;
  history: History[];
};
/**
 * ApiError - class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}

/**
 * api - exported function
 */
export async function api<T>(
  path: string,
  body?: unknown,
  key?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "venue",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ApiError(
      "Connection failed. The server has not acknowledged this operation.",
      0,
    );
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data as { message?: string; fields?: unknown; code?: string };
    throw new ApiError(
      error.message ?? "Request failed",
      response.status,
      error.fields,
      error.code,
    );
  }
  return data as T;
}

export type MutationResult = { id?: string };
export type Mutate = (
  path: string,
  body: unknown,
  onSuccess?: (result: MutationResult) => void,
) => Promise<boolean>;
