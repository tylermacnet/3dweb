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

test('resolves a listing id into the canonical chromeless details iframe URL', async () => {
  // Arrange
  const { DETAILS_BASE_URL, resolveDetailsIframeUrl } = await applicationConfig();

  // Act
  const url = resolveDetailsIframeUrl({ listingId: 'listing-42' });

  // Assert
  assert.equal(url, `${DETAILS_BASE_URL}/listing-42?hidenav=true`);
});

test('resolves the iframe URL against a custom details base', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act
  const url = resolveDetailsIframeUrl({
    listingId: 'listing-7',
    baseUrl: 'https://example.com/details',
  });

  // Assert
  assert.equal(url, 'https://example.com/details/listing-7?hidenav=true');
});

test('accepts a same-origin src override and forces hidenav', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act
  const url = resolveDetailsIframeUrl({
    src: 'https://3dmanagement.managebuilding.com/Resident/public/rentals/abc',
  });

  // Assert
  assert.equal(
    url,
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/abc?hidenav=true',
  );
});

test('rejects src overrides off the ManageBuilding original origin', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act and assert each hostile override
  assert.equal(
    resolveDetailsIframeUrl({ src: 'https://3dmanagement.managebuilding.com.evil.example/x' }),
    null,
  );
  assert.equal(resolveDetailsIframeUrl({ src: 'https://evil.example/x' }), null);
  assert.equal(resolveDetailsIframeUrl({ src: 'http://3dmanagement.managebuilding.com/x' }), null);
  assert.equal(resolveDetailsIframeUrl({ src: 'javascript:alert(1)' }), null);
  assert.equal(resolveDetailsIframeUrl({ src: 'not a url' }), null);
});

test('ignores a custom base url when validating a src override', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act and assert: a src on the custom base origin is still rejected because
  // baseUrl must never widen the iframe to a host-controlled origin.
  assert.equal(
    resolveDetailsIframeUrl({
      src: 'https://example.com/details/listing-9',
      baseUrl: 'https://example.com/details',
    }),
    null,
  );
});

test('treats an empty or whitespace src as absent', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act and assert: a blank src falls through to the listing id path.
  assert.equal(resolveDetailsIframeUrl({ src: '   ' }), null);
  assert.equal(
    resolveDetailsIframeUrl({
      src: '   ',
      listingId: 'listing-42',
    }),
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/listing-42?hidenav=true',
  );
});

test('returns null when neither a listing id nor a src is available', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act and assert
  assert.equal(resolveDetailsIframeUrl({}), null);
  assert.equal(resolveDetailsIframeUrl({ listingId: '' }), null);
  assert.equal(resolveDetailsIframeUrl({ listingId: '   ' }), null);
});

test('encodes hostile characters in the listing id path segment', async () => {
  // Arrange
  const { resolveDetailsIframeUrl } = await applicationConfig();

  // Act
  const url = resolveDetailsIframeUrl({ listingId: 'a b?c#d' });

  // Assert
  assert.equal(
    url,
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/a%20b%3Fc%23d?hidenav=true',
  );
});

test('encodes the listing id consistently in link URLs too', async () => {
  // Arrange
  const { getListingDetailsUrl } = await applicationConfig();

  // Act
  const url = getListingDetailsUrl(listingFixture('a b?c#d'));

  // Assert
  assert.equal(
    url,
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/a%20b%3Fc%23d',
  );
});

test('derives the chromeless prefetch URL from a card href', async () => {
  // Arrange
  const { hideNavVariantOf } = await applicationConfig();

  // Act and assert
  assert.equal(
    hideNavVariantOf('https://3dmanagement.managebuilding.com/Resident/public/rentals/abc'),
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/abc?hidenav=true',
  );
  assert.equal(
    hideNavVariantOf(
      'https://3dmanagement.managebuilding.com/Resident/public/rentals/abc?hidenav=true',
    ),
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/abc?hidenav=true',
  );
  assert.equal(hideNavVariantOf('https://evil.example/x?hidenav=true'), null);
  assert.equal(hideNavVariantOf('http://3dmanagement.managebuilding.com/x'), null);
  assert.equal(hideNavVariantOf('/relative/path'), null);
  assert.equal(hideNavVariantOf('not a url'), null);
});

test('prefixes the modal title with the listing location', async () => {
  // Arrange
  const { formatModalTitle } = await applicationConfig();
  const listing = listingFixture('listing-42');

  // Act
  const title = formatModalTitle(listing);

  // Assert
  assert.equal(title, 'Fredericton • Downtown / South Side — 144 King Street');
});

test('falls back gracefully for incomplete modal title data', async () => {
  // Arrange
  const { formatModalTitle } = await applicationConfig();
  const base = listingFixture('listing-42');

  // Act and assert each observable fallback
  assert.equal(
    formatModalTitle({ ...base, address: { ...base.address, line1: '', line2: '' } }),
    'Fredericton • Downtown / South Side',
  );
  assert.equal(
    formatModalTitle({
      ...base,
      address: { ...base.address, line1: '', line2: '', regionName: '', areaName: '' },
    }),
    'Property Details',
  );
});
