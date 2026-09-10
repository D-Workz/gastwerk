# Browser application

React/Vite frontend. [src/main.tsx](src/main.tsx) mounts [App](src/app/App.tsx), which owns login/session state, polling, language, role navigation, retry presentation, stock warnings and manager history. These concerns remain together in App; there is no separate authentication router or history feature.

## Module entry points

- [Waiter](src/features/waiter/README.md): table/menu/customization/order navigation and note orchestration.
- [Manager](src/features/manager/README.md): catalog, policy, stock and user administration.
- [Preparation](src/features/preparation/README.md): kitchen/bar queue projection.
- [Shared web code](src/shared/README.md): API transport, mutation retries, translations and common controls.
- [Generic UI](../../packages/ui/README.md), [contracts](../../packages/contracts/README.md) and [config](../../packages/config/README.md): directly imported shared source.

Create a new meaningful feature under `src/features/`, export its public composition component from `index.ts`, and compose it in App. Read its owning module before changing existing behavior. App passes polled state and the shared mutation function; preview-specific transport can stay in the feature while calling shared `api`. Frontend role visibility does not grant API permission. See the [architecture map](../../docs/architecture.md) for backend counterparts.

## Runtime and checks

Run commands from `gastwerk/`, not this directory. `npm run dev:web` uses [vite.config.ts](vite.config.ts) and proxies `/api` to the API; follow [local setup](../../README.md#develop-locally). `npm run build` performs TypeScript checks and outputs `apps/web/dist/`. [Dockerfile](Dockerfile) builds static assets and serves them with [nginx.conf](nginx.conf); `/api/` is proxied and other paths fall back to `index.html`.

`npm test` covers components, notes, the import graph and domain behavior without PostgreSQL. `npm run test:e2e` requires Chromium and the fixed isolated `venue_e2e` database; setup drops that test schema, so it is not a harmless live-site smoke check. See [test prerequisites](../../README.md#tests-and-checks) and [executed checks](../../docs/milestone-3-review.md#verification). The regex-based graph test checks relative static imports inside web/src for cycles and shared-to-feature dependencies; it does not enforce every intended boundary or all possible import forms.

## Source bar

App renders one [SourceBar](src/app/SourceBar.tsx) before login and authenticated content, including inside an iframe. [Public source configuration](src/app/source.ts) links to `https://github.com/D-Workz/gastwerk/tree/production`. The badge names the linked branch, not an exact deployed revision. The local inline GitHub Octicons mark needs no external service or CSP change.

The sticky bar stays in document flow. ResizeObserver publishes `--source-bar-height` for document focus scrolling and the waiter workspace sticky toolbar; keep that offset when changing navigation. Native modal dialogs remain above the bar in the browser top layer. Styling is scoped in [source-bar.module.css](src/app/source-bar.module.css), independently of the portfolio. URLs are compiled public values; no environment or production build setting is added.
