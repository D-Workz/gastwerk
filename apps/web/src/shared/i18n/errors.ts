/**
 * Shared mapping from API failures to browser translation keys. App, mutation
 * handling, and feature views use errorMessage to present localized failures
 * without displaying raw server error messages.
 */
import { ApiError } from "../api/api";
import type { T } from "./i18n";

export function errorMessage(error: unknown, t: T): string {
  if (!(error instanceof ApiError)) return t("requestError");
  if (error.status === 0 || error.status >= 500) return t("connectionError");
  if (["required", "size", "option"].includes(error.code ?? ""))
    return t("requiredError");
  if (error.code === "repeat_review") return t("reviewRepeat");
  if (
    ["unavailable", "ingredient", "portion", "product"].includes(
      error.code ?? "",
    )
  )
    return t("unavailableError");
  if (error.status === 409) return t("conflictError");
  return t("requestError");
}
