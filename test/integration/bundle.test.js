import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('esbuild bundles the web component and CSS', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), '3dweb-'));
  const outputFile = join(temporaryDirectory, 'bundle.js');

  try {
    await build({
      entryPoints: ['src/index.tsx'],
      bundle: true,
      format: 'iife',
      target: 'es2022',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });

    const bundle = await readFile(outputFile, 'utf8');
    assert.match(bundle, /customElements\.define\("property-listings"/);
    assert.match(bundle, /customElements\.define\("listing-card"/);
    assert.match(bundle, /customElements\.define\("listing-filters"/);
    assert.match(bundle, /customElements\.define\("listing-details"/);
    assert.match(bundle, /Property listing/);
    assert.match(bundle, /box-shadow/);
    assert.match(bundle, /showPopover/);
    assert.match(bundle, /hidePopover/);
    assert.match(bundle, /popover/);
    assert.match(bundle, /prefetch/);
    assert.match(bundle, /fetchpriority/);
    assert.doesNotMatch(bundle, /showModal|closedby/);
    assert.doesNotMatch(bundle, /phase-five-harness/);
    assert.doesNotMatch(bundle, /DetailsDialog|BrowserDetailsDialog|formatDialogTitle/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('host page mounts the property-listings web component', async () => {
  const indexHtml = await readFile('public/index.html', 'utf8');

  assert.match(indexHtml, /<property-listings><\/property-listings>/);
  assert.match(indexHtml, /src="\.\/dist\/bundle\.js"/);
  assert.match(indexHtml, /href="\.\/migration\.html"/);
  assert.match(indexHtml, /window\.location\.protocol === 'file:'/);
  assert.match(indexHtml, /live feed[\s\S]*HTTP\(S\) origin/);
  assert.doesNotMatch(indexHtml, /src\/.*\.(?:ts|tsx)/);
  assert.doesNotMatch(indexHtml, /<script[^>]+src="[^"]*(?:watch|dev|serve)/i);
});

test('migration report is a static page', async () => {
  const migrationHtml = await readFile('public/migration.html', 'utf8');

  assert.match(migrationHtml, /<h1>Migration report<\/h1>/);
  assert.match(migrationHtml, /Phases 1–9 are complete/);
  assert.match(migrationHtml, /Phase 7 review evidence/);
  assert.match(migrationHtml, /Phase 8 review evidence/);
  assert.doesNotMatch(migrationHtml, /<migration-progress>/);
});
