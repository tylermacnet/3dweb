import { AddressNormalizer } from '../domain/address-normalizer.js';
import type { Listing } from '../domain/listing.js';
import { getFSA, LocationResolver } from '../domain/location-resolver.js';

export class XmlListingParser {
  private readonly locationResolver: LocationResolver;

  constructor(locationResolver: LocationResolver) {
    this.locationResolver = locationResolver;
  }

  parse(xmlString: string): Listing[] {
    if (!xmlString.trim()) return [];

    const document = new DOMParser().parseFromString(xmlString, 'text/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('Unable to parse XML listing feed.');
    }

    return Array.from(document.querySelectorAll('Property')).map((property) =>
      this.parseProperty(property),
    );
  }

  private parseProperty(property: Element): Listing {
    const addressNode = property.querySelector('PropertyID > Address');
    const street = this.text(addressNode, 'Address');
    const unit = this.text(addressNode, 'Unit, UnitNumber');
    const normalizedAddress = AddressNormalizer.normalize([street, unit].filter(Boolean).join(' '));
    const city = this.text(addressNode, 'City');
    const postalCode = this.text(addressNode, 'PostalCode');
    const location = this.locationResolver.resolve(city, postalCode);

    const floorplan = property.querySelector('Floorplan');
    const bedroomCount = this.number(floorplan, 'Room[RoomType="Bedroom"] > Count') ?? 0;
    const bathroomCount = this.number(floorplan, 'Room[RoomType="Bathroom"] > Count');
    const rentValue = floorplan?.querySelector('EffectiveRent')?.getAttribute('Max');
    const parsedRent = this.numberValue(rentValue);
    const rent = parsedRent === null ? null : Math.round(parsedRent);
    const primaryImage = this.primaryImage(floorplan);
    const description = this.text(property, 'Information > LongDescription');

    return {
      id: this.text(floorplan, 'Identification > IDValue'),
      address: {
        line1: normalizedAddress.line1,
        line2: normalizedAddress.line2,
        city,
        postalCode,
        fsa: getFSA(postalCode),
        regionId: location.regionId,
        regionName: location.regionName,
        areaName: location.areaName,
      },
      bedroomCount,
      bathroomCount,
      rent,
      primaryImage,
      hook:
        description
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.length > 0) ?? '',
    };
  }

  private primaryImage(floorplan: Element | null): string {
    const files = Array.from(floorplan?.querySelectorAll('File') ?? []);
    const rankOne = files.find((file) => this.text(file, 'Rank') === '1');
    return this.text(rankOne, 'Src');
  }

  private text(parent: Element | null | undefined, selector: string): string {
    return parent?.querySelector(selector)?.textContent?.trim() ?? '';
  }

  private number(parent: Element | null, selector: string): number | null {
    return this.numberValue(parent?.querySelector(selector)?.textContent);
  }

  private numberValue(value: string | null | undefined): number | null {
    if (!value?.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
