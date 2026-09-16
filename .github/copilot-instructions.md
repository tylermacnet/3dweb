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
- CSS Handling: Import component-owned CSS from the component that owns the styles using
  `unsafeCSS`; the composition root should only register components and wire dependencies.
- Network Resilience: Use `AbortSignal.timeout(5000)` instead of manual timer clearing.

## Test Standards

- Use the native Node.js test runner (`node:test`) co-located under `test/`.
- Keep pure domain tests in `test/unit/` and adapter, parser, DOM, network, and bundle tests in `test/integration/`.
- Structure each test using Arrange, Act, Assert; keep one observable behavior per test.
- Run `mise run test-unit` for focused unit tests, `mise run test-integration` for focused integration tests, or `mise run test` for both.
- Run `mise run check` to validate formatting, linting, type-checking, tests, and bundling before finalizing work on any slice.

## Tooling Commands

- Copilot MUST strongly prefer repository-defined `mise` tasks (`mise run <task>`) over direct `npm`, `npx`, `node`, or tool-binary invocations.
- Use the relevant task for every routine workflow: `mise run test-unit`, `mise run test-integration`, `mise run test`, `mise run typecheck`, `mise run lint`, `mise run format-check`, `mise run build`, or `mise run check`.
- Do not bypass an existing `mise` task with an equivalent direct command, even when the direct command appears shorter.
- Direct package-manager, runtime, or tool commands are permitted only when no suitable `mise` task exists or when diagnosing a failed `mise` task.
- After using a direct diagnostic command, return to the corresponding `mise` task for final validation.
