import { LitElement, html, unsafeCSS } from 'lit';
import theme from '../styles/listing-theme.css';
import styles from './property-listings.css';
import './listing-filters.js';

export class PropertyListings extends LitElement {
  static styles = unsafeCSS(`${theme}\n${styles}`);

  render() {
    return html`
      <section class="listing-page" aria-labelledby="listings-title">
        <listing-filters></listing-filters>

        <p class="results-status" role="status">Showing <strong>1</strong> available listing</p>

        <ol class="listing-grid" aria-label="Property listings">
          <li>
            <listing-card
              title="Available property"
              location="Saint John, NB"
              price="$1,500/month"
            ></listing-card>
          </li>
        </ol>
      </section>
    `;
  }
}

customElements.define('property-listings', PropertyListings);
