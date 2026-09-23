import './components/property-listings.js';
import './components/listing-card.js';
import './components/listing-filters.js';
import './components/listing-details.js';
import { BrowserDetailsModal } from './adapters/browser-details-modal.js';
import { ManageBuildingFeed } from './adapters/managebuilding-feed.js';
import { XmlListingParser } from './adapters/xml-listing-parser.js';
import { LocationResolver } from './domain/location-resolver.js';
import type { DetailsModal } from './ports/details-modal.js';
import type { ListingFeed } from './ports/listing-feed.js';
import type { PropertyListings } from './components/property-listings.js';

// Public config re-exports — bundle is the source of truth post-build.
// Hosts (including `public/index.html`/`dev.html`) import from the built
// artifact, not from `src/`; external sites load `bundle.js` classic
// (no CORS) or `bundle.esm.js` via `type="module"` + CORS.
import { NEW_BRUNSWICK_REGIONS as _REGIONS } from './config/regions.js';
import {
  BEDROOM_FILTER_OPTIONS as _BEDROOM_OPTIONS,
  LISTING_FILTER_CONFIG as _FILTER_CONFIG,
  cleanRegionName as _cleanRegionName,
  getListingLocationGroups as _getListingLocationGroups,
} from './config/listing-filters.js';
import {
  APPLICATION_URL as _APPLICATION_URL,
  DETAILS_BASE_URL as _DETAILS_BASE_URL,
  formatModalTitle as _formatModalTitle,
  getListingDetailsUrl as _getListingDetailsUrl,
  hideNavVariantOf as _hideNavVariantOf,
  resolveDetailsIframeUrl as _resolveDetailsIframeUrl,
} from './config/application.js';

export { _REGIONS as NEW_BRUNSWICK_REGIONS };
export {
  _BEDROOM_OPTIONS as BEDROOM_FILTER_OPTIONS,
  _FILTER_CONFIG as LISTING_FILTER_CONFIG,
  _cleanRegionName as cleanRegionName,
  _getListingLocationGroups as getListingLocationGroups,
};
export {
  _APPLICATION_URL as APPLICATION_URL,
  _DETAILS_BASE_URL as DETAILS_BASE_URL,
  _formatModalTitle as formatModalTitle,
  _getListingDetailsUrl as getListingDetailsUrl,
  _hideNavVariantOf as hideNavVariantOf,
  _resolveDetailsIframeUrl as resolveDetailsIframeUrl,
};
// Dev-only re-exports for `public/dev.html` static-sample preview (UIX).
// Not part of external `bundle.js` classic embed; used only by dev host.
export { XmlListingParser } from './adapters/xml-listing-parser.js';
export { ManageBuildingFeed } from './adapters/managebuilding-feed.js';
export { LocationResolver } from './domain/location-resolver.js';

const locationResolver = new LocationResolver(_REGIONS);
const modalByDocument = new WeakMap<Document, DetailsModal>();

const PROPERTY_LISTINGS_TAG = 'property-listings';

interface ListingDefaults {
  createFeed(): ListingFeed;
  detailsModal: DetailsModal;
}

// Immutable shared per bundle; a fresh stateless feed per element; exactly one
// popover per document (a single shared overlay is correct sharing, not a
// singleton smell).
function defaultsFor(doc: Document): ListingDefaults {
  let detailsModal = modalByDocument.get(doc);
  if (!detailsModal) {
    detailsModal = new BrowserDetailsModal();
    modalByDocument.set(doc, detailsModal);
  }
  return {
    createFeed: () => new ManageBuildingFeed(new XmlListingParser(locationResolver)),
    detailsModal,
  };
}

function wireElement(element: PropertyListings, defaults: ListingDefaults): void {
  if (element.feed == null) element.feed = defaults.createFeed();
  if (element.detailsModal == null) element.detailsModal = defaults.detailsModal;
}

/**
 * Fills only the unset ports on every <property-listings> inside `root`, so a
 * host-supplied feed or dialog always wins. Safe to call repeatedly; safe in
 * SSR/server environments where no `document` exists.
 */
export function configurePropertyListings(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const target = root ?? document;
  const doc = target.nodeType === 9 ? (target as Document) : target.ownerDocument;
  if (!doc) return;

  const defaults = defaultsFor(doc);
  if (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.matches(PROPERTY_LISTINGS_TAG)
  ) {
    wireElement(target as PropertyListings, defaults);
  }
  for (const element of target.querySelectorAll<PropertyListings>(PROPERTY_LISTINGS_TAG)) {
    wireElement(element, defaults);
  }
}

function autoWire(): void {
  if (typeof document === 'undefined') return;
  configurePropertyListings();
  warmDetailsOverlay();
  // Late-added elements (host DOM changed after load) are wired as they appear.
  // Shadow-root rendering never retriggers this observer (subtree does not
  // traverse into shadow roots).
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => configurePropertyListings());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

// Mounts the shared overlay, adopts its styles, and warms the details
// connection off the critical path. requestIdleCallback is advisory: when it
// is unavailable the warm still happens, just sooner.
function warmDetailsOverlay(): void {
  const warm = (): void => {
    defaultsFor(document).detailsModal.warm?.();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => warm());
    return;
  }
  globalThis.setTimeout(warm, 1);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoWire, { once: true });
  } else {
    autoWire();
  }
}
