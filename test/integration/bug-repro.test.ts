import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import type { Listing } from '../../src/domain/listing.ts';

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

async function bundleEntry(entry: string, out: string) {
  const tmp = await mkdtemp(join(tmpdir(), '3dweb-bug-'));
  const outfile = join(tmp, out);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    loader: { '.css': 'text' },
    outfile,
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  await rm(tmp, { recursive: true, force: true });
  return mod;
}

async function bundleCombined(out: string) {
  const tmp = await mkdtemp(join(tmpdir(), '3dweb-bug-combined-'));
  const entryFile = join(tmp, 'entry.ts');
  const outfile = join(tmp, out);
  const cwd = process.cwd().replace(/\\/g, '/');
  const entryContent = `
    export * from '${cwd}/src/application/listing-store.ts';
    export * from '${cwd}/src/components/listing-grid.ts';
    export * from '${cwd}/src/index.tsx';
  `;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(entryFile, entryContent, 'utf8');
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
  return mod;
}

const sampleListings: Listing[] = [
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
  {
    id: '2',
    address: {
      line1: '2 Main St',
      line2: '',
      city: 'Moncton',
      postalCode: 'E1C 1A1',
      fsa: 'E1C',
      regionId: 'GMA',
      regionName: 'Greater Moncton',
      areaName: 'Moncton Central / Downtown',
    },
    bedroomCount: 2,
    bathroomCount: 1,
    rent: 1500,
    primaryImage: '',
    hook: '',
  },
];

test('Bug1: filtered to zero should show empty state, not Showing 0', async () => {
  installGlobals();
  const combined = await bundleCombined('combined.js');
  const { getListingStore, clearListingStore, ListingGrid } =
    combined as unknown as typeof import('../../src/application/listing-store.ts') &
      typeof import('../../src/components/listing-grid.ts');

  const doc = globalThis.document;
  clearListingStore(doc);
  const store = getListingStore(doc);
  const feed = { getListings: async () => sampleListings };
  store.setFeed(feed as never);
  // wait for load to complete - explicitly await load if not ready
  if (store.loadState.kind !== 'ready') await store.load();
  for (let i = 0; i < 20 && store.loadState.kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(store.loadState.kind, 'ready');
  // Filter to region that matches nothing
  store.setFilters({ regionId: 'OTHER' });
  assert.equal(store.visibleCount, 0);
  assert.equal(store.loadState.kind, 'ready');

  const grid = document.createElement('listing-grid') as unknown as InstanceType<
    typeof ListingGrid
  >;
  // Attach to doc so store is same doc
  document.body.appendChild(grid as unknown as Node);
  // Ensure grid is subscribed and will reflect store
  // Wait a tick for grid to pick up store state
  await new Promise((r) => setTimeout(r, 5));
  // Force render - use nested helper like property-listings.test
  function nestedMarkup(value: unknown): string {
    if (Array.isArray(value)) return value.map(nestedMarkup).join('');
    if (typeof value === 'object' && value !== null && 'strings' in value && 'values' in value) {
      const t = value as { strings: ArrayLike<string>; values: unknown[] };
      let m = '';
      const strings = Array.from(t.strings);
      strings.forEach((part, index) => {
        m += part;
        if (index < t.values.length) m += nestedMarkup(t.values[index]);
      });
      return m;
    }
    return '';
  }
  function staticMarkup(template: { strings: ArrayLike<string>; values: unknown[] }): string {
    let markup = '';
    const strings = Array.from(template.strings);
    strings.forEach((part, index) => {
      markup += part;
      if (index < template.values.length) markup += nestedMarkup(template.values[index]);
    });
    return markup;
  }
  const markup = staticMarkup(
    grid.render() as unknown as { strings: ArrayLike<string>; values: unknown[] },
  );
  // Should contain empty-state, not "Showing <strong>0</strong>"
  // Current buggy code shows Showing 0
  const hasEmpty = markup.includes('empty-state') || markup.includes('No available listings');
  const hasShowingZero = markup.includes('Showing') && markup.includes('<strong>0</strong>');
  // This assertion will fail before fix, pass after fix
  assert.ok(
    hasEmpty,
    `expected empty-state for filtered zero, got markup: ${markup.slice(0, 500)}`,
  );
  assert.ok(!hasShowingZero, `should not show Showing 0 when filtered empty`);

  document.body.removeChild(grid as unknown as Node);
  clearListingStore(doc);
});

test('Bug2: multiple grids should not create multiple feeds / abort fetches', async () => {
  const { window } = parseHTML(
    '<!doctype html><html><body><listing-grid></listing-grid><listing-grid></listing-grid><listing-grid></listing-grid></body></html>',
  );
  Object.assign(globalThis, {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
    Node: window.Node,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
  });
  const entryMod = await bundleEntry('src/index.tsx', 'entry.js');
  const doc = window.document;
  // Count feed creations by spying on ManageBuildingFeed
  let createCount = 0;
  const origCreate = entryMod as unknown as { ManageBuildingFeed?: unknown };
  // We cannot easily spy without modifying, so we check store feed identity
  // After fix, store should have one feed instance.
  // Call configurePropertyListings twice - should be idempotent
  const { configurePropertyListings, getListingStore: getStore } = entryMod as unknown as {
    configurePropertyListings: (root?: ParentNode) => void;
    getListingStore: (d: Document) => { loadState: { kind: string }; feed?: unknown };
  };
  configurePropertyListings(doc);
  const store1 = getStore(doc) as unknown as {
    loadState: { kind: string };
    currentFeed?: unknown;
    hasFeed: boolean;
  };
  const feed1 = store1.currentFeed;
  assert.ok(store1.hasFeed, 'store should have feed after first configure');
  const kind1 = store1.loadState.kind;
  // Call again - should be idempotent, not create new feed nor reset to idle
  configurePropertyListings(doc);
  const store2 = getStore(doc) as unknown as {
    loadState: { kind: string };
    currentFeed?: unknown;
    hasFeed: boolean;
  };
  const feed2 = store2.currentFeed;
  assert.equal(store1, store2, 'store should be same instance per document');
  assert.equal(
    feed1,
    feed2,
    'feed should be same instance per document, not recreated per element',
  );
  // Ensure loadState was not reset to idle (would indicate abort and re-create)
  // After first configure, loadState will be loading/idle, second should not reset to idle if already loading/ready
  // Check that second configure didn't reset kind to idle when it was loading
  if (kind1 === 'loading') {
    assert.notEqual(
      store2.loadState.kind,
      'idle',
      'second configure should not reset loading to idle',
    );
  }
});

test('Bug3: compact click without modal should not swallow navigation', async () => {
  installGlobals();
  const combined = await bundleCombined('combined2.js');
  const { getListingStore, clearListingStore, ListingGrid } =
    combined as unknown as typeof import('../../src/application/listing-store.ts') &
      typeof import('../../src/components/listing-grid.ts');

  const doc = globalThis.document;
  clearListingStore(doc);
  const store = getListingStore(doc);
  const feed = { getListings: async () => sampleListings };
  store.setFeed(feed as never);
  for (let i = 0; i < 20 && store.loadState.kind !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  store.setFilters({});

  const grid = document.createElement('listing-grid') as unknown as InstanceType<
    typeof ListingGrid
  >;
  (grid as unknown as { view: string }).view = 'compact';
  document.body.appendChild(grid as unknown as Node);

  // Add external listener that prevents default on listing-details-requested
  let listenerPrevented = false;
  grid.addEventListener('listing-details-requested', (e: Event) => {
    e.preventDefault();
    listenerPrevented = true;
  });

  // Ensure no modal is set
  (grid as unknown as { detailsModal?: unknown }).detailsModal = undefined;

  // Simulate click on compact anchor - create anchor and dispatch
  // We need to get a listing id to click
  const listing = sampleListings[0];
  const anchor = document.createElement('a');
  anchor.setAttribute('data-id', listing.id);
  anchor.setAttribute('href', `/rentals/${listing.id}`);
  // Mock matchMedia to be fine pointer (modal would be considered)
  Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
  const win = globalThis.window as unknown as { Event: typeof Event };
  // Create a fake MouseEvent via Event (linkedom lacks MouseEvent)
  const event = new win.Event('click', {
    bubbles: true,
    cancelable: true,
  }) as unknown as MouseEvent;
  Object.defineProperties(event, {
    button: { value: 0, writable: true },
    metaKey: { value: false, writable: true },
    ctrlKey: { value: false, writable: true },
    shiftKey: { value: false, writable: true },
    altKey: { value: false, writable: true },
  });
  Object.defineProperty(event, 'target', { value: anchor, enumerable: true });

  // Call handleCompactClick directly (private, so access via any)
  const anyGrid = grid as unknown as {
    handleCompactClick: (e: MouseEvent) => void;
    findListing: (id: string) => unknown;
  };
  // Need to ensure grid's store has listing so findListing works
  let prevented = false;
  const origPrevent = event.preventDefault;
  event.preventDefault = () => {
    prevented = true;
    origPrevent.call(event);
  };

  anyGrid.handleCompactClick(event);

  // Bug: with detailsModal == null and listener prevented, current code does preventDefault (swallows navigation) with no modal
  // Expected: should NOT preventDefault when no modal handled (navigation should proceed)
  // This will fail before fix, pass after fix
  assert.equal(
    prevented,
    false,
    'click should not be prevented when no modal and external listener prevented but modal missing - navigation should proceed',
  );

  document.body.removeChild(grid as unknown as Node);
  clearListingStore(doc);
});
