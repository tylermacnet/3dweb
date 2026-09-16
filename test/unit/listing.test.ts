import assert from 'node:assert/strict';
import test from 'node:test';
import { ValiError } from 'valibot';
import {
  createListing,
  createListingAddress,
  type ListingAddress,
} from '../../src/domain/listing.ts';
import { NEW_BRUNSWICK_REGIONS } from '../../src/config/regions.ts';

const address: ListingAddress = {
  line1: '1 Main Street',
  line2: '',
  city: 'Moncton',
  postalCode: 'E1C 1A1',
  fsa: 'E1C',
  regionId: 'GMA',
  regionName: 'Greater Moncton',
  areaName: 'Moncton',
};

test('creates validated and immutable listing values', () => {
  const listing = createListing({
    id: 'listing-1',
    address,
    bedroomCount: 2,
    bathroomCount: null,
    rent: null,
    primaryImage: '',
    hook: '',
  });

  assert.equal(listing.id, 'listing-1');
  assert.equal(Object.isFrozen(listing), true);
  assert.equal(Object.isFrozen(listing.address), true);
});

test('accepts optional rent and bathroom values', () => {
  const listing = createListing({
    id: 'listing-1',
    address,
    bedroomCount: 0,
    bathroomCount: 1,
    rent: 1250,
    primaryImage: '',
    hook: '',
  });

  assert.equal(listing.bathroomCount, 1);
  assert.equal(listing.rent, 1250);
});

test('rejects invalid identity and numeric values', () => {
  assert.throws(
    () =>
      createListing({
        id: ' ',
        address,
        bedroomCount: 1,
        bathroomCount: null,
        rent: null,
        primaryImage: '',
        hook: '',
      }),
    ValiError,
  );
  assert.throws(
    () =>
      createListing({
        id: 'listing-1',
        address,
        bedroomCount: -1,
        bathroomCount: null,
        rent: null,
        primaryImage: '',
        hook: '',
      }),
    ValiError,
  );
  assert.throws(
    () =>
      createListing({
        id: 'listing-1',
        address,
        bedroomCount: 1,
        bathroomCount: null,
        rent: Number.NaN,
        primaryImage: '',
        hook: '',
      }),
    ValiError,
  );
});

test('rejects incomplete address values', () => {
  assert.throws(() => createListingAddress({ ...address, line1: '' }), ValiError);
  assert.throws(() => createListingAddress({ ...address, regionId: '' }), ValiError);
});

test('keeps the region policy immutable', () => {
  const firstRegion = Object.values(NEW_BRUNSWICK_REGIONS)[0]!;

  assert.equal(Object.isFrozen(NEW_BRUNSWICK_REGIONS), true);
  assert.equal(Object.isFrozen(firstRegion), true);
  assert.equal(Object.isFrozen(firstRegion.localAreas), true);
});
