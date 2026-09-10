import { LitElement, html, unsafeCSS } from 'lit';
import styles from './styles.css';

export class ListingCard extends LitElement {
  static properties = {
    title: { type: String },
    location: { type: String },
    price: { type: String },
  };

  static styles = unsafeCSS(styles);

  title = '';
  location = '';
  price = '';

  render() {
    return html`
      <article class="card">
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
