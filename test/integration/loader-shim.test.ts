// Loader shim contract: universal-head safe. Tags present load the bundle
// immediately; no tags means no execute — a one-shot observer catches late
// tags and an idle prefetch (skipped on Save-Data) warms the HTTP cache.
// Duplicate loader tags never double-load. `?preview=<ref>` behavior stays.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

const DIST_BUNDLE = 'https://example.test/dist/bundle.js';
const DIST_ESM = 'https://example.test/dist/bundle.esm.js';

interface FakeScript {
  kind: 'script';
  src: string;
  listeners: Record<string, () => void>;
}

interface FakeLink {
  kind: 'link';
  rel: string;
  attrs: Record<string, string>;
}

type Appended = FakeScript | FakeLink;

interface Harness {
  appended: Appended[];
  dataset: Record<string, string>;
  setHasTag: (value: boolean) => void;
  fireObserver: () => void;
  observerCount: () => number;
  observerDisconnected: () => boolean;
  runIdle: () => void;
  window: Record<string, unknown>;
  restore: () => void;
}

let bundleFile = '';
let importCounter = 0;

async function loaderBundle(): Promise<string> {
  if (!bundleFile) {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-loader-'));
    // `.mjs` keeps each `?shim=N` evaluation a distinct ESM module: Node
    // loads ambiguous `.js` through the CJS cache (query stripped, executed
    // once), while `.mjs` is always ESM with a query-sensitive cache key.
    const outputFile = join(temporaryDirectory, 'loader.mjs');
    await build({
      entryPoints: ['src/loader.ts'],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      outfile: outputFile,
    });
    bundleFile = outputFile;
  }
  return bundleFile;
}

function installHarness(options: {
  hasTag: boolean;
  search?: string;
  saveData?: boolean;
  idle?: boolean;
}): Harness {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved: Record<string, unknown> = {
    document: g['document'],
    window: g['window'],
    MutationObserver: g['MutationObserver'],
    requestIdleCallback: g['requestIdleCallback'],
    setTimeout: g['setTimeout'],
  };
  // `navigator` is a getter-only accessor on the global object; shadowing it
  // requires defineProperty rather than assignment.
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  const appended: Appended[] = [];
  const dataset: Record<string, string> = {};
  let hasTag = options.hasTag;
  const observerCallbacks: Array<() => void> = [];
  let observerInstances = 0;
  let observerDisconnected = false;
  const idleCallbacks: Array<() => void> = [];
  const timerCalls: Array<{ delay: number; run: () => void }> = [];

  class FakeObserver {
    constructor(callback: () => void) {
      observerInstances += 1;
      observerCallbacks.push(callback);
    }
    observe(): void {
      // recording construction is the assertion surface
    }
    disconnect(): void {
      observerDisconnected = true;
    }
  }

  const fakeDocument = {
    baseURI: 'https://example.test/pages/listings.html',
    currentScript: null,
    documentElement: { dataset },
    head: {
      appendChild: (element: Appended) => {
        appended.push(element);
        return element;
      },
    },
    createElement: (tag: string): unknown => {
      if (tag === 'script') {
        const script: FakeScript = {
          kind: 'script',
          src: '',
          listeners: {},
        };
        return {
          ...script,
          set src(value: string) {
            script.src = value;
          },
          get src(): string {
            return script.src;
          },
          addEventListener: (name: string, listener: () => void): void => {
            script.listeners[name] = listener;
          },
        };
      }
      const link: FakeLink = { kind: 'link', rel: '', attrs: {} };
      return {
        ...link,
        set rel(value: string) {
          link.rel = value;
        },
        get rel(): string {
          return link.rel;
        },
        setAttribute: (name: string, value: string): void => {
          link.attrs[name] = value;
        },
        getAttribute: (name: string): string | null => link.attrs[name] ?? null,
        get href(): string {
          return link.attrs['href'] ?? '';
        },
      };
    },
    querySelector: (selector: string): unknown => {
      if (selector.includes('property-listings')) {
        return hasTag ? { tagName: 'PROPERTY-LISTINGS' } : null;
      }
      return null;
    },
    querySelectorAll: (): unknown[] => [],
  };

  const fakeWindow: Record<string, unknown> = {
    location: { search: options.search ?? '' },
  };

  g['document'] = fakeDocument;
  g['window'] = fakeWindow;
  g['MutationObserver'] = FakeObserver;
  if (options.idle === false) {
    g['requestIdleCallback'] = undefined;
    const realSetTimeout = saved['setTimeout'] as typeof setTimeout;
    g['setTimeout'] = ((run: () => void, delay: number) => {
      if (delay === 3000) {
        timerCalls.push({ delay, run });
        return 0 as unknown as NodeJS.Timeout;
      }
      return realSetTimeout(run, delay) as unknown as NodeJS.Timeout;
    }) as unknown;
  } else {
    g['requestIdleCallback'] = (callback: () => void): number => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    };
  }
  if (options.saveData) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { connection: { saveData: true } },
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }

  return {
    appended,
    dataset,
    setHasTag: (value: boolean): void => {
      hasTag = value;
    },
    fireObserver: (): void => {
      for (const callback of observerCallbacks) callback();
    },
    observerCount: (): number => observerInstances,
    observerDisconnected: (): boolean => observerDisconnected,
    runIdle: (): void => {
      for (const callback of idleCallbacks) callback();
      for (const timer of timerCalls) timer.run();
    },
    window: fakeWindow,
    restore: (): void => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete g[key];
        } else {
          g[key] = value;
        }
      }
      if (navigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
      } else {
        delete g['navigator'];
      }
    },
  };
}

async function evaluateLoader(): Promise<void> {
  importCounter += 1;
  const file = await loaderBundle();
  await import(`${pathToFileURL(file).href}?shim=${importCounter}`);
}

function scripts(harness: Harness): FakeScript[] {
  return harness.appended.filter((element): element is FakeScript => element.kind === 'script');
}

function prefetches(harness: Harness): FakeLink[] {
  return harness.appended.filter(
    (element): element is FakeLink =>
      element.kind === 'link' && element.attrs['data-3dweb-prefetch'] === 'bundle',
  );
}

test('loads the bundle immediately when a listing tag is present', async () => {
  // Arrange
  const harness = installHarness({ hasTag: true });

  try {
    // Act
    await evaluateLoader();

    // Assert
    const loaded = scripts(harness);
    assert.equal(loaded.length, 1);
    assert.equal((loaded[0] as unknown as Record<string, unknown>)['src'], DIST_BUNDLE);
    assert.equal(harness.window['__3DWEB_ESM_URL__'], DIST_ESM);
    assert.equal(prefetches(harness).length, 0);
    assert.equal(harness.observerCount(), 0);
  } finally {
    harness.restore();
  }
});

test('defers execution and prefetches on idle when no tags exist', async () => {
  // Arrange
  const harness = installHarness({ hasTag: false });

  try {
    // Act
    await evaluateLoader();

    // Assert: no bundle execution yet, observer armed for late tags.
    assert.equal(scripts(harness).length, 0);
    assert.equal(harness.observerCount(), 1);

    // Act: run the captured idle callback.
    harness.runIdle();

    // Assert: fetch-without-execute only.
    const links = prefetches(harness);
    assert.equal(links.length, 1);
    assert.equal(links[0].attrs['href'], DIST_BUNDLE);
    assert.equal(scripts(harness).length, 0);
  } finally {
    harness.restore();
  }
});

test('loads the bundle and disconnects when a late tag appears', async () => {
  // Arrange
  const harness = installHarness({ hasTag: false });

  try {
    await evaluateLoader();
    assert.equal(scripts(harness).length, 0);

    // Act
    harness.setHasTag(true);
    harness.fireObserver();

    // Assert
    const loaded = scripts(harness);
    assert.equal(loaded.length, 1);
    assert.equal((loaded[0] as unknown as Record<string, unknown>)['src'], DIST_BUNDLE);
    assert.equal(harness.observerDisconnected(), true);
  } finally {
    harness.restore();
  }
});

test('skips idle prefetch on Save-Data but still observes for tags', async () => {
  // Arrange
  const harness = installHarness({ hasTag: false, saveData: true });

  try {
    // Act
    await evaluateLoader();
    harness.runIdle();

    // Assert
    assert.equal(prefetches(harness).length, 0);
    assert.equal(scripts(harness).length, 0);
    assert.equal(harness.observerCount(), 1);
  } finally {
    harness.restore();
  }
});

test('falls back to the timer when requestIdleCallback is unavailable', async () => {
  // Arrange
  const harness = installHarness({ hasTag: false, idle: false });

  try {
    // Act
    await evaluateLoader();
    assert.equal(scripts(harness).length, 0);
    harness.runIdle();

    // Assert
    const links = prefetches(harness);
    assert.equal(links.length, 1);
    assert.equal(links[0].attrs['href'], DIST_BUNDLE);
  } finally {
    harness.restore();
  }
});

test('preview query selects the snapshot bundle and flags the document', async () => {
  // Arrange
  const harness = installHarness({ hasTag: true, search: '?preview=feature-x' });
  const messages: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown): void => {
    messages.push(String(message));
  };

  try {
    // Act
    await evaluateLoader();

    // Assert
    const loaded = scripts(harness);
    assert.equal(loaded.length, 1);
    assert.equal(
      (loaded[0] as unknown as Record<string, unknown>)['src'],
      'https://example.test/preview/feature-x/bundle.js',
    );
    assert.equal(
      harness.window['__3DWEB_ESM_URL__'],
      'https://example.test/preview/feature-x/bundle.esm.js',
    );
    assert.equal(harness.dataset['preview'], 'feature-x');
    assert.ok(messages.some((message) => message.includes('feature-x')));
  } finally {
    console.info = originalInfo;
    harness.restore();
  }
});

test('duplicate loader evaluations load the bundle only once', async () => {
  // Arrange
  const harness = installHarness({ hasTag: true });

  try {
    // Act
    await evaluateLoader();
    await evaluateLoader();

    // Assert
    assert.equal(scripts(harness).length, 1);
  } finally {
    harness.restore();
  }
});

test('bundle entry only warms the details overlay when modal elements exist', async () => {
  // Arrange
  const entry = await readFile('src/index.tsx', 'utf8');

  // Act / Assert: warm is gated, and standalone cards count as modal-capable.
  assert.match(entry, /if \(hasModalCapableElement\(document\)\) warmDetailsOverlay\(\);/);
  assert.match(entry, /LISTING_CARD_TAG/);
  assert.match(
    entry,
    /PROPERTY_LISTINGS_TAG\},\s*\$\{LISTING_GRID_TAG\},\s*\$\{LISTING_CARD_TAG\}/,
  );
});

test('loader source keeps its shim and safety markers', async () => {
  // Arrange
  const loader = await readFile('src/loader.ts', 'utf8');

  // Act / Assert
  assert.match(loader, /TAG_SELECTOR/);
  assert.match(
    loader,
    /property-listings,listing-grid,listing-card,listing-filters,listing-details/,
  );
  assert.match(loader, /__3DWEB_LOADER__/);
  assert.match(loader, /rel.*prefetch|prefetch.*rel/);
  assert.match(loader, /saveData/);
  assert.match(loader, /observer\.disconnect\(\)/);
  assert.match(loader, /requestIdleCallback/);
});
