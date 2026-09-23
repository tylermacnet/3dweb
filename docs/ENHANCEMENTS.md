# Possible Enhancements

This document records evaluated improvements that are intentionally outside the current migration
scope. An enhancement should be adopted only when its ongoing maintenance cost is justified by a
clear improvement to product behavior, contributor workflow, or coverage.

## Selective Cucumber.js acceptance coverage

The project may add Cucumber.js (`@cucumber/cucumber`) as a development-only dependency for a
small set of business-facing acceptance scenarios. Candidate scenarios include:

- address normalization examples
- unique, ambiguous, and unknown location resolution
- listing filtering and sorting policies
- loading, empty, error, retry, and details flows

Cucumber should complement, not replace, the native `node:test` suites. Keep direct TypeScript
tests for precise domain branches, malformed input, stable sorting, cancellation, parser behavior,
and component or adapter contracts where direct stack traces and type-safe fixtures are more useful.

Before adoption, assess the added feature/step-definition configuration, TypeScript runtime setup,
test discovery, reporting, execution time, dependency maintenance, and duplicate-runner workflow.
If adopted, provide a dedicated `mise run test-bdd` task and include it in the appropriate
quality gate without making Cucumber a runtime or production-bundle dependency.

## Alternative listing views (for example map-based)

Alternative presentations are not current scope but are anticipated as new
independent components on the same layers: reuse `domain`, `ListingFeedLoader`
(and the shared filter configuration), `ports`, `adapters`, and `config`, add one
`src/components/*` element, register it in the single bundle entry, and demo it
independently. Do not add a root component or couple the new view to
`property-listings`.

## Fragment deep-linking for listings (`#listing/<id>`)

Evaluated and deliberately deferred: recording the open listing in the page URL
so a shared link reopens the same details popover on load, browser Back closes
the popover (SPA-style history entry per open), and reload restores the open
state. The listing id already drives the iframe `src`; the fragment would
address page-level state only.

Deferred because host sharing already flows through the canonical ManageBuilding
details URL, and the fragment adds a sync module with open→write→hashchange
loop guards plus multi-instance arbitration (hash is document-global: adopt an
opt-in `<property-listings deep-link>` attribute with a single-opt-in-per-document
rule, or embeds fight over one hash). Dynamic availability also forces a
stale-id state: an id missing from the current feed must render a
"no longer available" popover body (title + notice + close action, no iframe)
instead of failing silently.

Adopt only when share-reopens-popover or Back-to-close becomes a host
requirement. Design on adoption: pure `parseListingHash`/`buildListingHash`
helpers in `src/application/` (DOM-free, unit-tested), container-owned binding,
hash written on open and cleared on explicit close, unknown ids cleared without
an error state unless the not-available body is also adopted.

## Card affordance icons (FontAwesome vs inline SVG)

Evaluated and deliberately deferred: restoring FontAwesome bed/bath/location
icons to `listing-card` to match `public/test.html` `CardTemplate` (`fa-bed`,
`fa-bath`, `fa-location-dot`). Current `listing-card` (`src/components/listing-card.ts:92`)
keeps one inline SVG pin (location) and plain-text badges (`Bachelor`, `N Bed`,
`N Bath`) without an external font.

Deferred because FontAwesome requires a global `fa-*` stylesheet/webfont, a
version pin, and an extra cross-origin request that would leak into every
shadow root and violate the single-script embed contract (`docs/MIGRATION_PLAN.md:15`
prefer native APIs; `src/styles/component-styles.ts:1` sole `unsafeCSS`
boundary). The badges are `aria-hidden` decorative in legacy; the text badge
itself is the accessible name, so dropping the decorative glyph is not an a11y
regression. The location pin stays as `currentColor` inline SVG (no dep) for
visual anchoring.

Adopt only when product design requires stronger scan affordance. On adoption:
add inline SVG only (no FontAwesome dep), `aria-hidden="true"`, `0.8em` /
`currentColor` / token stroke, one icon per badge (bed, bath) and keep the
existing pin. Keep `listing-card.css` as owner; do not load a global icon
font. Revisit `docs/STYLE_GUIDE.md` card hierarchy when adopted.

For the full command reference and architecture constraints, see `AGENTS.md`.
