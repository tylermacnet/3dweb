import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import type { Listing } from '../../src/domain/listing.ts';
import type { ListingFilterConfig, ListingFilterOptions } from '../../src/domain/listing-filter.ts';
import type { ListingLocationGroup } from '../../src/config/listing-filters.ts';

class TestHost {
  updates = 0;

  requestUpdate(): void {
    this.updates += 1;
  }
}

const listing: Listing = {
  id: 'listing-1',
  address: {
    line1: '1 Main Street',
    line2: '',
    city: 'Moncton',
    postalCode: 'E1C 1A1',
    fsa: 'E1C',
    regionId: 'GMA',
    regionName: 'Greater Moncton',
    areaName: 'Moncton',
  },
  bedroomCount: 1,
  bathroomCount: 1,
  rent: 1000,
  primaryImage: '',
  hook: '',
};

const listingWithArea: Listing = {
  id: 'listing-2',
  address: {
    line1: '2 Main Street',
    line2: '',
    city: 'Moncton',
    postalCode: 'E1C 1A1',
    fsa: 'E1C',
    regionId: 'GMA',
    regionName: 'Greater Moncton',
    areaName: 'Moncton Central / Downtown',
  },
  bedroomCount: 2,
  bathroomCount: 1,
  rent: 1500,
  primaryImage: '',
  hook: '',
};

const filterConfig: ListingFilterConfig<Listing> = {
  getRegionId: (value) => value.address.regionId,
  getAreaName: (value) => value.address.areaName,
  getBedroomCount: (value) => value.bedroomCount,
  getRent: (value) => value.rent,
  bedroomRules: {
    all: { matches: () => true },
    one: { matches: (bedroomCount) => bedroomCount === 1 },
  },
  unknownRent: { value: 0, matchesMaximum: true },
};

const buildGroups = (listings: readonly Listing[]): readonly ListingLocationGroup[] => [
  {
    regionId: 'ALL',
    regionName: 'All Locations',
    options: [
      { value: 'ALL', label: `All Locations (${listings.length})`, count: listings.length },
    ],
  },
];

async function loadStore(): Promise<
  typeof import('../../src/application/listing-filter-store.ts')
> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-store-'));
  const outputFile = join(temporaryDirectory, 'listing-filter-store.js');

  await build({
    entryPoints: ['src/application/listing-filter-store.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputFile,
  });

  const storeModule = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  return storeModule;
}

test('returns all listings when no criteria are set', async () => {
  // Arrange
  const { ListingFilterStore } = await loadStore();
  const store = new ListingFilterStore(new TestHost(), filterConfig, buildGroups);

  // Act
  const result = store.visibleListings([listing, listingWithArea]);

  // Assert
  assert.deepEqual(result, [listing, listingWithArea]);
});

test('filters by the current criteria without mutating the input', async () => {
  // Arrange
  const { ListingFilterStore } = await loadStore();
  const store = new ListingFilterStore(new TestHost(), filterConfig, buildGroups);
  const options: ListingFilterOptions = {
    regionId: 'GMA',
    areaName: 'Moncton Central / Downtown',
  };

  // Act
  store.setOptions(options);
  const result = store.visibleListings([listing, listingWithArea]);

  // Assert
  assert.deepEqual(result, [listingWithArea]);
});

test('builds location groups from the provided listings', async () => {
  // Arrange
  const { ListingFilterStore } = await loadStore();
  const store = new ListingFilterStore(new TestHost(), filterConfig, buildGroups);

  // Act
  const groups = store.locationGroups([listingWithArea]);

  // Assert
  assert.equal(groups[0]?.regionId, 'ALL');
  assert.equal(groups[0]?.options[0]?.count, 1);
});

test('requests a host update when options change', async () => {
  // Arrange
  const { ListingFilterStore } = await loadStore();
  const host = new TestHost();
  const store = new ListingFilterStore(host, filterConfig, buildGroups);

  // Act
  store.setOptions({ maxRent: 1200 });

  // Assert
  assert.equal(host.updates, 1);
});

test('defends its criteria from caller mutation of the source object', async () => {
  // Arrange
  const { ListingFilterStore } = await loadStore();
  const store = new ListingFilterStore(new TestHost(), filterConfig, buildGroups);

  // Act
  const live = { maxRent: 1200 };
  store.setOptions(live);
  live.maxRent = 999999;
  const mutatedAway = store.visibleListings([listingWithArea]);

  // Assert: the store snapshot is retained even though the caller kept the
  // original object alive and mutated it after the set.
  assert.deepEqual(mutatedAway, []);
  assert.deepEqual(store.options, { maxRent: 1200 });
});
