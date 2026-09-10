/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { ApiError } from "../api/api";
import type { T } from "./i18n";

/* --- Public API --- */


/**
 * errorMessage - exported function
 */
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
