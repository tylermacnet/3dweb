import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Listing } from '../domain/listing.js';
import type { ListingFeed } from '../ports/listing-feed.js';

export type ListingLoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly listings: readonly Listing[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string };

export class ListingFeedLoader implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private feed: ListingFeed | undefined;
  private requestController: AbortController | undefined;
  private _loadState: ListingLoadState = { kind: 'idle' };

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  get loadState(): ListingLoadState {
    return this._loadState;
  }

  setFeed(feed: ListingFeed | undefined): void {
    if (feed === this.feed) return;
    this.requestController?.abort();
    this.requestController = undefined;
    this._loadState = { kind: 'idle' };
    this.feed = feed;
    this.host.requestUpdate();
  }

  hostDisconnected(): void {
    this.requestController?.abort();
  }

  async load(): Promise<void> {
    if (!this.feed) return;

    this.requestController?.abort();
    const requestController = new AbortController();
    this.requestController = requestController;
    this._loadState = { kind: 'loading' };
    this.host.requestUpdate();

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
    this.host.requestUpdate();
  }

  retry(): Promise<void> {
    return this.load();
  }
}
