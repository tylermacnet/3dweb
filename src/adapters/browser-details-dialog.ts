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

function supportsPopover(): boolean {
  return (
    typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'
  );
}

export class BrowserDetailsDialog implements DetailsDialog {
  private panel: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private titleEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private shown = false;

  private readonly detailsBaseUrl: string;

  constructor(detailsBaseUrl = DETAILS_BASE_URL) {
    this.detailsBaseUrl = detailsBaseUrl;
  }

  open(listing: Listing, invoker?: HTMLElement): boolean {
    if (!globalThis.document || !globalThis.window) return false;
    if (!supportsPopover()) return false;

    this.mount();

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

    this.show(invoker);
    return true;
  }

  close(): void {
    if (!this.panel || !this.shown) return;
    this.shown = false;
    this.panel.hidePopover();
  }

  private show(invoker: HTMLElement | undefined): void {
    if (!this.panel || this.shown) return;
    this.shown = true;
    this.panel.showPopover(invoker === undefined ? undefined : { source: invoker });
  }

  private mount(): void {
    if (!globalThis.document || this.panel) return;

    const panel = document.createElement('div');
    panel.className = 'sc-property-dialog';
    panel.setAttribute('popover', 'auto');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'sc-dialog-title');
    // Native popover semantics: auto type gives the top-layer backdrop, Esc
    // and light-dismiss cross-browser, and (via showPopover({ source })) focus
    // return to the triggering element. No manual focus, trap, or dismiss code.
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
    closeButton.autofocus = true;
    closeButton.append(createCloseIcon(document));
    const iframe = document.createElement('iframe');
    iframe.className = 'sc-dialog-iframe';
    iframe.allowFullscreen = true;
    iframe.title = 'Property listing detail view';

    header.append(title, closeButton);
    layout.append(header, iframe);
    panel.append(layout);
    this.titleEl = title;
    this.iframe = iframe;
    this.closeBtn = closeButton;
    this.panel = panel;

    this.bindEvents();
    ensureDialogStyles(document);
    document.body.appendChild(panel);
  }

  private bindEvents(): void {
    if (!this.panel) return;

    // The toggle event is the single source of truth for open/closed state,
    // covering Esc, light-dismiss, and programmatic show/hide. On close the
    // cross-origin iframe is discarded so its page does not keep running.
    this.panel.addEventListener('toggle', (event: Event) => {
      const state = (event as ToggleEvent).newState;
      if (state === 'closed') {
        this.shown = false;
        if (this.iframe) this.iframe.src = 'about:blank';
      }
    });

    this.closeBtn?.addEventListener('click', () => this.close());
  }
}
