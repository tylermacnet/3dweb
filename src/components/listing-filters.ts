import { LitElement, html, unsafeCSS } from 'lit';
import theme from '../styles/listing-theme.css';
import styles from './listing-filters.css';
import { BEDROOM_FILTER_OPTIONS, SORT_OPTIONS } from '../config/listing-filters.js';

export class ListingFilters extends LitElement {
  static styles = unsafeCSS(`${theme}\n${styles}`);

  render() {
    return html`
      <section class="filters-panel" role="search" aria-label="Property filter options">
        <fieldset>
          <legend>Filter available property listings</legend>
          <label>
            Location
            <select aria-label="Location">
              <option value="ALL">All Locations</option>
            </select>
          </label>
          <label>
            Bedrooms
            <select aria-label="Bedrooms">
              ${BEDROOM_FILTER_OPTIONS.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
            </select>
          </label>
          <label>
            Sort By
            <select aria-label="Sort By">
              ${SORT_OPTIONS.map(
                (option) => html`<option value=${option.value}>${option.label}</option>`,
              )}
            </select>
          </label>
          <div class="price-group">
            <label for="max-rent">Max Rent</label>
            <output id="max-rent-value" for="max-rent">Up to $5,000 / mo</output>
            <input id="max-rent" type="range" min="0" max="5000" step="100" value="5000" />
          </div>
          <button type="button">Reset Filters</button>
        </fieldset>
      </section>
    `;
  }
}

customElements.define('listing-filters', ListingFilters);
