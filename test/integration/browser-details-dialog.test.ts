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

interface DialogDom {
  window: ReturnType<typeof parseHTML>['window'];
  restore(): void;
}

function installDialogDom(): DialogDom {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    HTMLDialogElement: globalThis.HTMLDialogElement,
    CSSStyleSheet: (globalThis as Record<string, unknown>).CSSStyleSheet,
  };
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLDialogElement: window.document.createElement('dialog').constructor,
  });
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com/' },
    configurable: true,
  });
  const dialogPrototype = window.document.createElement('dialog').constructor.prototype;
  const originalShowModal = dialogPrototype.showModal;
  const originalClose = dialogPrototype.close;
  dialogPrototype.showModal = function showModal() {
    Object.defineProperty(this, 'open', { configurable: true, value: true });
    this.setAttribute('open', '');
  };
  dialogPrototype.close = function close() {
    Object.defineProperty(this, 'open', { configurable: true, value: false });
    this.removeAttribute('open');
    this.dispatchEvent(new window.Event('close'));
  };
  return {
    window,
    restore() {
      dialogPrototype.showModal = originalShowModal;
      dialogPrototype.close = originalClose;
      Object.assign(globalThis, previous);
    },
  };
}

test('opens listing details in a modal iframe', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);

    // Assert
    const modal = document.querySelector('dialog');
    const iframe = document.querySelector('iframe');
    assert.ok(modal);
    assert.equal(modal.className, 'sc-property-dialog');
    assert.equal(modal.getAttribute('aria-labelledby'), 'sc-dialog-title');
    assert.equal(modal.getAttribute('closedby'), 'any');
    assert.equal(modal.getAttribute('open'), '');
    assert.match(iframe?.getAttribute('src') ?? '', /listing-42/);
    assert.match(iframe?.getAttribute('src') ?? '', /hidenav=true/);
    assert.equal(
      iframe?.getAttribute('src'),
      'https://example.com/details/listing-42?hidenav=true',
    );
  } finally {
    dom.restore();
  }
});

test('names the dialog from its visible header with an icon close action', async () => {
  // Arrange
  const { BrowserDetailsDialog } = await dialogModule();
  const dom = installDialogDom();

  try {
    const detailsDialog = new BrowserDetailsDialog('https://example.com/details');

    // Act
    detailsDialog.open(listing);

    // Assert
    const modal = document.querySelector('dialog');
    const labelledBy = modal?.getAttribute('aria-labelledby') ?? '';
    const title = modal?.querySelector(`#${labelledBy}`);
    const expectedTitle = 'Fredericton • Downtown / South Side — 144 King Street Unit 3';
    assert.equal(title?.textContent, expectedTitle);
    assert.equal(title?.getAttribute('title'), expectedTitle);
    const closeButton = modal?.querySelector('button');
    assert.equal(closeButton?.getAttribute('aria-label'), 'Close dialog');
    assert.ok(closeButton?.querySelector('svg'));
    assert.match(document.querySelector('iframe')?.title ?? '', /144 King Street Unit 3/);
  } finally {
    dom.restore();
  }
});

test('adopts the dialog stylesheet exactly once with opaque token fallbacks', async () => {
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
