import { LitElement, html, unsafeCSS } from 'lit';
import type { Listing } from '../domain/listing.js';
import theme from '../styles/listing-theme.css';
import baseStyles from '../styles.css';
import styles from './property-listings.css';

export class ListingCard extends LitElement {
  static properties = {
    listing: { attribute: false },
  };

  static styles = unsafeCSS(`${theme}\n${baseStyles}\n${styles}`);

  listing: Listing | undefined;

  render() {
    const listing = this.listing;
    if (!listing) return html``;

    const title = listing.address.line1 || 'Address unavailable';
    const location = [listing.address.city, listing.address.postalCode].filter(Boolean).join(', ');
    const price =
      listing.rent === null ? 'Call for price' : `$${listing.rent.toLocaleString()}/month`;

    return html`
      <article class="card">
        ${
          listing.primaryImage
            ? html`<img
                class="listing-image"
                src=${listing.primaryImage}
                alt=${title}
                loading="lazy"
              />`
            : html`<div
                class="listing-image listing-image-placeholder"
                role="img"
                aria-label="No image available"
              ></div>`
        }
        <p class="eyebrow">Property listing</p>
        <h2>${title}</h2>
        ${listing.address.line2 ? html`<p>${listing.address.line2}</p>` : ''}
        <p class="location">${location}</p>
        <p class="price">${price}</p>
        <button type="button" @click=${this.handleDetailsClick}>View details</button>
      </article>
    `;
  }

  private handleDetailsClick(): void {
    if (!this.listing) return;
    this.dispatchEvent(
      new CustomEvent<Listing>('listing-details-requested', {
        bubbles: true,
        composed: true,
        detail: this.listing,
      }),
    );
  }
}

customElements.define('listing-card', ListingCard);
