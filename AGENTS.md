# AGENTS.md

## Commands — MUST use `mise run <task>` — NEVER call tools directly

Agents and contributors MUST run every command via `mise run <task>` and MUST NEVER invoke `npm`, `node`, `npx`, `tsx`, `tsc`, `esbuild`, `prettier`, `oxlint`, or any other tool binary directly in the shell. This is a hard requirement, not a preference.

If the needed invocation has no dedicated task, you MUST expand an existing task's args (`mise run <task> -- <args>` — tasks expose `#USAGE` for this) or create a new file task instead of falling back to a direct call. Create new tasks with `mise tasks add --file <ns>:<name> --description "..." -- <command>` or by adding an executable file to `.mise/tasks/<ns>/<name>` (`.gitignore` allows all mise files except local — only `mise.local.toml`/`mise.local.lock`/`.mise.local.toml`/`.mise.local.lock`/`.mise/*.local.toml`/`.mise/*.local.lock` and `.mise/locks/` remain ignored). Never use `mise exec` / `mise x` wrappers as a shortcut — `mise run <task>` is the only entry point (the one exception is a one-off diagnostic `mise exec -- <cmd>` for parity, which must be followed by `mise run <task>` for final validation).

Direct `npx --no-install` (`esbuild`, `prettier`, `oxlint`, `tsc`) and bare `node` are permitted ONLY inside `.mise/tasks/*` definitions as the task's implementation; `mise` provides `node` via `[tools]` and JS CLIs via `node_modules/.bin` resolved by `npx` with no global `PATH` needed, auto-installing project dependencies through `[deps.install]` (backed by pinned `aube`; `package-lock.json` format is preserved).

Prefer project file tasks over inline `.mise/config.toml` tasks: define tasks as executable scripts in `.mise/tasks/<ns>/<name>` (or `.mise/tasks/<name>` for top-level; a directory `ns` groups tasks as `ns:name` with file `ns/_default` for the `ns` task itself — see https://mise.jdx.dev/tasks/file-tasks.html#task-grouping) with a `#MISE description="..."` header (and `#USAGE` for args, `#MISE alias="..."` where an alias is intentional). Keep `.mise/config.toml` for `[tools]`, `[env]`, `[deps.install]`, and `[settings]` only.

All mise-related configuration lives under `.mise/` (config and tasks) with `mise.lock` at the repository root. Do not enumerate tasks here — discover the current task inventory with `mise tasks ls` (or `mise tasks ls --extended` / `mise tasks info <task>` / `mise run <task> --help`); agents may also use the `mise` MCP server (`mise mcp`). Each task's `#MISE description` and `#USAGE` is the source of truth for its purpose and arguments.

## Onboarding — only `mise` is required

1. Install `mise`, then `mise trust` (one-time per checkout) and `mise install`.
2. Install the pre-commit hook (one-time per checkout): `mise generate git-pre-commit --write --task=pre-commit`. Formatting is a commit precondition enforced by the hook — `mise run check` assumes a formatted tree.
3. `mise run check` validates linting, type-checking, tests, and the bundle in parallel (canonical validation gate — keep this hard-coded). Without the hook, run `mise run check:format` first and fix with `mise run format`.
4. Point any AI agent at this checkout: the project toolchain comes from `mise`, the TypeScript language server from `mise run tool:lsp` (alias `mise run lsp`), and task/env introspection from the `mise` MCP server (`mise mcp`) — configure these in the agent's own global/user settings, since the repo ships no agent-specific config.
5. Tool versions are pinned in `.mise/config.toml` (`node`, `aube`, `git-cliff`) with `.mise/mise.lock` committed; the TypeScript LSP is the workspace compiler's native server (`tsc --lsp -stdio`, `tool:lsp` alias `lsp`, no extra tool); JS libraries stay in `package.json`/`package-lock.json` (exact versions) because `src/` and `test/` import them (`lit`, `valibot`, `esbuild`, `linkedom`). Agent skills declared by pinned tools sync into `.agents/skills` (gitignored machine-local links) automatically after installs; `mise run tool:skills` (alias `mise run skills`) re-syncs manually.

Direct commands are never run bare — even when no `mise` task exists, this rule still applies: do NOT fall back to `npx`, `node`, or `tsx`; instead create a task or expand an existing task's args. The ONLY permitted bare invocation is a one-off diagnostic `mise exec -- <cmd>` (canonical, `mise x` is alias) for parity, which must be followed by `mise run <task>` for final validation.

## Architecture layers

```
components -> application -> ports -> domain
adapters   -> ports       -> domain
config     -> shared kernel (immutable product policy; imported by all layers,
               type-only from domain)
index.tsx  -> bundle entry (registers all public elements; no root component)
```

- **Domain** (`src/domain/`): Pure business rules. Must NOT import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals.
- **Application** (`src/application/`): `ListingStore` (per-`Document` lazy singleton via `WeakMap`) owns feed loading, request cancellation, load-state machine, filter criteria, and derived visible listings/location groups/price bounds. `ListingFeedLoader`/`ListingFilterStore` are deprecated legacy (per-host, kept for tests only).
- **Ports** (`src/ports/`): Narrow interfaces (`ListingFeed`, `ListingParser`, `DetailsModal`).
- **Adapters** (`src/adapters/`): Concrete implementations (XML parsing, network fetch, browser popover).
- **Components** (`src/components/`): Independent Lit custom elements, presentational only. Lowercase kebab-case names. Public elements: `<property-listings>`, `<listing-grid>`, `<listing-card>`, `<listing-filters>`, `<listing-details>` (iframe-to-listing element accepting `listing-id` with a `src` override). There is no root component; each public element works standalone on an external site once `public/dist/bundle.js` is loaded. `listing-grid` with `view="card|compact|list"` is the composable primitive; `property-listings` is a thin legacy shell (`listing-filters` + `listing-grid view="card"`).
- **Config** (`src/config/`): Typed immutable product policy (regions, filter definitions, details URLs). Shared kernel: every layer may import it; `domain` imports it type-only so runtime purity holds.

## Key constraints

- Fail fast at build/commit time, degrade gracefully at runtime. Multi-step tasks use `set -e` (or explicit status capture), missing inputs are hard errors (never silent skips), multi-step writes publish atomically so failed runs leave no partial outputs, the `pre-commit` hook blocks unformatted commits, and red CI must block merging. Runtime embeds must never break their host: fall through to working fallbacks (navigation over modal, notices over crashes) instead of throwing.
- Generated outputs are reproducible from committed inputs and never committed: `public/dev.html` is rebuilt from `public/dev.template.html` plus the sample feed on every `build`.

- No DI containers, service locators, or mutable global singletons. The single bundle registers all elements; each element accepts its ports via properties/attributes with safe defaults assembled per document in the bundle entry (shared immutable location resolver, one feed and one `ListingStore` per document, one popover modal per document). No root component. The classic bundle exposes the store accessor on `window.__3DWEB__` so dev hosts loading both `bundle.js` + `bundle.esm.js` share one singleton.
- Domain purity: no Lit/DOM/browser globals in `src/domain/`.
- CSS is component-owned: imported via `componentStyles()` in the owning component's `static styles`.
  `src/styles/component-styles.ts` is the only `unsafeCSS` call site (first-party build-time CSS only).
  Exception: the light-DOM details popover is styled by its adapter
  (`src/adapters/browser-details-modal.css`, constructed stylesheet, `:root` token mirror) —
  `:host` tokens do not resolve outside shadow roots.
- Use `AbortSignal.timeout(5000)` for network resilience, not manual timer clearing.
- Use Valibot for lightweight runtime validation at external-to-domain boundaries.
- Use Lit HTML templates only — never manual `innerHTML` concatenation.

## Address Parser Design: ManageBuilding Feed Quirk

ManageBuilding `MarketingName` follows `"<property_name> - <unit_name>"`. The Address field is
often already correctly formatted, so it remains the address source. When Address exactly matches
MarketingName, the parser can use that structure to recognize a trailing initials segment in the
property-name portion without mistaking the final unit name for initials.

Initials cleanup belongs in `XmlListingParser`, not `AddressNormalizer`: it is feed-specific,
requires the MarketingName boundary, and keeps the domain normalizer pure and feed-agnostic.

The parser removes a trailing 1–3 uppercase-letter segment from the property name only. It keeps
the final unit name when the XML `Unit` field is empty; the name may be nonnumeric (for example,
`"Penthouse"`). An explicit XML `Unit` value takes precedence over that MarketingName unit name.
If Address differs from MarketingName, it is treated as manually corrected and used as-is.

Examples:

- `"37 Victoria Street - SH - 1"` → address `"37 Victoria Street"`, unit name `"1"` (strip `"SH"`)
- `"37 Victoria Street - SH - Penthouse"` → address `"37 Victoria Street"`, unit name `"Penthouse"`
- `"12 Main Street - OW"` → `"OW"` is the unit name, not property initials
- `"209 Prince Street - 2"` → keep the address and unit name; there is no initials segment

## Test structure

- `test/unit/` — pure domain tests (listing, address-normalizer, location-resolver, listing-filter).
- `test/integration/` — adapter, parser, DOM, network, bundle tests.
- `test-src/sample/listingFeeds.xml` — concrete Buildium source-XML reference and integration-test fixture; inspect its nested XML with an editor's tree/format view. It is a sample, not an exhaustive field catalog; see the Buildium source XML reference in `docs/DEVELOPMENT.md` and check `XmlListingParser` separately to see which fields are mapped.
- Tests use `node:test` (native Node runner). Discover test tasks with `mise tasks ls` (names under `test:`) and run `mise run test` for all or `mise run test:unit` / `mise run test:integration` for focused suites.
- Structure tests: Arrange, Act, Assert — one observable behavior per test.
- Integration tests importing `src/` TypeScript with runtime imports must bundle via esbuild first
  (`nodenext` `.js` specifiers do not resolve to `.ts` on disk); direct imports only work for
  type-only or dependency-free modules.

## Post-change mandatory process

After every major architecture, behavior, or public-contract change, complete all steps before
declaring work done:

1. Review dependency direction against architecture layers (domain purity, port ownership, adapter boundaries).
2. Review SOLID principles and 2026 platform practices.
3. Assess test coverage for changed behavior; add focused tests for missing branches/edge cases.
4. Synchronize `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, `docs/ROADMAP.md`, `AGENTS.md` if contracts or naming change.
5. Run `mise run check` and report results.

## Branching and releases (GitHub Flow, solo)

One long-lived branch (`main`, always deployable). No prefixes, no pull requests:
cut any short kebab branch off `main`, `git rebase` onto `origin/main`, merge
locally (squash default, fast-forward when commits stand alone), delete the branch.
Releases are `v*` tags on `main` (no release branches); regenerate `CHANGELOG.md`
with the tag commit. Full workflow, Pages/preview runbook, and security posture
live in `docs/DEVELOPMENT.md`.

## Style and formatting

- Prettier: `semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`.
- EditorConfig: 2-space indent, LF line endings, UTF-8.
- TypeScript: `strict`, `module: nodenext`, `target: esnext`, JSX `preserve`.
- Commit messages: Conventional Commits (`type[(scope)]: description`, lower-case
  imperative, no trailing period). Types: `feat`, `fix`, `docs`, `style`,
  `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`; `!`/`BREAKING CHANGE`
  for breaking changes. Squash merges are the enforcement point;
  `mise run release:check` verifies unmerged commits.

## Important files

- `.mise/config.toml` — toolchain, env, and settings (source of truth for runtimes; tasks live in `.mise/tasks/`).
- `.mise/tasks/` — file tasks (executable scripts with `#MISE` header; preferred over inline `.mise/config.toml` tasks; hierarchies use subdirectories `ns/name` → `ns:name` with `ns/_default` for the `ns` task itself).
- `.mise/mise.lock` — pinned toolchain versions (commit updates; managed by mise next to `.mise/config.toml`).
- Agent integration — the repo ships no agent-specific config: any AI agent can use `mise run tool:lsp` (alias `lsp`) for the workspace TypeScript language server and `mise mcp` as an MCP server, configured in the agent's own global settings.
- `src/index.tsx` — bundle entry, single entrypoint registering all public elements.
- `src/loader.ts` — universal loader shipped as `dist/loader.js` (production default, `?preview=` snapshots).
- `src/config/application.ts` — shared details URL, iframe variant, modal title policy.
- `src/styles/component-styles.ts` — sole `unsafeCSS` trust boundary for component styles.
- `src/adapters/browser-details-modal.css` — adapter-owned popover styles.
- `public/index.html` — lean host-page example consuming `./dist/loader.js`.
- `cliff.toml` — git-cliff changelog config (emoji groups, `v*` tags); `CHANGELOG.md` is generated.
- `release:*` task namespace — tag/changelog operations (`changelog`, `preview`, `check`).
- `preview:*` task namespace — branch preview builds (`build`, `publish`, `prune`).
- `.github/workflows/` — `ci.yml` (push → `check`), `pages.yml` (`main` → Pages), `release.yml` (`v*` → assets).
- `public/.nojekyll` — Pages serves `dist/` maps and dotfiles verbatim.
- `src/env.d.ts` — CSS module type declarations.

## Docs

- `docs/DEVELOPMENT.md` — workflow, architecture, address/location/filter policies.
- `docs/STYLE_GUIDE.md` — CSS tokens, typography, layout, accessibility rules.
- `docs/ROADMAP.md` — deferred stories and future enhancements.
