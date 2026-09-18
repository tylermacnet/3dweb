# Repository Architecture & Migration Guidelines

## Core Principles

- Migrate iteratively from `public/test.html` into vertical slices under `src/`.
- Architecture Layers: `components -> application -> ports -> domain` and `adapters -> ports -> domain`.
- Static Embed Constraints: Single bundle entry at `src/index.tsx` registers all public elements (`property-listings`, `listing-card`, `listing-filters`, `listing-details`). There is no root component; each element must work standalone on an external site. Do NOT introduce DI framework containers or server runtimes. Each element accepts its ports via properties/attributes with safe defaults assembled in the bundle entry.
- Strict Domain Purity: Domain modules MUST NOT import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals (`window`, `document`).

## Technical Stack & Mechanics

- UI Layer: Lit framework (`lit`). Use Lit HTML templates (`html```); never use manual string `innerHTML` concatenation.
- Components: Extend base classes via post-construction/constructor controller wiring or Lit properties. Preserve lowercase custom element contracts (`<property-listings>`, `<listing-card>`, `<listing-filters>`, `<listing-details>`). Copy functionality from `public/test.html` while improving artifacts to modern standards: Lit templates, Valibot boundaries, `AbortSignal.timeout(5000)`, token-based CSS. Sorting stays intentionally out of scope.
- State Management: Encapsulate application/UI state inside Lit `ReactiveController` instances.
- CSS Handling: Import component-owned CSS from the component that owns the styles using
  `componentStyles()` from `src/styles/component-styles.ts` (the project's only `unsafeCSS`
  call site; first-party build-time CSS only); the bundle entry only registers
  components and assembles safe port defaults. The light-DOM details popover is styled by its adapter via
  a constructed stylesheet, never by the composition root.
- Network Resilience: Use `AbortSignal.timeout(5000)` instead of manual timer clearing.
- Dependency policy: keep shipped runtime dependencies lightweight and purposeful; development-only
  dependencies may be added when their maintenance and workflow cost is justified.

## Test Standards

- Use the native Node.js test runner (`node:test`) co-located under `test/`.
- Keep pure domain tests in `test/unit/` and adapter, parser, DOM, network, and bundle tests in `test/integration/`.
- Integration tests importing `src/` TypeScript with runtime imports must bundle via esbuild
  first (`nodenext` `.js` specifiers do not resolve to `.ts` on disk).
- Structure each test using Arrange, Act, Assert; keep one observable behavior per test.
- Run `mise run test-unit` for focused unit tests, `mise run test-integration` for focused integration tests, or `mise run test` for both.
- Run `mise run check` to validate formatting, linting, type-checking, tests, and bundling before finalizing work on any slice.

## Tooling Commands

- Copilot MUST strongly prefer repository-defined `mise` tasks (`mise run <task>`) over direct `npm`, `npx`, `node`, or tool-binary invocations. Within `mise.toml` task definitions, call bare binaries; `mise` provides them via `node_modules/.bin` on `PATH` and auto-installs project dependencies through `[deps.install]` (backed by pinned `aube`).
- Use the relevant task for every routine workflow: `mise run test-unit`, `mise run test-integration`, `mise run test`, `mise run typecheck`, `mise run lint`, `mise run format-check`, `mise run build`, or `mise run check`.
- Do not bypass an existing `mise` task with an equivalent direct command, even when the direct command appears shorter.
- Direct package-manager, runtime, or tool commands are permitted only when no suitable `mise` task exists or when diagnosing a failed `mise` task.
- After using a direct diagnostic command, return to the corresponding `mise` task for final validation.

## Commit Message Rules

- Follow the Conventional Commits specification when creating commit messages.
- Use the repository's established `type: description` format and choose the type based on
  release impact (`feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`).
- Keep descriptions concise, lower-case, imperative, and free of a trailing period.
- Use an optional scope when it adds useful subsystem context, and use `!` or a
  `BREAKING CHANGE` footer only for intentional breaking changes.
- Consult the authoritative commit-message guidance before creating or validating a commit:
  https://raw.githubusercontent.com/conventional-changelog/conventional-changelog/refs/heads/master/skills/conventional-commit-message/SKILL.md
