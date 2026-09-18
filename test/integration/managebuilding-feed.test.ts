import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

async function loadFeed(): Promise<typeof import('../../src/adapters/managebuilding-feed.ts')> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-feed-'));
  const outputFile = join(temporaryDirectory, 'managebuilding-feed.js');

  await build({
    entryPoints: ['src/adapters/managebuilding-feed.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputFile,
  });

  const feedModule = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  return feedModule;
}

test('loads listings from the ManageBuilding feed', async () => {
  // Arrange
  const { ManageBuildingFeed } = await loadFeed();
  const xml = `
    <PhysicalProperty>
      <Property>
        <PropertyID>
          <Address>
            <Address>12 Main St</Address>
            <City>Saint John</City>
            <PostalCode>E2L 1A1</PostalCode>
          </Address>
        </PropertyID>
        <Information><LongDescription>Heat and lights included!</LongDescription></Information>
        <Floorplan>
          <Identification><IDValue>abc123</IDValue></Identification>
          <Room RoomType="Bedroom"><Count>2</Count></Room>
          <EffectiveRent Max="1500" />
        </Floorplan>
      </Property>
    </PhysicalProperty>
  `;
  const requestedUrls: string[] = [];
  const parser = {
    parse: (payload: string) => [
      {
        id: payload.includes('abc123') ? 'abc123' : '',
        address: {
          line1: '12 Main Street',
          line2: '',
          city: 'Saint John',
          postalCode: 'E2L 1A1',
          fsa: 'E2L',
          regionId: 'GSJ',
          regionName: 'Greater Saint John',
          areaName: 'Uptown / South End / Central',
        },
        bedroomCount: 2,
        bathroomCount: null,
        rent: 1500,
        primaryImage: '',
        hook: 'Heat and lights included!',
      },
    ],
  };
  const fetchFn = async (url: string) => {
    requestedUrls.push(url);
    return { ok: true, text: async () => xml } as Response;
  };
  const feed = new ManageBuildingFeed(parser, fetchFn as typeof fetch);

  // Act
  const listings = await feed.getListings();

  // Assert
  assert.deepEqual(requestedUrls, [ManageBuildingFeed.FEED_URL]);
  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.id, 'abc123');
  assert.equal(listings[0]?.rent, 1500);
  assert.equal(listings[0]?.address.line1, '12 Main Street');
});

test('falls back to the CORS proxies in fixed order after failed requests', async () => {
  // Arrange
  const { ManageBuildingFeed } = await loadFeed();
  const requestedUrls: string[] = [];
  const fetchFn = async (url: string) => {
    requestedUrls.push(url);
    if (requestedUrls.length <= 2) return { ok: false, text: async () => '' } as Response;
    return {
      ok: true,
      text: async () => JSON.stringify({ contents: '<Property><id>proxy</id></Property>' }),
    } as Response;
  };
  const feed = new ManageBuildingFeed({ parse: () => [] }, fetchFn as typeof fetch);

  // Act
  const xml = await feed.fetchXml();

  // Assert
  assert.deepEqual(requestedUrls, [
    ManageBuildingFeed.FEED_URL,
    `https://corsproxy.io/?${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
  ]);
  assert.match(xml, /<Property>/);
});

test('throws when every feed request fails', async () => {
  // Arrange
  const { ManageBuildingFeed } = await loadFeed();
  const fetchFn = async () => {
    throw new Error('network unavailable');
  };
  const feed = new ManageBuildingFeed({ parse: () => [] }, fetchFn as typeof fetch);

  // Act and assert
  await assert.rejects(feed.fetchXml(), {
    message: 'Unable to retrieve XML feed.',
  });
});
