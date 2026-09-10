# Coding agent instructions

## Purpose and scope

Maintain this React/TypeScript and Node/TypeScript restaurant application incrementally. Preserve working business behavior and persistence while improving code structure and user workflows. Read the active milestone specification, repository README and applicable package instructions before editing.

This file defines lasting engineering conventions. Product changes and acceptance criteria belong in milestone specifications. README.md is the human-facing setup guide. Do not replace an existing AGENTS.md wholesale: merge compatible instructions and resolve conflicts explicitly.

## Repository orientation

The application root for these instructions and commands is `codex/`, inside the outer Git repository. Begin with applicable parent instructions, the [onboarding README](README.md) and [architecture map](docs/architecture.md). Before changing a module, follow the map to its README, read any applicable local instructions, and inspect relevant implementation and tests. Select documentation by the active task; do not load every historical Markdown file indiscriminately.

Treat documentation as guidance to verify. Specifications describe requested behavior, source describes implemented behavior, and executed checks supply verification evidence. Identify disagreements before relying on a claim. The [Milestone 3 review](docs/milestone-3-review.md) records the orientation baseline and known gaps; it is not a permanent substitute for inspecting current code.

## Repository discovery and commands

Before making changes, inspect package manifests, lockfiles, existing modules, API contracts, migrations and tests. Identify the package manager and the actual commands for starting services, formatting, linting, type checking, tests and builds. Use those commands; do not invent commands or change the toolchain without a concrete reason. Update this section with verified repository-specific commands during implementation.

Establish the current test/build baseline and distinguish existing failures from regressions. Do not rebuild the application from scratch or reset user data.

Repository commands below run from `codex/` (npm; root `package-lock.json`). Use [README prerequisites](README.md#tests-and-checks) and report which checks were executed for the current change; the command list itself is not evidence of a new test run:

- Install: `npm ci`; local services: `npm run dev:api`, `npm run dev:web`.
- Database: `npm run db:migrate`, `npm run db:seed`; Docker: `docker compose up -d --build` (see README for ports and persistent volumes).
- Formatting: `npm run format`, `npm run format:check`; lint: `npm run lint`.
- Type checking/build: `npm run typecheck`, `npm run build`.
- Unit/components: `npm test`; PostgreSQL integration: `npm run test:integration`; Chromium: `npm run test:e2e`; combined gate: `npm run check`.
- Integration uses only `venue_test`; Playwright uses only `venue_e2e` on local ports 3002/5180. Never run concurrent suites against the same test database. Database/browser tests require local network/process access outside restricted sandboxes.
- `npm run test:compose` restarts the running Compose application and leaves attributable smoke-test history; use only with the README's prerequisites.

Frontend dependencies flow from app composition to features to shared modules/packages. Waiter styling lives in `features/waiter/waiter.css`; preview transport, preview lifecycle, notes and menu transformations have separate modules. ESLint enforces function spacing; Prettier handles JSX/control-flow formatting and preserves intentional blank lines.

## Formatting and file organization

- Separate top-level function/component declarations with a blank line. Use blank lines between meaningful logical blocks inside functions.
- Format multiline JSX and control flow consistently. Avoid compressed one-line handlers containing multiple operations.
- Organize files consistently: imports; module-level types; constants; component/hook or service exports; private helpers. Follow an existing coherent local convention if present and document any difference.
- Inside React function components, keep hooks unconditional and at the top level; group derived values, handlers, effects and rendering logically without breaking the Rules of Hooks.
- Constructors apply only to classes that actually need them; do not introduce classes or empty sections to satisfy a template.
- Use short section comments where they aid a substantial file. Small files do not need decorative headers for every section.
- Configure formatting/linting checks to enforce conventions where practical, including function spacing if supported by the installed tooling. Do not claim a formatter enforces a rule it does not enforce.
- Prefer descriptive names, explicit types at public boundaries and focused functions. Avoid broad any casts, nested conditional JSX and files with multiple unrelated responsibilities.

## Separation of concerns

- Organize frontend code by feature. Separate waiter, manager and preparation-station responsibilities.
- Keep routing/application composition in app-level modules and truly shared primitives in shared modules.
- Keep HTTP transport in API modules, stateful orchestration in focused hooks, pure transformations in domain utilities, and rendering in small TSX components.
- A view component receives typed props and callbacks. Extract a separate view/hook when complexity warrants it; do not mandate a wrapper and hook for every trivial button.
- React markup remains TSX. Do not add a custom HTML-template engine or use raw HTML injection to imitate another framework.
- Avoid a global helpers.ts or a single enormous hook that merely relocates the original complexity.
- Use feature entry points and acyclic dependencies. Cross-feature access goes through explicit contracts; shared code must not import feature internals.
- Prefer scoped styling or another consistent local styling approach over a growing unstructured global stylesheet.
- Backend application services remain authoritative for prices, recipe resolution, permissions and stock movements.

Preserve documented ownership, public interfaces and important business invariants unless the active task explicitly changes them. When a change crosses module boundaries, inspect the affected modules and tests, not only the first file. If current code violates an intended boundary, report the discrepancy and keep unrelated refactoring out of a focused task.

## Documentation and comments

Explain why non-obvious behavior exists: state transitions, retries, cancellation, snapshots and amendments. Document important contracts and extension points. Comments must stay current and must not simply narrate syntax.

Update affected architecture, module, API, configuration and user documentation in the same change when responsibilities, interfaces, data flows, business rules, settings or verification commands change. Create a concise README for a new meaningful module and link it from the architecture map; do not require one for every small folder. Update links when modules move or are renamed and remove obsolete explanations.

Describe implemented behavior, intent and invariants; separate future plans and unverified assumptions. Prefer stable relative links to source entry points/tests over copied definitions or brittle line references. Keep specifications as requirement baselines; record deviations instead of editing requirements away.

Keep global working rules here, module explanations in module READMEs and necessary local exceptions in scoped instructions. Preserve existing applicable instructions when editing them. AGENTS.md guides tools that read it; it does not automatically enforce compliance across every agent. Describe actual automated checks and their limits rather than implying universal enforcement.

## Verification

Add/update behavioral component tests, domain tests, API/database integration tests and end-to-end tests relevant to the change. Preserve stock/idempotency/authorization/concurrency coverage during UI refactoring. Test both German and English user flows where strings or validation change.

Verify the UI at phone, tablet and desktop dimensions using the available browser tooling. Exercise touch-sized targets, keyboard/focus behavior, back navigation, slow/failed requests and reconnection. Report unavailable verification explicitly.

Run checks appropriate to the active change using the verified formatting, lint, type, test and build commands. Verify referenced documentation paths and anchors where practical, and state command working directories and required services. For documentation-only tasks, follow the active scope; broad regression suites are not required solely for prose changes.

Never call behavior tested merely because tests exist or report a check as passed without executing it. Report failures, unavailable checks and unverified areas honestly. At handoff summarize changed behavior, affected documentation, architecture implications, executed commands/results and remaining limitations. Keep source references and navigation usable for both humans and coding agents.

## Boundaries

Preserve the single-venue scope, PostgreSQL persistence and existing Docker setup. No fiscal/payment integration, offline synchronization, LLM features or speculative plugin systems unless the active milestone explicitly requests them. Never deploy externally or erase data without authorization.

## Production deployment maintenance

Follow [parent deployment rules](../AGENTS.md) and the [deployment guide](../docs/deployment.md). Keep local development independent of the root production Compose, keep secrets/data outside Git and image contexts, and update deployment documentation with changed settings. Verify locally without resetting existing data; report server-specific verification gaps honestly. Production preparation does not itself authorize a live deployment.
