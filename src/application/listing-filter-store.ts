import {
  filterListings,
  type ListingFilterConfig,
  type ListingFilterOptions,
} from '../domain/listing-filter.js';
import type { Listing } from '../domain/listing.js';
import type { ListingLocationGroup } from '../config/listing-filters.js';

export interface ListingFilterHost {
  requestUpdate(): void;
}

/**
 * @deprecated Legacy per-host store. Live path is `ListingStore`
 * (`src/application/listing-store.ts`) which composes loading + filtering
 * per `Document`. Kept for backward-compat tests; do not use in new code.
 */
export class ListingFilterStore {
  private readonly host: ListingFilterHost;
  private readonly config: ListingFilterConfig<Listing>;
  private readonly buildGroups: (listings: readonly Listing[]) => readonly ListingLocationGroup[];
  private criteria: ListingFilterOptions = {};

  constructor(
    host: ListingFilterHost,
    config: ListingFilterConfig<Listing>,
    buildGroups: (listings: readonly Listing[]) => readonly ListingLocationGroup[],
  ) {
    this.host = host;
    this.config = config;
    this.buildGroups = buildGroups;
  }

  get options(): ListingFilterOptions {
    return { ...this.criteria };
  }

  setOptions(options: ListingFilterOptions): void {
    this.criteria = { ...options };
    this.host.requestUpdate();
  }

  visibleListings(listings: readonly Listing[]): readonly Listing[] {
    return filterListings(listings, this.criteria, this.config);
  }

  locationGroups(listings: readonly Listing[]): readonly ListingLocationGroup[] {
    return this.buildGroups(listings);
  }
}
