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

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
    return;
  }
  callback();
}

export class BrowserDetailsDialog implements DetailsDialog {
  private panel: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private skeleton: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private shown = false;
  private currentUrl: string | null = null;
  private resetTimer: number | undefined;

  private readonly detailsBaseUrl: string;
  private readonly resetDelayMs: number;

  constructor(detailsBaseUrl = DETAILS_BASE_URL, resetDelayMs = 5 * 60 * 1000) {
    this.detailsBaseUrl = detailsBaseUrl;
    this.resetDelayMs = resetDelayMs;
  }

  /**
   * Mounts the overlay, adopts styles, and warms the details connection off
   * the critical path. Safe to call repeatedly; `open()` works without it.
   */
  warm(): void {
    if (!globalThis.document || !globalThis.window) return;
    if (!supportsPopover()) return;
    this.mount();
    this.preconnect();
  }

  open(listing: Listing, invoker?: HTMLElement): boolean {
    if (!globalThis.document || !globalThis.window) return false;
    if (!supportsPopover()) return false;

    this.cancelReset();
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

    if (this.currentUrl === detailsUrl) {
      // Same document is already live: reshow it with no navigation.
      this.show(invoker);
      return true;
    }

    // New document: show the shell in this frame so the click is answered
    // instantly, then start the cross-origin navigation on the next frame
    // behind a skeleton.
    this.currentUrl = detailsUrl;
    this.showLoading();
    this.show(invoker);
    nextFrame(() => {
      if (this.currentUrl !== detailsUrl || !this.iframe) return;
      this.iframe.src = detailsUrl;
    });
    return true;
  }

  close(): void {
    if (!this.panel || !this.shown) return;
    this.shown = false;
    this.panel.hidePopover();
    // Keep the live document for fast reopen; discard it only after it has
    // sat unused long enough to be stale.
    this.scheduleReset();
  }

  private show(invoker: HTMLElement | undefined): void {
    if (!this.panel || this.shown) return;
    this.shown = true;
    this.panel.showPopover(invoker === undefined ? undefined : { source: invoker });
  }

  private showLoading(): void {
    if (this.panel) this.panel.setAttribute('aria-busy', 'true');
    if (this.skeleton) this.skeleton.hidden = false;
    if (this.iframe) {
      this.iframe.hidden = true;
      this.iframe.title = 'Loading property listing details';
    }
  }

  private hideLoading(): void {
    if (this.panel) this.panel.removeAttribute('aria-busy');
    if (this.skeleton) this.skeleton.hidden = true;
    if (this.iframe) this.iframe.hidden = false;
  }

  private scheduleReset(): void {
    this.cancelReset();
    this.resetTimer = globalThis.setTimeout(() => {
      this.resetTimer = undefined;
      if (this.shown || this.currentUrl === null) return;
      this.currentUrl = null;
      if (this.iframe) this.iframe.src = 'about:blank';
    }, this.resetDelayMs);
  }

  private cancelReset(): void {
    if (this.resetTimer !== undefined) {
      globalThis.clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  private preconnect(): void {
    let origin: string;
    try {
      origin = new URL(this.detailsBaseUrl).origin;
    } catch {
      return;
    }
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
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
    const skeleton = document.createElement('div');
    skeleton.className = 'sc-dialog-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    for (const width of ['70%', '40%', '90%']) {
      const line = document.createElement('div');
      line.className = 'skeleton-line';
      line.style.width = width;
      skeleton.append(line);
    }
    const iframe = document.createElement('iframe');
    iframe.className = 'sc-dialog-iframe';
    iframe.allowFullscreen = true;
    iframe.title = 'Property listing detail view';
    iframe.setAttribute('fetchpriority', 'high');
    iframe.hidden = true;

    header.append(title, closeButton);
    layout.append(header, skeleton, iframe);
    panel.append(layout);
    this.titleEl = title;
    this.skeleton = skeleton;
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
    // covering Esc, light-dismiss, and programmatic show/hide.
    this.panel.addEventListener('toggle', (event: Event) => {
      const state = (event as ToggleEvent).newState;
      if (state === 'closed') this.shown = false;
    });

    // The skeleton covers the shell until the live document paints. The
    // about:blank reset navigation also fires load, so only a real document
    // completes loading.
    this.iframe?.addEventListener('load', () => {
      if (!this.currentUrl || this.iframe?.getAttribute('src') === 'about:blank') return;
      if (this.titleEl && this.iframe) {
        this.iframe.title = `Details for ${this.titleEl.textContent ?? 'this listing'}`;
      }
      this.hideLoading();
    });

    this.closeBtn?.addEventListener('click', () => this.close());
  }
}
