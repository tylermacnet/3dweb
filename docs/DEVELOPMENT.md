# Development workflow

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

Do not invoke `node`, `npm`, `npx`, or tool binaries directly when an equivalent `mise` task exists. Within `mise.toml` task definitions, `aube` is the preferred tool. Direct commands are permitted only when:

1. no suitable `mise` task exists; or
2. a `mise` task has failed and a direct command is needed to diagnose that failure.

If a direct diagnostic command is necessary, return to the corresponding `mise` task for final validation.

Formatting tasks default to the whole repository when no paths are provided. Prefer targeted paths during iterative development, for example:

```text
mise run format src/adapters/managebuilding-feed.ts test/integration
mise run format-check src/adapters/managebuilding-feed.ts test/integration
```

Every task exposes its supported arguments through `mise run <task> --help`. Tasks documented as
accepting no arguments intentionally keep their project configuration fixed; use a focused task
such as `format`, `lint`, or a test task when selecting files.

The demo host page at `public/index.html` consumes only the generated
`public/dist/bundle.js` artifact, matching how an external site embeds the component. It must not
reference TypeScript source files or development/watch scripts. Use `mise run dev` or
`mise run serve` for local development; those tasks build the artifact before serving it.

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
5. Run the repository validation commands listed below and report their results in the handoff.

Targeted validation is useful during implementation, but it does not replace this process review.
If any review step is incomplete, the phase remains incomplete even when all commands pass.

## Architecture workflow

Keep changes within the project boundaries described in the migration plan:

- Put pure listing rules and types in `src/domain/`; domain modules must not import Lit,
  DOM APIs, `fetch`, `DOMParser`, or browser globals.
- Put orchestration and view state in `src/application/`. `ListingController` owns feed
  loading, cancellation, filtering, sorting, and dialog requests for the listing container.
- Define capabilities in `src/ports/` and implement them in `src/adapters/`. Application code
  depends on ports rather than concrete adapters.
- Keep Lit custom elements in `src/components/`. Components render state and emit semantic
  events; they do not fetch feeds or implement business rules.
- Keep concrete dependency construction in the composition root for the relevant component or
  demo entry point. Multiple independent components may have separate static entry points; do
  not add a service locator, global singleton, or dependency-injection framework.
- Component styles belong to their owning component and are bundled through that component's
  `static styles`; composition entry points should not own presentation styles.
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
