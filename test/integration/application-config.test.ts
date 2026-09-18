import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import type { Listing } from '../../src/domain/listing.ts';

type ApplicationConfigModule = typeof import('../../src/config/application.ts');

let cached: ApplicationConfigModule | undefined;

async function applicationConfig(): Promise<ApplicationConfigModule> {
  if (!cached) {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-app-config-'));
    const outputFile = join(temporaryDirectory, 'application-config.js');
    await build({
      entryPoints: ['src/config/application.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: outputFile,
    });
    cached = (await import(
      `${pathToFileURL(outputFile).href}?test=${Date.now()}`
    )) as ApplicationConfigModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
}

function listingFixture(id: string): Listing {
  return {
    id,
    address: {
      line1: '144 King Street',
      line2: '',
      city: 'Fredericton',
      postalCode: 'E3B 1A1',
      fsa: 'E3B',
      regionId: 'GFA',
      regionName: 'Greater Fredericton',
      areaName: 'Downtown / South Side',
    },
    bedroomCount: 2,
    bathroomCount: 1,
    rent: 1750,
    primaryImage: '',
    hook: '',
  };
}

test('builds the canonical details URL for a listing', async () => {
  // Arrange
  const { DETAILS_BASE_URL, getListingDetailsUrl } = await applicationConfig();
  const listing = listingFixture('listing-42');

  // Act
  const url = getListingDetailsUrl(listing);

  // Assert
  assert.equal(url, `${DETAILS_BASE_URL}/listing-42`);
});

test('honors a custom details base URL', async () => {
  // Arrange
  const { getListingDetailsUrl } = await applicationConfig();
  const listing = listingFixture('listing-7');

  // Act
  const url = getListingDetailsUrl(listing, { baseUrl: 'https://example.com/details' });

  // Assert
  assert.equal(url, 'https://example.com/details/listing-7');
});

test('adds the chromeless variant for the iframe only', async () => {
  // Arrange
  const { DETAILS_BASE_URL, getListingDetailsUrl } = await applicationConfig();
  const listing = listingFixture('listing-42');

  // Act
  const url = getListingDetailsUrl(listing, { hideNav: true });

  // Assert
  assert.equal(url, `${DETAILS_BASE_URL}/listing-42?hidenav=true`);
});

test('prefixes the dialog title with the listing location', async () => {
  // Arrange
  const { formatDialogTitle } = await applicationConfig();
  const listing = listingFixture('listing-42');

  // Act
  const title = formatDialogTitle(listing);

  // Assert
  assert.equal(title, 'Fredericton • Downtown / South Side — 144 King Street');
});

test('falls back gracefully for incomplete dialog title data', async () => {
  // Arrange
  const { formatDialogTitle } = await applicationConfig();
  const base = listingFixture('listing-42');

  // Act and assert each observable fallback
  assert.equal(
    formatDialogTitle({ ...base, address: { ...base.address, line1: '', line2: '' } }),
    'Fredericton • Downtown / South Side',
  );
  assert.equal(
    formatDialogTitle({
      ...base,
      address: { ...base.address, line1: '', line2: '', regionName: '', areaName: '' },
    }),
    'Property Details',
  );
});
