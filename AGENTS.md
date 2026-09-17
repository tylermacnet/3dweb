# AGENTS.md

## Commands — always use `mise run <task>`

Do not invoke `npm`, `node`, `npx`, or tool binaries directly when an equivalent `mise` task exists. Use `mise run <task>` for every workflow. Within task definitions, `aube` is the preferred tool for executing commands.

| Task                                   | Purpose                                             |
| -------------------------------------- | --------------------------------------------------- |
| `mise run build`                       | Bundle the web component                            |
| `mise run watch`                       | Rebuild on source change                            |
| `mise run serve`                       | Build and serve `public/` on localhost:8000         |
| `mise run dev`                         | Build, watch, and serve                             |
| `mise run format [files...]`           | Format files (default: `.`)                         |
| `mise run format-check [files...]`     | Check formatting                                    |
| `mise run lint [files...]`             | Lint files (default: `.`)                           |
| `mise run typecheck`                   | `tsc --noEmit`                                      |
| `mise run test-unit [files...]`        | Run unit tests (default: `test/unit`)               |
| `mise run test-integration [files...]` | Run integration tests (default: `test/integration`) |
| `mise run test`                        | Unit + integration                                  |
| `mise run check`                       | format-check → lint → typecheck → test → build      |

Direct commands are only allowed when no `mise` task exists or when diagnosing a failed `mise` task — then return to the `mise` task for final validation.

## Architecture layers

```
components -> application -> ports -> domain
adapters   -> ports       -> domain
config     -> domain
index.tsx  -> composition root (wires everything)
```

- **Domain** (`src/domain/`): Pure business rules. Must NOT import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals.
- **Application** (`src/application/`): `ListingController` is a Lit `ReactiveController` — owns feed loading, cancellation, filtering, sorting, dialog requests.
- **Ports** (`src/ports/`): Narrow interfaces (`ListingFeed`, `ListingParser`, `DetailsDialog`).
- **Adapters** (`src/adapters/`): Concrete implementations (XML parsing, network fetch, browser dialog).
- **Components** (`src/components/`): Lit custom elements, presentational only. Lowercase kebab-case names (`<listing-card>`, `<listing-filters>`, `<property-listings>`).
- **Config** (`src/config/`): Typed immutable product policy (regions, filter definitions).

## Key constraints

- No DI containers, service locators, or global singletons. Explicit TypeScript wiring only in `src/index.tsx`.
- Domain purity: no Lit/DOM/browser globals in `src/domain/`.
- CSS is component-owned: imported via `unsafeCSS` in the owning component's `static styles`.
- Use `AbortSignal.timeout(5000)` for network resilience, not manual timer clearing.
- Use Valibot for lightweight runtime validation at external-to-domain boundaries.
- Use Lit HTML templates only — never manual `innerHTML` concatenation.

## Test structure

- `test/unit/` — pure domain tests (listing, address-normalizer, location-resolver, listing-filter).
- `test/integration/` — adapter, parser, DOM, network, bundle tests.
- `test-src/sample/listingFeeds.xml` — sample XML feed for integration tests.
- Tests use `node:test` (native Node runner). Run with `mise run test-unit` or `mise run test-integration`.
- Structure tests: Arrange, Act, Assert — one observable behavior per test.

## Post-change mandatory process

After every migration phase or major change, complete all five steps before declaring work done:

1. Review dependency direction against architecture layers (domain purity, port ownership, adapter boundaries).
2. Review SOLID principles and 2026 platform practices.
3. Assess test coverage for changed behavior; add focused tests for missing branches/edge cases.
4. Synchronize `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, `docs/MIGRATION_PLAN.md`, `AGENTS.md` if contracts or naming change.
5. Run `mise run check` and report results.

## Style and formatting

- Prettier: `semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`.
- EditorConfig: 2-space indent, LF line endings, UTF-8.
- TypeScript: `strict`, `module: nodenext`, `target: esnext`, JSX `preserve`.
- Commit messages: Conventional Commits (`type: description`, lower-case imperative).

## Important files

- `mise.toml` — task definitions (source of truth for all commands).
- `src/index.tsx` — composition root, single entrypoint.
- `public/index.html` — host page consuming `public/dist/bundle.js`.
- `public/test.html` — legacy embed (migration source).
- `public/migration.html` — static demo, not part of production listings API.
- `src/components/phase-five-harness.ts` — migration debugging harness, never part of production API.
- `src/env.d.ts` — CSS module type declarations.

## Docs

- `docs/DEVELOPMENT.md` — workflow, architecture, address/location/filter policies.
- `docs/STYLE_GUIDE.md` — CSS tokens, typography, layout, accessibility rules.
- `docs/MIGRATION_PLAN.md` — phase-by-phase migration plan and quality gates.
- `docs/ENHANCEMENTS.md` — evaluated out-of-scope improvements.
- `.github/copilot-instructions.md` — architecture & migration guidelines (authoritative).
