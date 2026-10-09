import { LitElement, html } from 'lit';
import type { Listing } from '../domain/listing.js';
import { getListingDetailsUrl } from '../config/application.js';
import { cleanRegionName } from '../config/listing-filters.js';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './listing-card.css';

export const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg width="320" height="220" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="320" height="220" fill="%23edf2f7"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%234a5568"%3ENo Image Available%3C/text%3E%3C/svg%3E';

export interface ListingCardViewModel {
  line1: string;
  fullAddress: string;
  imgSrc: string;
  formattedRent: string;
  locationText: string;
  bedText: string;
  detailsUrl: string;
}

/**
 * Capability query vs viewport: `pointer: fine` is preferred over `768px`
 * — a touch laptop or iPad+keyboard should navigate vs popover by input
 * capability, not width. Historical `768px` breakpoint kept as reference only.
 * See `docs/ROADMAP.md`.
 */
export function shouldOpenDialog(): boolean {
  return globalThis.matchMedia?.('(pointer: fine)')?.matches ?? true;
}

export function describeListingCard(listing: Listing): ListingCardViewModel {
  const line1 = listing.address.line1 || 'Address unavailable';
  const fullAddress = `${listing.address.line1} ${listing.address.line2}`.trim();
  const cleanedRegion = cleanRegionName(listing.address.regionName);
  return {
    line1,
    fullAddress,
    imgSrc: listing.primaryImage || FALLBACK_IMAGE,
    formattedRent:
      listing.rent === null ? 'Call for Price' : `$${listing.rent.toLocaleString()} / mo`,
    locationText: [cleanedRegion, listing.address.areaName].filter(Boolean).join(' • '),
    bedText:
      listing.bedroomCount === 0
        ? 'Bachelor'
        : `${listing.bedroomCount} Bed${listing.bedroomCount !== 1 ? 's' : ''}`,
    detailsUrl: getListingDetailsUrl(listing),
  };
}

export class ListingCard extends LitElement {
  static properties = {
    listing: { attribute: false },
  };

  static styles = componentStyles(theme, styles);

  listing: Listing | undefined;

  render() {
    const listing = this.listing;
    if (!listing) return html``;

    const view = describeListingCard(listing);

    return html`
      <article class="property" data-id=${listing.id}>
        <header class="card-head">
          <img
            class="card-media"
            src=${view.imgSrc}
            alt=""
            loading="lazy"
            decoding="async"
            @error=${this.handleImageError}
          />
          <div class="card-header-titles">
            <h3 class="card-heading">
              <a
                class="title-link"
                href=${view.detailsUrl}
                aria-label=${`${view.fullAddress || view.line1} details`}
                title=${view.fullAddress || view.line1}
                @click=${this.handleDetailsClick}
              >
                <span class="address-line-1">${view.line1}</span>
                ${
                  listing.address.line2
                    ? html`<span class="address-line-2">${listing.address.line2}</span>`
                    : ''
                }
              </a>
            </h3>
          </div>
          ${
            view.locationText
              ? html`
                  <p class="location">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M8 0a5 5 0 0 0-5 5c0 3.5 5 11 5 11s5-7.5 5-11a5 5 0 0 0-5-5zm0 7.5A2.5 2.5 0 1 1 8 2.5a2.5 2.5 0 0 1 0 5z"
                      />
                    </svg>
                    <span>${view.locationText}</span>
                  </p>
                `
              : ''
          }
        </header>
        <div class="meta">
          <div class="badges">
            <span class="badge">${view.bedText}</span>
            ${
              listing.bathroomCount
                ? html`<span class="badge">${listing.bathroomCount} Bath</span>`
                : ''
            }
          </div>
          <span class="price">${view.formattedRent}</span>
        </div>
        ${listing.hook ? html`<p class="hook">${listing.hook}</p>` : ''}
        <footer class="card-foot">
          <span class="cta" aria-hidden="true">View Details &rarr;</span>
        </footer>
      </article>
    `;
  }

  private handleDetailsClick(event: MouseEvent): void {
    if (!this.listing) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!shouldOpenDialog()) return;
    // Ask any interested container (e.g. <property-listings>) to open details.
    // preventDefault on the custom event means a container took over; nothing
    // cancelling it here means no one can show details, so the anchor keeps its
    // default navigation as the progressive-enhancement fallback.
    const takenOver = !this.dispatchEvent(
      new CustomEvent<Listing>('listing-details-requested', {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: this.listing,
      }),
    );
    if (takenOver) event.preventDefault();
  }

  private handleImageError(event: Event): void {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.src === FALLBACK_IMAGE) return;
    img.src = FALLBACK_IMAGE;
  }
}

if (!customElements.get('listing-card')) customElements.define('listing-card', ListingCard);
