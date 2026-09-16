import type { ListingFilterConfig } from '../domain/listing-filter.js';
import type { Listing } from '../domain/listing.js';

export const LISTING_FILTER_CONFIG: ListingFilterConfig<Listing> = {
  getRegionId: (listing) => listing.address.regionId,
  getAreaName: (listing) => listing.address.areaName,
  getBedroomCount: (listing) => listing.bedroomCount,
  getRent: (listing) => listing.rent,
  bedroomRules: {
    all: { matches: () => true },
    studio: { matches: (bedroomCount) => bedroomCount === 0 },
    one: { matches: (bedroomCount) => bedroomCount === 1 },
    two: { matches: (bedroomCount) => bedroomCount === 2 },
    'three-plus': { matches: (bedroomCount) => bedroomCount >= 3 },
  },
  unknownRent: {
    value: 0,
    matchesMaximum: true,
  },
};

export interface ListingFilterOption {
  value: string;
  label: string;
}

export const BEDROOM_FILTER_OPTIONS: readonly ListingFilterOption[] = [
  { value: 'all', label: 'All Beds' },
  { value: 'studio', label: 'Bachelor / Studio' },
  { value: 'one', label: '1 Bedroom' },
  { value: 'two', label: '2 Bedrooms' },
  { value: 'three-plus', label: '3+ Bedrooms' },
];
