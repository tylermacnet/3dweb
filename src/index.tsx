import { LitElement, html, unsafeCSS } from 'lit';
import theme from './styles/listing-theme.css';
import styles from './styles.css';
import './components/property-listings.js';
import './components/migration-progress.js';
import { BrowserDetailsDialog } from './adapters/browser-details-dialog.js';
import { ManageBuildingFeed } from './adapters/managebuilding-feed.js';
import { XmlListingParser } from './adapters/xml-listing-parser.js';
import { NEW_BRUNSWICK_REGIONS } from './config/regions.js';
import { LocationResolver } from './domain/location-resolver.js';
import { PhaseFiveHarness } from './components/phase-five-harness.js';

export class ListingCard extends LitElement {
  static properties = {
    title: { type: String },
    location: { type: String },
    price: { type: String },
    image: { type: String },
  };

  static styles = unsafeCSS(`${theme}\n${styles}`);

  title = '';
  location = '';
  price = '';
  image = '';

  render() {
    return html`
      <article class="card">
        ${
          this.image
            ? html`<img class="listing-image" src=${this.image} alt=${this.title} loading="lazy" />`
            : html`<div
                class="listing-image listing-image-placeholder"
                role="img"
                aria-label="No image available"
              ></div>`
        }
        <p class="eyebrow">Property listing</p>
        <h1>${this.title}</h1>
        <p class="location">${this.location}</p>
        <p class="price">${this.price}</p>
        <button type="button">View details</button>
      </article>
    `;
  }
}

customElements.define('listing-card', ListingCard);

const harness = document.querySelector<PhaseFiveHarness>('phase-five-harness');
if (harness) {
  const locationResolver = new LocationResolver(NEW_BRUNSWICK_REGIONS);
  harness.feed = new ManageBuildingFeed(new XmlListingParser(locationResolver));
  harness.detailsDialog = new BrowserDetailsDialog();
}
