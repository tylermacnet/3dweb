import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { DOMParser as LinkedomDOMParser } from 'linkedom';
import { NEW_BRUNSWICK_REGIONS } from '../../src/config/regions.ts';
import { LocationResolver } from '../../src/domain/location-resolver.ts';

async function loadParser(): Promise<typeof import('../../src/adapters/xml-listing-parser.ts')> {
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
  callback: (
    Parser: typeof import('../../src/adapters/xml-listing-parser.ts').XmlListingParser,
  ) => T,
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
  const xml = `
    <PhysicalProperty>
      <Property>
        <Identification><IDValue>25089</IDValue></Identification>
        <PropertyID>
          <Identification><IDValue>25089</IDValue></Identification>
          <MarketingName>93 St. James St - 2</MarketingName>
          <Address AddressType="property">
            <Address>93 Saint James StreetApt. 2</Address>
            <City>Saint John</City>
            <State>NB</State>
            <PostalCode>E2L 1V6</PostalCode>
            <Email>leasing@3dprop.ca</Email>
          </Address>
          <Phone PhoneType="office"><PhoneDescription>3D Property Leasing</PhoneDescription><PhoneNumber>506-631-8016</PhoneNumber></Phone>
        </PropertyID>
        <General_ID><Identification><IdentificationTypeIdentification IDType="Management"><IDValue>36860</IDValue></IdentificationTypeIdentification></Identification></General_ID>
        <ILS_Identification ILS_IdentificationType="Mid Rise" RentalType="Unspecified" />
        <Information><StructureType>Unspecified</StructureType><UnitCount>6</UnitCount><YearBuilt /><LongDescription>Heat and lights included!</LongDescription><LeaseLength /></Information>
        <Floorplan>
          <Identification><IDValue>89584</IDValue></Identification>
          <Name>93 St. James St - 2</Name>
          <UnitCount>1</UnitCount>
          <FloorplanAvailabilityURL>http://3dmanagement.managebuilding.com/Resident/PublicPages/apartmentdetail.aspx?listingId=89584&amp;unitid=1&amp;buildingid=25089</FloorplanAvailabilityURL>
          <Room RoomType="Bedroom"><Count>2</Count><Comment>2 Bed</Comment></Room>
          <Room RoomType="Bathroom"><Count>1</Count><Comment>1 Bath</Comment></Room>
          <SquareFeet Min="0" Max="0" /><MarketRent Min="0" Max="0" /><EffectiveRent Min="1500" Max="1500" />
          <File FileID="b20e89e6d5394850838630dff4a31532.jpg" Active="true"><FileType>Photo</FileType><Name /><Caption /><Format>jpg</Format><Src>https://3dmanagement.managebuilding.com/Resident/api/public/files/download/listingImages?fileName=b20e89e6d5394850838630dff4a31532.jpg</Src><Rank>1</Rank></File>
        </Floorplan>
      </Property>
      <Property>
        <Identification><IDValue>25618</IDValue></Identification>
        <PropertyID>
          <Identification><IDValue>25618</IDValue></Identification>
          <MarketingName>Second St - 4</MarketingName>
          <Address AddressType="property"><Address>Second Street - 4</Address><City>Saint John</City><State>NB</State><PostalCode>E2L 1A1</PostalCode><Email>leasing@3dprop.ca</Email></Address>
          <Phone PhoneType="office"><PhoneDescription>3D Property Leasing</PhoneDescription><PhoneNumber>506-631-8016</PhoneNumber></Phone>
        </PropertyID>
        <Information><StructureType>Unspecified</StructureType><UnitCount>4</UnitCount><YearBuilt /><LongDescription>Second listing.</LongDescription><LeaseLength /></Information>
        <Floorplan>
          <Identification><IDValue>89721</IDValue></Identification>
          <Name>Second St - 4</Name>
          <UnitCount>1</UnitCount>
          <FloorplanAvailabilityURL>http://3dmanagement.managebuilding.com/Resident/PublicPages/apartmentdetail.aspx?listingId=89721&amp;unitid=4&amp;buildingid=25618</FloorplanAvailabilityURL>
          <Room RoomType="Bedroom"><Count>4</Count><Comment>4 Bed</Comment></Room>
          <Room RoomType="Bathroom"><Count>2</Count><Comment>2 Bath</Comment></Room>
          <SquareFeet Min="0" Max="0" /><MarketRent Min="0" Max="0" /><EffectiveRent Min="1900" Max="1900" />
        </Floorplan>
      </Property>
    </PhysicalProperty>
  `;
  await withParser((parser) => {
    const listings = parser.parse(xml);
    const sourceDocument = new DOMParser().parseFromString(xml, 'text/xml');
    const firstProperty = sourceDocument.querySelector('PhysicalProperty > Property');
    const floorplanId = firstProperty?.querySelector(
      'Floorplan > Identification > IDValue',
    )?.textContent;
    const floorplanUrl = firstProperty?.querySelector('FloorplanAvailabilityURL')?.textContent;

    assert.equal(listings.length, 2);
    assert.equal(listings[0]?.id, floorplanId);
    assert.equal(new URL(floorplanUrl!).searchParams.get('listingId'), floorplanId);
    for (const listing of listings) {
      assert.match(
        listing.address.postalCode,
        /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/,
      );
    }
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

test('parses a listing with a hyphen-separated Canadian postal code', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
      <PhysicalProperty>
        <Property>
          <PropertyID>
            <MarketingName>205 Charlotte St West - 2</MarketingName>
            <Address>
              <Address>205 Charlotte Street West - 2</Address>
              <City>Saint John</City>
              <PostalCode>E2M-1y1</PostalCode>
            </Address>
          </PropertyID>
          <Floorplan>
            <Identification><IDValue>22961</IDValue></Identification>
            <Room RoomType="Bedroom"><Count>2</Count></Room>
          </Floorplan>
        </Property>
      </PhysicalProperty>
    `);

    assert.equal(listing?.address.fsa, 'E2M');
    assert.equal(listing?.address.postalCode, 'E2M 1Y1');
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

test('preserves available listing fields and leaves optional fields unavailable when absent', async () => {
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

test('preserves an uppercase unit name instead of treating it as property initials', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>owner-initials-id</IDValue></Identification>
              <MarketingName>12 Main Street - OW</MarketingName>
              <Address>
                <Address>12 Main Street - OW</Address>
                <City>Saint John</City>
                <PostalCode>E2L 1A1</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>owner-initials-id</IDValue></Identification>
              <Name>12 Main Street - OW</Name>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '12 Main Street');
    assert.equal(listing?.address.line2, 'Unit OW');
  });
});

test('extracts unit number after stripping owner initials from three-part format', async () => {
  // Pattern: "street - initials - unit"
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>victoria-sh-1</IDValue></Identification>
              <MarketingName>37 Victoria Street - SH - 1</MarketingName>
              <Address>
                <Address>37 Victoria Street - SH - 1</Address>
                <City>Saint John</City>
                <PostalCode>E2K 1L2</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>victoria-sh-1</IDValue></Identification>
              <Name>37 Victoria Street - SH - 1</Name>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '37 Victoria Street');
    assert.equal(listing?.address.line2, 'Unit 1');
  });
});

test('strips property-name initials and preserves a nonnumeric unit name', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>penthouse-sh</IDValue></Identification>
              <MarketingName>37 Victoria Street - SH - Penthouse</MarketingName>
              <Address>
                <Address>37 Victoria Street - SH - Penthouse</Address>
                <City>Saint John</City>
                <PostalCode>E2K 1L2</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>penthouse-sh</IDValue></Identification>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '37 Victoria Street');
    assert.equal(listing?.address.line2, 'Unit Penthouse');
  });
});

test('uses an explicit XML unit instead of the MarketingName unit name', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>explicit-unit</IDValue></Identification>
              <MarketingName>37 Victoria Street - SH - Penthouse</MarketingName>
              <Address>
                <Address>37 Victoria Street - SH - Penthouse</Address>
                <Unit><UnitNumber>4</UnitNumber></Unit>
                <City>Saint John</City>
                <PostalCode>E2K 1L2</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>explicit-unit</IDValue></Identification>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '37 Victoria Street');
    assert.equal(listing?.address.line2, 'Unit 4');
  });
});

test('preserves numeric units when no owner initials are present', async () => {
  // Pattern: "street - unit" (numeric, no initials)
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>prince-2</IDValue></Identification>
              <MarketingName>209 Prince Street - 2</MarketingName>
              <Address>
                <Address>209 Prince Street - 2</Address>
                <City>Saint John</City>
                <PostalCode>E2L 2B3</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>prince-2</IDValue></Identification>
              <Name>209 Prince Street - 2</Name>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '209 Prince Street');
    assert.equal(listing?.address.line2, 'Unit 2');
  });
});

test('keeps single-letter MarketingName unit names on the unit line', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>unit-a</IDValue></Identification>
              <MarketingName>37 Victoria Street - A</MarketingName>
              <Address>
                <Address>37 Victoria Street - A</Address>
                <City>Saint John</City>
                <PostalCode>E2K 1L2</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>unit-a</IDValue></Identification>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '37 Victoria Street');
    assert.equal(listing?.address.line2, 'Unit A');
  });
});

test('uses corrected address when different from marketing name', async () => {
  // When Address has been manually corrected and differs from MarketingName,
  // trust the corrected Address and don't try to parse it
  await withParser((parser) => {
    const [listing] = parser.parse(`
        <PhysicalProperty>
          <Property>
            <PropertyID>
              <Identification><IDValue>corrected-addr</IDValue></Identification>
              <MarketingName>12 Main - OW</MarketingName>
              <Address>
                <Address>12 Main Street</Address>
                <City>Saint John</City>
                <PostalCode>E2L 1A1</PostalCode>
              </Address>
            </PropertyID>
            <Information><LongDescription /></Information>
            <Floorplan>
              <Identification><IDValue>corrected-addr</IDValue></Identification>
              <Name>12 Main - OW</Name>
              <Room RoomType="Bedroom"><Count>1</Count></Room>
            </Floorplan>
          </Property>
        </PhysicalProperty>
      `);

    assert.equal(listing?.address.line1, '12 Main Street');
    assert.equal(listing?.address.line2, '');
  });
});

test('keeps valid records and skips records without an ID', async () => {
  await withParser((parser) => {
    const feed = `
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
            <Identification><IDValue>good-id</IDValue></Identification>
            <Room RoomType="Bedroom"><Count>1</Count></Room>
          </Floorplan>
        </Property>
        <Property>
          <PropertyID>
            <Address>
              <Address>13 Main St</Address>
              <City>Saint John</City>
              <PostalCode>E2L 1A1</PostalCode>
            </Address>
          </PropertyID>
          <Information><LongDescription /></Information>
          <Floorplan>
            <Identification><IDValue></IDValue></Identification>
            <Room RoomType="Bedroom"><Count>1</Count></Room>
          </Floorplan>
        </Property>
      </PhysicalProperty>
    `;

    assert.deepEqual(
      parser.parse(feed).map((listing) => listing.id),
      ['good-id'],
    );
  });
});

test('keeps an ID-only listing and represents unavailable fields without invented values', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
      <PhysicalProperty>
        <Property>
          <Floorplan><Identification><IDValue>id-only</IDValue></Identification></Floorplan>
        </Property>
      </PhysicalProperty>
    `);

    assert.ok(listing);
    assert.equal(listing.id, 'id-only');
    assert.deepEqual(listing.address, {
      line1: '',
      line2: '',
      city: '',
      postalCode: '',
      fsa: '',
      regionId: 'OTHER',
      regionName: 'Other',
      areaName: 'Unknown location',
    });
    assert.equal(listing.bedroomCount, null);
    assert.equal(listing.bathroomCount, null);
    assert.equal(listing.rent, null);
    assert.equal(listing.primaryImage, '');
    assert.equal(listing.hook, '');
  });
});

test('invalid optional fields do not discard a listing with a usable ID', async () => {
  await withParser((parser) => {
    const [listing] = parser.parse(`
      <PhysicalProperty>
        <Property>
          <PropertyID><Address><PostalCode>not a postal code</PostalCode></Address></PropertyID>
          <Floorplan>
            <Identification><IDValue>partial-fields</IDValue></Identification>
            <Room RoomType="Bedroom"><Count>unknown</Count></Room>
            <EffectiveRent Max="unknown" />
          </Floorplan>
        </Property>
      </PhysicalProperty>
    `);

    assert.ok(listing);
    assert.equal(listing.id, 'partial-fields');
    assert.equal(listing.address.postalCode, 'not a postal code');
    assert.equal(listing.bedroomCount, null);
    assert.equal(listing.rent, null);
  });
});
