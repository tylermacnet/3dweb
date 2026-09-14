import { LitElement, html, unsafeCSS } from 'lit';
import theme from '../styles/listing-theme.css';
import styles from './migration-progress.css';

interface MigrationPhase {
  name: string;
  status: 'complete' | 'current' | 'planned';
}

const PHASES: readonly MigrationPhase[] = [
  { name: 'Domain types and regions', status: 'complete' },
  { name: 'Address and location resolution', status: 'complete' },
  { name: 'Listing filtering and sorting', status: 'complete' },
  { name: 'Feed ports and XML parser', status: 'current' },
  { name: 'HTTP feed and modal adapters', status: 'planned' },
  { name: 'Listing controller', status: 'planned' },
  { name: 'Presentation components', status: 'planned' },
  { name: 'Container and dependency wiring', status: 'planned' },
  { name: 'Host page parity', status: 'planned' },
];

export class MigrationProgress extends LitElement {
  static styles = unsafeCSS(`${theme}\n${styles}`);

  render() {
    return html`
      <section class="progress-panel" aria-labelledby="migration-progress-title">
        <p class="eyebrow">Migration in progress</p>
        <h1 id="migration-progress-title">Property listings web component</h1>
        <p class="progress-summary">
          Phase 4 is complete. The page below exposes the current component work while the feed
          integration is built.
        </p>
        <ol class="progress-list">
          ${PHASES.map(
            (phase, index) => html`
              <li class="progress-item ${phase.status}">
                <span class="progress-marker" aria-hidden="true">${index + 1}</span>
                <span>${phase.name}</span>
                <strong>${phase.status}</strong>
              </li>
            `,
          )}
        </ol>
      </section>
    `;
  }
}

customElements.define('migration-progress', MigrationProgress);
