import { LitElement, html, unsafeCSS } from 'lit';
import type { DetailsDialog } from '../ports/details-dialog.js';
import type { Listing } from '../domain/listing.js';
import type { ListingFeed } from '../ports/listing-feed.js';
import theme from '../styles/listing-theme.css';
import styles from './phase-five-harness.css';

type HarnessState = 'idle' | 'loading' | 'ready' | 'error';

export class PhaseFiveHarness extends LitElement {
  static properties = {
    feed: { attribute: false },
    detailsDialog: { attribute: false },
    listings: { state: true },
    state: { state: true },
    errorMessage: { state: true },
  };

  static styles = unsafeCSS(`${theme}\n${styles}`);

  feed: ListingFeed | undefined;
  detailsDialog: DetailsDialog | undefined;
  private listings: readonly Listing[] = [];
  private state: HarnessState = 'idle';
  private errorMessage = '';
  private requestController: AbortController | undefined;

  disconnectedCallback(): void {
    this.requestController?.abort();
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    void this.loadListings();
  }

  private async loadListings(): Promise<void> {
    if (!this.feed) {
      this.state = 'error';
      this.errorMessage = 'The listing feed adapter has not been wired.';
      return;
    }

    this.requestController?.abort();
    this.requestController = new AbortController();
    this.state = 'loading';
    this.errorMessage = '';

    try {
      this.listings = await this.feed.getListings(this.requestController.signal);
      this.state = 'ready';
    } catch (error) {
      if (this.requestController.signal.aborted) return;
      this.state = 'error';
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load listings.';
    }
  }

  private openDetails(listing: Listing): void {
    this.detailsDialog?.open(listing);
  }

  render() {
    return html`
      <section class="harness" aria-labelledby="harness-title">
        <div class="harness-header">
          <div>
            <p class="eyebrow">Adapter harness</p>
            <h2 id="harness-title">Live listing feed</h2>
            <p class="description">
              This demo exercises the HTTP feed adapter, XML parser, and browser details dialog.
            </p>
          </div>
          <button type="button" @click=${this.loadListings} ?disabled=${this.state === 'loading'}>
            ${this.state === 'loading' ? 'Loading…' : 'Reload listings'}
          </button>
        </div>

        ${this.renderStatus()}
        ${
          this.state === 'ready'
            ? html`
                <ol class="listing-grid" aria-label="Live property listings">
                  ${this.listings.map(
                    (listing) => html`
                      <li>
                        <article class="listing-card">
                          ${
                            listing.primaryImage
                              ? html`<img
                                  class="listing-image"
                                  src=${listing.primaryImage}
                                  alt=${this.addressLabel(listing)}
                                  loading="lazy"
                                />`
                              : html`<div
                                  class="listing-image placeholder"
                                  aria-hidden="true"
                                ></div>`
                          }
                          <p class="eyebrow">Listing ${listing.id}</p>
                          <h3>${listing.address.line1 || 'Address unavailable'}</h3>
                          ${
                            listing.address.line2
                              ? html`<p class="address-line">${listing.address.line2}</p>`
                              : ''
                          }
                          <p class="location">
                            ${[listing.address.city, listing.address.postalCode]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                          <p class="meta">
                            ${this.bedroomLabel(listing)} · ${this.rentLabel(listing)}
                          </p>
                          ${listing.hook ? html`<p class="hook">${listing.hook}</p>` : ''}
                          <button type="button" @click=${() => this.openDetails(listing)}>
                            View details
                          </button>
                        </article>
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
    if (this.state === 'loading') {
      return html`<p class="status" role="status">Loading listings from the feed…</p>`;
    }
    if (this.state === 'error') {
      return html`<p class="status error" role="alert">${this.errorMessage}</p>`;
    }
    if (this.state === 'ready' && this.listings.length === 0) {
      return html`<p class="status" role="status">No listings were returned by the feed.</p>`;
    }
    if (this.state === 'ready') {
      return html`<p class="status" role="status">${this.listings.length} listings loaded.</p>`;
    }
    return '';
  }

  private addressLabel(listing: Listing): string {
    return [listing.address.line1, listing.address.line2].filter(Boolean).join(' ');
  }

  private bedroomLabel(listing: Listing): string {
    return listing.bedroomCount === 0
      ? 'Bachelor'
      : `${listing.bedroomCount} bedroom${listing.bedroomCount === 1 ? '' : 's'}`;
  }

  private rentLabel(listing: Listing): string {
    return listing.rent === null ? 'Call for price' : `$${listing.rent.toLocaleString()} / month`;
  }
}

customElements.define('phase-five-harness', PhaseFiveHarness);
