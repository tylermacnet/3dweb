import { LitElement, html } from 'lit';
import { resolveDetailsIframeUrl } from '../config/application.js';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './listing-details.css';

export class ListingDetails extends LitElement {
  static properties = {
    listingId: { attribute: 'listing-id', type: String },
    src: { attribute: true, type: String },
    baseUrl: { attribute: 'base-url', type: String },
    title: { attribute: true, type: String },
  };

  static styles = componentStyles(theme, styles);

  listingId: string | undefined;
  src: string | undefined;
  baseUrl: string | undefined;

  render() {
    const resolved = resolveDetailsIframeUrl({
      ...(this.listingId !== undefined ? { listingId: this.listingId } : {}),
      ...(this.src !== undefined ? { src: this.src } : {}),
      ...(this.baseUrl !== undefined ? { baseUrl: this.baseUrl } : {}),
    });

    if (!resolved) {
      return html`
        <section class="details-error" role="status">
          <p>Property details are unavailable for this listing.</p>
        </section>
      `;
    }

    const heading = this.title?.trim() || 'Property Details';
    return html`
      <section class="details-iframe" aria-label="Property details">
        <h2 class="details-title">${heading}</h2>
        <iframe
          class="details-frame"
          src=${resolved}
          title=${heading}
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer"
        ></iframe>
      </section>
    `;
  }
}

customElements.define('listing-details', ListingDetails);
