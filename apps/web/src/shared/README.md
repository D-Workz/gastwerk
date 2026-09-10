# Web transport, retry handling and shared UI

## Purpose and boundaries

Owns browser API access, serialized mutation/retry state, translations/formatting and common line/count controls. Feature-specific previews and note state stay in waiter.

## Start here

- [api, ApiError, AppState and Mutate](api/api.ts)
- [mutation queue and retained retries](api/useMutation.ts)
- [translations and formatting](i18n/i18n.ts)
- [localized API error mapping](i18n/errors.ts)
- [state-aware line presentation/actions](ui/LineCard.tsx)
- [item count control](ui/QuantityControl.tsx)

## Interfaces and dependencies

api prefixes /api, selects GET versus POST from the presence of a body, sends the protection header and optional retry key, and applies a 12-second fetch timeout. JSON responses are cast to the caller type; AppState is defined here rather than validated through a shared response schema. useMutation is instantiated by App and passed down as Mutate.

## Behavior and invariants

Intentional mutations queue with distinct UUIDs. Transport/5xx failures retain the same operation in per-user sessionStorage; Retry resolves the original caller and reuses its key. Other API errors clear retry state and refresh. This is not offline synchronization. Shared UI includes domain-aware line actions, not only generic styling; general Field/Modal primitives live in packages/ui. QuantityControl caps ordinary selection at 100, while zero removal belongs to backend decrement.

## Making changes

New features should use this transport and supplied Mutate rather than inventing retry logic. Translate new errors and labels in both languages. Inspect API response handling when adding non-JSON error sources. Keep shared imports independent of features and check the frontend graph test.

## Verification

[intentional queue and lost-response retry](../../../../tests/notes.test.tsx); [relative-import graph constraints](../../../../tests/architecture.test.ts); [controls and localized preview failure](../../../../tests/components.test.tsx).

Run `npm test -- tests/notes.test.tsx tests/architecture.test.ts tests/components.test.tsx` from `gastwerk/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Non-JSON proxy errors can throw during response.json() before ApiError classification; recovery under that condition is not covered by the inspected tests. Treat this as a suspected retry gap, not a verified production incident. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
