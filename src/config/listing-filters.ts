import type { ListingFilterConfig } from '../domain/listing-filter.js';
import type { Listing } from '../domain/listing.js';
import { NEW_BRUNSWICK_REGIONS } from './regions.ts';

export const LISTING_FILTER_CONFIG: ListingFilterConfig<Listing> = {
  getRegionId: (listing) => listing.address.regionId,
  getAreaName: (listing) => listing.address.areaName,
  getBedroomCount: (listing) => listing.bedroomCount,
  getRent: (listing) => listing.rent,
  bedroomRules: {
    all: { matches: () => true },
    studio: { matches: (bedroomCount) => bedroomCount === 0 },
    one: { matches: (bedroomCount) => bedroomCount === 1 },
    two: { matches: (bedroomCount) => bedroomCount === 2 },
    'three-plus': { matches: (bedroomCount) => bedroomCount >= 3 },
  },
  unknownRent: {
    value: 0,
    matchesMaximum: true,
  },
};

export interface ListingFilterOption {
  value: string;
  label: string;
}

export const BEDROOM_FILTER_OPTIONS: readonly ListingFilterOption[] = [
  { value: 'all', label: 'All Beds' },
  { value: 'studio', label: 'Bachelor / Studio' },
  { value: 'one', label: '1 Bedroom' },
  { value: 'two', label: '2 Bedrooms' },
  { value: 'three-plus', label: '3+ Bedrooms' },
];

export interface ListingLocationGroup {
  regionId: string;
  regionName: string;
  options: readonly ListingLocationOption[];
}

export interface ListingLocationOption {
  value: string;
  label: string;
  count: number;
}

export function cleanRegionName(name: string): string {
  return name.replace(/^Greater\s+/i, '');
}

export function getListingLocationGroups(listings: readonly Listing[]): ListingLocationGroup[] {
  const areaCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();

  for (const listing of listings) {
    const { regionId, areaName } = listing.address;
    const areaKey = `${regionId}||${areaName}`;
    areaCounts.set(areaKey, (areaCounts.get(areaKey) ?? 0) + 1);
    regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);
  }

  const totalCount = listings.length;

  const groups = Object.entries(NEW_BRUNSWICK_REGIONS).flatMap(([regionName, region]) => {
    const cleanedName = cleanRegionName(regionName);
    const activeAreas = region.localAreas.flatMap((area) => {
      const count = areaCounts.get(`${region.id}||${area.name}`) ?? 0;
      return count > 0
        ? [{ value: `${region.id}||${area.name}`, label: `${area.name} (${count})`, count }]
        : [];
    });

    if (activeAreas.length === 0) return [];

    const options =
      activeAreas.length > 1
        ? [
            {
              value: `${region.id}||ALL`,
              label: `All ${cleanedName} (${regionCounts.get(region.id) ?? 0})`,
              count: regionCounts.get(region.id) ?? 0,
            },
            ...activeAreas,
          ]
        : activeAreas;

    return [{ regionId: region.id, regionName: cleanedName, options }];
  });

  return [
    {
      regionId: 'ALL',
      regionName: 'All Locations',
      options: [{ value: 'ALL', label: `All Locations (${totalCount})`, count: totalCount }],
    },
    ...groups,
  ];
}
