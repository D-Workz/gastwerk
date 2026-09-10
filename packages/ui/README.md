# Generic UI primitives

## Purpose and boundaries

Owns Field and Modal, two small reusable React components. Domain-aware tickets and quantity controls are in web/shared/ui.

## Start here

- [Field and Modal](src/index.tsx)

## Interfaces and dependencies

Field generates an ID and clones its single child to associate a label. Modal wraps the native dialog element, opens it in an effect and calls the supplied onClose for cancel/close actions. App uses Modal for retry feedback; manager/customization forms consume Field. Imports point directly to source, without a package-specific manifest.

## Behavior and invariants

Modal attempts to restore previously focused elements on cleanup. Native dialog behavior supplies modality; application callbacks determine whether closing is allowed. Field expects a child accepting an id. Neither component performs validation, persistence or API calls.

## Making changes

Inspect all callers for focus and label changes. Keep translated copy in callers, except the currently hard-coded bilingual close label. Do not infer universal accessibility compliance from using a native dialog.

## Verification

[form consumers](../../tests/components.test.tsx); [retry dialog and browser interaction consumers](../../tests/e2e/workflow.spec.ts).

Run `npm test -- tests/components.test.tsx` from `codex/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../README.md) and [Milestone 3 execution results](../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

No dedicated Field/Modal tests were found; consumer tests do not establish every focus-restoration or dialog interaction case. Use the [architecture map](../../docs/architecture.md) for neighboring modules and the [review findings](../../docs/milestone-3-review.md) for qualified claims.
