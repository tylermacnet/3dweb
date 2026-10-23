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

test('P0.3: allListings returns cached reference on repeated calls', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const first = store.allListings;
  const second = store.allListings;
  const third = store.allListings;
  assert.equal(first, second);
  assert.equal(second, third);

  clearListingStore(doc);
});

test('P0.4: allListings cache invalidated when feed changes', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const before = store.allListings;

  const sample2: Listing[] = [
    {
      ...sample[0],
      id: '2',
      rent: 2000,
    },
  ];
  store.setFeed({ getListings: async () => sample2 } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const after = store.allListings;
  assert.notEqual(before, after);
  assert.equal(after.length, 1);
  assert.equal(after[0]?.id, '2');

  clearListingStore(doc);
});

test('P0.5: visibleListings returns cached reference on repeated calls', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  store.setFilters({});
  const first = store.visibleListings;
  const second = store.visibleListings;
  assert.equal(first, second);

  clearListingStore(doc);
});

test('P0.6: visibleListings cache invalidated when criteria change', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const all = store.allListings;
  store.setFilters({ regionId: 'OTHER' });
  const filtered = store.visibleListings;
  assert.notEqual(all, filtered);
  assert.equal(filtered.length, 0);

  store.setFilters({});
  const again = store.visibleListings;
  assert.equal(again.length, 1);

  clearListingStore(doc);
});

test('P0.7: locationGroups returns cached reference on repeated calls', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const first = store.locationGroups;
  const second = store.locationGroups;
  assert.equal(first, second);

  clearListingStore(doc);
});

test('P0.8: priceBounds returns computed bounds on first call (not null)', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const bounds = store.priceBounds;
  assert.notEqual(bounds, null);
  assert.equal(bounds?.min, 1000);
  assert.equal(bounds?.max, 1000);

  clearListingStore(doc);
});

test('P0.9: priceBounds returns null when no listings have positive rent', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  const noRent: Listing[] = [
    {
      ...sample[0],
      id: 'free',
      rent: null,
    },
  ];
  store.setFeed({ getListings: async () => noRent } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const bounds = store.priceBounds;
  assert.equal(bounds, null);

  clearListingStore(doc);
});

test('P0.10: priceBounds cache invalidated after listings change', async () => {
  installGlobals();
  const { getListingStore, clearListingStore } = await bundleStore();
  const doc = globalThis.document;
  clearListingStore(doc);

  const store = getListingStore(doc);
  store.setFeed({ getListings: async () => sample } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const before = store.priceBounds;
  assert.equal(before?.min, 1000);

  const expensive: Listing[] = [
    {
      ...sample[0],
      id: 'pricey',
      rent: 5000,
    },
  ];
  store.setFeed({ getListings: async () => expensive } as never);
  for (let i = 0; i < 50 && (store.loadState as { kind: string }).kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const after = store.priceBounds;
  assert.equal(after?.min, 5000);
  assert.equal(after?.max, 5000);

  clearListingStore(doc);
});
