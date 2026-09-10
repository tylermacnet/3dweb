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
      format: 'esm',
      target: 'es2022',
      loader: { '.css': 'text' },
      outfile: outputFile,
    });

    const bundle = await readFile(outputFile, 'utf8');
    assert.match(bundle, /customElements\.define\("listing-card"/);
    assert.match(bundle, /Property listing/);
    assert.match(bundle, /box-shadow/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
