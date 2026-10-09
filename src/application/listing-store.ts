import type { ReactiveControllerHost } from 'lit';
import type { Listing } from '../domain/listing.js';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';
import { filterListings } from '../domain/listing-filter.js';
import { getListingLocationGroups, LISTING_FILTER_CONFIG } from '../config/listing-filters.js';
import type { ListingLocationGroup } from '../config/listing-filters.js';

export type ListingLoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly listings: readonly Listing[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string };

function priceBounds(listings: readonly Listing[]): { min: number; max: number } | null {
  let rawMin = Infinity;
  let rawMax = -Infinity;
  let count = 0;
  for (const l of listings) {
    const rent = l.rent;
    if (rent === null || rent <= 0) continue;
    count++;
    if (rent < rawMin) rawMin = rent;
    if (rent > rawMax) rawMax = rent;
  }
  if (count === 0) return null;
  return { min: Math.floor(rawMin / 100) * 100, max: Math.ceil(rawMax / 100) * 100 };
}

/**
 * Browser-level lazy singleton per Document.
 * Holds fetched/parsed listings, filter criteria, and derived visible sets.
 * Components read via getListingStore(document) and subscribe as ReactiveControllerHost.
 * Shared object is industry standard for local UI state (not event sourcing).
 */
export class ListingStore {
  private readonly hosts = new Set<ReactiveControllerHost>();
  private feed: ListingFeed | undefined;
  private requestController: AbortController | undefined;
  private _loadState: ListingLoadState = { kind: 'idle' };
  private _criteria: ListingFilterOptions = {};

  private notify(): void {
    for (const host of this.hosts) host.requestUpdate();
  }

  subscribe(host: ReactiveControllerHost): void {
    this.hosts.add(host);
    // Recover from a last-host abort: a remount after all hosts left
    // resets to idle, so kick a fresh load when a feed is already set.
    if (this.feed && this._loadState.kind === 'idle') void this.load();
  }

  unsubscribe(host: ReactiveControllerHost): void {
    this.hosts.delete(host);
    if (this.hosts.size === 0) this.abortToIdle();
  }

  get loadState(): ListingLoadState {
    return this._loadState;
  }

  get criteria(): ListingFilterOptions {
    return { ...this._criteria };
  }

  get allListings(): readonly Listing[] {
    return this._loadState.kind === 'ready' ? this._loadState.listings : [];
  }

  get visibleListings(): readonly Listing[] {
    return filterListings(this.allListings, this._criteria, LISTING_FILTER_CONFIG);
  }

  get locationGroups(): readonly ListingLocationGroup[] {
    return getListingLocationGroups(this.allListings);
  }

  get priceBounds(): { min: number; max: number } | null {
    return priceBounds(this.allListings);
  }

  get visibleCount(): number {
    return this.visibleListings.length;
  }

  get hasFeed(): boolean {
    return this.feed !== undefined;
  }

  get currentFeed(): ListingFeed | undefined {
    return this.feed;
  }

  setFeed(feed: ListingFeed | undefined): void {
    if (feed === this.feed) return;
    this.requestController?.abort();
    this.requestController = undefined;
    this._loadState = { kind: 'idle' };
    this.feed = feed;
    this.notify();
    if (feed) void this.load();
  }

  setFilters(options: ListingFilterOptions): void {
    this._criteria = { ...options };
    this.notify();
  }

  clearFilters(): void {
    this._criteria = {};
    this.notify();
  }

  async load(): Promise<void> {
    if (!this.feed) return;
    this.requestController?.abort();
    const requestController = new AbortController();
    this.requestController = requestController;
    this._loadState = { kind: 'loading' };
    this.notify();
    try {
      const listings = await this.feed.getListings(requestController.signal);
      if (requestController.signal.aborted || this.requestController !== requestController) return;
      this._loadState = listings.length > 0 ? { kind: 'ready', listings } : { kind: 'empty' };
    } catch (error) {
      if (requestController.signal.aborted || this.requestController !== requestController) return;
      this._loadState = {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to load listings.',
      };
    }
    this.notify();
  }

  retry(): Promise<void> {
    return this.load();
  }

  hostDisconnected(host: ReactiveControllerHost): void {
    this.hosts.delete(host);
    if (this.hosts.size === 0) this.abortToIdle();
  }

  private abortToIdle(): void {
    this.requestController?.abort();
    this.requestController = undefined;
    if (this._loadState.kind === 'loading') this._loadState = { kind: 'idle' };
  }
}

const storeByDocument = new WeakMap<Document, ListingStore>();

export function getListingStore(doc: Document): ListingStore {
  let store = storeByDocument.get(doc);
  if (!store) {
    store = new ListingStore();
    storeByDocument.set(doc, store);
  }
  return store;
}

export function clearListingStore(doc: Document): void {
  storeByDocument.delete(doc);
}
