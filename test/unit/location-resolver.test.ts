import assert from 'node:assert/strict';
import test from 'node:test';
import { NEW_BRUNSWICK_REGIONS } from '../../src/config/regions.ts';
import { getFSA, LocationResolver } from '../../src/domain/location-resolver.ts';

const resolver = new LocationResolver(NEW_BRUNSWICK_REGIONS);

test('extracts and normalizes a forward sortation area', () => {
  assert.equal(getFSA('e1c 2a3'), 'E1C');
  assert.equal(getFSA(' E 1 C 2A3 '), 'E1C');
  assert.equal(getFSA('E1C'), '');
  assert.equal(getFSA('12345'), '');
  assert.equal(getFSA(undefined), '');
  assert.equal(getFSA(null), '');
});

test('resolves an area by a unique FSA', () => {
  assert.deepEqual(resolver.resolve('', 'E2L 4A1'), {
    regionName: 'Greater Saint John',
    regionId: 'GSJ',
    areaName: 'Uptown / South End / Central',
    resolution: 'matched',
  });
});

test('uses city to disambiguate FSAs shared by local areas', () => {
  assert.deepEqual(resolver.resolve('Dieppe', 'E1A 1A1'), {
    regionName: 'Greater Moncton',
    regionId: 'GMA',
    areaName: 'Dieppe',
    resolution: 'matched',
  });
  assert.deepEqual(resolver.resolve('Edmundston', 'E3V 1A1'), {
    regionName: 'Greater Edmundston & Madawaska',
    regionId: 'GEM',
    areaName: 'Edmundston Downtown',
    resolution: 'matched',
  });
});

test('marks a shared FSA without a city match as ambiguous', () => {
  assert.deepEqual(resolver.resolve('Unknown', 'E1A 1A1'), {
    regionName: 'Other',
    regionId: 'OTHER',
    areaName: 'Unknown',
    resolution: 'ambiguous',
  });
});

test('resolves by city when the postal code is unknown', () => {
  assert.deepEqual(resolver.resolve('Rothesay', 'X1X 1X1'), {
    regionName: 'Greater Saint John',
    regionId: 'GSJ',
    areaName: 'Rothesay',
    resolution: 'matched',
  });
});

test('marks a city-only query with multiple area matches as ambiguous', () => {
  assert.deepEqual(resolver.resolve('moncton', 'X1X 1X1'), {
    regionName: 'Other',
    regionId: 'OTHER',
    areaName: 'moncton',
    resolution: 'ambiguous',
  });
});

test('returns an Other fallback when neither city nor FSA resolves', () => {
  assert.deepEqual(resolver.resolve('', 'X1X 1X1'), {
    regionName: 'Other',
    regionId: 'OTHER',
    areaName: 'General',
    resolution: 'unknown',
  });
  assert.deepEqual(resolver.resolve('Unknown', undefined), {
    regionName: 'Unknown',
    regionId: 'OTHER',
    areaName: 'Unknown',
    resolution: 'unknown',
  });
});

test('does not depend on browser globals', () => {
  assert.equal('window' in globalThis, false);
  assert.equal('document' in globalThis, false);
});
