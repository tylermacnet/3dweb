import { LitElement, html, unsafeCSS } from 'lit';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { DetailsDialog } from '../ports/details-dialog.js';
import type { Listing } from '../domain/listing.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';
import { ListingController } from '../application/listing-controller.js';
import theme from '../styles/listing-theme.css';
import styles from './property-listings.css';
import './listing-filters.js';
import './listing-card.js';

export class PropertyListings extends LitElement {
  static properties = {
    feed: { attribute: false },
    detailsDialog: { attribute: false },
  };

  static styles = unsafeCSS(`${theme}\n${styles}`);

  feed: ListingFeed | undefined;
  detailsDialog: DetailsDialog | undefined;
  private readonly controller = new ListingController(this);

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('feed') || changedProperties.has('detailsDialog')) {
      this.controller.configure(this.feed, this.detailsDialog);
      if (this.feed && this.controller.state === 'idle') void this.controller.loadListings();
    }
  }

  render() {
    return html`
      <section class="listing-page" aria-labelledby="listings-title">
        <listing-filters
          .options=${this.controller.options}
          @listing-filters-changed=${(event: CustomEvent<ListingFilterOptions>) =>
            this.controller.setOptions(event.detail)}
        ></listing-filters>

        ${this.renderStatus()}
        ${
          this.controller.state === 'ready'
            ? html`
                <ol class="listing-grid" aria-label="Property listings">
                  ${this.controller.visibleListings.map(
                    (listing) => html`
                      <li>
                        <listing-card
                          .listing=${listing}
                          @listing-details-requested=${(event: CustomEvent<Listing>) =>
                            this.controller.openDetails(event.detail)}
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

  private renderStatus() {
    switch (this.controller.state) {
      case 'loading':
        return html`<p class="results-status" role="status">Loading listings…</p>`;
      case 'error':
        return html`<p class="results-status" role="alert">${this.controller.errorMessage}</p>`;
      case 'ready':
        return html`<p class="results-status" role="status">
          Showing <strong>${this.controller.visibleListings.length}</strong> available listings
        </p>`;
      default:
        return '';
    }
  }
}

customElements.define('property-listings', PropertyListings);
