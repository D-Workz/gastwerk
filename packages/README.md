# Shared code in Gastwerk

This folder contains reusable source code used by Gastwerk's applications. It is part of the restaurant project, alongside `apps/web` (the browser) and `apps/api` (the server).

## Why it lives outside apps

The browser and server need to agree on data structures and settings. Keeping one definition here avoids maintaining different copies in each application. For example, a product's fields should mean the same thing in the manager's form and in the server that saves it.

These folders do not run on their own, expose HTTP endpoints or connect to the database. Applications import their TypeScript source directly. Dependencies and commands belong to the [Gastwerk package manifest](../package.json); the individual folders have no package manifests, separate builds or published npm releases.

## Choose a module

| Module | The question it answers | Current consumers |
| --- | --- | --- |
| [contracts](contracts/README.md) | What does this data look like, and what structural rules must it satisfy? | Browser, API and config. |
| [config](config/README.md) | Which settings exist, which values are allowed, and what are their defaults? | Browser policy editor and API; environment settings are consumed by the API. |
| [ui](ui/README.md) | How can screens reuse a labeled input or a dialog? | Browser components. |

## How the pieces interact

When a manager edits a product, the browser uses definitions from contracts and form controls from ui. It sends the edited data to the API. The API validates the input with contracts, checks permissions and business rules, and saves it through its persistence code. Later, price calculation uses the settings described by config. The shared modules support this workflow; the API remains responsible for enforcing it.

Config imports preference definitions from contracts. Contracts depends on Zod, the library used to check data at runtime. UI depends on React. None of these modules imports an application feature, and the API does not use React UI components.

## Where should new code go?

- Put shared data shapes and structural validation in contracts. Business decisions such as whether an order can be closed belong in API services.
- Put shared settings schemas and defaults in config. Reading secret files, saving settings and calculating prices belong to their API modules.
- Put generic React controls in ui. Restaurant-specific screens and controls belong in the browser's feature or shared folders.

UI currently has only one consuming application. Its location separates generic controls from restaurant workflows; it does not mean the server uses it or that a second frontend exists. There is no need to move every reusable browser function into packages.

Each module's `src/index.ts` (or `src/index.tsx`) is its entry point. Read its README before changing it and inspect its consumers because one shared change can affect multiple screens or server operations.

Return to the [Gastwerk overview](../README.md#how-the-project-fits-together) or use the [architecture map](../docs/architecture.md) to explore other modules. See the main README for [test prerequisites and commands](../README.md#tests-and-checks); commands run from `gastwerk/`, not a package subfolder.
