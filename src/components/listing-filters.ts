import { LitElement, html, unsafeCSS } from 'lit';
import theme from '../styles/listing-theme.css';
import styles from './listing-filters.css';
import { BEDROOM_FILTER_OPTIONS, SORT_OPTIONS } from '../config/listing-filters.js';
import type { ListingFilterOptions } from '../domain/listing-filter.js';

export class ListingFilters extends LitElement {
  static properties = {
    options: { attribute: false },
  };

  static styles = unsafeCSS(`${theme}\n${styles}`);

  options: ListingFilterOptions = {};

  render() {
    return html`
      <section class="filters-panel" role="search" aria-label="Property filter options">
        <fieldset>
          <legend>Filter available property listings</legend>
          <label>
            Bedrooms
            <select
              aria-label="Bedrooms"
              .value=${this.options.bedroomRule ?? 'all'}
              @change=${this.handleChange}
            >
              ${BEDROOM_FILTER_OPTIONS.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
            </select>
          </label>
          <label>
            Sort By
            <select
              aria-label="Sort By"
              .value=${this.options.sort ?? 'default'}
              @change=${this.handleChange}
            >
              ${SORT_OPTIONS.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
            </select>
          </label>
          <div class="price-group">
            <label for="max-rent">Max Rent</label>
            <output id="max-rent-value" for="max-rent">
              Up to ${this.options.maxRent ?? 5000} / mo
            </output>
            <input
              id="max-rent"
              type="range"
              min="0"
              max="5000"
              step="100"
              .value=${String(this.options.maxRent ?? 5000)}
              @input=${this.handleChange}
            />
          </div>
          <button type="button" @click=${this.reset}>Reset Filters</button>
        </fieldset>
      </section>
    `;
  }

  private handleChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement)) return;

    const bedroomRule = this.selectValue('Bedrooms');
    const selectedSort = this.selectValue('Sort By');
    const sort = SORT_OPTIONS.find((option) => option.value === selectedSort)?.value;
    const nextOptions: ListingFilterOptions = {
      ...(bedroomRule && bedroomRule !== 'all' ? { bedroomRule } : {}),
      ...(sort && sort !== 'default' ? { sort } : {}),
      maxRent: Number(this.maxRentInput?.value ?? 5000),
    };

    this.dispatchOptions(nextOptions);
  }

  private reset(): void {
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

  private get maxRentInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('#max-rent');
  }

  private selectValue(label: string): string | undefined {
    return Array.from(this.renderRoot.querySelectorAll('select')).find(
      (select) => select.getAttribute('aria-label') === label,
    )?.value;
  }
}

customElements.define('listing-filters', ListingFilters);
