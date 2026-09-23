import { LitElement, html } from 'lit';
import theme from '../styles/listing-theme.css';
import { componentStyles } from '../styles/component-styles.js';
import styles from './listing-filters.css';
import { BEDROOM_FILTER_OPTIONS, type ListingLocationGroup } from '../config/listing-filters.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';

const DEFAULT_MAX_RENT = 5000;

export interface SplitLocationValue {
  regionId?: string;
  areaName?: string;
}

export function splitLocationValue(value: string): SplitLocationValue {
  const [regionId, areaName] = value.split('||');
  return {
    ...(regionId && regionId !== 'ALL' ? { regionId } : {}),
    ...(areaName && areaName !== 'ALL' ? { areaName } : {}),
  };
}

export function formatMaxRentLabel(maxRent: number): string {
  return `Up to $${maxRent.toLocaleString()} / mo`;
}

export class ListingFilters extends LitElement {
  static properties = {
    options: { attribute: false },
    locationGroups: { attribute: false },
    priceMin: { attribute: false },
    priceMax: { attribute: false },
  };

  static styles = componentStyles(theme, styles);

  options: ListingFilterOptions = {};
  locationGroups: readonly ListingLocationGroup[] = [];
  priceMin = 0;
  priceMax: number | undefined;

  private priceDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.priceDebounceTimer);
  }

  render() {
    const maxRent = this.options.maxRent ?? this.priceMax ?? DEFAULT_MAX_RENT;
    // `aria-controls` is omitted intentionally: filters and results live in
    // separate shadow roots and the wiring is via `listing-filters-changed`
    // (composed/bubbles) + `ListingFilterStore` — a cross-root `idref`
    // would be invalid and brittle. See `docs/ENHANCEMENTS.md` collapsed.
    return html`
      <section class="filters-panel" role="search" aria-label="Property filter options">
        <fieldset class="filter-fields">
          <legend class="filter-legend">Filter available property listings</legend>
          <div class="field">
            <label for="location-filter">Location</label>
            <select id="location-filter" .value=${this.locationValue} @change=${this.handleSelect}>
              ${this.allLocationsOptions.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
              ${this.regionGroups.map(
                (group) => html`
                  <optgroup label=${group.regionName}>
                    ${group.options.map(
                      (option) => html`<option value=${option.value}>${option.label}</option>`,
                    )}
                  </optgroup>
                `,
              )}
            </select>
          </div>
          <div class="field">
            <label for="bedroom-filter">Bedrooms</label>
            <select
              id="bedroom-filter"
              .value=${this.options.bedroomRule ?? 'all'}
              @change=${this.handleSelect}
            >
              ${BEDROOM_FILTER_OPTIONS.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
            </select>
          </div>
          <div class="field price-field">
            <label for="max-rent">Max Rent</label>
            <output id="max-rent-value" for="max-rent" aria-live="polite"
              >${formatMaxRentLabel(maxRent)}</output
            >
            <input
              id="max-rent"
              type="range"
              min=${String(this.priceMin)}
              max=${String(this.priceMax ?? DEFAULT_MAX_RENT)}
              step="100"
              .value=${String(maxRent)}
              aria-describedby="max-rent-value"
              @input=${this.handlePriceInput}
              @change=${this.handlePriceCommit}
            />
          </div>
          <div class="field reset-field">
            <button type="button" class="reset-btn" @click=${this.reset}>Reset Filters</button>
          </div>
        </fieldset>
      </section>
    `;
  }

  private handleSelect(): void {
    this.dispatchOptions(this.readControlValues());
  }

  private handlePriceInput(): void {
    const priceDisplay = this.renderRoot.querySelector<HTMLElement>('#max-rent-value');
    const priceInput = this.priceInput;
    if (priceDisplay && priceInput) {
      priceDisplay.textContent = formatMaxRentLabel(Number(priceInput.value));
    }
    clearTimeout(this.priceDebounceTimer);
    this.priceDebounceTimer = setTimeout(() => {
      this.dispatchOptions(this.readControlValues());
    }, 150);
  }

  private handlePriceCommit(): void {
    clearTimeout(this.priceDebounceTimer);
    this.dispatchOptions(this.readControlValues());
  }

  private reset(): void {
    clearTimeout(this.priceDebounceTimer);
    this.dispatchOptions({});
  }

  private dispatchOptions(options: ListingFilterOptions): void {
    this.options = options;
    this.dispatchEvent(
      new CustomEvent<ListingFilterOptions>('listing-filters-changed', {
        bubbles: true,
        composed: true,
        detail: options,
      }),
    );
  }

  private readControlValues(): ListingFilterOptions {
    const location =
      this.renderRoot.querySelector<HTMLSelectElement>('#location-filter')?.value ?? 'ALL';
    const bedroomRule =
      this.renderRoot.querySelector<HTMLSelectElement>('#bedroom-filter')?.value ?? 'all';
    return {
      ...splitLocationValue(location),
      ...(bedroomRule && bedroomRule !== 'all' ? { bedroomRule } : {}),
      maxRent: Number(this.priceInput?.value ?? DEFAULT_MAX_RENT),
    };
  }

  private get priceInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('#max-rent');
  }

  private get locationValue(): string {
    if (this.options.regionId && this.options.areaName) {
      return `${this.options.regionId}||${this.options.areaName}`;
    }
    if (this.options.regionId) return `${this.options.regionId}||ALL`;
    return 'ALL';
  }

  private get allLocationsOptions(): readonly { value: string; label: string }[] {
    return this.locationGroups.find((group) => group.regionId === 'ALL')?.options ?? [];
  }

  private get regionGroups(): readonly ListingLocationGroup[] {
    return this.locationGroups.filter((group) => group.regionId !== 'ALL');
  }
}

if (!customElements.get('listing-filters'))
  customElements.define('listing-filters', ListingFilters);
