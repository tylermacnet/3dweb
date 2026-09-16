import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { filterAndSortListings, type ListingFilterOptions } from '../domain/listing-filter.js';
import type { Listing } from '../domain/listing.js';
import { LISTING_FILTER_CONFIG } from '../config/listing-filters.js';
import type { DetailsDialog } from '../ports/details-dialog.js';
import type { ListingFeed } from '../ports/listing-feed.js';

export type ListingViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export class ListingController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private feed: ListingFeed | undefined;
  private detailsDialog: DetailsDialog | undefined;
  private requestController: AbortController | undefined;
  private listings: readonly Listing[] = [];
  options: ListingFilterOptions = {};

  state: ListingViewState = 'idle';
  errorMessage = '';

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  configure(feed: ListingFeed | undefined, detailsDialog: DetailsDialog | undefined): void {
    if (feed !== this.feed) {
      this.requestController?.abort();
      this.requestController = undefined;
      this.listings = [];
      this.state = 'idle';
      this.errorMessage = '';
    }
    this.feed = feed;
    this.detailsDialog = detailsDialog;
  }

  hostConnected(): void {
    if (this.feed) void this.loadListings();
  }

  hostDisconnected(): void {
    this.requestController?.abort();
  }

  get visibleListings(): readonly Listing[] {
    return filterAndSortListings(this.listings, this.options, LISTING_FILTER_CONFIG);
  }

  setOptions(options: ListingFilterOptions): void {
    this.options = options;
    this.host.requestUpdate();
  }

  async loadListings(): Promise<void> {
    if (!this.feed) {
      this.state = 'error';
      this.errorMessage = 'The listing feed adapter has not been configured.';
      this.host.requestUpdate();
      return;
    }

    this.requestController?.abort();
    const requestController = new AbortController();
    this.requestController = requestController;
    this.state = 'loading';
    this.errorMessage = '';
    this.host.requestUpdate();

    try {
      const listings = await this.feed.getListings(requestController.signal);
      if (requestController.signal.aborted || this.requestController !== requestController) return;
      this.listings = listings;
      this.state = listings.length > 0 ? 'ready' : 'empty';
    } catch (error) {
      if (requestController.signal.aborted) return;
      this.state = 'error';
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load listings.';
    }
    this.host.requestUpdate();
  }

  retry(): Promise<void> {
    return this.loadListings();
  }

  openDetails(listing: Listing): void {
    this.detailsDialog?.open(listing);
  }
}
