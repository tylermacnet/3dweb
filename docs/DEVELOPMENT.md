# Development workflow

## Onboarding — only `mise` is required

1. Install `mise`, then `mise trust` (one-time per checkout) and `mise install`.
2. Install the pre-commit hook (one-time per checkout): `mise generate git-pre-commit --write --task=pre-commit`. Formatting is a commit precondition enforced by the hook.
3. `mise run check` validates linting, type-checking, tests, and the bundle in parallel.
4. Point any AI agent at this checkout: the project toolchain comes from `mise`, the language server from `mise run tool:lsp` (alias `mise run lsp`), and task/env introspection from the `mise` MCP server (`mise mcp`). OpenCode reads the committed `opencode.jsonc`; other agents wire the same task into their own settings.

Versions are declared once per domain — toolchain in `.mise/config.toml` with `.mise/mise.lock`
committed, JS libraries in `package.json`/`package-lock.json`, workflow actions in their `uses:`
refs — and never restated in prose. Discover current values with `mise ls --current` and
`mise tasks ls`. `mise` auto-installs the toolchain and project dependencies through
`[deps.install]` before tasks run, so no manual install is needed; a custom provider keeps the
existing lockfile format and writes it in place. Never mix installers in one tree: prune
`node_modules/` when the installer changes.

## Use mise tasks first — MUST use `mise run <task>`, NEVER call tools directly

Agents and contributors MUST run every command via `mise run <task>` and MUST NEVER invoke a package manager, runtime, compiler, bundler, linter, formatter, or any other tool binary directly in the shell. This is a hard requirement, not a preference.

If the needed invocation has no dedicated task, expand an existing task's args (`mise run <task> -- <args>` — tasks expose `#USAGE` for this). Reserve new tasks for repeatable dev and build steps; do not create a task for a one-off command — use the single diagnostic escape hatch, `mise exec -- <cmd>` (alias `mise x`), and follow it with `mise run <task>` for final validation. Add a task with `mise tasks add --file <ns>:<name> --description "..." -- <command>` or by adding an executable file to `.mise/tasks/<ns>/<name>` (`.gitignore` allows all mise files except local — only `mise.local.toml`/`mise.local.lock`/`.mise.local.toml`/`.mise.local.lock`/`.mise/*.local.toml`/`.mise/*.local.lock` and `.mise/locks/` remain ignored).

Tool binaries and the runtime are permitted ONLY inside `.mise/tasks/*` definitions as the task's implementation; `mise` provides the runtime via `[tools]` and the project's installed CLIs resolve from the local dependency tree with no global `PATH` needed, auto-installing dependencies through `[deps.install]` while preserving the lockfile format.

Task definitions are project file tasks in `.mise/tasks/<ns>/<name>` (preferred, committed, isolated to this repo — not global `~/.config/mise`; a directory `ns` groups tasks as `ns:name` with file `ns/_default` for the `ns` task itself) — see https://mise.jdx.dev/tasks/file-tasks.html — with `.mise/config.toml` reserved for `[tools]`, `[env]`, `[deps.install]`, and `[settings]`.

All mise-related configuration lives under `.mise/` (config and tasks) with `.mise/mise.lock` committed next to it. Do not rely on hard-coded task lists here — discover the current task inventory with `mise tasks ls` (or `mise tasks ls --extended` / `mise tasks info <task>` / `mise run <task> --help`); agents may also use the `mise` MCP server (`mise mcp`). Each task's `#MISE description` and `#USAGE` is the source of truth for its purpose and arguments. The canonical validation gate is `mise run check` (lint, type, test, and build in parallel — formatting is a commit precondition enforced by the `pre-commit` hook, not a `check` dependency); keep this hard-coded where instructions require a single gate, but do not duplicate the full inventory in docs.

Direct commands are never run bare — even when no `mise` task exists, this rule still applies: do NOT fall back to a bare binary; expand an existing task's args, or for a one-off diagnostic use `mise exec -- <cmd>` (canonical, `mise x` is alias) and follow it with `mise run <task>` for final validation.

## Toolchain and language server

- `.mise/config.toml` is the source of truth for runtimes, CLIs, env, and project
  dependencies (custom `[deps.install]` with `auto = true` installs from
  `package.json`/`package-lock.json` before `mise run`); tasks live as project file tasks in `.mise/tasks/<ns>/<name>` (isolated to this repo, committed — `.gitignore` allows all mise files except local). A custom provider
  ID is used because the built-in dependency provider expects a lockfile this project
  will never have; the pinned installer reads and writes `package-lock.json` in place.
- Before migrating tooling, prune regenerables (`node_modules/`, `public/dist/`) and
  orphaned stores (`mise prune --yes` plus the installer's store prune); keep `package.json` and
  `package-lock.json` as the JS pinning source.
- The language server is the workspace compiler's native server, launched
  via `mise run tool:lsp` (alias `mise run lsp`); point any
  agent's LSP client at that command. The `typescript` entry is the only
  server `opencode.jsonc` configures; lint/type diagnostics come from `mise run check:lint` / `mise run check:type`.
  (`typescript-language-server` cannot be used: it wraps the classic `tsserver.js`,
  which the pinned compiler no longer ships. Verified live: pull diagnostics report TS2322
  and hover resolves symbols; push `publishDiagnostics` was not observed, so the agent
  loop still prefers the `lint`/`type` tasks for diagnostics.)
- OpenCode gets this wiring from the committed `opencode.jsonc`. Any agent can also use the
  `mise` MCP server (`mise mcp`, `type: local`) from its own configuration; the one-time
  cloud-agent and client setup lives in the `repo-admin` skill.
  No `.mise/config.toml` change was needed: the server is built into the pinned mise binary
  and `[settings] experimental = true` already enables it (verified: `mise mcp`
  answers `initialize` without extra environment variables).
- Verify with `mise ls --current` (toolchain) plus your agent's own MCP/LSP status.
- Bumping is manual and version-agnostic: change the relevant pins (`.mise/config.toml` or
  `package.json`), run `mise install`, then `mise run tool:skills` and `mise run check` —
  `[deps.install]` re-resolves the JS lockfile on the next task run. Commit the lockfiles, the
  regenerated `.agents/tool-skills`, and the pins together, and never restate the resulting
  versions in prose. Every workflow pins the same `mise-action` major, which installs with
  `--locked`: a `mise.lock` out of step with `.mise/config.toml` fails CI instead of silently
  resolving a different version.
- Agent skills are committed, never machine-local links. `mise run tool:skills` (alias
  `mise run skills`) materializes the skills shipped by the pinned tools into
  `.agents/tool-skills`; `[settings.skills]` has `auto_sync = false` so an install never writes
  links into the tree, and `opencode.jsonc` lists that directory as a skill source. Project
  skills live in `.agents/skills`. Neither directory is gitignored: the generated one only
  changes when the toolchain does, so it is part of the upgrade PR.

## Agent tooling (LSP and MCP)

- OpenCode: the committed `opencode.jsonc` launches `mise run tool:lsp` for `.ts`/`.tsx`; keep it as the only LSP wiring.
- Copilot cloud agent: mise and dependencies come from `.github/workflows/copilot-setup-steps.yml`. It has no LSP client — type feedback comes from `mise run check:type` / `mise run check`.
- MCP is per-client configuration, never a repository file. The one-time cloud-agent entry, its
  verification command, and the rest of the repository setup live in the `repo-admin` skill.

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

`public/dev.html` is the internal dev host with the static sample inlined for
`file://` use. It is always generated, never committed: committed source is
`public/dev.template.html` (empty sample block) and `build` injects the current
`test-src/sample/listingFeeds.xml` atomically. Run `mise run build` (or `check`)
to regenerate it after cloning.

### Buildium source XML reference

The primary published reference is Buildium's official
[Rental listings in XML](https://help.buildium.com/hc/s/article/Rental-listings-in-XML-1557493000864)
article. It identifies the feed as **MITS Property Marketing 3.0**, intended for custom website
integrations, and documents `XMLRentals.ashx` for active listings and `?listings=all` for all
listings. Buildium defines active status by whether the current date falls between the unit's
configured start and end dates. For MITS context, see the
[RETT Consortium's MITS data models](https://rettc.org/mits-data-models). The Buildium article
does not enumerate XML fields or required/optional cardinality; do not infer those constraints
from its summary.

Use [`test-src/sample/listingFeeds.xml`](../test-src/sample/listingFeeds.xml) as the repository's
concrete reference for the Buildium listing-feed XML structure. Open it in an editor with XML
formatting/tree support to inspect nested elements; the fixture is largely minified, so avoid
reformatting the committed fixture just to read it. Its root is `PhysicalProperty`, with listing
data nested under `Property` (including `PropertyID`, `ILS_Identification`, `Information`, and
`Floorplan`), followed by root-level `CustomRecords`. The fixture shows real feed element and
attribute names, including values such as `ILS_IdentificationType`, rent under `EffectiveRent`,
and per-unit `AvailabilityDate` custom records joined by property and unit IDs.

The sample demonstrates this repository's feed, not every MITS 3.0 field or every Buildium
variation. Buildium's article documents `XMLRentals.ashx`, while this application currently fetches
ManageBuilding's `/resident/api/public/listingFeeds` endpoint
(`src/adapters/managebuilding-feed.ts`); do not assume these endpoints have identical payloads.
When adding or relying on a field, verify its meaning and constraints against the MITS
Property Marketing 3.0 schema, inspect the actual configured feed/sample, and trace whether
`XmlListingParser` maps it into the domain listing. A field's absence from the UI or domain model
does not imply it is absent from the source. Use focused parser integration tests for newly mapped
fields and custom-record associations.

For this read-only consumer view, a property needs only a valid, non-empty Buildium listing ID to
appear. The canonical source is the `listingId` query parameter of that record's
`FloorplanAvailabilityURL`; extract and validate that URL parameter rather than inferring the
Buildium link ID from an `Identification/IDValue`. The sample's first record has `listingId=89584`
in its URL, while its property identifiers are `25089`. The floorplan's own `Identification/IDValue`
also happens to be `89584` in that record, but this sample-level coincidence is not the canonical
mapping. The configured feed sample contains a `FloorplanAvailabilityURL` with a `listingId`
parameter for each listing record; continue treating the URL parameter as the source of truth.

Parse each `<Property>` independently; skip a record only when its listing ID is missing or
unusable. Other fields—including address, bedroom count, bathroom count, rent, image, and
description—are best-effort. Preserve unavailable numeric values as unknown (`null`) and text as
empty rather than inventing a value. Do not reject a listing or show partial-result warnings because
optional fields are absent or invalid. Malformed feed-level XML remains a recoverable feed error
because records cannot be read reliably.

The sample's root-level `CustomRecords` include `AvailabilityDate` values keyed by
`PropertyIDValue` and `UnitIDValue`. Associate them by those identifiers, not XML position, and
use the structured date rather than description text. Buildium's active-listing rule (today between
the unit's configured start/end dates) is distinct from the unit's `AvailabilityDate`.
The supported sort dimensions are price and availability date only; price can be ordered either
direction and availability is ordered soonest first. Filtering and sorting are separate operations;
sorting should be stable, and missing/invalid availability dates must not be guessed. Any such
controls must treat absent data as unknown rather than excluding an otherwise linkable listing.

## Branching, releases, Pages, and previews

GitHub Flow. One long-lived branch (`main`, always deployable); every change reaches it
through a pull request. Cut a short lower-case kebab branch off `main`, push it, open a PR,
wait for the `check` workflow, then squash-merge. There is no `develop`, no `release/*`,
and no `support/*`.

### Pull requests and merging

`main` is protected by the checked-in ruleset `.github/rulesets/main-pr-only.json`: a PR is
required, `check` must pass, and force-pushes/deletions are blocked (no bypass). Agents may open
and update PRs but never merge them; a maintainer who is not the author merges. The required
status check is the job name `check` in `.github/workflows/ci.yml` — renaming that job or breaking
the workflow leaves every PR unmergeable, because no bypass can force the merge through. Change
the name only together with the ruleset.

Rebase onto `origin/main` before merging and never rebase `main`. The ruleset allows squash merges
only: one conventional commit per change and a clean changelog. The branch, PR, merge, release, and
preview commands live in the `git-workflow` skill; the rules above are the contract.

### Tags and changelog

Releases are `v*` tags on `main` (no release branches, ever). `main` takes changes only through a
PR, so the changelog commit is a normal PR as well: regenerate `CHANGELOG.md` from Conventional
Commits, merge the PR, then tag that merge commit. `cliff.toml` (emoji groups,
`tag_pattern = "v[0-9]*"`) is the changelog source of truth and `CHANGELOG.md` is committed; the
commands are in the `git-workflow` skill and discoverable with `mise tasks ls` (`release:*` = tag
and changelog operations, not branches).

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
warm on arrival. Bundle load failures reset so a later mutation can retry,
but mutation-triggered retries share the same three-retry budget and wait for
any pending backoff (1s, 2s, 4s) instead of triggering immediate attempts.
Timed retries also cover static pages that never mutate again. A failed preview
snapshot falls back to production `dist/` for all later retries. Off the critical path the shim queues
low-priority `prefetch` links for the classic and ESM bundles (skipped on
Save-Data; `requestIdleCallback` with `timeout: 3000`) so a later listing page
usually hits the HTTP cache; prefetch fetches but never executes. Stable
unversioned `dist/` URLs are kept intentionally so the CMS snippet never
changes; the `?preview=<ref>` snapshot selection is unchanged.

- `public/dist/` and `public/preview/` are gitignored build artifacts; CI builds
  them. `public/.nojekyll` is committed so Pages serves maps and dotfiles verbatim.
- Workflows (`.github/workflows/`): `ci.yml` runs `mise run check` on pull requests and
  pushes to `main`; `copilot-setup-steps.yml` installs the toolchain for the Copilot cloud
  agent; `pages.yml` builds (`mise run build`), syncs previews
  (`mise run preview:publish` + `mise run preview:prune`), and deploys on every
  branch push (production `dist/` always builds from `main`; other branches only refresh
  previews — the `github-pages` environment must allow all branches); `release.yml` attaches `loader.js`/`bundle.js`/`bundle.esm.js` (+ maps) and
  generated changelog notes to each `v*` tag.
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
  branch with zero HTML edits. A failed bundle build stops preview publication
  rather than reporting an incomplete snapshot as successful.
- The frozen client snippet is the same two lines as the demo page with an
  absolute loader URL (see [Pages](#pages-cross-domain-embeds) above) — no
  CMS-side logic, ever.

## Security posture

Trust model: only maintainers have write access, and the PR gate means every ref `pages.yml`
publishes comes from a reviewed push. Outside contributors arrive through fork PRs, which cannot
publish Pages previews (preview publishing only builds branches in this repository) and do not run
workflow code until a maintainer approves the run.

Controls in place:

- `main` is PR-gated by the checked-in ruleset: required `check`, squash-only, no force-push or
  deletion, no bypass. Review by a person other than the author is policy rather than enforcement —
  the ruleset requires zero approvals so a lone maintainer is not blocked.
- Preview refs are same-origin by construction: the flat-ref pattern (`/` becomes `-`), the
  same-origin base, and the production fallback. Preview state is signalled by
  `document.documentElement.dataset.preview` + one `console.info` line only.
- Agent configuration is reviewed like code: `opencode.jsonc` and the project skills are committed,
  and per-client MCP entries live in settings rather than the tree.

Open gaps before granting write access to someone you do not fully trust: no preview
allowlist/manifest and no visible preview badge, no fork-PR build controls beyond GitHub's
first-time-contributor approval, and no CODEOWNERS or required-reviewer rule. Tracked in
`docs/ROADMAP.md`.

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

After every major architecture, behavior, or public-contract change, do not declare the work done
until the change has been reviewed for ownership and dependency direction, checked against current
platform documentation, covered by tests for new branches and edge cases, synchronized across the
docs and skills, and validated with `mise run check`. The expanded checklist is the `post-change`
skill; `AGENTS.md` carries the same rule for agents that cannot load skills. A passing build does
not replace the review, and targeted validation during implementation does not replace the full
gate.

## Architecture workflow

Organize by business feature first, with each feature owning its domain, application, ports,
adapters, components, and product configuration. Use `shared/` only for capabilities genuinely
used by multiple features. Within a feature preserve dependency direction: components render and
emit semantic events; application orchestrates through ports; adapters implement ports; domain
rules stay pure. The current source tree remains layer-first under `src/domain/`,
`src/application/`, `src/ports/`, `src/adapters/`, `src/components/`, and `src/config/`; this is
legacy organization, not the target for new or incrementally migrated feature work.

- Keep domain modules free of Lit, DOM APIs, `fetch`, `DOMParser`, and browser globals.
- `ListingStore` (currently `src/application/listing-store.ts`, per-`Document` lazy singleton via
  `WeakMap`) owns feed loading, request cancellation, load state, filter criteria, and derived
  visible listings/location groups/price bounds. `ListingFeedLoader`/`ListingFilterStore` are
  deprecated legacy implementations kept for tests.
- Application code depends on narrow capability ports rather than concrete adapters.
- Keep Lit custom elements presentational; they do not fetch feeds or implement business rules.
- There is no root component. The single bundle entry (`src/index.tsx`) registers
  all public elements (`property-listings`, `listing-grid`, `listing-card`, `listing-filters`,
  `listing-details`) so each works standalone on an external site. Assemble safe
  port defaults in the bundle entry (one feed and one `ListingStore` per document, one
  popover modal per document) and let hosts override them per element via
  properties/attributes; do not add a service locator, global singleton, or
  dependency-injection framework. `listing-grid` with `view="card|compact|list"` is the
  composable primitive; `property-listings` is a thin legacy shell. Future listing views
  (for example a map) should be independently composable and address-first; add them within the
  listings feature without changing existing elements.
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

When adding or migrating a feature, preserve lowercase kebab-case filenames and custom-element
names, PascalCase classes/types, camelCase members, narrow capability interfaces, and explicit
typed boundaries. Add a focused unit or integration test with the change and update the
architecture documentation when a public contract or dependency direction changes.

## Failure and reproducibility policy

Build time fails fast; runtime degrades gracefully. These are different phases
with opposite duties.

At build/commit/CI time, never move forward past a preventable problem: tasks
use `set -e`, missing inputs are hard errors naming the file (never silent
skips), multi-step writes publish atomically (temp + rename) so a failed run
leaves no partial output, the `pre-commit` hook blocks unformatted commits, and
red CI blocks merges. Generated outputs derive deterministically from committed
inputs and are never committed: `public/dev.html` is rebuilt from
`public/dev.template.html` plus `test-src/sample/listingFeeds.xml` on every
`build`.

At runtime, the embed must never break its host: degrade to working fallbacks
instead of throwing. Cards keep default navigation when no modal is wired or
the pointer is coarse, `DetailsModal` implementations return `false` when
unsupported, and host pages render notices (`Feed unavailable in this origin`,
`file://` limitations) instead of crashing. See
[Card, popover, and details-iframe policy](#card-popover-and-details-iframe-policy)
for the reference implementation. Graceful runtime handling does not mean accepting malformed
feed data: validate required external fields at the XML boundary, surface a recoverable load error,
and do not silently invent or display invalid listing values.

## Address and location policy

The address and location domain rules are deterministic and browser-independent. Address
normalization is idempotent for supported feed formats and returns empty lines for missing input
rather than inventing address content. Canadian postal codes are normalized to uppercase `ANA NAN`
format and validated against Canada Post's letter/digit pattern; a hyphen in the standard separator
position is accepted alongside whitespace. Invalid or missing postal codes are rejected when
creating a listing.

### ManageBuilding Address Parsing Quirk

ManageBuilding `MarketingName` has the form `"<property_name> - <unit_name>"`. The Address field
is often already correctly formatted and remains the source for address parsing. When Address
matches MarketingName, `XmlListingParser` uses the final segment as the unit-name boundary and
strips a trailing initials segment only from the property-name portion. It does not assume that
the unit name is numeric.

If the XML `Unit` field is populated, that explicit value takes precedence. Otherwise, the final
MarketingName unit name is preserved and normalized as the address's secondary line. A MarketingName
unit name that looks like initials (for example, `"OW"`) is still a unit name; it is never removed.
When Address differs from MarketingName, the parser trusts the corrected Address.

This feed-specific logic belongs in the adapter, not `AddressNormalizer`, so the domain normalizer
remains pure and feed-agnostic.

**Example parsing**:

```
Input (MarketingName):  "37 Victoria Street - SH - Penthouse"
Input (Address):        "37 Victoria Street - SH - Penthouse"
Input (Unit):           (empty)

Parser removes "SH" from property name and retains "Penthouse" as the unit name:
  AddressNormalizer input: "37 Victoria Street - Penthouse"

Final result:
  line1: "37 Victoria Street"
  line2: "Unit Penthouse"
```

Location resolution prefers an FSA, then a unique city-area match. A shared FSA without a
city match is reported as `ambiguous`; malformed or unknown data is reported as `unknown`. Both
outcomes use the `OTHER` region rather than silently selecting the first configured area. The
region configuration does not contain guessed city aliases; add aliases only when they are
verified by the source data and covered by domain tests.

## Filtering policy

Listing filtering is side-effect free and uses typed criteria independent of control order or DOM
values. Empty criteria preserve the source listing set, combined criteria use AND semantics, and
maximum rent is inclusive. Filtering does not sort or mutate results. When sorting is available,
the only supported dimensions are price and structured availability date (see
[Buildium source XML reference](#buildium-source-xml-reference)); do not add sorting by bedrooms,
address, or source order as a product feature. Price supports both directions; availability is
soonest first. Preserve source order for equal keys and do not invent missing availability dates.
Location options are populated from active listings, grouped by configured region,
and support an "All Locations" entry, entire regions, and individual active areas.
Region names are cleaned via `cleanRegionName()` in `src/config/listing-filters.ts`
before being used as display labels. The `getListingLocationGroups()` function produces
the complete location dropdown configuration including the "All Locations" option
and per-region grouping with listing counts.
The current domain permits rent to be `null`, and the filter treats both `null` and `0` as unknown
rent that matches a maximum-rent filter. This legacy behavior conflicts with the configured feed
contract, where rent is required, and is not the desired XML validation policy. Bedroom rules that
are not configured produce no matches, while non-finite rent criteria are ignored. `ListingStore`
derives the filter's price range from loaded listings, excluding `null` and non-positive rents before
rounding the bounds to the nearest hundred. These are current implementation details; the required
feed contract still needs to be enforced at the XML boundary.

Filtering preserves source order and does not mutate the input. Missing bedroom and location
values are rejected at the domain construction boundary rather than guessed by the filtering
layer. The XML adapter must likewise reject a missing bedroom count instead of converting it to
zero; a real count of zero remains valid.

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
