# Property Listing Web Component Migration Plan

## Purpose

Migrate the legacy `public/test.html` property-listing embed into a maintainable Lit
web component without changing the user-facing behavior. The migration is performed
as small, reviewable vertical slices so every phase leaves the project buildable,
testable, and usable.

The target follows 2026 web engineering practices:

- Keep business rules framework-agnostic and deterministic.
- Prefer native browser and platform APIs over unnecessary dependencies.
- Use strict TypeScript types, explicit error states, and abortable network work.
- Treat accessibility, responsive behavior, performance, and security as acceptance
  criteria rather than follow-up enhancements.
- Preserve the single static entry point at `src/index.tsx`; do not add a server
  runtime or dependency-injection container.

## Target Architecture

```text
components -> application -> ports -> domain
adapters   -> ports       -> domain
config     -> domain (when configuration describes domain policy)
index.tsx  -> components, application, adapters, config
```

### Layers and responsibilities

- **Domain (`src/domain/`)**: Listing entities/value objects and pure business rules.
  Domain code must not import Lit, DOM APIs, `fetch`, `DOMParser`, or browser globals.
- **Application (`src/application/`)**: Use-case orchestration and UI-facing state.
  `ReactiveController` instances coordinate ports and expose state to components.
- **Ports (`src/ports/`)**: Small interfaces owned by the application/domain boundary.
  Ports describe capabilities, not implementations or vendor-specific data formats.
- **Adapters (`src/adapters/`)**: Network, XML, and browser implementations of ports.
  Translate external data and failures at the boundary.
- **Components (`src/components/`)**: Focused Lit custom elements responsible for
  rendering, user interaction, and accessibility. They do not contain feed or
  business-rule implementations.
- **Configuration (`src/config/`)**: Typed, immutable product policy such as regions
  and filter definitions. Configuration is not a substitute for domain logic.
- **Composition root (`src/index.tsx`)**: The only place that creates concrete
  adapters and wires dependencies explicitly. It registers components but does not
  own their presentation styles.

### SOLID and dependency rules

- **Single Responsibility**: Each module has one reason to change; parsing, fetching,
  orchestration, rendering, and styling remain separate.
- **Open/Closed**: Add a feed, parser, region, or dialog implementation through a
  port/configuration extension rather than changing unrelated consumers.
- **Liskov Substitution**: Every adapter must honor its port's return, error, and
  cancellation contract.
- **Interface Segregation**: Keep ports narrow (`ListingFeed`, `ListingParser`,
  `DetailsDialog`) so consumers depend only on capabilities they use.
- **Dependency Inversion**: Application code depends on ports; concrete adapters are
  supplied by `src/index.tsx`.

No layer may reach around an adjacent layer, import from a more concrete layer, or
duplicate a rule already owned by the domain/configuration layer.

## Naming and File Conventions

- Use lowercase kebab-case filenames: `listing-filter.ts`, `property-listings.ts`,
  and `property-listings.css`.
- Use PascalCase for types/classes and camelCase for functions, variables, and
  properties. Use `UPPER_SNAKE_CASE` only for true module constants.
- Name interfaces for capabilities (`ListingFeed`, `ListingParser`) and avoid
  implementation-prefixed interfaces such as `IListingFeed`.
- Name adapters after the external mechanism (`ManageBuildingFeed`,
  `XmlListingParser`, `BrowserDetailsDialog`), not after a generic `Service`.
- Use singular domain concepts (`Listing`, `Address`) and plural collections
  (`listings`).
- Preserve lowercase custom-element names and match the public element contract:
  `<listing-card>`, `<listing-filters>`, and `<property-listings>`. The details
  experience is currently implemented by the `BrowserDetailsDialog` adapter rather
  than a custom element.
- Keep one primary public concept per file. Co-locate a component stylesheet only
  when it is owned exclusively by that component.

## Execution Phases

Every phase must keep the production bundle buildable, add or update the smallest
relevant test, and complete the mandatory post-change process below. Use Arrange,
Act, Assert in tests and make one observable behavior the focus of each test.

### Mandatory post-change process

After every migration phase or major architecture, behavior, or public-contract change:

1. Review dependency direction and layer boundaries against the target architecture.
2. Review SOLID responsibilities and current 2026 platform practices; fix newly introduced
   coupling, duplicated rules, unsafe browser behavior, accessibility gaps, or type-safety issues.
3. Assess coverage for changed domain rules and adapter, application, component, and host boundaries;
   add focused tests for missing behavior, edge cases, and regressions.
4. Synchronize the related development, style, and migration documentation.
5. Run the validation commands in **Post-Migration Quality Gates** and record the results in the
   phase handoff before declaring the phase complete.

Passing commands alone is not sufficient evidence of completion; the architecture, SOLID,
documentation, and coverage reviews are required process steps.

1. **Phase 1: Establish the domain model and region policy**
   - Create `src/domain/listing.ts` and `src/config/regions.ts`.
   - Define explicit types/value objects for listing identity, address, pricing,
     availability, and region configuration; reject invalid states at boundaries.
   - Keep region data immutable and separate from rendering labels.
   - Add pure unit tests for valid construction and representative edge cases.
   - Do not import Lit, DOM APIs, or adapter code.

2. **Phase 2: Implement address normalization and location resolution**
   - Create `src/domain/address-normalizer.ts` and
     `src/domain/location-resolver.ts`.
   - Use deterministic, named pure functions with no hidden global state.
   - Make normalization idempotent and define behavior for missing or ambiguous
     address data instead of silently inventing values.
   - Add unit tests for casing, whitespace, postal-code variants, aliases, and
     unknown locations.

3. **Phase 3: Implement listing filtering and sorting**
   - Create `src/domain/listing-filter.ts`.
   - Keep filter criteria typed, composable, and side-effect free; do not couple
     sorting to UI control order or DOM values.
   - Define stable sorting and explicit handling for missing price, room, and
     location values.
   - Add table-driven unit tests covering empty criteria, combined criteria,
     boundaries, stable ordering, and no-match results.

4. **Phase 4: Define ports and implement XML parsing**
   - Define `src/ports/listing-feed.ts`, `src/ports/listing-parser.ts`, and
     `src/ports/details-dialog.ts`.
   - Create `src/adapters/xml-listing-parser.ts` to translate external XML into
     valid domain listings.
   - Keep vendor field names and parsing assumptions inside the adapter; do not
     leak XML/DOM types into ports or domain modules.
   - Return typed, actionable parse failures and never silently drop malformed
     records without an explicit policy.
   - Add integration tests using `test-src/sample/listingFeeds.xml`, including
     malformed and incomplete feed records.

5. **Phase 5: Implement network and browser adapters**
   - Create `src/adapters/managebuilding-feed.ts` and
     `src/adapters/browser-details-dialog.ts`.
   - Use `AbortSignal.timeout(5000)` for network resilience, preserve cancellation,
     check HTTP responses, and map failures to a documented application error shape.
   - Keep `fetch`, `DOMParser`, and dialog APIs confined to adapters.
   - Ensure external URLs are validated and opened with safe browser options.
   - Add integration tests for success, HTTP failure, timeout/cancellation, parser
     failure, and dialog behavior without relying on a live service.

6. **Phase 6: Build the application controller**
   - Create `src/application/listing-controller.ts` as a Lit
     `ReactiveController`.
   - Orchestrate loading, filtering, sorting, empty, error, and retry states while
     depending only on ports and domain functions.
   - Make state transitions explicit and race-safe when criteria change or a
     request is cancelled; do not hide errors behind success-shaped fallbacks.
   - Add focused tests for state transitions using test doubles for each port.

7. **Phase 7: Build focused presentation components**
   - Implement `listing-card` and `listing-filters` under `src/components/`; keep
     details presentation behind the `DetailsDialog` port and
     `BrowserDetailsDialog` adapter unless a future component contract is explicitly
     required.
   - Use Lit templates only; never concatenate HTML or use manual `innerHTML`.
   - Keep components presentational and accessible: semantic elements, labels,
     keyboard support, visible `:focus-visible`, live status messaging, and
     non-color state communication.
   - Keep styles scoped, token-based, responsive, and free of host-page assumptions.
   - Add DOM integration tests for rendering, events, accessibility attributes,
     and keyboard interactions.

8. **Phase 8: Compose the container and dependencies**
   - Build `property-listings` and wire concrete dependencies in `src/index.tsx`.
   - Keep dependency construction in the composition root; do not introduce a
     service locator, global mutable singleton, or DI framework.
   - Keep component-owned CSS in the owning component and preserve public
     custom-element contracts; use `src/index.tsx` only as the composition root.
   - Add integration coverage for loading, success, empty, error, retry, and
     filter-to-render flows.

9. **Phase 9: Update the host page and verify parity**
   - Update `public/index.html` to consume the new bundle and preserve the host
     page's responsibilities for branding, layout, and navigation.
   - Compare behavior against `public/test.html`: data, filters, sorting, details
     interaction, responsive layout, loading, empty, and error states.
   - Keep migration-only helpers such as `migration-progress` and
     `phase-five-harness` out of the production listings API.
   - Record any intentional parity differences and their user-facing rationale.

## Post-Migration Quality Gates

The process review above applies after every phase. These commands are the required validation
evidence for that review and are also required before merge or final migration sign-off:

10. **Test coverage and regression protection**
    - Run `mise run test-unit` and `mise run test-integration`, then
      `mise run test`.
    - Ensure every domain rule has meaningful branch/edge-case coverage and every
      adapter/application/component boundary has behavior-focused integration
      coverage; prioritize risk and behavior over a vanity percentage.
    - Add regression tests for every defect found during parity review.
    - Run `mise run check` so formatting, linting, type checking, tests, and the
      production bundle are validated together.

11. **Demo and documentation update**
    - Update the demo/host page and sample data to demonstrate loading, populated,
      empty, error, retry, filtering, sorting, and details flows.
    - Verify the demo works at desktop and mobile widths with keyboard navigation
      and assistive-technology-friendly status updates.
    - Update `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, and this plan when
      commands, public contracts, architecture, or naming conventions change.

12. **Pull request code review**
    - Open a pull request containing the migration as reviewable commits or clearly
      scoped changes; include screenshots or a short demo recording when visual
      behavior changes.
    - Review the complete diff, not only the last phase, against this plan and
      verify dependency direction, SOLID responsibilities, naming, accessibility,
      security, performance, error handling, and legacy parity.
    - Require passing CI and `mise run check`; resolve review comments with tests
      where behavior or regressions are involved.
    - Merge only after an independent reviewer confirms the whole migration is
      production-ready and the pull request description documents known tradeoffs.
