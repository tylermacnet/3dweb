import type { RegionMap } from '../config/regions.js';
import type { ResolvedLocation, LocationResolution } from './listing.js';

export function getFSA(postalCode: string | null | undefined): string {
  const compactPostalCode = (postalCode ?? '').replace(/\s+/g, '').toUpperCase();
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[A-Z]\d$/.test(compactPostalCode)
    ? compactPostalCode.substring(0, 3)
    : '';
}

export const getFsa = getFSA;

export class LocationResolver {
  private readonly fsaIndex: Record<string, ResolvedLocation[]> = {};
  private readonly regionMap: RegionMap;

  constructor(regionMap: RegionMap) {
    this.regionMap = regionMap;
    this.buildFsaIndex();
  }

  resolve(
    city: string | null | undefined,
    postalCode: string | null | undefined,
  ): ResolvedLocation {
    const normalizedCity = normalizeLocationText(city);
    const fsaMatches = this.fsaIndex[getFSA(postalCode)];

    if (fsaMatches && fsaMatches.length > 0) {
      if (fsaMatches.length === 1) return withResolution(fsaMatches[0]!, 'matched');

      if (normalizedCity) {
        const cityMatch = fsaMatches.find((match) =>
          normalizeLocationText(match.areaName).includes(normalizedCity),
        );
        if (cityMatch) return withResolution(cityMatch, 'matched');
      }

      return ambiguousLocation(city);
    }

    if (normalizedCity) {
      const cityMatches: ResolvedLocation[] = [];
      for (const [regionName, regionData] of Object.entries(this.regionMap)) {
        for (const area of regionData.localAreas) {
          if (normalizeLocationText(area.name).includes(normalizedCity)) {
            cityMatches.push({
              regionName,
              regionId: regionData.id,
              areaName: area.name,
              resolution: 'matched',
            });
          }
        }
      }
      if (cityMatches.length === 1) return cityMatches[0]!;
      if (cityMatches.length > 1) return ambiguousLocation(city);
    }

    return unknownLocation(city);
  }

  private buildFsaIndex(): void {
    for (const [regionName, regionData] of Object.entries(this.regionMap)) {
      for (const area of regionData.localAreas) {
        for (const fsa of area.fsas) {
          (this.fsaIndex[fsa] ??= []).push({
            regionName,
            regionId: regionData.id,
            areaName: area.name,
            resolution: 'matched',
          });
        }
      }
    }
  }
}

function normalizeLocationText(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

function withResolution(
  location: Omit<ResolvedLocation, 'resolution'>,
  resolution: LocationResolution,
): ResolvedLocation {
  return { ...location, resolution };
}

function ambiguousLocation(city: string | null | undefined): ResolvedLocation {
  return {
    regionName: 'Other',
    regionId: 'OTHER',
    areaName: normalizeLocationText(city) ? city!.trim() : 'Ambiguous location',
    resolution: 'ambiguous',
  };
}

function unknownLocation(city: string | null | undefined): ResolvedLocation {
  const fallbackCity = city?.trim() ?? '';
  return {
    regionName: fallbackCity || 'Other',
    regionId: 'OTHER',
    areaName: fallbackCity || 'General',
    resolution: 'unknown',
  };
}
