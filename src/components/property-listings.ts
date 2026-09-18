import { LitElement, html } from 'lit';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { DetailsDialog } from '../ports/details-dialog.js';
import type { Listing } from '../domain/listing.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';
import { ListingFeedLoader, type ListingLoadState } from '../application/listing-feed-loader.js';
import { ListingFilterStore } from '../application/listing-filter-store.js';
import { APPLICATION_URL, hideNavVariantOf } from '../config/application.js';
import { getListingLocationGroups, LISTING_FILTER_CONFIG } from '../config/listing-filters.js';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './property-listings.css';
import './listing-filters.js';
import './listing-card.js';

const SKELETON_COUNT = 6;

export class PropertyListings extends LitElement {
  static properties = {
    feed: { attribute: false },
    detailsDialog: { attribute: false },
  };

  static styles = componentStyles(theme, styles);

  feed: ListingFeed | undefined;
  detailsDialog: DetailsDialog | undefined;

  private readonly loader = new ListingFeedLoader(this);
  private readonly filterStore = new ListingFilterStore(
    this,
    LISTING_FILTER_CONFIG,
    getListingLocationGroups,
  );

  connectedCallback(): void {
    super.connectedCallback();
    this.syncLoader();
  }

  private syncLoader(): void {
    this.loader.setFeed(this.feed);
    if (this.feed && this.loader.loadState.kind === 'idle') void this.loader.load();
  }

  private handleDetailsRequested(event: CustomEvent<Listing>): void {
    if (!this.detailsDialog) return;
    const handled = this.detailsDialog.open(
      event.detail,
      event.target instanceof HTMLElement ? event.target : undefined,
    );
    if (handled) event.preventDefault();
  }

  private readonly prefetched = new Set<string>();

  /**
   * Hover/focus intent prefetch: warms the exact iframe URL (the `hidenav`
   * variant, a different cache key from the anchor href) before the click.
   * Deduped, skipped on Save-Data, and harmless where prefetch is unsupported
   * (the link element is simply ignored). Touch users never reach this path:
   * coarse pointers navigate to the full details page instead.
   */
  private handleGridIntent(event: Event): void {
    if (typeof document === 'undefined') return;
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    const variant = anchor?.getAttribute('href')
      ? hideNavVariantOf(anchor.getAttribute('href') as string)
      : null;
    if (!variant || this.prefetched.has(variant)) return;
    const saveData =
      typeof navigator !== 'undefined' &&
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
        true;
    if (saveData) return;
    this.prefetched.add(variant);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.setAttribute('as', 'document');
    link.href = variant;
    document.head.appendChild(link);
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('feed')) this.syncLoader();
  }

  render() {
    const state = this.loader.loadState;
    const listings = state.kind === 'ready' ? state.listings : [];
    const visibleListings = this.filterStore.visibleListings(listings);
    const locationGroups = this.filterStore.locationGroups(listings);
    return html`
      <section class="listing-page" aria-label="Property listings">
        <listing-filters
          .options=${this.filterStore.options}
          .locationGroups=${locationGroups}
          @listing-filters-changed=${(event: CustomEvent<ListingFilterOptions>) =>
            this.filterStore.setOptions(event.detail)}
        ></listing-filters>

        ${this.renderStatus(state, visibleListings.length)}
        ${
          state.kind === 'ready'
            ? html`
                <ol
                  class="listing-grid"
                  aria-label="Property listings results"
                  @pointerover=${this.handleGridIntent}
                  @focusin=${this.handleGridIntent}
                >
                  ${visibleListings.map(
                    (listing) => html`
                      <li>
                        <listing-card
                          .listing=${listing}
                          @listing-details-requested=${this.handleDetailsRequested}
                        ></listing-card>
                      </li>
                    `,
                  )}
                </ol>
              `
            : ''
        }
      </section>
    `;
  }

  private renderStatus(state: ListingLoadState, visibleCount: number) {
    switch (state.kind) {
      case 'loading':
        return html`
          <p class="results-status" role="status">
            <span class="visually-hidden">Loading listings…</span>
          </p>
          <ol class="listing-grid" aria-label="Property listings results" aria-busy="true">
            ${Array.from(
              { length: SKELETON_COUNT },
              () => html`
                <li>
                  <div class="skeleton-card" aria-hidden="true">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-content">
                      <div class="skeleton-line" style="width: 70%;"></div>
                      <div class="skeleton-line" style="width: 40%;"></div>
                      <div class="skeleton-line" style="width: 90%;"></div>
                    </div>
                  </div>
                </li>
              `,
            )}
          </ol>
        `;
      case 'error':
        return html`
          <div class="results-status" role="alert">
            <p>${state.message}</p>
            <button type="button" @click=${() => void this.loader.retry()}>Try again</button>
          </div>
        `;
      case 'ready':
        return html`
          <p class="results-status" role="status">
            Showing
            <strong>${visibleCount}</strong> available listing${visibleCount === 1 ? '' : 's'}
          </p>
        `;
      case 'empty':
        return html`
          <div class="empty-state" role="status">
            <p>No available listings match your selected criteria right now.</p>
            <div class="empty-actions">
              <button type="button" @click=${() => this.filterStore.setOptions({})}>
                Clear filters
              </button>
              <a href=${APPLICATION_URL} target="_blank" rel="noopener noreferrer" class="apply-cta"
                >Apply Online Now &rarr;</a
              >
            </div>
          </div>
        `;
      default:
        return '';
    }
  }
}

customElements.define('property-listings', PropertyListings);
