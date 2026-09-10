# Waiter workspace

## Purpose and boundaries

Owns table → menu → choices/edit → order interaction. It consumes server state and mutations; prices, order validity and stock effects remain backend-authoritative.

## Start here

- [public Service export](index.ts)
- [workspace and action orchestration](Service.tsx)
- [pure menu filtering](menu/catalog.ts)
- [guided choices and size tiles](customize/ChoiceSteps.tsx)
- [explicit ingredient editing](customize/Customizer.tsx)
- [note lifecycle](order/useNotes.ts)
- [order controls](order/Order.tsx)

## Interfaces and dependencies

App passes AppState, translated labels, preferences, Mutate and a navigation-guard registrar. Tables/Menu render selection and keep local search/filter state. Service owns workspace history, chosen table, add/repeat/decrease/send and undo callbacks. Order/InlineNote render notes and actions; useNotes owns pending text and save/flush/review. Customizer uses usePreview, whose feature-local api.ts calls shared transport; preview results are server-calculated. There is no universal feature state hook: substantial orchestration remains in Service.tsx.

## Behavior and invariants

Menu stays mounted while order/customization is shown, but returning to Tables unmounts it. ChoiceSteps offers size first when multiple exist, then every option group; the final choice saves an unsent line. Item count uses shared QuantityControl (1–100). Failed final saves retain selections. Advanced customization waits for the latest debounced preview and explicit review after choice changes. Navigation/send flush draft notes; submitted notes require explicit amendment. In-flight/failed text is held outside the line renderer. Repeat/decrease call backend endpoints; decrement-to-zero undo is revision checked. Browser Back maps destinations to tables/menu rather than reconstructing every intermediate workspace.

## Making changes

Change selection rendering in tables/menu, filtering in menu/catalog.ts, choice progression in customize, and note behavior in order/useNotes.ts. Quantity controls before saving differ from saved-line repeat/decrement. Inspect backend service/repeat.ts and shared useMutation when changing rapid actions; inspect note flushes before navigation/send changes. Scope waiter styles through waiter.css.

## Verification

[choices, failures and menu/order interaction](../../../../../tests/components.test.tsx); [flush, amendment, retry and retained text](../../../../../tests/notes.test.tsx); [German/English viewport workflows](../../../../../tests/e2e/workflow.spec.ts); [authoritative repeats and serving-size effects](../../../../../tests/api.integration.test.ts).

Run `npm test -- tests/components.test.tsx tests/notes.test.tsx` from `codex/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../../../../README.md) and [Milestone 3 execution results](../../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

The Add branch uses group/size presence, not product.guided. Submitted-note flush blocks navigation rather than silently saving. Backend repeat failures all lead to the review flow; this is not a dedicated typed price-change response branch. Use the [architecture map](../../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../../docs/milestone-3-review.md) for qualified claims.
