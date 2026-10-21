import assert from 'node:assert/strict';
import test from 'node:test';
import { ValiError } from 'valibot';
import {
  createListing,
  createListingAddress,
  normalizeCanadianPostalCode,
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

  test('accepts an ID-only listing with unknown numeric values', () => {
    const listing = createListing({
      id: 'id-only',
      address: {
        line1: '',
        line2: '',
        city: '',
        postalCode: '',
        fsa: '',
        regionId: 'OTHER',
        regionName: 'Other',
        areaName: 'Unknown location',
      },
      bedroomCount: null,
      bathroomCount: null,
      rent: null,
      primaryImage: '',
      hook: '',
    });

    assert.equal(listing.id, 'id-only');
    assert.equal(listing.bedroomCount, null);
    assert.equal(listing.rent, null);
  });

  assert.equal(listing.bathroomCount, 1);
  assert.equal(listing.rent, 1250);
});

test('normalizes valid postal codes and preserves unknown address values', () => {
  assert.equal(normalizeCanadianPostalCode('e2m-1y1'), 'E2M 1Y1');
  assert.equal(normalizeCanadianPostalCode(' E 2 M  1 Y 1 '), 'E2M 1Y1');
  assert.equal(normalizeCanadianPostalCode('E2M--1Y1'), null);
  assert.equal(normalizeCanadianPostalCode('D2M 1Y1'), null);
  assert.equal(normalizeCanadianPostalCode(undefined), null);

  const listing = createListing({
    id: 'listing-1',
    address: { ...address, postalCode: 'e1c-1a1' },
    bedroomCount: 1,
    bathroomCount: null,
    rent: null,
    primaryImage: '',
    hook: '',
  });

  assert.equal(listing.address.postalCode, 'E1C 1A1');
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

test('accepts incomplete address values as best-effort data', () => {
  assert.equal(createListingAddress({ ...address, line1: '' }).line1, '');
  assert.equal(createListingAddress({ ...address, regionId: '' }).regionId, '');
  assert.equal(createListingAddress({ ...address, postalCode: '' }).postalCode, '');
  assert.equal(createListingAddress({ ...address, postalCode: 'D1C 1A1' }).postalCode, 'D1C 1A1');
});

test('keeps the region policy immutable', () => {
  const firstRegion = Object.values(NEW_BRUNSWICK_REGIONS)[0]!;

  assert.equal(Object.isFrozen(NEW_BRUNSWICK_REGIONS), true);
  assert.equal(Object.isFrozen(firstRegion), true);
  assert.equal(Object.isFrozen(firstRegion.localAreas), true);
});
