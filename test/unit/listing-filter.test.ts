import assert from 'node:assert/strict';
import test from 'node:test';
import type { Listing } from '../../src/domain/listing.ts';
import { getListingLocationGroups, cleanRegionName } from '../../src/config/listing-filters.ts';
import { filterListings, type ListingFilterCriteria } from '../../src/domain/listing-filter.ts';
import type { ListingFilterConfig } from '../../src/domain/listing-filter.ts';

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

test('returns all listings for empty criteria', () => {
  assert.deepEqual(
    filterListings(listings, {}, config).map((listing) => listing.id),
    ['studio', 'one-bedroom', 'unknown-rent'],
  );
});

test('applies table-driven filtering cases', () => {
  const cases = [
    {
      name: 'empty criteria',
      criteria: {},
      expected: ['studio', 'one-bedroom', 'unknown-rent'],
    },
    {
      name: 'inclusive rent boundary',
      criteria: { maxRent: 900 },
      expected: ['studio', 'unknown-rent'],
    },
    {
      name: 'no matching region',
      criteria: { regionId: 'GFA' },
      expected: [],
    },
  ] satisfies Array<{
    name: string;
    criteria: ListingFilterCriteria;
    expected: string[];
  }>;

  for (const scenario of cases) {
    assert.deepEqual(
      filterListings(listings, scenario.criteria, config).map((listing) => listing.id),
      scenario.expected,
      scenario.name,
    );
  }
});

test('includes a listing at the exact maximum rent boundary', () => {
  assert.deepEqual(
    filterListings(listings, { maxRent: 900 }, config).map((listing) => listing.id),
    ['studio', 'unknown-rent'],
  );
});

test('keeps unknown rents visible under a price filter', () => {
  assert.deepEqual(
    filterListings(listings, { maxRent: 100 }, config).map((listing) => listing.id),
    ['unknown-rent'],
  );
});

test('returns no listings when criteria do not match', () => {
  assert.deepEqual(filterListings(listings, { regionId: 'GFA', bedroomRule: 'two' }, config), []);
});

test('ignores non-finite maximum rent criteria', () => {
  assert.deepEqual(
    filterListings(listings, { maxRent: Number.NaN }, config).map((listing) => listing.id),
    ['studio', 'one-bedroom', 'unknown-rent'],
  );
});

test('rejects unknown bedroom rules without returning matches', () => {
  assert.deepEqual(filterListings(listings, { bedroomRule: 'unconfigured' }, config), []);
});

test('combines filter criteria without changing source order', () => {
  assert.deepEqual(
    filterListings(listings, { bedroomRule: 'three-plus' }, config).map((listing) => listing.id),
    ['unknown-rent'],
  );
});

test('builds reference-compatible location groups from active listings', () => {
  const groups = getListingLocationGroups(listings);

  assert.deepEqual(groups, [
    {
      regionId: 'ALL',
      regionName: 'All Locations',
      options: [{ value: 'ALL', label: 'All Locations (3)', count: 3 }],
    },
    {
      regionId: 'GSJ',
      regionName: 'Saint John',
      options: [{ value: 'GSJ||Rothesay', label: 'Rothesay (1)', count: 1 }],
    },
    {
      regionId: 'GMA',
      regionName: 'Moncton',
      options: [
        {
          value: 'GMA||Moncton Central / Downtown',
          label: 'Moncton Central / Downtown (2)',
          count: 2,
        },
      ],
    },
  ]);
});

test('builds only All Locations group when listings are empty', () => {
  const groups = getListingLocationGroups([]);

  assert.deepEqual(groups, [
    {
      regionId: 'ALL',
      regionName: 'All Locations',
      options: [{ value: 'ALL', label: 'All Locations (0)', count: 0 }],
    },
  ]);
});

test('cleanRegionName strips Greater prefix', () => {
  assert.equal(cleanRegionName('Greater Saint John'), 'Saint John');
  assert.equal(cleanRegionName('Greater Moncton'), 'Moncton');
});

test('cleanRegionName is case-insensitive and handles no prefix', () => {
  assert.equal(cleanRegionName('Greater Saint John'), 'Saint John');
  assert.equal(cleanRegionName('Saint John'), 'Saint John');
  assert.equal(cleanRegionName(''), '');
});
