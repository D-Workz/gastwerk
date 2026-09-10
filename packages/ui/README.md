# UI: reusable browser controls

UI contains two small React components that multiple Gastwerk screens reuse. They handle common form and dialog behavior so each screen can focus on its own workflow.

Only the browser application currently uses this module. Its location under packages separates generic controls from restaurant-specific screens; it does not make it a server dependency or a separately published component library.

## What is inside?

The entry point is [src/index.tsx](src/index.tsx).

| Component | Purpose | Example in Gastwerk |
| --- | --- | --- |
| `Field` | Connect a text label to a form control using a generated ID. | A login input or a manager's product-editing field. |
| `Modal` | Open a native browser dialog and provide a title and close button. | The application dialog for retrying an unacknowledged request. |

For example, a screen can write:

```tsx
<Field label="Product name">
  <input name="name" />
</Field>
```

Field associates the label with the input. It does not decide whether the name is valid or save the product. It expects one React child that accepts an `id` prop.

## How it interacts with the app

The calling screen supplies labels, dialog content and an `onClose` callback. Modal uses the native `dialog` element and calls `showModal()` after mounting. The browser provides modal behavior; the application's callback decides what should happen when the close button or Escape is used. A callback can deliberately keep a required retry dialog open.

When Modal unmounts, it attempts to restore focus to the previously focused element. Most text comes from callers; its close button currently has a fixed bilingual accessible label. Native dialog behavior alone does not establish that every calling workflow is accessible.

Neither component makes API requests, validates business data or writes to storage. Restaurant-specific controls such as order-line actions and quantity controls live in [web shared UI](../../apps/web/src/shared/README.md), and larger workflows live in the browser's features. Shared styling for Field and Modal is currently supplied by the browser's [style.css](../../apps/web/src/style.css).

## Making changes and checking them

Inspect callers when changing labels, IDs, focus or closing behavior: a small change here can affect several forms. Generic reusable controls fit here; a component that understands order states or kitchen actions usually belongs in the browser's own modules.

[Component tests](../../tests/components.test.tsx) exercise form consumers, and [browser workflows](../../tests/e2e/workflow.spec.ts) exercise application interactions. There is no dedicated Field/Modal test suite covering every focus-restoration or dialog case.

With dependencies installed and the [supported Node runtime](../../README.md#tests-and-checks), run `npm test -- tests/components.test.tsx` from `gastwerk/`; no database is needed. Browser tests have separate Chromium and isolated-database prerequisites in that guide. These are available checks, not a claim that they were executed for this documentation edit.

Return to the [packages overview](../README.md) or [architecture map](../../docs/architecture.md).
