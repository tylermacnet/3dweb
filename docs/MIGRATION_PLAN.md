# Property Listing Web Component Migration Plan

## Architecture Target
- Domain: `src/domain/` (`listing.ts`, `address-normalizer.ts`, `location-resolver.ts`, `listing-filter.ts`)
- Application: `src/application/` (`listing-controller.ts`)
- Ports: `src/ports/` (`listing-feed.ts`, `details-dialog.ts`)
- Adapters: `src/adapters/` (`managebuilding-feed.ts`, `xml-listing-parser.ts`, `browser-details-dialog.ts`)
- Components: `src/components/` (`property-listings.ts`, `listing-card.ts`, `listing-filters.ts`, `property-dialog.ts`)
- Config: `src/config/regions.ts`
- Root: `src/index.tsx`

## Execution Phases
1. Phase 1: Extract domain types and New Brunswick region configuration (`src/domain/listing.ts`, `src/config/regions.ts`).
2. Phase 2: Implement address normalization & location resolution (`src/domain/address-normalizer.ts`, `src/domain/location-resolver.ts`).
3. Phase 3: Implement pure listing filter & sort functions (`src/domain/listing-filter.ts`).
4. Phase 4: Define feed/dialog ports and XML listing parser adapter (`src/ports/`, `src/adapters/xml-listing-parser.ts`).
5. Phase 5: Implement HTTP feed adapter and browser modal adapter (`src/adapters/managebuilding-feed.ts`, `src/adapters/browser-details-dialog.ts`).
6. Phase 6: Build `ListingController` as a Lit `ReactiveController` (`src/application/listing-controller.ts`).
7. Phase 7: Build presentation components (`listing-card`, `listing-filters`, `property-dialog`).
8. Phase 8: Build container component `property-listings` and wire dependencies in `src/index.tsx`.
9. Phase 9: Update host page `public/index.html` and verify parity against `public/test.html`.