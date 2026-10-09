# Development workflow

## Onboarding — only `mise` is required

1. Install `mise`, then `mise trust` (one-time per checkout) and `mise install`.
2. `mise run check` validates formatting, linting, type-checking, tests, and the bundle.
3. `mise run tool:chat` (alias `mise run chat`) launches OpenCode with the project toolchain and TypeScript LSP.

Tool versions are pinned in `.mise/config.toml` (`node`, `aube`, `opencode`, `git-cliff`) with
`.mise/mise.lock` committed; the TypeScript LSP is the workspace compiler's native server (`tsc --lsp -stdio`,
`tool:lsp` alias `lsp`, no extra tool). JS libraries stay in
`package.json`/`package-lock.json` (exact versions) because `src/` and `test/` import them
(`lit`, `valibot`, `esbuild`, `linkedom`); `mise` auto-installs them through `[deps.install]`
(backed by pinned `aube`; `package-lock.json` format is preserved) before tasks run,
so no manual install is needed. Never mix installers in one tree: prune `node_modules/`
when switching between `npm` and `aube`.

## Use mise tasks first — MUST use `mise run <task>`, NEVER call tools directly

Agents and contributors MUST run every command via `mise run <task>` and MUST NEVER invoke `npm`, `node`, `npx`, `tsx`, `tsc`, `esbuild`, `prettier`, `oxlint`, or any other tool binary directly in the shell. This is a hard requirement, not a preference.

If the needed invocation has no dedicated task, you MUST expand an existing task's args (`mise run <task> -- <args>` — tasks expose `#USAGE` for this) or create a new file task instead of falling back to a direct call. Create new tasks with `mise tasks add --file <ns>:<name> --description "..." -- <command>` or by adding an executable file to `.mise/tasks/<ns>/<name>` (`.gitignore` allows all mise files except local — only `mise.local.toml`/`mise.local.lock`/`.mise.local.toml`/`.mise.local.lock`/`.mise/*.local.toml`/`.mise/*.local.lock` and `.mise/locks/` remain ignored). Never use `mise exec` / `mise x` wrappers as a shortcut — `mise run <task>` is the only entry point (the one exception is a one-off diagnostic `mise exec -- <cmd>` for parity, which must be followed by `mise run <task>` for final validation).

Direct `npx --no-install` (`esbuild`, `prettier`, `oxlint`, `tsc`) and bare `node`/`opencode` are permitted ONLY inside `.mise/tasks/*` definitions as the task's implementation; `mise` provides `node`/`opencode` via `[tools]` and JS CLIs via `node_modules/.bin` resolved by `npx` with no global `PATH` needed, auto-installing project dependencies through `[deps.install]` (backed by pinned `aube`; `package-lock.json` format is preserved).

Task definitions are project file tasks in `.mise/tasks/<ns>/<name>` (preferred, committed, isolated to this repo — not global `~/.config/mise`; a directory `ns` groups tasks as `ns:name` with file `ns/_default` for the `ns` task itself) — see https://mise.jdx.dev/tasks/file-tasks.html — with `.mise/config.toml` reserved for `[tools]`, `[env]`, `[deps.install]`, and `[settings]`.

All mise-related configuration lives under `.mise/` (config and tasks) with `mise.lock` at the repository root. Do not rely on hard-coded task lists here — discover the current task inventory with `mise tasks ls` (or `mise tasks ls --extended` / `mise tasks info <task>` / `mise run <task> --help`); agents may also use the `mise` MCP server (`mise mcp`). Each task's `#MISE description` and `#USAGE` is the source of truth for its purpose and arguments. The canonical validation gate is `mise run check` (format → lint → type → test → build); keep this hard-coded where instructions require a single gate, but do not duplicate the full inventory in docs.

Direct commands are never run bare — even when no `mise` task exists, this rule still applies: do NOT fall back to `npx`, `node`, or `tsx`; instead create a task or expand an existing task's args. The ONLY permitted bare invocation is a one-off diagnostic `mise exec -- <cmd>` (canonical, `mise x` is alias) for parity, which must be followed by `mise run <task>` for final validation.

## Toolchain and language server

- `.mise/config.toml` is the source of truth for runtimes, CLIs, env, and project
  dependencies (custom `[deps.install]` with `auto = true` runs `aube install` over
  `package.json`/`package-lock.json` before `mise run`); tasks live as project file tasks in `.mise/tasks/<ns>/<name>` (isolated to this repo, committed — `.gitignore` allows all mise files except local). A custom provider
  ID is used because built-in `[deps.aube]` requires an `aube-lock.yaml` this project
  will never have; aube reads/writes `package-lock.json` in place.
- Before migrating tooling, prune regenerables (`node_modules/`, `public/dist/`) and
  orphaned stores (`aube store prune`, `mise prune --yes`); keep `package.json` and
  `package-lock.json` as the JS pinning source.
- Project TypeScript LSP lives in `.opencode/opencode.json` and launches the workspace
  compiler's native server via `mise run tool:lsp` (alias `mise run lsp`, `tsc --lsp -stdio`). Only the `typescript`
  server is enabled; lint/type diagnostics come from `mise run check:lint` / `mise run check:type`.
  (`typescript-language-server` cannot be used: it wraps the classic `tsserver.js`,
  which TypeScript 7 no longer ships. Verified live: pull diagnostics report TS2322
  and hover resolves symbols; push `publishDiagnostics` was not observed, so the agent
  loop still prefers the `lint`/`type` tasks for diagnostics.)
- The same file enables the `mise` MCP server (`mise mcp`, `type: local`,
  `enabled: true`), so OpenCode chat can list tools/tasks/env/config and run tasks.
  No `.mise/config.toml` change was needed: the server is built into the pinned mise binary
  and `[settings] experimental = true` already enables it (verified: `mise mcp`
  answers `initialize` without `MISE_EXPERIMENTAL`, and `opencode mcp list` reports
  `mise` connected).
- Verify with `mise ls --current` and `opencode debug config`.
- Pins are reproducible, not self-updating. To bump to latest releases: `mise self-update --yes`,
  edit `.mise/config.toml` pins (or `mise lock --bump`), `mise install`, `aube update --latest <pkg>`
  for JS deps, then `mise run check` to prove the bumps are safe before committing
  `.mise/config.toml` + `mise.lock` + `package.json`/`package-lock.json`.
- Agent skills declared by pinned tools sync into `.agents/skills` automatically after
  installs (`[settings.skills]` with `auto_sync` and `prune` in `.mise/config.toml`). The links
  point at machine-local installs and are gitignored; run `mise run tool:skills` (alias `mise run skills`) to re-sync
  manually, for example after changing tool versions.

Formatting and lint tasks default to the whole repository when no paths are provided. Prefer targeted paths during iterative development, for example:

```text
mise run format src/adapters/managebuilding-feed.ts test/integration
mise run check:format src/adapters/managebuilding-feed.ts test/integration
```

Every task exposes its supported arguments through `mise run <task> --help` (discover tasks via `mise tasks ls`). Tasks documented as
accepting no arguments intentionally keep their project configuration fixed; use a focused task
such as `format`, `check:lint`, or a test task when selecting files.

The demo host page at `public/index.html` consumes only the generated
bundle artifacts (`public/dist/bundle.js` classic IIFE + `public/dist/bundle.esm.js`
ESM), matching how an external site embeds any subset of the library
(`<property-listings>`, `<listing-card>`, `<listing-filters>`,
`<listing-details>`). The bundle is the source of truth for config
(`NEW_BRUNSWICK_REGIONS`, `getListingLocationGroups`, `DETAILS_BASE_URL`):
`public/index.html` imports from `bundle.esm.js` via `type="module"` (modern,
CORS) with an IIFE `globalThis.__3DWEB_CONFIG__` fallback for classic
`<script src="bundle.js">` or `file://` hosts. It must not reference
TypeScript source files or development/watch scripts. Use `mise run dev` or
`mise run build:serve` for local development; those tasks build the artifacts
before serving them.

When `public/index.html` is opened directly from `file://`, the page displays a development notice:
the bundled client still executes, but successful live feed requests require an HTTP(S) origin.
This diagnostic is host-page-only and has no effect when the component is embedded by an external
site or served over HTTP(S).

The demo page loads `./dist/loader.js`, the universal loader shipped from
`src/loader.ts` — the same single script any external site embeds. It selects
the production bundle or a `?preview=<ref>` snapshot; see
[Previews (`?preview=`)](#previews-preview) below.

## Branching, releases, Pages, and previews

GitHub Flow, solo variant. One long-lived branch (`main`, always deployable).
There are no prefixes and no pull requests: cut any short lower-case kebab
branch name off `main`, rebase it onto `origin/main`, merge locally, delete it.
There is no `develop`, no `release/*`, and no `support/*`.

### Merging

Rebase the branch before every merge; then squash (default — one conventional
commit per change, cleanest changelog) or fast-forward (when the branch holds
multiple independently meaningful conventional commits). Never rebase `main`.

```text
git fetch origin
git checkout <branch> && git rebase origin/main
git checkout main && git merge --ff-only origin/main
git merge --squash <branch>
git commit -m "feat: concise lower-case imperative description"
mise run check && git push origin main
git branch -d <branch>
```

Fast-forward alternative (each kept commit must already be conventional):

```text
git checkout <branch> && git rebase origin/main
git checkout main && git merge --ff-only <branch>
git push origin main && git branch -d <branch>
```

Recommended one-time config: `git config pull.rebase true` and
`git config fetch.prune true`.

### Tags and changelog

Releases are `v*` tags on `main` (no release branches, ever). With the tag
commit, regenerate `CHANGELOG.md` from Conventional Commits:

```text
mise run release:changelog
mise run release:preview   # dry-run of unreleased entries, no files written
mise run release:check     # fail when unmerged commits are non-conventional
```

`cliff.toml` (emoji groups, `tag_pattern = "v[0-9]*"`) is the changelog source
of truth; `CHANGELOG.md` is committed. (`release:*` = tag/changelog operations,
not branches.)

### Pages (cross-domain embeds)

GitHub Pages serves `public/` from `main` and is the cross-domain
distribution point. External static sites embed the universal loader (classic
script, no CORS preflight; it pulls the classic bundle, and exposes the ESM
URL for module consumers):

```html
<script defer src="https://tylermacnet.github.io/3dweb/dist/loader.js"></script>
<property-listings></property-listings>
```

The loader is a dependency-free shim that is safe in the universal `<head>`:
tags present at evaluation load the bundle immediately, tags added later are
caught by a one-shot observer that disconnects after loading, and duplicate
loader tags never double-load (first writer wins). With no listing elements
on the page nothing else runs — no bundle execution, no feed fetch, no modal
mount, no preconnect — and the bundle entry only warms the details overlay
when a modal-capable element (`property-listings`, `listing-grid`) exists
(standalone `listing-card` only dispatches events; it never calls
`modal.open()` alone). The entry observer re-checks so SPA-injected grids
warm on arrival. Bundle load failures reset so a later mutation retries
instead of staying poisoned. Off the critical path the shim queues
low-priority `prefetch` links for the classic and ESM bundles (skipped on
Save-Data; `requestIdleCallback` with `timeout: 3000`) so a later listing page
usually hits the HTTP cache; prefetch fetches but never executes. Stable
unversioned `dist/` URLs are kept intentionally so the CMS snippet never
changes; the `?preview=<ref>` snapshot selection is unchanged.

- `public/dist/` and `public/preview/` are gitignored build artifacts; CI builds
  them. `public/.nojekyll` is committed so Pages serves maps and dotfiles verbatim.
- Workflows (`.github/workflows/`): `ci.yml` runs `mise run check` on push to
  any branch; `pages.yml` builds (`mise run build`), syncs previews
  (`mise run preview:publish` + `mise run preview:prune`), and deploys on `main`
  pushes; `release.yml` attaches `loader.js`/`bundle.js`/`bundle.esm.js` (+ maps) and
  git-cliff notes to each `v*` tag.
- One-time manual step: repository Settings → Pages → Source = GitHub Actions.

### Previews (`?preview=`)

The client CMS HTML is effectively frozen, so demos ride on link-shareable
preview snapshots: `?preview=<ref>` makes the universal loader pull
`preview/<ref>/bundle.js` instead of the production bundle. Default (no param)
is always `main`. Removing the param exits preview.

- The loader (`src/loader.ts` → `dist/loader.js`) resolves bundle URLs against
  its own script location, so it works unchanged on any domain with zero
  page-specific logic. Refs are flat (`/` → `-`, `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`,
  never `main`); unknown or expired refs fall back to production. It only ever
  builds same-origin URLs — arbitrary origins are impossible by construction.
- Local testing: `mise run preview:build -- <ref>` (defaults to the current
  branch) writes `public/preview/<ref>/` (bundle + loader copy), then open
  `public/index.html?preview=<ref>`. CI (`pages.yml`) rebuilds every active
  remote branch and prunes dead ones, so the frozen client page can demo any
  branch with zero HTML edits.
- The frozen client snippet is the same two lines as the demo page with an
  absolute loader URL (see [Pages](#pages-cross-domain-embeds) above) — no
  CMS-side logic, ever.

## Security posture

Single-user repository (`tylermacnet` personal account; only the owner pushes).
Accepted trade-offs, valid only while that holds:

- No preview allowlist/manifest and no preview badge: the pinned same-origin
  base plus the flat-ref pattern plus production fallback are sufficient because
  no untrusted party can publish a preview ref. Preview state is signalled by
  `document.documentElement.dataset.preview` + one `console.info` line only.
- Re-harden when collaborators arrive: preview manifest gating, visible badge,
  fork-PR build controls, branch protection with required PRs/CI (see
  `docs/ROADMAP.md`).

## Commit messages

Follow Conventional Commits: `type[(scope)]: description`, description
lower-case imperative with no trailing period. Canonical types:
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. Breaking changes append `!` or add a `BREAKING CHANGE:`
footer. Scopes are optional lower-case subsystems (`dev`, `domain`,
`application`, `adapter`, `component`, `config`, `mise`, `ci`, `pages`,
`preview`, `docs`, `test`). Examples: `feat: add compact grid view`,
`fix: reset load state after last-host abort`, `docs: document preview links`.
Squash merges are the enforcement point — one good message per merge;
`mise run release:check` verifies unmerged commits.

## Mandatory post-change process

After every major architecture, behavior, or public-contract change, do not declare the work
complete until this review is performed:

1. Review the changed dependency direction against the architecture layers and confirm that
   domain purity, port ownership, adapter boundaries, and component responsibilities remain
   intact.
2. Review the change against SOLID principles and 2026 platform practices, recording or fixing
   any new coupling, duplicated business rule, unsafe browser behavior, accessibility gap, or
   type-safety issue.
3. Assess test coverage for the changed behavior and boundaries; add focused tests for missing
   branches, edge cases, regressions, and integration contracts.
4. Synchronize `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, `docs/ROADMAP.md`, and `AGENTS.md` when
   architecture, contracts, naming, workflow, or user-facing behavior changes.
5. Run the repository validation commands listed below and report their results in the handoff.

Targeted validation is useful during implementation, but it does not replace this process review.
If any review step is incomplete, the change remains incomplete even when all commands pass.

## Architecture workflow

Keep changes within the project architecture boundaries:

- Put pure listing rules and types in `src/domain/`; domain modules must not import Lit,
  DOM APIs, `fetch`, `DOMParser`, or browser globals.
- Put orchestration and view state in `src/application/`. `ListingStore` (per-`Document`
  lazy singleton via `WeakMap`) owns feed loading, request cancellation, load-state machine,
  filter criteria, and derived visible listings/location groups/price bounds.
  `ListingFeedLoader`/`ListingFilterStore` are deprecated legacy (per-host, kept for tests only).
- Define capabilities in `src/ports/` and implement them in `src/adapters/`. Application code
  depends on ports rather than concrete adapters.
- Keep Lit custom elements in `src/components/`. Components render state and emit semantic
  events; they do not fetch feeds or implement business rules.
- There is no root component. The single bundle entry (`src/index.tsx`) registers
  all public elements (`property-listings`, `listing-grid`, `listing-card`, `listing-filters`,
  `listing-details`) so each works standalone on an external site. Assemble safe
  port defaults in the bundle entry (one feed and one `ListingStore` per document, one
  popover modal per document) and let hosts override them per element via
  properties/attributes; do not add a service locator, global singleton, or
  dependency-injection framework. `listing-grid` with `view="card|compact|list"` is the
  composable primitive; `property-listings` is a thin legacy shell. Future listing views
  (for example a map-based plan) add a new component on the same layers without changing
  existing elements.
- Component styles belong to their owning component and are bundled through that component's
  `static styles` via `componentStyles()` from `src/styles/component-styles.ts`; the bundle
  entry must not own presentation styles. `componentStyles()` is the project's only
  `unsafeCSS` call site: pass only first-party `.css` bundled at build time, never runtime,
  user, or feed-derived strings.
- Write stylesheets with native CSS nesting (Baseline): `:host` is the encapsulation boundary
  with external tokens mapped to local `var()` fallbacks at the top; keep template internals
  flat with explicit classes; nest only states, modifiers, pseudo-elements, and responsive
  contexts; maximum nesting depth is 3; always include `&` when chaining pseudo-classes,
  compound classes, or reversed context. Never use Sass-style `&__child` concatenation.
- The adapter-backed details popover is styled by its adapter, not by a component or the
  composition root. `BrowserDetailsModal` owns `src/adapters/browser-details-modal.css` and
  applies it once per document as a constructed stylesheet (plain `<style>` fallback only when
  unsupported). The popover stylesheet mirrors the tokens it needs under `:root` with literal
  `var()` fallbacks: `:host` tokens do not resolve in light DOM, and unresolved tokens rendered
  the overlay transparent in an earlier attempt.
- Use Valibot for lightweight runtime validation at external-to-domain boundaries instead of
  inventing repeated validation helpers. Bundle it for the external embed; do not add a second
  runtime validation library for the same boundary. The lightweight-dependency constraint applies
  to shipped runtime dependencies; development-only tools may be evaluated separately for their
  value, maintenance cost, and effect on the test workflow.

When adding a layer or component, preserve lowercase kebab-case filenames and custom-element
names, PascalCase classes/types, camelCase members, narrow capability interfaces, and explicit
typed boundaries. Add a focused unit or integration test with the change and update the
architecture documentation when a public contract or dependency direction changes.

## Address and location policy

The Phase 2 domain rules are deterministic and browser-independent. Address normalization is
idempotent for supported feed formats and returns empty lines for missing input rather than
inventing address content. Canadian postal codes are normalized to a valid FSA only when the full
postal-code shape is valid.

Location resolution prefers an FSA, then a unique city-area match. A shared FSA without a
city match is reported as `ambiguous`; malformed or unknown data is reported as `unknown`. Both
outcomes use the `OTHER` region rather than silently selecting the first configured area. The
region configuration does not contain guessed city aliases; add aliases only when they are
verified by the source data and covered by domain tests.

## Filtering policy

Listing filtering is side-effect free and uses typed criteria independent of control order or DOM
values. Empty criteria preserve the source listing set, combined criteria use AND semantics, and
maximum rent is inclusive. Sorting is intentionally not part of the current product feature set.
Location options are populated from active listings, grouped by configured region,
and support an "All Locations" entry, entire regions, and individual active areas.
Region names are cleaned via `cleanRegionName()` in `src/config/listing-filters.ts`
before being used as display labels. The `getListingLocationGroups()` function produces
the complete location dropdown configuration including the "All Locations" option
and per-region grouping with listing counts.
Unknown rent is represented by `null` in the domain and uses the configured sentinel value `0` for
filtering; a zero-rent listing is not a valid business value. Bedroom rules that are not
configured produce no matches, while non-finite rent criteria are ignored. The
listing range (`priceMin`/`priceMax`) shown in `listing-filters` is derived from
the loaded listings inside `ListingStore` (`floor(min/100)*100`,
`ceil(max/100)*100`, ignoring `null`/0) — `bundle.esm.js`/`bundle.js` is the
source of truth for that derivation, not the host page.

Filtering preserves source order and does not mutate the input. Missing bedroom and location
values are rejected at the domain construction boundary rather than guessed by the filtering
layer.

## Card, popover, and details-iframe policy

Each listing card renders a single stretched link to the canonical details URL from
`getListingDetailsUrl()` in `src/config/application.ts`. An unmodified primary click on a fine
pointer stops at the card and dispatches a cancelable, composed
`listing-details-requested` event; the container opens the `DetailsModal` port and, only when
the modal reports it handled the request, cancels the click so the anchor never navigates.
If no modal is wired (standalone card) or it declines (popover unsupported), the anchor keeps
its default navigation: coarse pointers and modified clicks (new-tab gestures) also fall through
to normal link navigation, so old browsers and touch-first hosts degrade to the canonical link.
The `hidenav` chromeless variant is iframe-only and must
never appear in card links. Popover headers are prefixed with the listing location
(`formatModalTitle()`), using the same region/area vocabulary as the card.

The details overlay is a product modal backed by the native Popover API (a non-modal
`div[popover="auto"]` top-layer element with `role="dialog"`) that
gives cross-browser backdrop, `Esc`, and light-dismiss without the Chromium-only `closedby`.
`BrowserDetailsModal` mirrors the platform open/closed state from the `toggle` event, hands the
triggering card to `showPopover({ source })` for native focus return, and mounts nothing at all
when `showPopover` is unsupported
(the port returns `false` so the card navigates instead).

Open latency is owned on our side of the timeline (the cross-origin document itself is
untouchable): the overlay is premounted, styled, and preconnected at idle via the optional
`DetailsModal.warm()` (wired by the bundle entry; `open()` works without it); `open()` shows
the shell with a skeleton (`aria-busy`) in the click frame and starts the iframe navigation on
the next animation frame, retiring the skeleton on the iframe `load` event; reopening the same
listing reuses the live document with no navigation, while a different listing always
navigates and an unused document is discarded to `about:blank` after a staleness window
(5 minutes by default, cancelable by reopen); hover/focus intent over the results grid
prefetches the exact iframe URL via `hideNavVariantOf()` (the `hidenav` variant is a different
cache key from the anchor href), deduped and skipped on Save-Data. The overlay opens with a
short ease-out fade/rise (opacity/transform only, `allow-discrete` for symmetric exits) that is
fully disabled under `prefers-reduced-motion`.

`<listing-details>` is the standalone iframe-to-listing element. It accepts
`listing-id` with a `src` override, and resolves both through
`resolveDetailsIframeUrl()` in `src/config/application.ts`: the src override is
accepted only when HTTPS on exactly the ManageBuilding canonical origin (a host-supplied
`base-url` never widens iframe origins; it affects listing-id resolution only), the listing-id
path segment is always URL-encoded, and both always force `hidenav` for the
iframe. Blank `src` and blank `listing-id` fall through to the other input. Invalid or missing
input renders an error state without an iframe. It
never replaces the popover; it is for hosts that want a bare embeddable details view.

Cards render client-side, so true no-script operation still shows no listings; the anchor
provides popover-failure degradation, new-tab and copy-link behavior, and crawlable links, not
full no-script rendering.
