# Repository Architecture & Migration Guidelines

## Core Principles

- Migrate iteratively from `public/test.html` into vertical slices under `src/`.
- Architecture Layers: `components -> application -> ports -> domain` and `adapters -> ports -> domain`.
- Static Embed Constraints: Single entrypoint at `src/index.tsx`. Do NOT introduce DI framework containers or server runtimes. Explicit TypeScript wiring only.
- Strict Domain Purity: Domain modules MUST NOT import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals (`window`, `document`).

## Technical Stack & Mechanics

- UI Layer: Lit framework (`lit`). Use Lit HTML templates (`html```); never use manual string `innerHTML` concatenation.
- Components: Extend base classes via post-construction/constructor controller wiring orLit properties. Preserve lowercase custom element contracts (e.g., `<listing-card>`, `<property-listings>`).
- State Management: Encapsulate application/UI state inside Lit `ReactiveController` instances.
- CSS Handling: Import `src/styles.css` inside `src/index.tsx` using `unsafeCSS`.
- Network Resilience: Use `AbortSignal.timeout(5000)` instead of manual timer clearing.

## Test Standards

- Use the native Node.js test runner (`node:test`) co-located under `test/`.
- Run `mise run check` to validate formatting, linting, type-checking, tests, and bundling before finalizing work on any slice.

## Tooling Commands

- Prefer repository-defined `mise` tasks (`mise run <task>`) over direct `npm`, `npx`, or tool-binary invocations.
- Use the relevant task for focused work, such as `mise run test`, `mise run typecheck`, `mise run lint`, or `mise run build`.
- Use direct package-manager or tool commands only when no suitable `mise` task exists or when diagnosing a task failure.
