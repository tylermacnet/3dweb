import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { Listing } from '../../src/domain/listing.ts';

type DialogModule = typeof import('../../src/adapters/browser-details-dialog.ts');

let cached: DialogModule | undefined;

async function dialogModule(): Promise<DialogModule> {
  if (!cached) {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-dialog-'));
    const outputFile = join(temporaryDirectory, 'browser-details-dialog.js');
    await build({
      entryPoints: ['src/adapters/browser-details-dialog.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`)) as DialogModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
}

const listing: Listing = {
  id: 'listing-42',
  address: {
    line1: '144 King Street',
    line2: 'Unit 3',
    city: 'Fredericton',
    postalCode: 'E3B 1A1',
    fsa: 'E3B',
    regionId: 'GFA',
    regionName: 'Greater Fredericton',
    areaName: 'Downtown / South Side',
  },
  bedroomCount: 2,
  bathroomCount: 1,
  rent: 1750,
  primaryImage: '',
  hook: 'Near downtown',
};

interface ShowCall {
  method: 'show' | 'hide';
  source?: HTMLElement;
}

interface DialogDom {
  window: ReturnType<typeof parseHTML>['window'];
  openPopovers: Set<HTMLElement>;
  calls: ShowCall[];
  restore(): void;
}

// Linkedom has no native Popover API, so mirror the observable contract the
// platform owns in real browsers: showPopover/hidePopover fire toggle events
// (used by the adapter to reset the iframe and track open state) and the stub
// records invocations so focus-source handoff can be asserted.
function installDialogDom(): DialogDom {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    CSSStyleSheet: (globalThis as Record<string, unknown>).CSSStyleSheet,
  };
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
  });
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com/' },
    configurable: true,
  });

  const openPopovers = new Set<HTMLElement>();
  const calls: ShowCall[] = [];
  const prototype = window.HTMLElement.prototype as unknown as {
    showPopover?: unknown;
    hidePopover?: unknown;
  };
  const originalShow = prototype.showPopover;
  const originalHide = prototype.hidePopover;

  function toggleEvent(newState: 'open' | 'closed'): Event {
    const event = new window.Event('toggle');
    Object.defineProperty(event, 'newState', { value: newState });
    return event;
  }

  prototype.showPopover = function showPopover(
    this: HTMLElement,
    options?: { source?: HTMLElement },
  ) {
    calls.push({ method: 'show', source: options?.source });
    openPopovers.add(this);
    this.dispatchEvent(toggleEvent('open'));
  };
  prototype.hidePopover = function hidePopover(this: HTMLElement) {
    calls.push({ method: 'hide' });
    openPopovers.delete(this);
    this.dispatchEvent(toggleEvent('closed'));
  };

  return {
    window,
    openPopovers,
    calls,
    restore() {
      prototype.showPopover = originalShow;
      prototype.hidePopover = originalHide;
      Object.assign(globalThis, previous);
    },
  };
}

test('opens listing details in a chromeless auto popover iframe', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    const handled = detailsDialog.open(listing);

    // Assert
    const panel = document.querySelector('[popover="auto"]');
    const iframe = document.querySelector('iframe');
    assert.equal(handled, true);
    assert.ok(panel);
    assert.equal(panel.className, 'sc-property-dialog');
    assert.equal(panel.getAttribute('popover'), 'auto');
    assert.equal(panel.getAttribute('role'), 'dialog');
    assert.equal(panel.getAttribute('aria-labelledby'), 'sc-dialog-title');
    assert.ok(dom.openPopovers.has(panel as HTMLElement));
    assert.equal(dom.calls[0]?.method, 'show');
    assert.equal(dom.calls[0]?.source, undefined);
    assert.equal(
      iframe?.getAttribute('src'),
      'https://example.com/details/listing-42?hidenav=true',
    );
    assert.match(iframe?.getAttribute('src') ?? '', /hidenav=true/);
    assert.equal(iframe?.getAttribute('fetchpriority'), 'high');
  } finally {
    dom.restore();
  }
});

test('covers the shell with a skeleton until the live document paints', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);

    // Assert: busy shell while the cross-origin navigation is in flight.
    const panel = document.querySelector('[popover="auto"]');
    const skeleton = panel?.querySelector('.sc-dialog-skeleton');
    const iframe = document.querySelector('iframe');
    assert.equal(panel?.getAttribute('aria-busy'), 'true');
    assert.ok(skeleton);
    assert.equal(skeleton?.getAttribute('aria-hidden'), 'true');
    assert.equal((skeleton as HTMLElement | null)?.hidden, false);
    assert.equal((iframe as unknown as { hidden: boolean } | null)?.hidden, true);

    // Act: the live document reports its first paint.
    iframe?.dispatchEvent(new dom.window.Event('load'));

    // Assert: skeleton retires, frame takes the slot with no layout shift.
    assert.equal(panel?.getAttribute('aria-busy'), null);
    assert.equal((skeleton as HTMLElement | null)?.hidden, true);
    assert.equal((iframe as unknown as { hidden: boolean } | null)?.hidden, false);
    assert.match(iframe?.title ?? '', /144 King Street Unit 3/);
  } finally {
    dom.restore();
  }
});

test('hands the triggering element to the platform for focus return', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing, trigger);

    // Assert
    assert.equal(dom.calls[0]?.method, 'show');
    assert.equal(dom.calls[0]?.source, trigger);
  } finally {
    dom.restore();
  }
});

test('names the popover from its visible header with an icon close action', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);
    document.querySelector('iframe')?.dispatchEvent(new dom.window.Event('load'));

    // Assert
    const panel = document.querySelector('[popover="auto"]');
    const labelledBy = panel?.getAttribute('aria-labelledby') ?? '';
    const title = panel?.querySelector(`#${labelledBy}`);
    const expectedTitle = 'Fredericton • Downtown / South Side — 144 King Street Unit 3';
    assert.equal(title?.textContent, expectedTitle);
    assert.equal(title?.getAttribute('title'), expectedTitle);
    const closeButton = panel?.querySelector('button');
    assert.equal(closeButton?.getAttribute('aria-label'), 'Close dialog');
    assert.equal(closeButton?.autofocus, true);
    assert.ok(closeButton?.querySelector('svg'));
    assert.match(document.querySelector('iframe')?.title ?? '', /144 King Street Unit 3/);
  } finally {
    dom.restore();
  }
});

test('reopens the same listing with no new navigation', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');
    detailsDialog.open(listing);
    document.querySelector('iframe')?.dispatchEvent(new dom.window.Event('load'));
    detailsDialog.close();

    // Act: reopen the same listing while the document is retained.
    const handled = detailsDialog.open(listing);

    // Assert: reshown with the live document, no second navigation.
    assert.equal(handled, true);
    assert.equal(
      document.querySelector('iframe')?.getAttribute('src'),
      'https://example.com/details/listing-42?hidenav=true',
    );
    assert.equal(dom.calls.filter((call) => call.method === 'show').length, 2);
    assert.equal(document.querySelector('[popover="auto"]')?.getAttribute('aria-busy'), null);
  } finally {
    dom.restore();
  }
});

test('navigates when opening a different listing', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');
    detailsDialog.open(listing);
    document.querySelector('iframe')?.dispatchEvent(new dom.window.Event('load'));

    // Act
    detailsDialog.open({ ...listing, id: 'listing-7' });

    // Assert: the shell returns to loading for the new document.
    assert.equal(
      document.querySelector('iframe')?.getAttribute('src'),
      'https://example.com/details/listing-7?hidenav=true',
    );
    assert.equal(document.querySelector('[popover="auto"]')?.getAttribute('aria-busy'), 'true');
  } finally {
    dom.restore();
  }
});

test('discards the retained document only after it sits unused', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details', 20);
    detailsDialog.open(listing);
    detailsDialog.close();

    // Act: let the idle window expire.
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Assert
    assert.equal(document.querySelector('iframe')?.getAttribute('src'), 'about:blank');
  } finally {
    dom.restore();
  }
});

test('cancels the discard when the listing reopens in time', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details', 30);
    detailsDialog.open(listing);
    detailsDialog.close();

    // Act: reopen before the idle window expires, then outlive it.
    detailsDialog.open(listing);
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Assert: the live document survived because the timer was cancelled.
    assert.equal(
      document.querySelector('iframe')?.getAttribute('src'),
      'https://example.com/details/listing-42?hidenav=true',
    );
  } finally {
    dom.restore();
  }
});

test('warm premounts, styles, and preconnects exactly once', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.warm();
    detailsDialog.warm();

    // Assert
    assert.equal(document.querySelectorAll('[popover="auto"]').length, 1);
    assert.equal(
      document.querySelectorAll('link[rel="preconnect"][href="https://example.com"]').length,
      1,
    );

    // Act: opening after a warm reuses the mounted shell.
    const handled = detailsDialog.open(listing);

    // Assert
    assert.equal(handled, true);
    assert.equal(document.querySelectorAll('[popover="auto"]').length, 1);
  } finally {
    dom.restore();
  }
});

test('refuses to work (and mounts nothing) when popover is unsupported', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();
  (
    dom.window.HTMLElement.prototype as unknown as {
      showPopover?: unknown;
      hidePopover?: unknown;
    }
  ).showPopover = undefined;
  (
    dom.window.HTMLElement.prototype as unknown as {
      showPopover?: unknown;
      hidePopover?: unknown;
    }
  ).hidePopover = undefined;

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    const handled = detailsDialog.open(listing);

    // Assert
    assert.equal(handled, false);
    assert.equal(document.querySelector('[popover="auto"]'), null);
    assert.equal(document.body.childElementCount, 0);
  } finally {
    dom.restore();
  }
});

test('adopts the popover stylesheet exactly once with opaque token fallbacks', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();
  const adopted: { cssText: string }[] = [];
  class FakeStyleSheet {
    cssText = '';
    replaceSync(cssText: string): void {
      this.cssText = cssText;
      adopted.push(this);
    }
  }
  (globalThis as Record<string, unknown>).CSSStyleSheet = FakeStyleSheet;
  Object.assign(document, { adoptedStyleSheets: [] });

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);
    detailsDialog.open(listing);

    // Assert
    assert.equal(adopted.length, 1);
    assert.match(adopted[0].cssText, /:root\s*\{[^}]*--sc-surface-bg:\s*#ffffff/);
    assert.match(adopted[0].cssText, /--dialog-bg:\s*var\(--sc-surface-bg,\s*#ffffff\)/);
    assert.match(adopted[0].cssText, /background:\s*var\(--dialog-bg\)/);
    assert.match(adopted[0].cssText, /&::backdrop\s*\{[^}]*background:\s*rgb\(15 23 42 \/ 60%\)/);
    assert.match(adopted[0].cssText, /:popover-open::backdrop/);
    assert.match(adopted[0].cssText, /transition:\s*opacity 0\.15s/);
    assert.match(adopted[0].cssText, /allow-discrete/);
    assert.match(adopted[0].cssText, /prefers-reduced-motion:\s*reduce/);
    assert.match(adopted[0].cssText, /\.sc-dialog-skeleton/);
  } finally {
    dom.restore();
  }
});

test('falls back to a single style element without constructed stylesheets', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();
  delete (globalThis as Record<string, unknown>).CSSStyleSheet;

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);
    detailsDialog.open(listing);

    // Assert
    const styles = document.querySelectorAll('style[data-sc-dialog-styles]');
    assert.equal(styles.length, 1);
    const cssText = styles[0].textContent ?? '';
    assert.match(cssText, /:root\s*\{[^}]*--sc-surface-bg:\s*#ffffff/);
    assert.match(cssText, /--dialog-bg:\s*var\(--sc-surface-bg,\s*#ffffff\)/);
    assert.match(cssText, /background:\s*var\(--dialog-bg\)/);
  } finally {
    dom.restore();
  }
});
