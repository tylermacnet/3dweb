import type { Listing } from '../domain/listing.js';
import type { DetailsDialog } from '../ports/details-dialog.js';

export class BrowserDetailsDialog implements DetailsDialog {
  private dialog: HTMLDialogElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private titleEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  private readonly detailsBaseUrl: string;

  constructor(detailsBaseUrl = 'https://3dmanagement.managebuilding.com/Resident/public/rentals') {
    this.detailsBaseUrl = detailsBaseUrl;
  }

  open(listing: Listing): void {
    if (!globalThis.document || !globalThis.window) return;

    this.mount();
    const activeElement = document.activeElement;
    this.lastFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;

    const url = new URL(`${this.detailsBaseUrl}/${listing.id}`, window.location.href);
    url.searchParams.set('hidenav', 'true');

    const title = [listing.address.line1, listing.address.line2].filter(Boolean).join(' ');
    if (this.titleEl) this.titleEl.textContent = title || 'Property Details';
    if (this.iframe) this.iframe.src = url.toString();
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
    this.dialog.className = 'property-dialog';
    this.dialog.setAttribute('aria-label', 'Property Details Modal');
    const layout = document.createElement('div');
    layout.className = 'dialog-layout';
    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('h3');
    title.className = 'dialog-title';
    title.textContent = 'Property Details';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'dialog-close';
    closeButton.setAttribute('aria-label', 'Close dialog');
    closeButton.textContent = '×';
    const iframe = document.createElement('iframe');
    iframe.className = 'dialog-iframe';
    iframe.allowFullscreen = true;
    iframe.title = 'Property listing detail view';

    header.append(title, closeButton);
    layout.append(header, iframe);
    this.dialog.append(layout);
    this.titleEl = title;
    this.iframe = iframe;
    this.closeBtn = closeButton;

    this.bindEvents();
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
