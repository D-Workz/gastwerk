# Restaurant App â€” Owner's Project Record

Version: 1.0 Â· 2026-09-08

## 1. Purpose and document boundaries

This file records product direction, decisions, deferred ideas and the development experiment. Keep it outside the implementation agent's initial project context. Give the agent SPEC.md, which is a self-contained milestone-one task and deliberately does not mention the experiment.

SPEC.md is the requirements baseline. The generated repository README will explain how to run the implemented application. Architecture and milestone-status documentation will describe what actually exists, including gaps. Later milestone specifications will extend that repository rather than repeatedly presenting the whole roadmap.

## 2. Motivation and audience

The owner is a developer experienced in Java, JavaScript, React, Node and relational/document/graph databases. The project is an opportunity to regain practical experience and document different AI-assisted development approaches. Initial intent is open source, not monetization. No license has been selected.

The product is a restaurant operations web app for the Austrian market, with German and English support. A friend working in hospitality will supply specific operational frustrations and desired features later. Their venue type, current system and concrete pain points are not yet known. Do not claim a validated market gap.

## 3. Confirmed decisions

| Topic | Decision |
| --- | --- |
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Database baseline | PostgreSQL |
| Deployment baseline | Docker Compose, frontend/backend/database services |
| Architecture | Modular monolith; separation of UI, transport, domain services and persistence |
| First delivery | Responsive browser app, initially one venue |
| Languages | German and English |
| Customization | Validated configuration, reusable components, venue defaults and user display preferences |
| Waiter selection | Table number/list or simplified map; menu list or tiles; configurable density/size |
| Item actions | Always-present Add and Edit controls; ingredient removal/restoration/addition and notes |
| Guided ordering | Configurable follow-up choices, e.g. apple juice pure/still/sparkling |
| Ingredient selection | Configured quick choices and advanced search across the active ingredient catalog |
| Portions and pricing | Explicit serving quantities and configurable surcharges |
| Learned choices | Record modification usage now; frequency-based suggestions later |
| Quality | Strict typing, focused modules, useful comments, component/domain/integration/E2E tests and maintained documentation |
| Handoff | Self-contained milestone specification; private roadmap and experiment notes kept separate |

## 4. Milestone-one product summary

Deliver ingredients â†’ recipes/menu â†’ waiter orders â†’ kitchen/bar â†’ inventory consumption, with real persistence and multiple users. A manager configures catalog, portions, guided choices, stock and tables. Waiters customize and send items. Stations start preparation and mark ready; waiters mark served and close the service order. German/English and configurable layouts are part of the first release.

Steps: 1A foundation, 1B catalog/inventory, 1C ordering, 1D preparation/integration, 1E verification/documentation. These are steps inside one complete milestone, not permission to stop at scaffolding.

The detailed requirements and acceptance scenarios live in SPEC.md. They include concurrency, retried requests, historical price/recipe snapshots, amendments, and cancellation behavior as well as normal ordering.

## 5. Explicit working defaults added to make the handoff implementable

The following are drafting defaults, not requirements reported by the hospitality friend. They are explicit in SPEC.md and can be revised in a later specification:

- One inventory pool and one open service order per table; multiple waiters may contribute.
- Persist drafts server-side; drafts are visibly unsent and absent from preparation queues.
- Consume ingredients when preparation begins, exactly once and transactionally.
- Cancellation before preparation consumes nothing; afterward, consumption remains.
- After preparation starts, changes use cancellation plus a replacement ticket. This is intentionally conservative about reusable ingredients.
- Allow negative recorded inventory with a warning; manually configured availability remains authoritative.
- Advanced additions without portion defaults require a quantity. Without a configured surcharge, explicitly show no surcharge; waiters cannot set arbitrary prices.
- Required/optional single-choice groups are sufficient initially; multiple groups may share a follow-up screen. No conditional branching engine.
- Use manual allergen data with unknown/incomplete states; no automatic safety claims.
- Informational order value and service closure only; no payments or fiscal receipts.
- Browser operation requires connectivity. Show failure/retry/reconnection states; full offline synchronization is deferred.

## 6. Architecture principles and remaining choices

Use catalog, inventory, service, fulfillment, identity and configuration modules. Contracts may be shared with the frontend; database models stay in the backend. Configure known presentation options and product choices rather than building a general-purpose plugin/workflow engine.

The agent may choose backend framework, ORM/database toolkit, migration library, frontend build tooling, package manager, test libraries, styling library and live-update mechanism. It must document consequential choices and use stable supported dependencies. These were not selected in our discussion.

For a comparison intended to control the stack more tightly, freeze these choices before starting both runs. If each agent chooses independently, record that architecture/tooling choice is part of the comparison.

## 7. Deferred product directions

| Direction | Motivation / decision still needed |
| --- | --- |
| Experience-based quick choices | Rank actual frequent modifications per dish; keep manager-pinned buttons stable and suggestions separate; ordinary counts may suffice |
| LLM side panel | Navigate records, answer stock/menu questions, summarize operational data and link to source records |
| Recipe suggestions | Find existing dishes using ingredients; later suggest new uses or substitutions, clearly distinct from approved recipes |
| Staff/order analytics | Define quantity vs order value vs settled revenue, time windows and attribution before implementing â€œwhich waiter sold mostâ€ |
| Recipe depth | Nested recipes, preparation batches, yields and loss factors |
| Inventory depth | Suppliers, purchasing, multiple locations, expiry dates, batches, waste workflows and stocktaking |
| Service depth | Courses, seats, table transfers, split bills, tips and takeaway |
| Connectivity | Installable PWA and full offline ordering are separate decisions; offline needs a synchronization/conflict policy |
| Hardware | Kitchen printers, scanners and terminal integrations after concrete venue needs emerge |
| Austrian payments/register integration | Separately specify current legal, fiscal and payment requirements before real operation |
| Native apps | Reconsider only when practical device/distribution/integration requirements justify them |
| Expansion | Multi-venue support, reservations and customer self-ordering |

Future LLM access should reuse permission-controlled application services. Numeric calculations belong in the application/database. Initially prefer read-only capabilities, links to underlying records and clear definitions of reporting metrics. Keep the system fully usable without an LLM provider. Staff data visibility must follow role permissions; provider data handling requires a concrete design when this feature is scoped.

## 8. Initial market research retained for context

This is preliminary research from the planning conversation, not a complete competitive assessment. Product documentation establishes advertised functionality; customer reviews are anecdotal and not representative evidence.

- ready2order documents table management, configurable table arrangements and table-order workflows: [restaurant support](https://support.ready2order.com/l/de/category/o2Qp36kvtz-gastroerweiterungen).
- Gastronovi documents inventory, recipe costing and ingredient/allergen management: [inventory](https://www.gastronovi.com/produkte/warenkreislauf/warenwirtschaft/), [costing](https://www.gastronovi.com/produkte/warenkreislauf/kalkulation/).
- An orderbird reviewer described payment activation/contact problems: [reviews](https://www.trustpilot.com/review/www.orderbird.com). This suggests investigating setup dependencies, not claiming a broad product defect.
- Austria has receipt and applicable electronic-register obligations: [official Austrian overview](https://www.usp.gv.at/themen/steuern-finanzen/steuerliche-rechte-und-pflichten/registrierkassen.html). Reverify current rules when fiscal integration is actually scoped.
- Allergen information needs maintained ingredient data: [WKO guidance](https://www.wko.at/tourismus-freizeitwirtschaft/gastronomie/allergeninfos-deutsch).

Working hypothesis: many desired individual features already exist; usability, configuration effort and behavior under service pressure may be more useful differentiators. Validate through the friend's actual examples.

## 9. Questions for the hospitality friend

1. What venue type, service pattern, staff count and devices should we design around?
2. Which system is in use, and what are three concrete frustrating situations?
3. Walk through a busy shift: ordering, amendments, kitchen/bar communication and closure.
4. Which additions/substitutions are frequent, and who decides portions/pricing?
5. What really happens when an item is changed after preparation starts?
6. How reliable is connectivity, and which hardware must work?
7. How is inventory currently recorded, and how precise can it realistically be?
8. Which reports change real decisions, and who should be allowed to view them?

## 10. Development experiment â€” owner only

Original plan: Claude Code as an agent versus more manual development assisted by GPT-6 Astra. The owner subsequently installed Codex CLI, making an agent-versus-agent run possible. Final experiment configuration remains to be recorded; do not infer that a manual third run is committed.

Codex CLI can be started in the project folder with `codex -m gpt-6-astra`. Model access/tool behavior should be checked at run time. Official references consulted: [CLI](https://learn.chatgpt.com/docs/codex/cli), [models](https://learn.chatgpt.com/docs/models).

Comparisons concern complete model/tool/workflow combinations unless those variables are controlled. Keep the same frozen SPEC.md, seed expectations and acceptance criteria for each run. Start from separate equivalent repositories. Do not leak the first implementation into the second unless deliberately testing assisted iteration. Record human learning between runs as a limitation.

### Run record template

| Field | Value to record |
| --- | --- |
| Run ID and date | |
| Specification version / hash | |
| Starting repository commit | |
| Agent name/version | |
| Exact selected model | |
| Reasoning settings | |
| Allowed tools/network/permissions | |
| Framework decisions fixed or agent-selected | |
| Hardware/runtime environment | |
| Start/end and elapsed time | |
| Active human time | |
| Reported usage/cost and measurement basis | |
| Human prompts/corrections | |
| Tests actually run and results | |
| Acceptance scenarios passed/failed | |
| Bugs and time to repair | |
| Documentation/setup usability | |
| Maintainability observations | |
| Unfinished requirements | |

Preserve logs and commits where practical. Evaluate time to first screen separately from time to a verified complete workflow. Avoid judging maintainability by line count or comment count. Document limitations: small sample, different tools/settings, evolving model availability and the owner's increasing familiarity.

## 11. Transition to milestone two

1. Verify milestone one against SPEC.md, including two-browser and persistence scenarios.
2. Review the implemented architecture, schema, API, configuration, tests and limitations.
3. Gather the friend's feedback on the working system.
4. Write a focused next-milestone specification referencing a known baseline commit and existing docs.
5. State additions, changed rules, migrations, unchanged behaviors and new acceptance criteria.
6. Ask the next agent to inspect the actual code; documentation guides inspection but does not replace it.

Preserve important decisions and reasons here. Keep implementation documentation in the repository. Record actual defects or unfinished milestone-one work before presenting them as new features.

## 12. Decision log

| Date | Decision and reason |
| --- | --- |
| 2026-09-08 | Choose Node/TypeScript and React/TypeScript based on owner's preference |
| 2026-09-08 | Use browser-first delivery and modular boundaries for a manageable extensible base |
| 2026-09-08 | Include ingredient editing and guided choices in milestone one because they are central to ordering |
| 2026-09-08 | Support both configured quick choices and full ingredient search; defer learned ordering |
| 2026-09-08 | Require behavioral tests, useful comments and developer/user documentation |
| 2026-09-08 | Separate owner record from agent specification so implementation stays focused on the current milestone |

Dates record this planning session, not independently verified dates for external product claims.

