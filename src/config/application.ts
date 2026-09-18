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
  const url = new URL(`${options.baseUrl ?? DETAILS_BASE_URL}/${listing.id}`);
  if (options.hideNav) url.searchParams.set('hidenav', 'true');
  return url.toString();
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
