import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import type { Listing } from '../../src/domain/listing.ts';
import type { ListingFeed } from '../../src/ports/listing-feed.ts';

class TestHost {
  updates = 0;

  addController(): void {}

  requestUpdate(): void {
    this.updates += 1;
  }
}

const listing: Listing = {
  id: 'listing-1',
  address: {
    line1: '1 Main Street',
    line2: '',
    city: 'Moncton',
    postalCode: 'E1C 1A1',
    fsa: 'E1C',
    regionId: 'GMA',
    regionName: 'Greater Moncton',
    areaName: 'Moncton',
  },
  bedroomCount: 1,
  bathroomCount: 1,
  rent: 1000,
  primaryImage: '',
  hook: '',
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

async function loadLoader(): Promise<
  typeof import('../../src/application/listing-feed-loader.ts')
> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-loader-'));
  const outputFile = join(temporaryDirectory, 'listing-feed-loader.js');

  await build({
    entryPoints: ['src/application/listing-feed-loader.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputFile,
  });

  const loaderModule = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  return loaderModule;
}

test('loads the feed into a ready state carrying its listings', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const host = new TestHost();
  const response = deferred<readonly Listing[]>();
  const feed: ListingFeed = { getListings: async () => response.promise };
  const loader = new ListingFeedLoader(host);
  loader.setFeed(feed);

  const load = loader.load();
  assert.equal(loader.loadState.kind, 'loading');
  response.resolve([listing]);
  await load;

  assert.deepEqual(loader.loadState, { kind: 'ready', listings: [listing] });
});

test('transitions to an explicit empty state for an empty feed', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const loader = new ListingFeedLoader(new TestHost());
  loader.setFeed({ getListings: async () => [] });

  await loader.load();

  assert.equal(loader.loadState.kind, 'empty');
});

test('retains an actionable error and retries through the feed port', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const host = new TestHost();
  let attempts = 0;
  const loader = new ListingFeedLoader(host);
  loader.setFeed({
    getListings: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Feed unavailable');
      return [listing];
    },
  });

  await loader.load();
  assert.deepEqual(loader.loadState, { kind: 'error', message: 'Feed unavailable' });

  await loader.retry();
  assert.deepEqual(loader.loadState, { kind: 'ready', listings: [listing] });
  assert.equal(attempts, 2);
});

test('ignores a stale request after a newer request completes', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const first = deferred<readonly Listing[]>();
  const second = deferred<readonly Listing[]>();
  let request = 0;
  const loader = new ListingFeedLoader(new TestHost());
  loader.setFeed({
    getListings: async () => {
      request += 1;
      return request === 1 ? first.promise : second.promise;
    },
  });

  const firstLoad = loader.load();
  const secondLoad = loader.load();
  second.resolve([]);
  await secondLoad;
  first.resolve([listing]);
  await firstLoad;

  assert.equal(loader.loadState.kind, 'empty');
});

test('ignores a stale request that rejects after a newer request completes', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const first = deferred<readonly Listing[]>();
  const second = deferred<readonly Listing[]>();
  let request = 0;
  const loader = new ListingFeedLoader(new TestHost());
  loader.setFeed({
    getListings: async () => {
      request += 1;
      if (request === 1) {
        return first.promise.then(() => {
          throw new Error('Stale feed error');
        });
      }
      return second.promise;
    },
  });

  const firstLoad = loader.load();
  const secondLoad = loader.load();
  second.resolve([]);
  await secondLoad;
  first.resolve([]);
  await firstLoad;

  assert.equal(loader.loadState.kind, 'empty');
});

test('does nothing when no feed is configured', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const loader = new ListingFeedLoader(new TestHost());

  await loader.load();

  assert.equal(loader.loadState.kind, 'idle');
});

test('swapping the feed cancels the in-flight request and returns to idle', async () => {
  const { ListingFeedLoader } = await loadLoader();
  const first = deferred<readonly Listing[]>();
  let aborted = false;
  const loader = new ListingFeedLoader(new TestHost());
  loader.setFeed({
    getListings: async (signal) => {
      signal?.addEventListener(
        'abort',
        () => {
          aborted = true;
        },
        { once: true },
      );
      return first.promise;
    },
  });

  const load = loader.load();
  first.resolve([listing]);
  loader.setFeed({ getListings: async () => [listing] });
  await load;

  assert.equal(aborted, true);
  assert.equal(loader.loadState.kind, 'idle');
});
