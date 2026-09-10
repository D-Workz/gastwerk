/**
 * Preview transport for waiter customization. usePreview calls this adapter
 * to request a server snapshot through shared API transport, optionally with
 * an existing line ID for the preview context.
 */
import type {
  Customization,
  Snapshot,
} from "../../../../../../packages/contracts/src/index";
import { api } from "../../../shared/api/api";

export function previewCustomization(
  input: Customization,
  lineId?: string,
): Promise<Snapshot> {
  return api<Snapshot>("/preview", { input, ...(lineId ? { lineId } : {}) });
}
