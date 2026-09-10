/**
 * Shared Vitest DOM setup for component and hook tests. It installs jest-dom
 * matchers, cleans rendered trees between tests, and supplies minimal dialog
 * methods that toggle the open attribute without emulating native modal behavior.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// Attribute-only stubs: focus trapping and native dialog behavior need browser tests.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

// JSDOM has no layout; actual bar resize/scroll offsets are checked in Chromium.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
