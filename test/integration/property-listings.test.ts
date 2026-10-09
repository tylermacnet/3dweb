// Linkedom cannot commit dynamic parts or run the feed lifecycle, so this
// suite asserts registration, the idle render skeleton, and the port-driven
// properties. Loader/store behavior is covered by the application suites.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { PropertyListings } from '../../src/components/property-listings.ts';

type ComponentModule = typeof import('../../src/components/property-listings.ts');

let cached: ComponentModule | undefined;

function installLinkedomGlobals(): void {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
  });
}

async function componentModule(): Promise<ComponentModule> {
  if (!cached) {
    installLinkedomGlobals();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-property-listings-'));
    const outputFile = join(temporaryDirectory, 'property-listings.js');
    await build({
      entryPoints: ['src/components/property-listings.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(
      `${pathToFileURL(outputFile).href}?test=${Date.now()}`
    )) as ComponentModule;
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

test('registers the property-listings element', async () => {
  // Arrange
  await componentModule();

  // Assert
  assert.ok(globalThis.customElements.get('property-listings'));
});

test('declares feed and detailsModal as non-attribute ports', async () => {
  // Arrange
  const { PropertyListings } = await componentModule();

  // Assert
  const properties = (PropertyListings as unknown as { properties: Record<string, unknown> })
    .properties;
  assert.deepEqual(properties.feed, { attribute: false });
  assert.deepEqual(properties.detailsModal, { attribute: false });
});

test('renders the container skeleton with filters while idle', async () => {
  // Arrange
  await componentModule();
  const element = document.createElement('property-listings') as unknown as PropertyListings;

  // Act
  const markup = staticMarkup(element.render() as unknown as TemplateLike);

  // Assert
  assert.match(markup, /<section/);
  assert.match(markup, /listing-page/);
  assert.match(markup, /aria-label="Property listings"/);
  assert.match(markup, /<listing-filters/);
  assert.match(markup, /listing-grid/);
});
