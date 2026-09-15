import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { BrowserDetailsDialog } from '../../src/adapters/browser-details-dialog.ts';
import type { Listing } from '../../src/domain/listing.ts';

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

test('opens listing details in a modal iframe', () => {
  // Arrange
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    HTMLDialogElement: globalThis.HTMLDialogElement,
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
    assert.equal(modal.getAttribute('aria-label'), 'Property Details Modal');
    assert.equal(modal.getAttribute('open'), '');
    assert.match(iframe?.getAttribute('src') ?? '', /listing-42/);
    assert.match(iframe?.getAttribute('src') ?? '', /hidenav=true/);
  } finally {
    dialogPrototype.showModal = originalShowModal;
    dialogPrototype.close = originalClose;
    Object.assign(globalThis, previous);
  }
});
