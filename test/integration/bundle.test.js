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
  assert.match(indexHtml, /window\.location\.protocol === 'file:'/);
  assert.match(indexHtml, /live feed[\s\S]*HTTP\(S\) origin/);
  assert.doesNotMatch(indexHtml, /src\/.*\.(?:ts|tsx)/);
  assert.doesNotMatch(indexHtml, /<script[^>]+src="[^"]*(?:watch|dev|serve)/i);
});

test('host page stays a lean example and delegates loading to dist/loader.js', async () => {
  const indexHtml = await readFile('public/index.html', 'utf8');

  assert.match(indexHtml, /<script defer src="\.\/dist\/loader\.js"><\/script>/);
  // The staging ESM import follows the loader's selection with a dist fallback.
  assert.match(indexHtml, /__3DWEB_ESM_URL__/);
  assert.match(indexHtml, /await import\(__previewEsm\)\.catch/);
  // No loader logic of its own: no preview parsing, no script injection.
  assert.doesNotMatch(indexHtml, /get\('preview'\)/);
  assert.doesNotMatch(indexHtml, /document\.createElement\('script'\)/);
  assert.doesNotMatch(indexHtml, /flatRef/);
});

test('universal loader resolves production by default and previews by query', async () => {
  const loader = await readFile('src/loader.ts', 'utf8');

  // Base is the loader's own location, so it works unchanged on any site.
  assert.match(loader, /document\.currentScript/);
  // Production default resolves to the sibling dist bundle.
  assert.match(loader, /__3DWEB_ESM_URL__/);
  assert.match(loader, /'dist\/' \+ file/);
  // `?preview=<ref>` selects a same-origin snapshot; anything else falls back.
  assert.match(loader, /get\('preview'\)/);
  assert.match(loader, /'preview\/' \+ ref \+ '\/'/);
  assert.match(loader, /flat === 'main'/);
  assert.match(loader, /A-Za-z0-9\._-/);
  assert.match(loader, /dataset\.preview/);
  // Preview failure falls back to production for both classic and ESM.
  assert.match(loader, /distFile\('bundle\.esm\.js'\)/);
  // The loader builds document-relative URLs only — never an external origin.
  // (Strip comments first: the docblock shows an example Pages URL.)
  const code = loader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  assert.doesNotMatch(code, /https?:\/\//);
});
