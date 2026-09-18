import { LitElement, html } from 'lit';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { DetailsDialog } from '../ports/details-dialog.js';
import type { Listing } from '../domain/listing.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';
import { ListingController } from '../application/listing-controller.js';
import { APPLICATION_URL } from '../config/application.js';
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
  private readonly controller = new ListingController(this);

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('feed') || changedProperties.has('detailsDialog')) {
      this.controller.configure(this.feed, this.detailsDialog);
      if (this.feed && this.controller.state === 'idle') void this.controller.loadListings();
    }
  }

  render() {
    return html`
      <section class="listing-page" aria-label="Property listings">
        <listing-filters
          .options=${this.controller.options}
          .locationGroups=${this.controller.locationGroups}
          @listing-filters-changed=${(event: CustomEvent<ListingFilterOptions>) =>
            this.controller.setOptions(event.detail)}
        ></listing-filters>

        ${this.renderStatus()}
        ${
          this.controller.state === 'ready'
            ? html`
                <ol class="listing-grid" aria-label="Property listings results">
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
            <p>${this.controller.errorMessage}</p>
            <button type="button" @click=${() => void this.controller.retry()}>Try again</button>
          </div>
        `;
      case 'ready':
        return html`<p class="results-status" role="status">
          Showing <strong>${this.controller.visibleListings.length}</strong> available
          listing${this.controller.visibleListings.length === 1 ? '' : 's'}
        </p>`;
      case 'empty':
        return html`
          <div class="empty-state" role="status">
            <p>No available listings match your selected criteria right now.</p>
            <div class="empty-actions">
              <button type="button" @click=${() => this.controller.setOptions({})}>
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
