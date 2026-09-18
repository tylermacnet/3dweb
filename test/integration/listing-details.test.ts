// Linkedom does not commit lit-html dynamic part values (static markup renders,
// expressions stay empty), so these tests assert the static template structure
// of the valid/error render branches; URL resolution is covered separately by
// the application-config suite. Full pixel/DOM rendering remains a candidate
// for a real-browser runner.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { ListingDetails } from '../../src/components/listing-details.ts';

type DetailsModule = typeof import('../../src/components/listing-details.ts');

let cached: DetailsModule | undefined;

function installLinkedomGlobals(): void {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
  });
}

async function detailsModule(): Promise<DetailsModule> {
  if (!cached) {
    installLinkedomGlobals();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-details-'));
    const outputFile = join(temporaryDirectory, 'listing-details.js');
    await build({
      entryPoints: ['src/components/listing-details.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(
      `${pathToFileURL(outputFile).href}?test=${Date.now()}`
    )) as DetailsModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
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

function createDetails(listingId?: string): ListingDetails {
  const element = document.createElement('listing-details') as unknown as ListingDetails;
  if (listingId !== undefined) element.listingId = listingId;
  return element;
}

test('renders the iframe structure for a resolvable listing id', async () => {
  // Arrange
  await detailsModule();
  const details = createDetails('listing-42');

  // Act
  const markup = staticMarkup(details.render() as unknown as TemplateLike);

  // Assert
  assert.match(markup, /<section/);
  assert.match(markup, /details-iframe/);
  assert.match(markup, /aria-label="Property details"/);
  assert.match(markup, /<h2/);
  assert.match(markup, /details-title/);
  assert.match(markup, /<iframe/);
  assert.match(markup, /details-frame/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /allowfullscreen/);
  assert.match(markup, /referrerpolicy="no-referrer"/);
});

test('renders an error state without an iframe when nothing resolves', async () => {
  // Arrange
  await detailsModule();
  const details = createDetails();

  // Act
  const markup = staticMarkup(details.render() as unknown as TemplateLike);

  // Assert
  assert.match(markup, /details-error/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /Property details are unavailable for this listing\./);
  assert.doesNotMatch(markup, /<iframe/);
});
