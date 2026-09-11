export type ListingSort = 'default' | 'price-asc' | 'price-desc' | 'beds-asc' | 'beds-desc';

export interface BedroomRule {
  matches: (bedroomCount: number) => boolean;
}

export interface ListingFilterConfig<T> {
  getRegionId: (listing: T) => string;
  getAreaName: (listing: T) => string;
  getBedroomCount: (listing: T) => number;
  getRent: (listing: T) => number | null;
  bedroomRules: Readonly<Record<string, BedroomRule>>;
  unknownRent: {
    value: number;
    matchesMaximum: boolean;
  };
}

export interface ListingFilterCriteria {
  regionId?: string;
  areaName?: string;
  bedroomRule?: string;
  maxRent?: number;
}

export interface ListingFilterOptions extends ListingFilterCriteria {
  sort?: ListingSort;
}

export function filterListings<T>(
  listings: readonly T[],
  criteria: ListingFilterCriteria,
  config: ListingFilterConfig<T>,
): T[] {
  return listings.filter((listing) => {
    return (
      matchesLocation(listing, criteria, config) &&
      matchesBedrooms(listing, criteria.bedroomRule, config) &&
      matchesRent(listing, criteria.maxRent, config)
    );
  });
}

export function sortListings<T>(
  listings: readonly T[],
  sort: ListingSort,
  config: ListingFilterConfig<T>,
): T[] {
  if (sort === 'default') return [...listings];

  return [...listings].sort((a, b) => sortDifference(a, b, sort, config));
}

export function filterAndSortListings<T>(
  listings: readonly T[],
  options: ListingFilterOptions,
  config: ListingFilterConfig<T>,
): T[] {
  return sortListings(filterListings(listings, options, config), options.sort ?? 'default', config);
}

function matchesLocation<T>(
  listing: T,
  criteria: ListingFilterCriteria,
  config: ListingFilterConfig<T>,
): boolean {
  if (criteria.regionId && config.getRegionId(listing) !== criteria.regionId) return false;
  if (
    criteria.areaName &&
    config.getAreaName(listing).toLowerCase() !== criteria.areaName.toLowerCase()
  ) {
    return false;
  }
  return true;
}

function matchesBedrooms<T>(
  listing: T,
  bedroomRule: string | undefined,
  config: ListingFilterConfig<T>,
): boolean {
  if (!bedroomRule) return true;
  const rule = config.bedroomRules[bedroomRule];
  return rule ? rule.matches(config.getBedroomCount(listing)) : false;
}

function matchesRent<T>(
  listing: T,
  maxRent: number | undefined,
  config: ListingFilterConfig<T>,
): boolean {
  if (maxRent === undefined || !Number.isFinite(maxRent)) return true;
  const rent = config.getRent(listing);
  if (rent === null || rent === config.unknownRent.value) {
    return config.unknownRent.matchesMaximum;
  }
  return rent <= maxRent;
}

function sortDifference<T>(
  a: T,
  b: T,
  sort: Exclude<ListingSort, 'default'>,
  config: ListingFilterConfig<T>,
): number {
  switch (sort) {
    case 'price-asc':
      return rentValue(a, config) - rentValue(b, config);
    case 'price-desc':
      return rentValue(b, config) - rentValue(a, config);
    case 'beds-asc':
      return config.getBedroomCount(a) - config.getBedroomCount(b);
    case 'beds-desc':
      return config.getBedroomCount(b) - config.getBedroomCount(a);
  }
}

function rentValue<T>(listing: T, config: ListingFilterConfig<T>): number {
  return config.getRent(listing) ?? config.unknownRent.value;
}
