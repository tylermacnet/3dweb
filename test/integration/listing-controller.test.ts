import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import type { Listing } from '../../src/domain/listing.ts';
import type { DetailsDialog } from '../../src/ports/details-dialog.ts';
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

const listingWithArea: Listing = {
  id: 'listing-2',
  address: {
    line1: '2 Main Street',
    line2: '',
    city: 'Moncton',
    postalCode: 'E1C 1A1',
    fsa: 'E1C',
    regionId: 'GMA',
    regionName: 'Greater Moncton',
    areaName: 'Moncton Central / Downtown',
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

async function loadController(): Promise<
  typeof import('../../src/application/listing-controller.ts')
> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-controller-'));
  const outputFile = join(temporaryDirectory, 'listing-controller.js');

  await build({
    entryPoints: ['src/application/listing-controller.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputFile,
  });

  const controllerModule = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);
  await rm(temporaryDirectory, { recursive: true, force: true });
  return controllerModule;
}

test('transitions from loading to ready and exposes filtered listings', async () => {
  const { ListingController } = await loadController();
  const host = new TestHost();
  const response = deferred<readonly Listing[]>();
  const feed: ListingFeed = { getListings: async () => response.promise };
  const controller = new ListingController(host);

  controller.configure(feed, undefined);
  const load = controller.loadListings();
  assert.equal(controller.state, 'loading');
  response.resolve([listing]);
  await load;

  assert.equal(controller.state, 'ready');
  assert.deepEqual(controller.visibleListings, [listing]);
});

test('transitions to an explicit empty state for an empty feed', async () => {
  const { ListingController } = await loadController();
  const controller = new ListingController(new TestHost());
  controller.configure({ getListings: async () => [] }, undefined);

  await controller.loadListings();

  assert.equal(controller.state, 'empty');
  assert.deepEqual(controller.visibleListings, []);
});

test('retains an actionable error and retries through the feed port', async () => {
  const { ListingController } = await loadController();
  const host = new TestHost();
  let attempts = 0;
  const controller = new ListingController(host);
  controller.configure(
    {
      getListings: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('Feed unavailable');
        return [listing];
      },
    },
    undefined,
  );

  await controller.loadListings();
  assert.equal(controller.state, 'error');
  assert.equal(controller.errorMessage, 'Feed unavailable');

  await controller.retry();
  assert.equal(controller.state, 'ready');
  assert.equal(attempts, 2);
});

test('ignores a stale request after a newer request completes', async () => {
  const { ListingController } = await loadController();
  const first = deferred<readonly Listing[]>();
  const second = deferred<readonly Listing[]>();
  let request = 0;
  const controller = new ListingController(new TestHost());
  controller.configure(
    {
      getListings: async () => {
        request += 1;
        return request === 1 ? first.promise : second.promise;
      },
    },
    undefined,
  );

  const firstLoad = controller.loadListings();
  const secondLoad = controller.loadListings();
  second.resolve([]);
  await secondLoad;
  first.resolve([listing]);
  await firstLoad;

  assert.equal(controller.state, 'empty');
  assert.deepEqual(controller.visibleListings, []);
});

test('exposes location groups after loading listings', async () => {
  const { ListingController } = await loadController();
  const host = new TestHost();
  const response = deferred<readonly Listing[]>();
  const feed: ListingFeed = { getListings: async () => response.promise };
  const controller = new ListingController(host);

  controller.configure(feed, undefined);
  const load = controller.loadListings();
  response.resolve([listingWithArea]);
  await load;

  assert.equal(controller.locationGroups.length > 0, true);
  assert.equal(controller.locationGroups[0].regionId, 'ALL');
});

test('exposes empty location groups for an empty feed', async () => {
  const { ListingController } = await loadController();
  const controller = new ListingController(new TestHost());
  controller.configure({ getListings: async () => [] }, undefined);

  await controller.loadListings();

  assert.deepEqual(controller.locationGroups, [
    {
      regionId: 'ALL',
      regionName: 'All Locations',
      options: [{ value: 'ALL', label: 'All Locations (0)', count: 0 }],
    },
  ]);
});

test('opens details through the details dialog port', async () => {
  const { ListingController } = await loadController();
  let opened: Listing | undefined;
  const dialog: DetailsDialog = {
    open: (value) => {
      opened = value;
    },
    close: () => undefined,
  };
  const controller = new ListingController(new TestHost());

  controller.configure(undefined, dialog);
  controller.openDetails(listing);

  assert.equal(opened, listing);
});
