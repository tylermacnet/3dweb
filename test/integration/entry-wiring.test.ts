// ConfigurePropertyListings owns the entry wiring contract: fill only unset
// ports, fresh stateless feed per element, one dialog per document, host
// overrides preserved. Linkedom cannot upgrade/run these custom elements, so
// we exercise the pure DOM-wiring function on plain custom-element tags.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

type EntryModule = typeof import('../../src/index.tsx');

let cached: EntryModule | undefined;

function installLinkedomGlobals(): void {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
  });
}

async function entryModule(): Promise<EntryModule> {
  if (!cached) {
    installLinkedomGlobals();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-entry-'));
    const outputFile = join(temporaryDirectory, 'bundle.js');
    await build({
      entryPoints: ['src/index.tsx'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });
    cached = (await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`)) as EntryModule;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return cached;
}

function freshDocument(markup: string): ReturnType<typeof parseHTML>['window'] {
  return parseHTML(`<!doctype html><html><body>${markup}</body></html>`).window;
}

test('fills unset ports on every property-listings with a fresh feed and shared dialog', async () => {
  // Arrange
  const { configurePropertyListings } = await entryModule();
  const window = freshDocument(
    '<property-listings></property-listings><property-listings></property-listings>',
  );

  // Act
  configurePropertyListings(window.document);

  // Assert
  const elements = window.document.querySelectorAll('property-listings');
  assert.equal(elements.length, 2);
  const [first, second] = elements as unknown as Array<{ feed?: unknown; detailsDialog?: unknown }>;
  assert.ok(first?.feed);
  assert.notEqual(first?.feed, second?.feed);
  assert.equal(typeof first?.feed?.getListings, 'function');
  assert.ok(first?.detailsDialog);
  assert.equal(first?.detailsDialog, second?.detailsDialog);
});

test('preserves a host-supplied feed and dialog per element', async () => {
  // Arrange
  const { configurePropertyListings } = await entryModule();
  const window = freshDocument('<property-listings></property-listings>');
  const hostFeed = { getListings: async () => [] };
  const hostDialog = { open: () => true, close: () => undefined };
  const element = window.document.querySelector('property-listings') as unknown as {
    feed?: unknown;
    detailsDialog?: unknown;
  };
  element.feed = hostFeed;
  element.detailsDialog = hostDialog;

  // Act
  configurePropertyListings(window.document);

  // Assert
  assert.equal(element.feed, hostFeed);
  assert.equal(element.detailsDialog, hostDialog);
});

test('scopes wiring to the given root and is idempotent across calls', async () => {
  // Arrange
  const { configurePropertyListings } = await entryModule();
  const window = freshDocument(
    '<main><property-listings></property-listings></main><property-listings></property-listings>',
  );
  const main = window.document.querySelector('main');

  // Act
  configurePropertyListings(main as unknown as ParentNode);
  const wired = [...window.document.querySelectorAll('property-listings')].map(
    (element) => (element as unknown as { feed?: unknown }).feed,
  );
  configurePropertyListings(main as unknown as ParentNode);
  const afterSecondPass = [...window.document.querySelectorAll('property-listings')].map(
    (element) => (element as unknown as { feed?: unknown }).feed,
  );

  // Assert
  assert.ok(wired[0]);
  assert.equal(wired[1], undefined);
  assert.deepEqual(wired[0], afterSecondPass[0]);
});

test('wires the root element itself when it is a property-listings', async () => {
  // Arrange
  const { configurePropertyListings } = await entryModule();
  const window = freshDocument('<property-listings></property-listings>');
  const element = window.document.querySelector('property-listings') as unknown as {
    feed?: unknown;
    detailsDialog?: unknown;
  };

  // Act
  configurePropertyListings(element as unknown as ParentNode);

  // Assert
  assert.ok(element.feed);
  assert.ok(element.detailsDialog);
});
