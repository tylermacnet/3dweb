import type { Listing } from '../domain/listing.js';
import type { DetailsDialog } from '../ports/details-dialog.js';
import {
  DETAILS_BASE_URL,
  formatDialogTitle,
  getListingDetailsUrl,
} from '../config/application.js';
import dialogCss from './browser-details-dialog.css';

const adoptedSheets = new WeakMap<Document, CSSStyleSheet>();

function createCloseIcon(doc: Document): SVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 3l10 10M13 3L3 13');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg as unknown as SVGElement;
}

function ensureDialogStyles(doc: Document): void {
  if (adoptedSheets.has(doc) || doc.querySelector('style[data-sc-dialog-styles]')) return;
  if (typeof CSSStyleSheet !== 'undefined' && Array.isArray(doc.adoptedStyleSheets)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(dialogCss);
    doc.adoptedStyleSheets.push(sheet);
    adoptedSheets.set(doc, sheet);
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute('data-sc-dialog-styles', '');
  style.textContent = dialogCss;
  doc.head.appendChild(style);
}

export class BrowserDetailsDialog implements DetailsDialog {
  private dialog: HTMLDialogElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private titleEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  private readonly detailsBaseUrl: string;

  constructor(detailsBaseUrl = DETAILS_BASE_URL) {
    this.detailsBaseUrl = detailsBaseUrl;
  }

  open(listing: Listing): void {
    if (!globalThis.document || !globalThis.window) return;

    this.mount();
    const activeElement = document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;

    const detailsUrl = getListingDetailsUrl(listing, {
      baseUrl: this.detailsBaseUrl,
      hideNav: true,
    });

    const titleText = formatDialogTitle(listing);
    if (this.titleEl) {
      this.titleEl.textContent = titleText;
      this.titleEl.setAttribute('title', titleText);
    }
    if (this.iframe) {
      this.iframe.src = detailsUrl;
      this.iframe.title = `Details for ${titleText}`;
    }
    if (this.dialog && !this.dialog.open) this.dialog.showModal();
    this.closeBtn?.focus();
  }

  close(): void {
    if (!this.dialog) return;

    if (this.dialog.open) this.dialog.close();
    if (this.iframe) this.iframe.src = 'about:blank';
    if (this.lastFocusedElement) this.lastFocusedElement.focus();
  }

  private mount(): void {
    if (!globalThis.document || this.dialog) return;

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'sc-property-dialog';
    this.dialog.setAttribute('aria-labelledby', 'sc-dialog-title');
    // Progressive enhancement: browsers with closedby="any" get native light
    // dismiss; the manual handlers below remain the fallback elsewhere.
    this.dialog.setAttribute('closedby', 'any');
    const layout = document.createElement('div');
    layout.className = 'sc-dialog-layout';
    const header = document.createElement('div');
    header.className = 'sc-dialog-header';
    const title = document.createElement('h3');
    title.className = 'sc-dialog-title';
    title.id = 'sc-dialog-title';
    title.textContent = 'Property Details';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'sc-dialog-close';
    closeButton.setAttribute('aria-label', 'Close dialog');
    closeButton.append(createCloseIcon(document));
    const iframe = document.createElement('iframe');
    iframe.className = 'sc-dialog-iframe';
    iframe.allowFullscreen = true;
    iframe.title = 'Property listing detail view';

    header.append(title, closeButton);
    layout.append(header, iframe);
    this.dialog.append(layout);
    this.titleEl = title;
    this.iframe = iframe;
    this.closeBtn = closeButton;

    this.bindEvents();
    ensureDialogStyles(document);
    document.body.appendChild(this.dialog);
  }

  private bindEvents(): void {
    if (!this.dialog) return;

    this.dialog.addEventListener('close', () => {
      if (this.iframe) this.iframe.src = 'about:blank';
      if (this.lastFocusedElement) this.lastFocusedElement.focus();
    });

    this.dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || !this.dialog) return;

      const focusables = this.dialog.querySelectorAll('button, iframe');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        if (last instanceof HTMLElement) last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        if (first instanceof HTMLElement) first.focus();
        event.preventDefault();
      }
    });

    this.closeBtn?.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });
  }
}
