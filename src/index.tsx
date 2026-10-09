import './components/property-listings.js';
import './components/listing-card.js';
import './components/listing-filters.js';
import './components/listing-grid.js';
import './components/listing-details.js';
import { BrowserDetailsModal } from './adapters/browser-details-modal.js';
import { ManageBuildingFeed } from './adapters/managebuilding-feed.js';
import { XmlListingParser } from './adapters/xml-listing-parser.js';
import { LocationResolver } from './domain/location-resolver.js';
import { getListingStore, clearListingStore } from './application/listing-store.js';
import type { DetailsModal } from './ports/details-modal.js';
import type { ListingFeed } from './ports/listing-feed.js';
import type { PropertyListings } from './components/property-listings.js';
import type { ListingGrid } from './components/listing-grid.js';

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
export { getListingStore, clearListingStore } from './application/listing-store.js';

// Classic (`bundle.js` IIFE) singleton bridge: `bundle.esm.js` is a separate
// module instance with its own `WeakMap<Document,ListingStore>`. Dev hosts
// loading both runtimes must share one store, so expose the classic accessor
// for module scripts to prefer over an ESM import (P0.3). First writer wins
// so load order never re-splits the singleton.
{
  const g = globalThis as unknown as {
    __3DWEB__?: {
      getListingStore: typeof getListingStore;
      clearListingStore: typeof clearListingStore;
    };
  };
  g.__3DWEB__ ??= { getListingStore, clearListingStore };
}

const locationResolver = new LocationResolver(_REGIONS);
const modalByDocument = new WeakMap<Document, DetailsModal>();
const defaultFeedByDocument = new WeakMap<Document, ListingFeed>();

const PROPERTY_LISTINGS_TAG = 'property-listings';
const LISTING_GRID_TAG = 'listing-grid';
const LISTING_CARD_TAG = 'listing-card';

interface ListingDefaults {
  createFeed(): ListingFeed;
  detailsModal: DetailsModal;
}

// Immutable shared per bundle; exactly one popover per document (a single
// shared overlay is correct sharing, not a singleton smell).
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

function getOrCreateDefaultFeed(doc: Document, defaults: ListingDefaults): ListingFeed {
  let feed = defaultFeedByDocument.get(doc);
  if (!feed) {
    feed = defaults.createFeed();
    defaultFeedByDocument.set(doc, feed);
  }
  return feed;
}

function ensureStoreFeed(doc: Document, defaults: ListingDefaults): void {
  const store = getListingStore(doc);
  if (store.loadState.kind === 'idle') {
    try {
      if (!store.hasFeed) store.setFeed(getOrCreateDefaultFeed(doc, defaults));
      else void store.load();
    } catch {
      // ignore SSR
    }
  }
}

function wireElement(element: PropertyListings | ListingGrid, defaults: ListingDefaults): void {
  const doc =
    (element.ownerDocument as Document) ?? (typeof document !== 'undefined' ? document : undefined);
  if (doc) ensureStoreFeed(doc, defaults);
  const anyEl = element as unknown as { feed?: ListingFeed; detailsModal?: DetailsModal };
  if (anyEl.feed == null) {
    // Reuse the single default feed per document instead of creating a fresh one per element
    const feed = doc ? getOrCreateDefaultFeed(doc, defaults) : defaults.createFeed();
    anyEl.feed = feed;
    try {
      if (doc) {
        const store = getListingStore(doc);
        if (!store.hasFeed) store.setFeed(feed);
      }
    } catch {
      // ignore
    }
  } else {
    try {
      if (doc) {
        const store = getListingStore(doc);
        if (store.currentFeed !== anyEl.feed) store.setFeed(anyEl.feed);
      }
    } catch {
      // ignore
    }
  }
  if (anyEl.detailsModal == null) {
    anyEl.detailsModal = defaults.detailsModal;
  }
}

/**
 * Fills only the unset ports on every relevant element inside `root`, so a
 * host-supplied feed or dialog always wins. Safe to call repeatedly; safe in
 * SSR/server environments where no `document` exists. Transparent singleton
 * means hosts can use <listing-filters> + <listing-grid> without wiring.
 */
export function configurePropertyListings(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const target = root ?? document;
  const doc = target.nodeType === 9 ? (target as Document) : target.ownerDocument;
  if (!doc) return;

  const defaults = defaultsFor(doc);
  // Ensure singleton store has a feed lazily when any listing element exists
  const hasAnyListingElement =
    (typeof Element !== 'undefined' &&
      target instanceof Element &&
      (target.matches(PROPERTY_LISTINGS_TAG) || target.matches(LISTING_GRID_TAG))) ||
    target.querySelectorAll(`${PROPERTY_LISTINGS_TAG}, ${LISTING_GRID_TAG}`).length > 0;
  if (hasAnyListingElement) ensureStoreFeed(doc, defaults);

  if (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.matches(PROPERTY_LISTINGS_TAG)
  ) {
    wireElement(target as unknown as PropertyListings, defaults);
  }
  if (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.matches(LISTING_GRID_TAG)
  ) {
    wireElement(target as unknown as ListingGrid, defaults);
  }
  for (const element of target.querySelectorAll<PropertyListings>(PROPERTY_LISTINGS_TAG)) {
    wireElement(element, defaults);
  }
  for (const element of target.querySelectorAll<ListingGrid>(LISTING_GRID_TAG)) {
    wireElement(element, defaults);
  }
}

function autoWire(): void {
  if (typeof document === 'undefined') return;
  configurePropertyListings();
  // The details overlay (mount + styles + preconnect) is only warmed when a
  // modal-capable element is present, so universal-head embeds on off-listing
  // pages stay idle. open() mounts on demand, so it works without warm.
  if (hasModalCapableElement(document)) warmDetailsOverlay();
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => configurePropertyListings());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function hasModalCapableElement(doc: Document): boolean {
  return (
    doc.querySelectorAll(`${PROPERTY_LISTINGS_TAG}, ${LISTING_GRID_TAG}, ${LISTING_CARD_TAG}`)
      .length > 0
  );
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
