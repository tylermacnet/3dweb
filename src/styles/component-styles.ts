import { unsafeCSS, type CSSResult } from 'lit';

/**
 * Trust boundary: `cssTexts` must only ever be first-party `.css` source files
 * bundled at build time (esbuild `css:text` loader). Never pass runtime, user,
 * or feed-derived strings here — they would bypass Lit's CSS sanitization
 * guarantees. This is the only `unsafeCSS` call site in the project.
 */
export function componentStyles(...cssTexts: string[]): CSSResult[] {
  return cssTexts.map((cssText) => unsafeCSS(cssText));
}
