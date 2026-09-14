import type { Listing } from '../domain/listing.js';

export interface ListingFeed {
  getListings(signal?: AbortSignal): Promise<readonly Listing[]>;
}
