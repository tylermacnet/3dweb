import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { DOMParser as LinkedomDOMParser } from 'linkedom';
import { NEW_BRUNSWICK_REGIONS } from '../src/config/regions.ts';
import { LocationResolver } from '../src/domain/location-resolver.ts';

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-src',
  'sample',
  'listingFeeds.xml',
);

async function loadParser(): Promise<typeof import('../src/adapters/xml-listing-parser.ts')> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-parser-'));
  const outputFile = join(temporaryDirectory, 'xml-listing-parser.js');

  await build({
    entryPoints: ['src/adapters/xml-listing-parser.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputFile,
  });

  const parserModule = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  return parserModule;
}

async function withParser<T>(
  callback: (Parser: typeof import('../src/adapters/xml-listing-parser.ts').XmlListingParser) => T,
): Promise<T> {
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = LinkedomDOMParser;

  try {
    const { XmlListingParser } = await loadParser();
    return callback(new XmlListingParser(new LocationResolver(NEW_BRUNSWICK_REGIONS)));
  } finally {
    globalThis.DOMParser = previousParser;
  }
}

test('parses the supplied real-world listing feed', async () => {
  const xml = await readFile(fixturePath, 'utf8');
  await withParser((parser) => {
    const listings = parser.parse(xml);

    assert.equal(listings.length, 12);
    assert.deepEqual(listings[0], {
      id: '89584',
      address: {
        line1: '93 Saint James Street',
        line2: 'Apt 2',
        city: 'Saint John',
        postalCode: 'E2L 1V6',
        fsa: 'E2L',
        regionId: 'GSJ',
        regionName: 'Greater Saint John',
        areaName: 'Uptown / South End / Central',
      },
      bedroomCount: 2,
      bathroomCount: 1,
      rent: 1500,
      primaryImage:
        'https://3dmanagement.managebuilding.com/Resident/api/public/files/download/listingImages?fileName=b20e89e6d5394850838630dff4a31532.jpg',
      hook: 'Heat and lights included!',
    });
    assert.equal(listings[1]?.id, '89721');
    assert.equal(listings[1]?.bedroomCount, 4);
    assert.equal(listings[1]?.rent, 1900);
  });
});

test('returns no listings for an empty XML feed', async () => {
  await withParser((parser) => {
    assert.deepEqual(parser.parse(' \n\t '), []);
  });
});

test('rejects XML documents reported as malformed by the DOM parser', async () => {
  const previousParser = globalThis.DOMParser;

  class MalformedDocumentParser {
    parseFromString(): Document {
      return new LinkedomDOMParser().parseFromString('<parsererror />', 'text/xml');
    }
  }

  globalThis.DOMParser = MalformedDocumentParser;
  try {
    const { XmlListingParser } = await loadParser();
    const parser = new XmlListingParser(new LocationResolver(NEW_BRUNSWICK_REGIONS));
    assert.throws(() => parser.parse('<PhysicalProperty />'), {
      message: 'Unable to parse XML listing feed.',
    });
  } finally {
    globalThis.DOMParser = previousParser;
  }
});

test('preserves required listing fields and handles optional fields when absent', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
      <PhysicalProperty>
        <Property>
          <PropertyID>
            <Address>
              <Address>12 Main St</Address>
              <City>Saint John</City>
              <PostalCode>E2L 1A1</PostalCode>
            </Address>
          </PropertyID>
          <Information><LongDescription /></Information>
          <Floorplan>
            <Identification><IDValue>required-id</IDValue></Identification>
            <Room RoomType="Bedroom"><Count>1</Count></Room>
            <Room RoomType="Bathroom"><Count>1</Count></Room>
          </Floorplan>
        </Property>
      </PhysicalProperty>
    `);

    assert.equal(listing?.id, 'required-id');
    assert.equal(listing?.bedroomCount, 1);
    assert.equal(listing?.bathroomCount, 1);
    assert.equal(listing?.rent, null);
    assert.equal(listing?.primaryImage, '');
    assert.equal(listing?.hook, '');
  });
});
