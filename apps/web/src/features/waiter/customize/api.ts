/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import type {
  Customization,
  Snapshot,
} from "../../../../../../packages/contracts/src/index";
import { api } from "../../../shared/api/api";

/* --- Public API --- */


/**
 * previewCustomization - exported function
 */
export function previewCustomization(
  input: Customization,
  lineId?: string,
): Promise<Snapshot> {
  return api<Snapshot>("/preview", { input, ...(lineId ? { lineId } : {}) });
}
