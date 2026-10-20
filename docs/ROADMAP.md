# Roadmap

This document records evaluated improvements that are intentionally outside current scope.
An enhancement should be adopted only when its ongoing maintenance cost is justified by a clear
improvement to product behavior, contributor workflow, or coverage.

## Composable listing views (implemented)

`listing-grid` with `view="card|compact|list"` is the composable primitive.
`property-listings` is retained as a thin legacy shell (`listing-filters` +
`listing-grid view="card"`). All views share the transparent browser-level lazy
singleton `ListingStore` per `Document` (`src/application/listing-store.ts:33` via
`WeakMap<Document,ListingStore>`) — filters write, grids read. Single bundle
entry (`src/index.tsx:1`) statically registers elements but data fetching is
lazy (first component triggers `store.load()`; `AbortSignal.timeout(5000)`).
CSS is component-owned (`listing-grid.css`, `listing-card.css`,
`listing-filters.css` via `componentStyles` `src/styles/component-styles.ts:1`).

## Deferred: map overlay

Map overlay remains deferred pending a concrete user need and a tile/provider decision. Use
normalized listing addresses as the primary map input; do not require coordinates in the feed
upfront. Verify that the selected provider can geocode the available addresses with acceptable
coverage, cost, privacy, and rate limits. Add coordinates to the listing model only if a provider
or a demonstrated address-quality gap requires them. Follow the composable pattern: add
`listing-map` without coupling it to `property-listings`.

## Deferred: multiple feeds and property-type filtering

Multiple feeds/domains and property-type support are independent concerns. The feed contains
different property types (for example, single-family and multi-family), but the current `Listing`
model and XML parser do not expose a property-kind field. Evaluate mapping and filtering those
types independently; do not make that work depend on a multiton or custom-domain support.

Multiple feeds/domains remain deferred. Domain stays open for now; `detailsModal` is already
per-document via `WeakMap` (`src/index.tsx:58`). If multiple feeds become necessary, parameterize
`ManageBuildingFeed` `FEED_URL` (`src/adapters/managebuilding-feed.ts:6`), then consider a
`WeakMap<Document, Map<key, Store>>` registry and lazy per-key fetches. Keep the bundle single
entry. Generated config, if any, remains limited to `src/config/generated/`.

## Required feed data and sorting policy

For the configured Buildium/MITS feed, bedroom count and rent are required data: missing or invalid
values are feed errors, not zero bedrooms or an unknown-price listing. A real bedroom count of zero
remains valid. `AvailabilityDate` is present in the structured `CustomRecords` and must be matched
to its property/unit identifiers. It is distinct from Buildium's active-listing date window.

The only supported sort dimensions are price and availability date (price in either direction,
availability soonest first); filtering remains a separate operation. The current parser/domain
still default or permit missing values, and the UI does not yet map or sort by availability. Treat
these as implementation gaps to address when this feed work is scheduled, not as reasons to infer
data from listing descriptions or broaden sorting to unrelated fields. The source contract and
inspection steps are in [Development](DEVELOPMENT.md#buildium-source-xml-reference).

## Deferred: user-specific listing views

Different views for different users are a product direction, not yet a defined feature. Clarify
which users need which views and what decisions each view should help them make before selecting
view variants or adding user/role-specific behavior. The existing `listing-grid` view variants
remain available as composable presentation options; keep this separate from feed/property type.

## Deep-link priority

If URL-linked state is adopted, prioritize sharing/restoring filter state ahead of deep-linking an
open listing's details. Filter links preserve the result context; property links add transient
popover state. Keep property deep links deferred until hosts require share-and-reopen or
Back-to-close behavior.

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

Reasons to defer include overlap with the canonical ManageBuilding details URL,
the document-global fragment when multiple embeds are present, synchronization
and browser-history behavior, and stale listing IDs when availability changes.
These are design costs to address if the host requirement justifies the feature,
not reasons to rule it out permanently.

## Card affordance icons (FontAwesome vs inline SVG)

Evaluated and deliberately deferred: restoring FontAwesome bed/bath/location icons to
`listing-card` (`fa-bed`, `fa-bath`, `fa-location-dot`). Current
`listing-card` (`src/components/listing-card.ts:92`) keeps one inline SVG pin (location) and
plain-text badges (`Bachelor`, `N Bed`, `N Bath`) without an external font.

Deferred because FontAwesome requires a global `fa-*` stylesheet/webfont, a version pin, and an
extra cross-origin request that would leak into every shadow root and violate the single-script
embed contract (project prefers native APIs; `src/styles/component-styles.ts:1` sole `unsafeCSS`
boundary). The badges are `aria-hidden` decorative; the text badge itself is the accessible name,
so dropping the decorative glyph is not an a11y regression. The location pin stays as
`currentColor` inline SVG (no dep) for visual anchoring.

Adopt only when product design requires stronger scan affordance. On adoption:
add inline SVG only (no FontAwesome dep), `aria-hidden="true"`, `0.8em` /
`currentColor` / token stroke, one icon per badge (bed, bath) and keep the
existing pin. Keep `listing-card.css` as owner; do not load a global icon
font. Revisit `docs/STYLE_GUIDE.md` card hierarchy when adopted.

## Deferred: multi-user collaboration hardening

Current workflow is single-user (owner-only pushes): no pull requests, no branch
protection, no preview allowlist/manifest, no preview badge. If collaborators
arrive, re-harden before onboarding them: require PRs with green CI on `main`,
gate preview publishing to maintainer-approved refs (manifest allowlist, no fork
auto-build), add a visible preview indicator, and revisit the `?preview=`
same-origin assumptions in `docs/DEVELOPMENT.md`.

For the full command reference and architecture constraints, see `AGENTS.md`.
