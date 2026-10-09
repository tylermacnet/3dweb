import { LitElement, html } from 'lit';
import type { Listing } from '../domain/listing.js';
import type { DetailsModal } from '../ports/details-modal.js';
import type { ListingFeed } from '../ports/listing-feed.js';
import { getListingStore } from '../application/listing-store.js';
import { APPLICATION_URL, hideNavVariantOf } from '../config/application.js';
import { cleanRegionName } from '../config/listing-filters.js';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './listing-grid.css';
import './listing-card.js';
import { describeListingCard, FALLBACK_IMAGE } from './listing-card.js';

const SKELETON_COUNT = 6;

// Shared per-document so multiple grids do not emit duplicate prefetch links.
const prefetchedByDocument = new WeakMap<Document, Set<string>>();

export type ListingGridView = 'card' | 'compact' | 'list';

function isListingGridView(value: string): value is ListingGridView {
  return value === 'card' || value === 'compact' || value === 'list';
}

export class ListingGrid extends LitElement {
  static properties = {
    view: {
      attribute: true,
      type: String,
      reflect: true,
      converter: {
        fromAttribute: (v: string | null): ListingGridView =>
          v !== null && isListingGridView(v) ? v : 'card',
        toAttribute: (v: unknown): string => String(v),
      },
    },
    feed: { attribute: false },
    detailsModal: { attribute: false },
  };

  static styles = componentStyles(theme, styles);

  view: ListingGridView = 'card';
  feed: ListingFeed | undefined;
  detailsModal: DetailsModal | undefined;

  private readonly prefetched = new Set<string>();

  connectedCallback(): void {
    super.connectedCallback();
    this.subscribeStore();
    this.syncFeed();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeStore();
  }

  private get store() {
    const doc = this.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
    if (!doc) throw new Error('Document unavailable for listing store');
    return getListingStore(doc);
  }

  private subscribeStore(): void {
    try {
      this.store.subscribe(this);
    } catch {
      // SSR guard
    }
  }

  private unsubscribeStore(): void {
    try {
      this.store.unsubscribe(this);
    } catch {
      // ignore
    }
  }

  private syncFeed(): void {
    if (!this.feed) return;
    try {
      this.store.setFeed(this.feed);
    } catch {
      // SSR guard
    }
  }

  willUpdate(changed: Map<string, unknown>): void {
    // Coerce JS-property sets (converter only covers attributes). Converges:
    // 'card' is valid so the re-update terminates.
    if (changed.has('view') && !isListingGridView(String(this.view))) this.view = 'card';
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('feed')) this.syncFeed();
  }

  private handleDetailsRequested(event: CustomEvent<Listing>): void {
    const modal = this.detailsModal;
    if (!modal) return;
    const handled = modal.open(
      event.detail,
      event.target instanceof HTMLElement ? event.target : undefined,
    );
    if (handled) event.preventDefault();
  }

  private handleGridIntent(event: Event): void {
    const doc = this.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
    if (!doc) return;
    // composedPath crosses listing-card shadow roots; closest() alone misses them.
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    let anchor: HTMLAnchorElement | null = null;
    for (const node of path) {
      if (node instanceof HTMLAnchorElement && node.hasAttribute('href')) {
        anchor = node;
        break;
      }
    }
    anchor ??= (event.target as Element | null)?.closest?.('a[href]') ?? null;
    const href = anchor?.getAttribute('href');
    const variant = href ? hideNavVariantOf(href) : null;
    if (!variant) return;
    let seen = prefetchedByDocument.get(doc);
    if (!seen) {
      seen = new Set<string>();
      prefetchedByDocument.set(doc, seen);
    }
    if (seen.has(variant) || this.prefetched.has(variant)) return;
    const saveData =
      typeof navigator !== 'undefined' &&
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
        true;
    if (saveData) return;
    seen.add(variant);
    this.prefetched.add(variant);
    const link = doc.createElement('link');
    link.rel = 'prefetch';
    link.href = variant;
    doc.head.appendChild(link);
  }

  private handleImageError(event: Event): void {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.src === FALLBACK_IMAGE) return;
    img.src = FALLBACK_IMAGE;
  }

  render() {
    let state: { kind: string; message?: string } = { kind: 'idle' };
    let visibleListings: readonly Listing[] = [];
    let visibleCount = 0;
    try {
      const store = this.store;
      state = store.loadState as unknown as { kind: string; message?: string };
      visibleListings = store.visibleListings;
      visibleCount = store.visibleCount;
    } catch {
      state = { kind: 'idle' };
    }

    return html`
      ${this.renderStatus(state as never, visibleCount)}
      ${
        state.kind === 'ready'
          ? html`
              <ol
                class="listing-grid"
                aria-label="Property listings results"
                @pointerover=${this.handleGridIntent}
                @focusin=${this.handleGridIntent}
              >
                ${visibleListings.map((listing) => html`<li>${this.renderItem(listing)}</li>`)}
              </ol>
            `
          : ''
      }
    `;
  }

  private renderItem(listing: Listing) {
    const view = this.view;
    if (view === 'compact') return this.renderCompact(listing);
    if (view === 'list') return this.renderList(listing);
    return html`
      <listing-card
        .listing=${listing}
        @listing-details-requested=${this.handleDetailsRequested}
      ></listing-card>
    `;
  }

  private renderCompact(listing: Listing) {
    const vm = describeListingCard(listing);
    const location = [cleanRegionName(listing.address.regionName), listing.address.areaName]
      .filter(Boolean)
      .join(' • ');
    return html`
      <article class="compact-row" data-id=${listing.id}>
        <img
          class="compact-thumb"
          src=${vm.imgSrc}
          alt=""
          loading="lazy"
          decoding="async"
          @error=${this.handleImageError}
        />
        <div class="compact-main">
          <a
            class="compact-title"
            href=${vm.detailsUrl}
            aria-label=${`${vm.fullAddress || vm.line1} details`}
            title=${vm.fullAddress || vm.line1}
            @click=${this.handleCompactClick}
            data-id=${listing.id}
          >
            ${vm.line1}
          </a>
          <div class="compact-meta">
            <span class="badge">${vm.bedText}</span>
            ${listing.bathroomCount ? html`<span class="badge">${listing.bathroomCount} Bath</span>` : ''}
            ${location ? html`<span>${location}</span>` : ''}
          </div>
        </div>
        <span class="compact-price">${vm.formattedRent}</span>
      </article>
    `;
  }

  private renderList(listing: Listing) {
    const vm = describeListingCard(listing);
    const location = [cleanRegionName(listing.address.regionName), listing.address.areaName]
      .filter(Boolean)
      .join(' • ');
    return html`
      <article class="list-row" data-id=${listing.id}>
        <img
          class="list-media"
          src=${vm.imgSrc}
          alt=""
          loading="lazy"
          decoding="async"
          @error=${this.handleImageError}
        />
        <div class="list-content">
          <h3 class="list-title">
            <a
              href=${vm.detailsUrl}
              aria-label=${`${vm.fullAddress || vm.line1} details`}
              title=${vm.fullAddress || vm.line1}
              @click=${this.handleCompactClick}
              data-id=${listing.id}
            >
              ${vm.line1}
              ${
                listing.address.line2
                  ? html`<span style="color:var(--grid-muted);font-weight:500"
                      >${listing.address.line2}</span
                    >`
                  : ''
              }
            </a>
          </h3>
          ${
            location
              ? html`
                  <p class="list-location">
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M8 0a5 5 0 0 0-5 5c0 3.5 5 11 5 11s5-7.5 5-11a5 5 0 0 0-5-5zm0 7.5A2.5 2.5 0 1 1 8 2.5a2.5 2.5 0 0 1 0 5z"
                      />
                    </svg>
                    <span>${location}</span>
                  </p>
                `
              : ''
          }
          <div class="list-meta">
            <span class="badge">${vm.bedText}</span>
            ${listing.bathroomCount ? html`<span class="badge">${listing.bathroomCount} Bath</span>` : ''}
            <span class="list-price">${vm.formattedRent}</span>
          </div>
          ${listing.hook ? html`<p class="list-hook">${listing.hook}</p>` : ''}
          <span class="list-cta" aria-hidden="true">View Details &rarr;</span>
        </div>
      </article>
    `;
  }

  private handleCompactClick = (event: MouseEvent): void => {
    const target = event.target as HTMLAnchorElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const listing = this.findListing(id);
    if (!listing) return;
    // Match listing-card behavior: pointer:fine gates modal, else fall through to navigation
    if (globalThis.matchMedia?.('(pointer: fine)')?.matches === false) return;
    const wasHandledByEvent = !this.dispatchEvent(
      new CustomEvent<Listing>('listing-details-requested', {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: listing,
      }),
    );
    // If an ancestor already handled the request, respect it but only prevent
    // navigation when the modal actually handles it. This avoids swallowing
    // navigation when detailsModal is missing (see bug repro).
    if (wasHandledByEvent) {
      // An external listener claimed handling; do not also try modal and do not
      // swallow navigation unless we have a modal to show (we don't here).
      return;
    }
    if (this.detailsModal) {
      const handled = this.detailsModal.open(
        listing,
        target instanceof HTMLElement ? target : undefined,
      );
      if (handled) event.preventDefault();
    }
  };

  private findListing(id: string): Listing | undefined {
    try {
      return (
        this.store.visibleListings.find((l) => l.id === id) ??
        this.store.allListings.find((l) => l.id === id)
      );
    } catch {
      return undefined;
    }
  }

  private renderStatus(state: { kind: string; message?: string }, visibleCount: number) {
    switch (state.kind) {
      case 'idle':
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
            <p>${(state as { message: string }).message}</p>
            <button
              type="button"
              @click=${() => {
                try {
                  void this.store.retry();
                } catch {}
              }}
            >
              Try again
            </button>
          </div>
        `;
      case 'ready':
        if (visibleCount === 0) {
          return html`
            <div class="empty-state" role="status">
              <p>No available listings match your selected criteria right now.</p>
              <div class="empty-actions">
                <button
                  type="button"
                  @click=${() => {
                    try {
                      this.store.clearFilters();
                    } catch {}
                  }}
                >
                  Clear filters
                </button>
                <a
                  href=${APPLICATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="apply-cta"
                  >Apply Online Now &rarr;</a
                >
              </div>
            </div>
          `;
        }
        return html`
          <p class="results-status" role="status">
            Showing <strong>${visibleCount}</strong> available
            listing${visibleCount === 1 ? '' : 's'}
          </p>
        `;
      case 'empty':
        return html`
          <div class="empty-state" role="status">
            <p>No listings available right now.</p>
            <div class="empty-actions">
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

if (!customElements.get('listing-grid')) customElements.define('listing-grid', ListingGrid);
