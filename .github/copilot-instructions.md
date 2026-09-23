# Repository Architecture & Migration Guidelines

## Core Principles

- Migrate iteratively from the frozen `public/test.html` baseline (kept byte-identical for parity comparison; never edit it) into vertical slices under `src/`.
- Architecture Layers: `components -> application -> ports -> domain` and `adapters -> ports -> domain`; `config` is a shared kernel (immutable product policy imported by all layers, type-only from domain).
- Static Embed Constraints: Single bundle entry at `src/index.tsx` registers all public elements (`property-listings`, `listing-card`, `listing-filters`, `listing-details`). There is no root component; each element must work standalone on an external site. Do NOT introduce DI framework containers or server runtimes. Each element accepts its ports via properties/attributes with safe defaults assembled in the bundle entry.
- Strict Domain Purity: Domain modules MUST NOT import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals (`window`, `document`).

## Technical Stack & Mechanics

- UI Layer: Lit framework (`lit`). Use Lit HTML templates (`html```); never use manual string `innerHTML` concatenation.
- Components: Extend base classes via post-construction/constructor controller wiring or Lit properties. Preserve lowercase custom element contracts (`<property-listings>`, `<listing-card>`, `<listing-filters>`, `<listing-details>`). Copy functionality from the frozen `public/test.html` baseline while improving artifacts to modern standards: Lit templates, Valibot boundaries, `AbortSignal.timeout(5000)`, token-based CSS. Sorting stays intentionally out of scope.
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
- Discover test tasks with `mise tasks ls` (names under `test:`) and run `mise run test:unit` / `mise run test:integration` / `mise run test`. Run `mise run check` to validate formatting, linting, type-checking, tests, and bundling before finalizing work on any slice (canonical gate — keep hard-coded).

## Tooling Commands — MUST use `mise run <task>`, NEVER call tools directly

- Agents and contributors MUST run every command via `mise run <task>` and MUST NEVER invoke `npm`, `node`, `npx`, `tsx`, `tsc`, `esbuild`, `prettier`, `oxlint`, or any other tool binary directly in the shell. This is a hard requirement, not a preference. If the needed invocation has no dedicated task, you MUST expand an existing task's args (`mise run <task> -- <args>` — tasks expose `#USAGE` for this) or create a new file task instead of falling back to a direct call.
- Create new tasks with `mise tasks add --file <ns>:<name> --description "..." -- <command>` or by adding an executable file to `.mise/tasks/<ns>/<name>` (`.gitignore` allows all mise files except local — only `mise.local.toml`/`mise.local.lock`/`.mise.local.toml`/`.mise.local.lock`/`.mise/*.local.toml`/`.mise/*.local.lock` and `.mise/locks/` remain ignored). Never use `mise exec` / `mise x` wrappers as a shortcut — `mise run <task>` is the only entry point (the one exception is a one-off diagnostic `mise exec -- <cmd>` for parity, which must be followed by `mise run <task>` for final validation).
- Direct `npx --no-install` (`esbuild`, `prettier`, `oxlint`, `tsc`) and bare `node`/`opencode` are permitted ONLY inside `.mise/tasks/*` definitions as the task's implementation; `mise` provides `node`/`opencode` via `[tools]` and JS CLIs via `node_modules/.bin` resolved by `npx` with no global `PATH` needed, auto-installing project dependencies through `[deps.install]` (backed by pinned `aube`).
- Prefer project file tasks in `.mise/tasks/<ns>/<name>` (or `.mise/tasks/<name>` for top-level; directory `ns` groups tasks as `ns:name` with `ns/_default` for `ns` itself — see https://mise.jdx.dev/tasks/file-tasks.html; project-local, committed, isolated to this repo — not global `~/.config/mise`) over inline `[tasks.*]` in `.mise/config.toml`. Keep `.mise/config.toml` for `[tools]`, `[env]`, `[deps.install]`, and `[settings]` only. Discover tasks with `mise tasks ls` / `mise tasks info <task>` / `mise run <task> --help` or `mise mcp`; do not hard-code full inventories in docs.
- Use `mise run <task>` for every routine workflow — discover the current inventory with `mise tasks ls` and keep `mise run check` as the hard-coded validation gate. Do not bypass an existing `mise` task with an equivalent direct command, even when the direct command appears shorter.
- Direct commands are never run bare — even when no `mise` task exists, this rule still applies: do NOT fall back to `npx`, `node`, or `tsx`; instead create a task or expand an existing task's args. After any diagnostic `mise exec --` use, return to `mise run <task>` for final validation.

## Commit Message Rules

- Follow the Conventional Commits specification when creating commit messages.
- Use the repository's established `type: description` format and choose the type based on
  release impact (`feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`).
- Keep descriptions concise, lower-case, imperative, and free of a trailing period.
- Use an optional scope when it adds useful subsystem context, and use `!` or a
  `BREAKING CHANGE` footer only for intentional breaking changes.
- Consult the authoritative commit-message guidance before creating or validating a commit:
  https://raw.githubusercontent.com/conventional-changelog/conventional-changelog/refs/heads/master/skills/conventional-commit-message/SKILL.md
