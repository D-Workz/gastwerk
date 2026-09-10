/**
 * Shared browser transport and application-state/mutation interfaces. App and
 * feature adapters use api to reach same-origin /api routes; ApiError supplies
 * HTTP failure metadata to localized error and retry handling.
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
 * HTTP failure metadata; status 0 represents a fetch failure without a response.
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
 * A body selects POST; omitting it selects GET. Successful JSON is trusted as T
 * without runtime schema validation. Fetch failures become ApiError status 0;
 * JSON decoding failures propagate separately from HTTP ApiError responses.
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
/**
 * Resolves true after a handled success, false after a handled rejection. A lost
 * acknowledgement may keep the promise pending until Retry finishes; callers
 * must await it before treating the operation as saved or abandoning busy state.
 */
export type Mutate = (
  path: string,
  body: unknown,
  onSuccess?: (result: MutationResult) => void,
) => Promise<boolean>;
