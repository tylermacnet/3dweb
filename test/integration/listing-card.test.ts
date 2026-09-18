// Linkedom does not commit lit-html dynamic part values (static markup renders,
// expressions stay empty), so these tests assert the pure view model, the static
// Lit template structure, and the custom-event contract instead of rendered pixels.
// Full pixel/DOM rendering remains a candidate for a real-browser runner.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { Listing } from '../../src/domain/listing.ts';
import type { ListingCard } from '../../src/components/listing-card.ts';

type CardModule = typeof import('../../src/components/listing-card.ts');

let cached: CardModule | undefined;

function installLinkedomGlobals(): void {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLImageElement: window.HTMLImageElement,
    customElements: window.customElements,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    Node: window.Node,
  });
}

async function cardModule(): Promise<CardModule> {
  if (!cached) {
    installLinkedomGlobals();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-card-'));
    const outputFile = join(temporaryDirectory, 'listing-card.js');
    await build({
      entryPoints: ['src/components/listing-card.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`)) as CardModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
}

function listingFixture(): Listing {
  return {
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
    primaryImage: 'https://example.com/photo.jpg',
    hook: 'Near downtown',
  };
}

function createCard(listing: Listing): ListingCard {
  const element = document.createElement('listing-card') as unknown as ListingCard;
  element.listing = listing;
  return element;
}

interface TemplateLike {
  strings: ArrayLike<string>;
  values: unknown[];
}

function nestedMarkup(value: unknown): string {
  if (Array.isArray(value)) return value.map(nestedMarkup).join('');
  if (typeof value === 'object' && value !== null && 'strings' in value && 'values' in value) {
    return staticMarkup(value as TemplateLike);
  }
  return '';
}

function staticMarkup(template: TemplateLike): string {
  let markup = '';
  const strings = Array.from(template.strings);
  strings.forEach((part, index) => {
    markup += part;
    if (index < template.values.length) markup += nestedMarkup(template.values[index]);
  });
  return markup;
}

class RecordingCustomEvent {
  readonly type: string;
  readonly detail: unknown;
  readonly bubbles: boolean;
  readonly composed: boolean;

  constructor(type: string, init?: { detail?: unknown; bubbles?: boolean; composed?: boolean }) {
    this.type = type;
    this.detail = init?.detail;
    this.bubbles = init?.bubbles ?? false;
    this.composed = init?.composed ?? false;
  }
}

function captureDispatched(target: object): RecordingCustomEvent[] {
  const events: RecordingCustomEvent[] = [];
  Object.assign(globalThis, { CustomEvent: RecordingCustomEvent });
  (target as { dispatchEvent(event: unknown): boolean }).dispatchEvent = (event: unknown) => {
    events.push(event as RecordingCustomEvent);
    return true;
  };
  return events;
}

test('describes rent, location, and bedroom labels for a complete listing', async () => {
  // Arrange
  const { describeListingCard } = await cardModule();

  // Act
  const view = describeListingCard(listingFixture());

  // Assert
  assert.equal(view.formattedRent, '$1,750 / mo');
  assert.equal(view.locationText, 'Fredericton • Downtown / South Side');
  assert.equal(view.bedText, '2 Beds');
  assert.equal(view.line1, '144 King Street');
  assert.equal(view.fullAddress, '144 King Street Unit 3');
  assert.equal(view.imgSrc, 'https://example.com/photo.jpg');
  assert.equal(
    view.detailsUrl,
    'https://3dmanagement.managebuilding.com/Resident/public/rentals/listing-42',
  );
});

test('falls back for unknown rent, studio layout, and missing image', async () => {
  // Arrange
  const { describeListingCard, FALLBACK_IMAGE } = await cardModule();
  const listing: Listing = {
    ...listingFixture(),
    bedroomCount: 0,
    rent: null,
    primaryImage: '',
  };

  // Act
  const view = describeListingCard(listing);

  // Assert
  assert.equal(view.formattedRent, 'Call for Price');
  assert.equal(view.bedText, 'Bachelor');
  assert.equal(view.imgSrc, FALLBACK_IMAGE);
});

test('renders the legacy card structure with semantic elements and labels', async () => {
  // Arrange
  await cardModule();
  const card = createCard(listingFixture());

  // Act
  const template = card.render();
  const markup = staticMarkup(template as unknown as TemplateLike);

  // Assert
  assert.match(markup, /<article/);
  assert.match(markup, /class="property"/);
  assert.match(markup, /<header/);
  assert.match(markup, /card-head/);
  assert.match(markup, /<img/);
  assert.match(markup, /card-media/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /card-header-titles/);
  assert.match(markup, /<h3/);
  assert.match(markup, /card-heading/);
  assert.match(markup, /<a/);
  assert.match(markup, /href=/);
  assert.match(markup, /title-link/);
  assert.match(markup, /title=/);
  assert.match(markup, /<svg/);
  assert.match(markup, /aria-label/);
  assert.match(markup, /address-line-1/);
  assert.match(markup, /address-line-2/);
  assert.match(markup, /class="location"/);
  assert.match(markup, /class="meta"/);
  assert.match(markup, /class="badges"/);
  assert.match(markup, /class="badge"/);
  assert.match(markup, /class="price"/);
  assert.match(markup, /class="hook"/);
  assert.match(markup, /<footer/);
  assert.match(markup, /card-foot/);
  assert.match(markup, /class="cta"/);
  assert.match(markup, /aria-hidden="true"/);
});

function syntheticClick(overrides: Record<string, unknown> = {}): {
  event: MouseEvent;
  prevented(): boolean;
} {
  let prevented = false;
  const event = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  } as unknown as MouseEvent;
  return { event, prevented: () => prevented };
}

function stubPointer(matches: boolean): void {
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches });
}

function restorePointer(original: unknown): void {
  if (original === undefined) delete (globalThis as Record<string, unknown>).matchMedia;
  else (globalThis as Record<string, unknown>).matchMedia = original;
}

test('opens the dialog for an unmodified click on a fine pointer', async () => {
  // Arrange
  await cardModule();
  const listing = listingFixture();
  const card = createCard(listing);
  const dispatched = captureDispatched(card);
  const original = (globalThis as Record<string, unknown>).matchMedia;
  stubPointer(true);
  const click = syntheticClick();

  try {
    // Act
    (card as unknown as { handleDetailsClick(event: MouseEvent): void }).handleDetailsClick(
      click.event,
    );

    // Assert
    assert.equal(click.prevented(), true);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, 'listing-details-requested');
    assert.equal(dispatched[0].detail, listing);
    assert.equal(dispatched[0].bubbles, true);
    assert.equal(dispatched[0].composed, true);
  } finally {
    restorePointer(original);
  }
});

test('follows the link on a coarse pointer', async () => {
  // Arrange
  await cardModule();
  const card = createCard(listingFixture());
  const dispatched = captureDispatched(card);
  const original = (globalThis as Record<string, unknown>).matchMedia;
  stubPointer(false);
  const click = syntheticClick();

  try {
    // Act
    (card as unknown as { handleDetailsClick(event: MouseEvent): void }).handleDetailsClick(
      click.event,
    );

    // Assert
    assert.equal(click.prevented(), false);
    assert.equal(dispatched.length, 0);
  } finally {
    restorePointer(original);
  }
});

test('never intercepts modified or non-primary clicks', async () => {
  // Arrange
  await cardModule();
  const card = createCard(listingFixture());
  const dispatched = captureDispatched(card);
  const original = (globalThis as Record<string, unknown>).matchMedia;
  stubPointer(true);

  try {
    for (const overrides of [
      { button: 1 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      const click = syntheticClick(overrides);

      // Act
      (card as unknown as { handleDetailsClick(event: MouseEvent): void }).handleDetailsClick(
        click.event,
      );

      // Assert
      assert.equal(click.prevented(), false);
    }
    assert.equal(dispatched.length, 0);
  } finally {
    restorePointer(original);
  }
});

test('defaults to the dialog when pointer detection is unavailable', async () => {
  // Arrange
  await cardModule();
  const card = createCard(listingFixture());
  const dispatched = captureDispatched(card);
  const original = (globalThis as Record<string, unknown>).matchMedia;
  delete (globalThis as Record<string, unknown>).matchMedia;
  const click = syntheticClick();

  try {
    // Act
    (card as unknown as { handleDetailsClick(event: MouseEvent): void }).handleDetailsClick(
      click.event,
    );

    // Assert
    assert.equal(click.prevented(), true);
    assert.equal(dispatched.length, 1);
  } finally {
    restorePointer(original);
  }
});

test('swaps a broken image for the fallback exactly once', async () => {
  // Arrange
  await cardModule();
  const { FALLBACK_IMAGE } = await cardModule();
  const card = createCard(listingFixture());
  const image = document.createElement('img') as unknown as HTMLImageElement;
  Object.defineProperty(image, 'src', {
    configurable: true,
    writable: true,
    value: 'https://example.com/photo.jpg',
  });

  // Act
  (card as unknown as { handleImageError(event: unknown): void }).handleImageError({
    target: image,
  });

  // Assert
  assert.equal(image.src, FALLBACK_IMAGE);

  // Act again with the fallback already in place
  (card as unknown as { handleImageError(event: unknown): void }).handleImageError({
    target: image,
  });

  // Assert no error loop is triggered
  assert.equal(image.src, FALLBACK_IMAGE);
});
