import type { Listing } from '../domain/listing.js';

export interface ListingParser {
  parse(xmlString: string): readonly Listing[];
}
