import { AddressNormalizer } from '../domain/address-normalizer.js';
import { createListing, normalizeCanadianPostalCode, type Listing } from '../domain/listing.js';
import { getFSA, LocationResolver } from '../domain/location-resolver.js';
import type { ListingParser } from '../ports/listing-parser.js';

/**
 * Typed parse failure. The parser is fail-fast by explicit product policy: a
 * single malformed `<Property>` record aborts the whole feed (surfacing as
 * the loader `error` + retry state) rather than silently dropping records.
 * `recordIndex` identifies the offending record; the `cause` preserves the
 * underlying Valibot/DOM error.
 */
export class ListingParseError extends Error {
  readonly recordIndex: number | undefined;

  constructor(message: string, options?: { cause?: unknown; recordIndex?: number }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ListingParseError';
    this.recordIndex = options?.recordIndex;
  }
}

export class XmlListingParser implements ListingParser {
  private readonly locationResolver: LocationResolver;

  constructor(locationResolver: LocationResolver) {
    this.locationResolver = locationResolver;
  }

  parse(xmlString: string): Listing[] {
    if (!xmlString.trim()) return [];

    const document = new DOMParser().parseFromString(xmlString, 'text/xml');
    if (document.querySelector('parsererror')) {
      throw new ListingParseError('Unable to parse XML listing feed.');
    }

    const properties = Array.from(document.querySelectorAll('Property'));
    return properties.map((property, recordIndex) => {
      try {
        return this.parseProperty(property);
      } catch (error) {
        throw new ListingParseError(`Unable to parse listing record ${recordIndex}.`, {
          cause: error,
          recordIndex,
        });
      }
    });
  }

  private parseProperty(property: Element): Listing {
    const addressNode = property.querySelector('PropertyID > Address');
    const marketingName = this.text(property, 'PropertyID > MarketingName');
    let street = this.text(addressNode, 'Address');
    let unit = this.text(addressNode, 'Unit, UnitNumber');

    // MarketingName ends with " - <unit name>". When Address matches it, use
    // that boundary to clean the property name and preserve the unit name.
    if (street && this.normalizeWhitespace(street) === this.normalizeWhitespace(marketingName)) {
      const parsed = this.parseMarketingNameAddress(street);
      if (parsed) {
        street = parsed.propertyName;
        if (!unit) unit = parsed.unitName;
      }
    }

    const addressString = unit ? this.withUnit(street, unit) : street;
    const normalizedAddress = AddressNormalizer.normalize(addressString);
    const city = this.text(addressNode, 'City');
    const rawPostalCode = this.text(addressNode, 'PostalCode');
    const postalCode = normalizeCanadianPostalCode(rawPostalCode) ?? rawPostalCode;
    const location = this.locationResolver.resolve(city, postalCode);

    const floorplan = property.querySelector('Floorplan');
    const bedroomCount = this.number(floorplan, 'Room[RoomType="Bedroom"] > Count') ?? 0;
    const bathroomCount = this.number(floorplan, 'Room[RoomType="Bathroom"] > Count');
    const rentValue = floorplan?.querySelector('EffectiveRent')?.getAttribute('Max');
    const parsedRent = this.numberValue(rentValue);
    const rent = parsedRent === null ? null : Math.round(parsedRent);
    const primaryImage = this.primaryImage(floorplan);
    const description = this.text(property, 'Information > LongDescription', true);

    return createListing({
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
    });
  }

  /**
   * Detect a dash-delimited owner-initials segment (1-3 uppercase letters).
   *
   * @example
   * isOwnerInitials('SH')     // true
   * isOwnerInitials('OW')     // true
   * isOwnerInitials('ABC')    // true
   * isOwnerInitials('sh')     // false (lowercase)
   * isOwnerInitials('4')      // false (numeric)
   * isOwnerInitials('ABCD')   // false (too long)
   */
  private isOwnerInitials(value: string): boolean {
    return /^[A-Z]{1,3}$/.test(value.trim());
  }

  /**
   * Separate the final unit-name segment and strip trailing initials from the
   * property name without treating the unit name itself as metadata.
   */
  private parseMarketingNameAddress(
    address: string,
  ): { propertyName: string; unitName: string } | null {
    const segments = this.normalizeWhitespace(address).split(/\s+-\s+/u);
    if (segments.length < 2) return null;

    const unitName = segments.pop() ?? '';
    let propertyName = segments.join(' - ');
    if (segments.length > 0) {
      const initials = segments[segments.length - 1];
      if (initials && this.isOwnerInitials(initials)) {
        segments.pop();
        propertyName = segments.join(' - ');
      }
    }

    return { propertyName: propertyName.trim(), unitName: unitName.trim() };
  }

  private withUnit(street: string, unit: string): string {
    if (/^(?:apt(?:artment)?|unit|suite|ste)\b|^#/i.test(unit)) {
      return `${street} ${unit}`.trim();
    }
    return `${street} Unit ${unit}`.trim();
  }

  private primaryImage(floorplan: Element | null): string {
    const files = Array.from(floorplan?.querySelectorAll('File') ?? []);
    const rankOne = files.find((file) => this.text(file, 'Rank') === '1');
    return this.text(rankOne, 'Src');
  }

  private text(
    parent: Element | null | undefined,
    selector: string,
    preserveLineBreaks = false,
  ): string {
    const value = parent?.querySelector(selector)?.textContent ?? '';
    if (preserveLineBreaks) {
      return value
        .split(/\r\n?|\n/u)
        .map((line) => this.normalizeWhitespace(line))
        .join('\n')
        .trim();
    }
    return this.normalizeWhitespace(value);
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/gu, ' ').trim();
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
