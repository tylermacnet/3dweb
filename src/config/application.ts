import type { Listing } from '../domain/listing.js';
import { cleanRegionName } from './listing-filters.js';

export const APPLICATION_URL =
  'https://3dmanagement.managebuilding.com/Resident/rental-application/new';

export const DETAILS_BASE_URL = 'https://3dmanagement.managebuilding.com/Resident/public/rentals';

export interface ListingDetailsUrlOptions {
  baseUrl?: string;
  /** Chromeless embed variant for the details iframe only; never for links. */
  hideNav?: boolean;
}

export function getListingDetailsUrl(
  listing: Listing,
  options: ListingDetailsUrlOptions = {},
): string {
  const url = new URL(`${options.baseUrl ?? DETAILS_BASE_URL}/${encodeURIComponent(listing.id)}`);
  if (options.hideNav) url.searchParams.set('hidenav', 'true');
  return url.toString();
}

export interface DetailsIframeUrlOptions {
  listingId?: string;
  /** Same-origin override for hosts that have the details URL already. */
  src?: string;
  baseUrl?: string;
}

/**
 * Resolves the iframe source for <listing-details>. Always forces the
 * chromeless hidenav variant. A `src` override must be HTTPS on exactly the
 * ManageBuilding canonical origin (never the caller-supplied base), so hosts
 * cannot point the iframe at an arbitrary site. `baseUrl` affects only
 * listing-id resolution. Returns null when no usable input is present.
 */
export function resolveDetailsIframeUrl(options: DetailsIframeUrlOptions): string | null {
  const src = options.src?.trim();
  if (src) {
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:') return null;
    if (url.origin !== new URL(DETAILS_BASE_URL).origin) return null;
    url.searchParams.set('hidenav', 'true');
    return url.toString();
  }

  const listingId = options.listingId?.trim();
  if (listingId) {
    const url = new URL(`${options.baseUrl ?? DETAILS_BASE_URL}/${encodeURIComponent(listingId)}`);
    url.searchParams.set('hidenav', 'true');
    return url.toString();
  }

  return null;
}

/** Dialog header title: location prefix (same vocabulary as the card) + address. */
export function formatDialogTitle(listing: Listing): string {
  const location = [cleanRegionName(listing.address.regionName), listing.address.areaName]
    .filter(Boolean)
    .join(' • ');
  const address = [listing.address.line1, listing.address.line2].filter(Boolean).join(' ');
  if (address) return location ? `${location} — ${address}` : address;
  return location || 'Property Details';
}
