import { LitElement, html } from 'lit';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { DetailsModal } from '../ports/details-modal.js';
import { getListingStore } from '../application/listing-store.js';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './property-listings.css';
import './listing-filters.js';
import './listing-grid.js';

/**
 * Legacy composition: property-listings now composes the transparent singleton
 * primitives (listing-filters + listing-grid view="card") without owning
 * loader/filter state itself. This keeps existing embeds working while new
 * hosts can use <listing-filters> + <listing-grid view="card|compact|list">
 * directly and share the same browser-level lazy singleton per Document.
 */
export class PropertyListings extends LitElement {
  static properties = {
    feed: { attribute: false },
    detailsModal: { attribute: false },
  };

  static styles = componentStyles(theme, styles);

  feed: ListingFeed | undefined;
  detailsModal: DetailsModal | undefined;

  private get store() {
    const doc = this.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
    if (!doc) throw new Error('Document unavailable for listing store');
    return getListingStore(doc);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.syncFeed();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('feed')) this.syncFeed();
  }

  private syncFeed(): void {
    if (!this.feed) return;
    try {
      this.store.setFeed(this.feed);
    } catch {
      // SSR guard
    }
  }

  render() {
    return html`
      <section class="listing-page" aria-label="Property listings">
        <listing-filters></listing-filters>
        <listing-grid
          view="card"
          .feed=${this.feed}
          .detailsModal=${this.detailsModal}
        ></listing-grid>
      </section>
    `;
  }
}

if (!customElements.get('property-listings'))
  customElements.define('property-listings', PropertyListings);
