# Development workflow

## Onboarding — only `mise` is required

1. Install `mise`, then `mise trust` (one-time per checkout) and `mise install`.
2. `mise run check` validates formatting, linting, type-checking, tests, and the bundle.
3. `mise run chat` launches OpenCode with the project toolchain and TypeScript LSP.

Tool versions are pinned in `mise.toml` (`node`, `aube`, `opencode`) with `mise.lock`
committed; the TypeScript LSP is the workspace compiler's native server (`tsc --lsp -stdio`,
no extra tool). JS libraries stay in
`package.json`/`package-lock.json` (exact versions) because `src/` and `test/` import them
(`lit`, `valibot`, `esbuild`, `linkedom`); `mise` auto-installs them through `[deps.install]`
(backed by pinned `aube`; `package-lock.json` format is preserved) before tasks run,
so no manual install is needed. Never mix installers in one tree: prune `node_modules/`
when switching between `npm` and `aube`.

## Use mise tasks first

Copilot and contributors **must strongly prefer repository-defined `mise` tasks** for all development workflows. Run tasks from the repository root with `mise run <task>`. Task definitions are sourced from `mise.toml`.

See `AGENTS.md` for the complete command reference.

Use the task that matches the work:

| Task                                   | Purpose                                                  | Arguments                                      |
| -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `mise run build`                       | Create the production bundle                             | None                                           |
| `mise run watch`                       | Rebuild the bundle when source files change              | None                                           |
| `mise run serve`                       | Build and serve `public/` on port 8000                   | None                                           |
| `mise run dev`                         | Build, watch, and serve the site                         | None                                           |
| `mise run format [files...]`           | Format selected files or the repository                  | Optional paths; defaults to `.`                |
| `mise run format-check [files...]`     | Check formatting for selected files or the repository    | Optional paths; defaults to `.`                |
| `mise run lint [files...]`             | Lint selected files or the repository                    | Optional paths; defaults to `.`                |
| `mise run typecheck`                   | Type-check the project                                   | None                                           |
| `mise run test-unit [files...]`        | Run selected unit tests                                  | Optional paths; defaults to `test/unit`        |
| `mise run test-integration [files...]` | Run selected integration tests                           | Optional paths; defaults to `test/integration` |
| `mise run test`                        | Run all unit and integration tests                       | None                                           |
| `mise run check`                       | Run formatting, linting, type checking, tests, and build | None                                           |
| `mise run chat`                        | Launch OpenCode AI agent in local project context        | None                                           |

Do not invoke `node`, `npm`, `npx`, or tool binaries directly when an equivalent `mise` task exists. Within `mise.toml` task definitions, call bare binaries (`esbuild`, `prettier`, `oxlint`, `tsc`, `node`); `mise` provides them via `node_modules/.bin` on `PATH` (`[env] _.path`). Direct commands are permitted only when:

1. no suitable `mise` task exists; or
2. a `mise` task has failed and a direct command is needed to diagnose that failure.

If a direct diagnostic command is necessary, return to the corresponding `mise` task for final validation.

## Toolchain and language server

- `mise.toml` is the source of truth for runtimes, CLIs, env, tasks, and project
  dependencies (custom `[deps.install]` with `auto = true` runs `aube install` over
  `package.json`/`package-lock.json` before `mise run`/`mise exec`). A custom provider
  ID is used because built-in `[deps.aube]` requires an `aube-lock.yaml` this project
  will never have; aube reads/writes `package-lock.json` in place.
- Before migrating tooling, prune regenerables (`node_modules/`, `public/dist/`) and
  orphaned stores (`aube store prune`, `mise prune --yes`); keep `package.json` and
  `package-lock.json` as the JS pinning source.
- Project TypeScript LSP lives in `.opencode/opencode.json` and launches the workspace
  compiler's native server via `mise exec -- tsc --lsp -stdio`. Only the `typescript`
  server is enabled; lint/type diagnostics come from `mise run lint` / `mise run typecheck`.
  (`typescript-language-server` cannot be used: it wraps the classic `tsserver.js`,
  which TypeScript 7 no longer ships. Verified live: pull diagnostics report TS2322
  and hover resolves symbols; push `publishDiagnostics` was not observed, so the agent
  loop still prefers the `lint`/`typecheck` tasks for diagnostics.)
- Verify with `mise ls --current` and `opencode debug config`.
- Pins are reproducible, not self-updating. To bump to latest releases: `mise self-update --yes`,
  edit `mise.toml` pins (or `mise lock --bump`), `mise install`, `aube update --latest <pkg>`
  for JS deps, then `mise run check` to prove the bumps are safe before committing
  `mise.toml` + `mise.lock` + `package.json`/`package-lock.json`.

Formatting tasks default to the whole repository when no paths are provided. Prefer targeted paths during iterative development, for example:

```text
mise run format src/adapters/managebuilding-feed.ts test/integration
mise run format-check src/adapters/managebuilding-feed.ts test/integration
```

Every task exposes its supported arguments through `mise run <task> --help`. Tasks documented as
accepting no arguments intentionally keep their project configuration fixed; use a focused task
such as `format`, `lint`, or a test task when selecting files.

The demo host page at `public/index.html` consumes only the generated
`public/dist/bundle.js` artifact, matching how an external site embeds any subset
of the library (`<property-listings>`, `<listing-card>`, `<listing-filters>`,
`<listing-details>`). It must not reference TypeScript source files or
development/watch scripts. Use `mise run dev` or `mise run serve` for local
development; those tasks build the artifact before serving it.

When `public/index.html` is opened directly from `file://`, the page displays a development notice:
the bundled client still executes, but successful live feed requests require an HTTP(S) origin.
This diagnostic is host-page-only and has no effect when the component is embedded by an external
site or served over HTTP(S).

## Mandatory post-change process

After every migration phase or major architecture, behavior, or public-contract change, do not
declare the work complete until this review is performed:

1. Review the changed dependency direction against the architecture layers and confirm that
   domain purity, port ownership, adapter boundaries, and component responsibilities remain
   intact.
2. Review the change against SOLID principles and 2026 platform practices, recording or fixing
   any new coupling, duplicated business rule, unsafe browser behavior, accessibility gap, or
   type-safety issue.
3. Assess test coverage for the changed behavior and boundaries; add focused tests for missing
   branches, edge cases, regressions, and integration contracts.
4. Synchronize `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, `docs/MIGRATION_PLAN.md`, and `AGENTS.md` when
   architecture, contracts, naming, workflow, or user-facing behavior changes.
5. Update `public/migration.html` before committing: promote completed phases, add a
   review-evidence section for each newly completed phase, and refresh the header summary and
   test counts.
6. Run the repository validation commands listed below and report their results in the handoff.

Targeted validation is useful during implementation, but it does not replace this process review.
If any review step is incomplete, the phase remains incomplete even when all commands pass.

## Architecture workflow

Keep changes within the project boundaries described in the migration plan:

- Put pure listing rules and types in `src/domain/`; domain modules must not import Lit,
  DOM APIs, `fetch`, `DOMParser`, or browser globals.
- Put orchestration and view state in `src/application/`. `ListingFeedLoader` owns feed
  loading and cancellation behind an explicit `setFeed()` port; `ListingFilterStore` owns
  filter criteria and derives visible listings and location groups from the loader's
  loaded listings. The container composes the two.
- Define capabilities in `src/ports/` and implement them in `src/adapters/`. Application code
  depends on ports rather than concrete adapters.
- Keep Lit custom elements in `src/components/`. Components render state and emit semantic
  events; they do not fetch feeds or implement business rules.
- There is no root component. The single bundle entry (`src/index.tsx`) registers
  all public elements (`property-listings`, `listing-card`, `listing-filters`,
  `listing-details`) so each works standalone on an external site. Assemble safe
  port defaults in the bundle entry and let hosts override them per element via
  properties/attributes; do not add a service locator, global singleton, or
  dependency-injection framework. Future listing views (for example a map-based
  plan) add a new component on the same layers without changing existing
  elements.
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
configured produce no matches, while non-finite rent criteria are ignored.

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
