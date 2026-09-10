export interface ListingAddress {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  fsa: string;
  regionId: string;
  regionName: string;
  areaName: string;
}

export interface Listing {
  id: string;
  address: ListingAddress;
  bedroomCount: number;
  bathroomCount: number | null;
  rent: number | null;
  primaryImage: string;
  hook: string;
}

export interface ResolvedLocation {
  regionName: string;
  regionId: string;
  areaName: string;
}
