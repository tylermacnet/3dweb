import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { Listing } from '../../src/domain/listing.ts';

async function bundleStore() {
  const tmp = await mkdtemp(join(tmpdir(), '3dweb-p0-'));
  const entryFile = join(tmp, 'entry.ts');
  const outfile = join(tmp, 'out.js');
  const cwd = process.cwd().replace(/\\/g, '/');
  await writeFile(
    entryFile,
    `export * from '${cwd}/src/application/listing-store.ts';\nexport * from '${cwd}/src/components/listing-grid.ts';\n`,
    'utf8',
  );
  await build({
    entryPoints: [entryFile],
    bundle: true,
    format: 'esm',
    platform: 'node',
    loader: { '.css': 'text' },
    outfile,
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  await rm(tmp, { recursive: true, force: true });
  return mod as unknown as typeof import('../../src/application/listing-store.ts') &
    typeof import('../../src/components/listing-grid.ts');
}

function installGlobals() {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    Node: window.Node,
    Element: window.Element,
  });
}

const sample: Listing[] = [
  {
    id: '1',
    address: {
      line1: '1 Main St',
      line2: '',
      city: 'Saint John',
      postalCode: 'E2L 1V1',
      fsa: 'E2L',
      regionId: 'GSJ',
      regionName: 'Greater Saint John',
      areaName: 'Uptown / South End / Central',
    },
    bedroomCount: 1,
    bathroomCount: 1,
    rent: 1000,
    primaryImage: '',
    hook: '',
  },
];

function markupOf(template: { strings: ArrayLike<string>; values: unknown[] }): string {
  const nested = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(nested).join('');
    if (typeof v === 'object' && v !== null && 'strings' in v && 'values' in v) {
      const t = v as { strings: ArrayLike<string>; values: unknown[] };
      return markupOf(t);
    }
    return '';
  };
  let out = '';
  const strings = Array.from(template.strings);
  strings.forEach((part, i) => {
    out += part;
    if (i < template.values.length) out += nested(template.values[i]);
  });
  return out;
}

test('P0.1: backend-empty renders without Clear filters; filtered-empty keeps it', async () => {
  installGlobals();
  const { getListingStore, clearListingStore, ListingGrid } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  // Arrange: empty feed -> backend empty
  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => [] } as never);
  for (
    let i = 0;
    i < 50 && !['empty', 'ready'].includes((store.loadState as { kind: string }).kind);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 10));
  }
  // Act
  assert.equal(store.loadState.kind, 'empty');
  const grid = document.createElement('listing-grid') as unknown as InstanceType<
    typeof ListingGrid
  >;
  document.body.appendChild(grid as unknown as Node);
  await new Promise((r) => setTimeout(r, 5));
  const emptyMarkup = markupOf(
    (grid as unknown as { render(): { strings: ArrayLike<string>; values: unknown[] } }).render(),
  );
  // Assert: backend-empty copy, no Clear filters
  assert.ok(emptyMarkup.includes('No listings available right now'));
  assert.ok(!emptyMarkup.includes('Clear filters'));

  // Arrange: non-empty feed filtered to zero -> ready + 0
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  store.setFilters({ regionId: 'OTHER' });
  assert.equal((store.loadState as { kind: string }).kind, 'ready');
  assert.equal(store.visibleCount, 0);
  const filteredMarkup = markupOf(
    (grid as unknown as { render(): { strings: ArrayLike<string>; values: unknown[] } }).render(),
  );
  // Assert: filtered-empty copy keeps Clear filters
  assert.ok(filteredMarkup.includes('No available listings match'));
  assert.ok(filteredMarkup.includes('Clear filters'));

  document.body.removeChild(grid as unknown as Node);
  clearListingStore(doc);
});

test('P0.2: last-host abort resets loading to idle and remount recovers', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);
  const store = getListingStore(doc);

  // Arrange: hanging feed
  let release!: (v: Listing[]) => void;
  const gate = new Promise<Listing[]>((res) => {
    release = res;
  });
  store.setFeed({ getListings: (_s: AbortSignal) => gate.then((v) => v) } as never);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal((store.loadState as { kind: string }).kind, 'loading');

  // Act: last host leaves
  const host = { requestUpdate() {} } as never;
  store.subscribe(host);
  store.unsubscribe(host);
  // Assert: aborted back to idle, not stuck loading
  assert.equal((store.loadState as { kind: string }).kind, 'idle');

  // Act: remount with real feed recovers
  release(sample);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal((store.loadState as { kind: string }).kind, 'ready');
  clearListingStore(doc);
});
