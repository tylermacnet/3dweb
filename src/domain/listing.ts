import * as v from 'valibot';

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1));
const optionalText = v.pipe(v.string(), v.trim());
const nonNegativeNumber = v.pipe(v.number(), v.finite(), v.minValue(0));

export const listingAddressSchema = v.object({
  line1: requiredText,
  line2: optionalText,
  city: requiredText,
  postalCode: requiredText,
  fsa: requiredText,
  regionId: requiredText,
  regionName: requiredText,
  areaName: requiredText,
});

export const listingSchema = v.object({
  id: requiredText,
  address: listingAddressSchema,
  bedroomCount: nonNegativeNumber,
  bathroomCount: v.nullable(nonNegativeNumber),
  rent: v.nullable(nonNegativeNumber),
  primaryImage: optionalText,
  hook: optionalText,
});

export type ListingAddress = v.InferOutput<typeof listingAddressSchema>;
export type Listing = v.InferOutput<typeof listingSchema>;

export function createListingAddress(input: unknown): ListingAddress {
  return Object.freeze(v.parse(listingAddressSchema, input));
}

export function createListing(input: unknown): Listing {
  const listing = v.parse(listingSchema, input);
  return Object.freeze({ ...listing, address: Object.freeze(listing.address) });
}

export interface ResolvedLocation {
  regionName: string;
  regionId: string;
  areaName: string;
  resolution: LocationResolution;
}

export type LocationResolution = 'matched' | 'ambiguous' | 'unknown';
