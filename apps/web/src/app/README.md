# App: composing the browser application

This module assembles the screens and shared browser behavior. [main.tsx](../main.tsx) mounts App once; App chooses what to display from the current session, selected role view and server state.

## Entry points and interactions

| File                                           | Responsibility                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [App.tsx](App.tsx)                             | Restore/login/logout sessions, poll state, choose role views, pass mutation callbacks, display retries, stock warnings and history. |
| [SourceBar.tsx](SourceBar.tsx)                 | Render the source link and publish the bar height for sticky/focus offsets.                                                         |
| [source.ts](source.ts)                         | Public repository destination compiled into the browser.                                                                            |
| [source-bar.module.css](source-bar.module.css) | Scoped source-bar layout.                                                                                                           |

App imports waiter, preparation and manager through their feature entry points. It passes AppState and callbacks; features do not own the global session. The waiter registers a navigation guard so App can attempt to flush notes before changing role views or signing out. The shared mutation hook retains unacknowledged requests and refreshes state after handled operations.

The source bar is outside login/authenticated branches and renders once per document, including an embedded document. Its measured height is consumed by document scroll padding and the waiter sticky toolbar. Modal uses the native browser top layer. The branch badge describes the linked branch rather than an exact deployed revision.

## Structural limitations

App currently combines session restoration, polling, language preferences, navigation and history rendering with layout. There is no separate authentication router or history feature. If these areas grow or require independent testing, session/polling orchestration and history presentation are candidates for extraction. Such work must preserve navigation guards, retry identity and role behavior; this guide does not perform that refactor.

The SourceBar height variable belongs to the document root, so its integration assumes a single bar in each document. Its cleanup removes the variable. Avoid mounting several instances in one document without revisiting that ownership.

## Verification and navigation

[Browser workflows](../../../../tests/e2e/workflow.spec.ts) cover application interactions; [notes/retry tests](../../../../tests/notes.test.tsx) cover shared behavior. These references do not establish complete App or SourceBar coverage. Follow [test prerequisites](../../README.md#runtime-and-checks) from `gastwerk/`; database/browser tests require the isolated setup.

Return to the [web guide](../../README.md) or [architecture map](../../../../docs/architecture.md).
