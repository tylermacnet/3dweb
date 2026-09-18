// See listing-card.test.ts for why these tests assert the view helpers, static Lit
// template structure, and event contracts rather than fully rendered pixels.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { ListingFilterOptions } from '../../src/domain/listing-filter.ts';
import type { ListingFilters } from '../../src/components/listing-filters.ts';

type FiltersModule = typeof import('../../src/components/listing-filters.ts');

let cached: FiltersModule | undefined;

function installLinkedomGlobals(): void {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    Node: window.Node,
  });
}

async function filtersModule(): Promise<FiltersModule> {
  if (!cached) {
    installLinkedomGlobals();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-filters-'));
    const outputFile = join(temporaryDirectory, 'listing-filters.js');
    await build({
      entryPoints: ['src/components/listing-filters.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(
      `${pathToFileURL(outputFile).href}?test=${Date.now()}`
    )) as FiltersModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
}

function createFilters(): ListingFilters {
  return document.createElement('listing-filters') as unknown as ListingFilters;
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

test('splits location values into region and area criteria', async () => {
  // Arrange
  const { splitLocationValue } = await filtersModule();

  // Act and assert each observable split behavior
  assert.deepEqual(splitLocationValue('ALL'), {});
  assert.deepEqual(splitLocationValue('GMA||ALL'), { regionId: 'GMA' });
  assert.deepEqual(splitLocationValue('GMA||Dieppe'), {
    regionId: 'GMA',
    areaName: 'Dieppe',
  });
});

test('formats the maximum rent label with thousands separators', async () => {
  // Arrange
  const { formatMaxRentLabel } = await filtersModule();

  // Act
  const label = formatMaxRentLabel(5000);

  // Assert
  assert.equal(label, 'Up to $5,000 / mo');
});

test('resolves the location select value from the active filter options', async () => {
  // Arrange
  await filtersModule();
  const filters = createFilters();
  const internals = filters as unknown as { locationValue: string };

  // Act and assert each observable resolution
  filters.options = {};
  assert.equal(internals.locationValue, 'ALL');
  filters.options = { regionId: 'GMA' };
  assert.equal(internals.locationValue, 'GMA||ALL');
  filters.options = { regionId: 'GMA', areaName: 'Dieppe' };
  assert.equal(internals.locationValue, 'GMA||Dieppe');
});

test('renders labeled controls with live price feedback', async () => {
  // Arrange
  await filtersModule();
  const filters = createFilters();

  // Act
  const template = filters.render();
  const markup = template.strings.join('');

  // Assert
  assert.match(markup, /role="search"/);
  assert.match(markup, /<fieldset/);
  assert.match(markup, /Filter available property listings/);
  assert.match(markup, /for="location-filter"/);
  assert.match(markup, /id="location-filter"/);
  assert.match(markup, /for="bedroom-filter"/);
  assert.match(markup, /id="bedroom-filter"/);
  assert.match(markup, /for="max-rent"/);
  assert.match(markup, /id="max-rent"/);
  assert.match(markup, /type="range"/);
  assert.match(markup, /aria-describedby="max-rent-value"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Reset Filters/);
  assert.match(markup, /reset-field/);
});

test('keeps sorting out of the migrated filter contract', async () => {
  // Arrange
  await filtersModule();
  const filters = createFilters();

  // Act
  const markup = filters.render().strings.join('').toLowerCase();

  // Assert
  assert.doesNotMatch(markup, /sort/);
});

test('dispatches filter changes as a bubbling event carrying the options', async () => {
  // Arrange
  await filtersModule();
  const filters = createFilters();
  const dispatched = captureDispatched(filters);
  const next: ListingFilterOptions = { regionId: 'GMA', maxRent: 2000 };

  // Act
  (
    filters as unknown as {
      dispatchOptions(options: ListingFilterOptions): void;
    }
  ).dispatchOptions(next);

  // Assert
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, 'listing-filters-changed');
  assert.deepEqual(dispatched[0].detail, next);
  assert.equal(dispatched[0].bubbles, true);
  assert.equal(dispatched[0].composed, true);
  assert.deepEqual(filters.options, next);
});
