/**
 * Universal bundle loader for 3D Property Listings embeds.
 *
 * Any site loads exactly one script and zero page-specific logic:
 *
 * ```html
 * <script defer src="https://tylermacnet.github.io/3dweb/dist/loader.js"></script>
 * <property-listings></property-listings>
 * ```
 *
 * Behavior: production bundle (`dist/`) by default; `?preview=<ref>` loads a
 * same-origin preview snapshot (`preview/<ref>/`). Unknown or expired refs
 * fall back to production. Bundle URLs resolve against this script's own
 * location, so the loader works unchanged on any domain. Only the flat-ref
 * pattern gates what loads — origins can never vary by construction.
 */
(function () {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  function flatRef(raw: string): string {
    var flat = raw
      .replace(/\//g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .slice(0, 64);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(flat) || flat === 'main') {
      return '';
    }
    return flat;
  }

  function scriptBase(): string {
    var current = document.currentScript as HTMLScriptElement | null;
    if (current && current.src) {
      return new URL('.', current.src).href;
    }
    return document.baseURI;
  }

  // Site root holding `dist/` (and `preview/` on the Pages site).
  var root = new URL('../', scriptBase());
  var ref = flatRef(new URLSearchParams(window.location.search).get('preview') || '');

  function distFile(file: string): string {
    return new URL('dist/' + file, root).href;
  }

  function bundleFile(file: string): string {
    var url = new URL((ref ? 'preview/' + ref + '/' : 'dist/') + file, root);
    if (url.origin !== root.origin) {
      return distFile(file);
    }
    return url.href;
  }

  function loadClassic(src: string, onError?: () => void): void {
    var el = document.createElement('script');
    el.async = false;
    el.defer = true;
    el.src = src;
    if (onError) {
      el.addEventListener('error', onError, { once: true });
    }
    document.head.appendChild(el);
  }

  var w = window as unknown as { __3DWEB_ESM_URL__?: string };
  if (ref) {
    document.documentElement.dataset.preview = ref;
    console.info('[3dweb] preview bundle: ' + ref);
    w.__3DWEB_ESM_URL__ = bundleFile('bundle.esm.js');
    loadClassic(bundleFile('bundle.js'), function () {
      w.__3DWEB_ESM_URL__ = distFile('bundle.esm.js');
      loadClassic(distFile('bundle.js'));
    });
  } else {
    w.__3DWEB_ESM_URL__ = distFile('bundle.esm.js');
    loadClassic(distFile('bundle.js'));
  }
})();
