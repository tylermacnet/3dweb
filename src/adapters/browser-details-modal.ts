import type { Listing } from '../domain/listing.js';
import type { DetailsModal } from '../ports/details-modal.js';
import { DETAILS_BASE_URL, formatModalTitle, getListingDetailsUrl } from '../config/application.js';
import modalCss from './browser-details-modal.css';

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

function ensureModalStyles(doc: Document): void {
  if (adoptedSheets.has(doc) || doc.querySelector('style[data-sc-modal-styles]')) return;
  if (typeof CSSStyleSheet !== 'undefined' && Array.isArray(doc.adoptedStyleSheets)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(modalCss);
    doc.adoptedStyleSheets.push(sheet);
    adoptedSheets.set(doc, sheet);
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute('data-sc-modal-styles', '');
  style.textContent = modalCss;
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

export class BrowserDetailsModal implements DetailsModal {
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

  /**
   * Shows the details modal for a listing. This is a product modal backed by
   * the native Popover API: a non-modal `popover="auto"` top-layer element
   * with `role="dialog"`, light dismiss, and `Esc` handling from the
   * platform. Focus returns natively via `showPopover({ source })`.
   */

  open(listing: Listing, invoker?: HTMLElement): boolean {
    if (!globalThis.document || !globalThis.window) return false;
    if (!supportsPopover()) return false;

    this.cancelReset();
    this.mount();

    const detailsUrl = getListingDetailsUrl(listing, {
      baseUrl: this.detailsBaseUrl,
      hideNav: true,
    });

    const titleText = formatModalTitle(listing);
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
    if (!globalThis.document) return;
    let origin: string;
    try {
      origin = new URL(this.detailsBaseUrl).origin;
    } catch {
      return;
    }
    if (globalThis.document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = globalThis.document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    globalThis.document.head.appendChild(link);
  }

  private mount(): void {
    if (!globalThis.document || this.panel) return;

    const doc = globalThis.document;
    const panel = doc.createElement('div');
    panel.className = 'sc-property-modal';
    panel.setAttribute('popover', 'auto');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'sc-modal-title');
    // Native popover semantics: auto type gives the top-layer backdrop, Esc
    // and light-dismiss cross-browser, and (via showPopover({ source })) focus
    // return to the triggering element. No manual focus, trap, or dismiss code.
    const layout = doc.createElement('div');
    layout.className = 'sc-modal-layout';
    const header = doc.createElement('div');
    header.className = 'sc-modal-header';
    const title = doc.createElement('h3');
    title.className = 'sc-modal-title';
    title.id = 'sc-modal-title';
    title.textContent = 'Property Details';
    const closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'sc-modal-close';
    closeButton.setAttribute('aria-label', 'Close modal');
    closeButton.autofocus = true;
    closeButton.append(createCloseIcon(doc));
    const skeleton = doc.createElement('div');
    skeleton.className = 'sc-modal-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    for (const width of ['70%', '40%', '90%']) {
      const line = doc.createElement('div');
      line.className = 'skeleton-line';
      line.style.width = width;
      skeleton.append(line);
    }
    const iframe = doc.createElement('iframe');
    iframe.className = 'sc-modal-iframe';
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
    ensureModalStyles(doc);
    doc.body.appendChild(panel);
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
