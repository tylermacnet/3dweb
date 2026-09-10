import type { RegionMap } from '../config/regions.js';
import type { ResolvedLocation } from './listing.js';

export function getFSA(postalCode: string | null | undefined): string {
  return (postalCode ?? '').replace(/\s+/g, '').toUpperCase().substring(0, 3);
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
    const fsaMatches = this.fsaIndex[getFSA(postalCode)];

    if (fsaMatches && fsaMatches.length > 0) {
      if (fsaMatches.length === 1) return fsaMatches[0]!;

      if (city) {
        const cityLower = city.toLowerCase().trim();
        const cityMatch = fsaMatches.find((match) =>
          match.areaName.toLowerCase().includes(cityLower),
        );
        if (cityMatch) return cityMatch;
      }

      return fsaMatches[0]!;
    }

    if (city) {
      const cityLower = city.toLowerCase().trim();
      for (const [regionName, regionData] of Object.entries(this.regionMap)) {
        const matchedArea = regionData.localAreas.find((area) =>
          area.name.toLowerCase().includes(cityLower),
        );
        if (matchedArea) {
          return { regionName, regionId: regionData.id, areaName: matchedArea.name };
        }
      }
    }

    const fallbackCity = city ?? '';
    return {
      regionName: fallbackCity || 'Other',
      regionId: 'OTHER',
      areaName: fallbackCity || 'General',
    };
  }

  private buildFsaIndex(): void {
    for (const [regionName, regionData] of Object.entries(this.regionMap)) {
      for (const area of regionData.localAreas) {
        for (const fsa of area.fsas) {
          (this.fsaIndex[fsa] ??= []).push({
            regionName,
            regionId: regionData.id,
            areaName: area.name,
          });
        }
      }
    }
  }
}
