import type { Listing } from '../domain/listing.js';

export interface DetailsDialog {
  open(listing: Listing): void;
  close(): void;
}
