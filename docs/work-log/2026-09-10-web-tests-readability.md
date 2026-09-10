# Web and test readability — 2026-09-10

## Scope and starting state

Applied the reviewed formatting/comment style to `apps/web/src` and `tests`, including CSS. Starting revision: `1115e5478bbee4c096a74dbc6e9e7067f506181a`. Existing changes included the reviewed `usePreview.ts` example and staged `docs/2026-09-10-gastro-feature-inventory.md`; both were preserved. Gastwerk now resolves as its own Git root; an earlier conversation inspection saw the outer repository and a codex-to-gastwerk move. Several existing guides still name codex.

The user corrected the original target to Gastwerk web and tests, requested a module-context header for each file, and accepted the revised example before this pass. Consulted the evaluator's `agent_commands/formatting_documentation.md`, parent/Gastwerk AGENTS.md, Gastwerk README, architecture map, web/feature/shared READMEs, package manifest/lockfile, formatter/linter/TypeScript configuration, callers, and tests. No other evaluator milestone was applied.

## Changes and decisions

Added concise file-context headers, removed unused generation metadata and malformed placeholder JSDoc, documented non-obvious input/revision/retry contracts, and restored useful spacing with existing Prettier conventions. Preserved import order, expressions, assertions, control flow, translation strings, and tooling directives. No tooling dependency on annotation metadata was found in inspected scripts/configuration.

The reviewed preview example already had the accepted header and needed no further changes. README/configuration/architecture content was not changed because interfaces and behavior remain unchanged. This work log is the only addition outside the requested source roots, as required by repository work-record instructions. Evaluator code and profiles remain untouched.

## Verification

Commands below ran from the Gastwerk root with existing dependencies. Baseline TypeScript and scoped ESLint produced no diagnostics; baseline scoped Prettier reported formatting issues. The earlier preview-only type check also passed.

- `./node_modules/.bin/prettier --check apps/web/src/**/*.{ts,tsx,css} tests/**/*.{ts,tsx}`: passed
- `./node_modules/.bin/eslint apps/web/src tests`: passed
- `./node_modules/.bin/tsc --noEmit`: passed

A standalone comparison over all 38 scoped files passed: emitted JavaScript is identical; normalized TypeScript syntax is unchanged; CSS matches after removal of comments and canonical formatting. The check did not execute application code. Source copies were compared against the starting snapshots before writing to avoid overwriting concurrent edits. Temporary evidence is under `/tmp/gastwerk-format-review/full/` (`changes.diff`, `files.json`, `before/`, `after/`, `check-*.txt`); these are session-local artifacts, not durable repository evidence.

No new tests were added. Behavioral, PostgreSQL, browser, Compose, and architecture evaluation runs were not needed for comments/formatting and were not executed. No services were started or databases accessed. Formatting/types/static comparisons do not establish application correctness.

## Limitations and follow-up

- Preview loading tracks input object identity but not lineId; changing only lineId can leave an earlier snapshot visible during the next request. Behavior remains unchanged.
- Shared transport decodes JSON before classifying HTTP errors. A non-JSON response can bypass ApiError retry classification; the shared module README already identifies this gap.
- Source headers describe test execution side effects; database/browser/Compose test behavior was inspected, not run.
- Existing codex path references in documentation remain unchanged under the explicit README/source-only scope.

## Changed source files

- `apps/web/src/app/App.tsx`
- `apps/web/src/features/manager/CatalogForm.tsx`
- `apps/web/src/features/manager/Manager.tsx`
- `apps/web/src/features/manager/PolicyForm.tsx`
- `apps/web/src/features/manager/index.ts`
- `apps/web/src/features/preparation/Station.tsx`
- `apps/web/src/features/preparation/index.ts`
- `apps/web/src/features/waiter/Service.tsx`
- `apps/web/src/features/waiter/customize/ChoiceSteps.tsx`
- `apps/web/src/features/waiter/customize/Customizer.tsx`
- `apps/web/src/features/waiter/customize/api.ts`
- `apps/web/src/features/waiter/index.ts`
- `apps/web/src/features/waiter/menu/Menu.tsx`
- `apps/web/src/features/waiter/menu/catalog.ts`
- `apps/web/src/features/waiter/order/InlineNote.tsx`
- `apps/web/src/features/waiter/order/Order.tsx`
- `apps/web/src/features/waiter/order/useNotes.ts`
- `apps/web/src/features/waiter/tables/Tables.tsx`
- `apps/web/src/features/waiter/waiter.css`
- `apps/web/src/main.tsx`
- `apps/web/src/shared/api/api.ts`
- `apps/web/src/shared/api/useMutation.ts`
- `apps/web/src/shared/i18n/errors.ts`
- `apps/web/src/shared/i18n/i18n.ts`
- `apps/web/src/shared/ui/LineCard.tsx`
- `apps/web/src/shared/ui/QuantityControl.tsx`
- `apps/web/src/style.css`
- `tests/api.integration.test.ts`
- `tests/architecture.test.ts`
- `tests/components.test.tsx`
- `tests/compose-smoke.ts`
- `tests/deployment.test.ts`
- `tests/domain.test.ts`
- `tests/e2e/setup.ts`
- `tests/e2e/workflow.spec.ts`
- `tests/notes.test.tsx`
- `tests/setup.ts`
