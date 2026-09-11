import assert from 'node:assert/strict';
import test from 'node:test';
import type { Listing } from '../src/domain/listing.ts';
import {
  filterAndSortListings,
  filterListings,
  sortListings,
} from '../src/domain/listing-filter.ts';
import type { ListingFilterConfig } from '../src/domain/listing-filter.ts';

const address = (regionId: string, areaName: string) => ({
  line1: '1 Main Street',
  line2: '',
  city: 'Moncton',
  postalCode: 'E1C 1A1',
  fsa: 'E1C',
  regionId,
  regionName: 'Greater Moncton',
  areaName,
});

const listings: Listing[] = [
  {
    id: 'studio',
    address: address('GMA', 'Moncton Central / Downtown'),
    bedroomCount: 0,
    bathroomCount: 1,
    rent: 900,
    primaryImage: '',
    hook: '',
  },
  {
    id: 'one-bedroom',
    address: address('GMA', 'Moncton Central / Downtown'),
    bedroomCount: 1,
    bathroomCount: 1,
    rent: 1100,
    primaryImage: '',
    hook: '',
  },
  {
    id: 'unknown-rent',
    address: address('GSJ', 'Rothesay'),
    bedroomCount: 3,
    bathroomCount: 2,
    rent: null,
    primaryImage: '',
    hook: '',
  },
];

const config: ListingFilterConfig<Listing> = {
  getRegionId: (listing) => listing.address.regionId,
  getAreaName: (listing) => listing.address.areaName,
  getBedroomCount: (listing) => listing.bedroomCount,
  getRent: (listing) => listing.rent,
  bedroomRules: {
    studio: { matches: (count) => count === 0 },
    one: { matches: (count) => count === 1 },
    two: { matches: (count) => count === 2 },
    'three-plus': { matches: (count) => count >= 3 },
  },
  unknownRent: { value: 0, matchesMaximum: true },
};

test('filters by region, area, bedrooms, and maximum rent', () => {
  assert.deepEqual(
    filterListings(
      listings,
      {
        regionId: 'GMA',
        areaName: 'moncton central / downtown',
        bedroomRule: 'one',
        maxRent: 1100,
      },
      config,
    ).map((listing) => listing.id),
    ['one-bedroom'],
  );
});

test('keeps unknown rents visible under a price filter', () => {
  assert.deepEqual(
    filterListings(listings, { maxRent: 100 }, config).map((listing) => listing.id),
    ['unknown-rent'],
  );
});

test('sorts without mutating the source', () => {
  const source = [listings[1]!, listings[0]!, listings[2]!];
  const sorted = sortListings(source, 'price-asc', config);

  assert.deepEqual(
    sorted.map((listing) => listing.id),
    ['unknown-rent', 'studio', 'one-bedroom'],
  );
  assert.deepEqual(
    source.map((listing) => listing.id),
    ['one-bedroom', 'studio', 'unknown-rent'],
  );
});

test('combines filtering and sorting', () => {
  assert.deepEqual(
    filterAndSortListings(listings, { bedroomRule: 'three-plus', sort: 'beds-desc' }, config).map(
      (listing) => listing.id,
    ),
    ['unknown-rent'],
  );
});
