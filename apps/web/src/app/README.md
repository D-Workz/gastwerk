# App: composing the browser application

This module connects session data, navigation and role features. [main.tsx](../main.tsx) mounts App once. The API remains responsible for authentication, permissions, business rules and persistence.

## Entry points and ownership

| File                                                                      | Responsibility                                                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [App.tsx](App.tsx)                                                        | Choose role views, hold language/view selection, coordinate waiter navigation guards and wire mutation retries to session refresh.              |
| [useSession.ts](useSession.ts)                                            | Restore/login/logout sessions, fetch the application snapshot, handle expiry and connection state, and ignore responses from obsolete sessions. |
| [usePolling.ts](usePolling.ts)                                            | Schedule two-second, focus and online refreshes while authenticated; remove timers/listeners on cleanup.                                        |
| [LoginScreen.tsx](LoginScreen.tsx)                                        | Render login fields and own submission busy/error presentation; receives a login callback.                                                      |
| [AppHeader.tsx](AppHeader.tsx)                                            | Render branding, language selection and user/logout controls; receives callbacks.                                                               |
| [HistoryView.tsx](HistoryView.tsx)                                        | Render closed orders and audit history from the server snapshot.                                                                                |
| [StockWarnings.tsx](StockWarnings.tsx)                                    | Display negative/low stock warnings from server balances and thresholds.                                                                        |
| [SourceBar.tsx](SourceBar.tsx)                                            | Render the source link and publish the bar height for sticky/focus offsets.                                                                     |
| [source.ts](source.ts) and [source-bar.module.css](source-bar.module.css) | Public source destination and scoped bar layout.                                                                                                |

## Session and interaction flow

`useSession` owns one session value. Immediately after login/restoration it contains the authenticated user while the first state request loads. Once loaded, the server snapshot contains the authoritative displayed user; there is no separately updated user state. Transient refresh failures retain the last snapshot and mark it disconnected. A 401 clears the session. A generation counter invalidates earlier requests after logout, expiry, a new login or unmount.

The hook calls App's stable `onAuthenticated` callback after restore/login to initialize language and role view. Polling updates server data without resetting the selected view or initializing presentation preferences again. Scheduling lives in usePolling; it neither parses responses nor owns another user state. Poll requests may still overlap within the same session; this refactor does not introduce cancellation or ordered-response handling.

App imports waiter, preparation and manager through their feature entry points. The waiter registers a navigation guard to flush notes before a role change or logout. Login errors stay in LoginScreen; mutation and logout errors appear in the authenticated shell. Failed logout retains the session and displays an error. The shared mutation hook owns retained requests and retry keys; successful mutations call the session refresh function.

Presentation components do not issue their own API requests. History and stock warnings receive the current snapshot. The source bar stays outside the login/authenticated branches and renders once per document, including inside an iframe. Its height offsets waiter navigation and document focus scrolling; native modal dialogs remain in the top layer.

## Extending and remaining boundaries

Add role views through feature entry points and compose them in App. Keep server data in the session hook, screen-specific inputs in their owning views, and polling scheduling in usePolling. Keep `onAuthenticated` stable so normal App renders do not restart session restoration. Adding a new view does not require a router or global store.

The SourceBar height variable belongs to the document root and assumes a single bar per document. The aggregate AppState response is still browser-defined and is not runtime-validated as a whole; see the [main guide](../../../../README.md#shared-response-contract-ownership). Changes to the shared mutation queue's account-switch behavior remain outside this refactor.

## Verification and navigation

[Session tests](../../../../tests/session.test.tsx) cover restoration, initial loading, snapshot user ownership, transient failures, expiry, late responses, StrictMode and polling cleanup. [App tests](../../../../tests/app.test.tsx) cover login errors, language/role selection, guarded navigation/logout, history, failed logout and same-key preference retries. [Notes/retry tests](../../../../tests/notes.test.tsx) exercise the existing mutation machinery; [browser workflows](../../../../tests/e2e/workflow.spec.ts) exercise real role sessions and ordering.

Run `npm test -- tests/app.test.tsx tests/session.test.tsx tests/notes.test.tsx` from `gastwerk/` with installed dependencies; no database is needed for these tests. Follow the [web test prerequisites](../../README.md#runtime-and-checks) for the separate database/browser suites. Test inventory is not a substitute for the current work log's executed results.

Return to the [web guide](../../README.md) or [architecture map](../../../../docs/architecture.md).
