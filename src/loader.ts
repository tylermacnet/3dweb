/**
 * Universal bundle loader for 3D Property Listings embeds.
 *
 * Any site loads exactly one script in the universal head and zero
 * page-specific logic:
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
 *
 * Resource discipline (universal-head safe): the shim itself is dependency
 * free and does nothing when no listing element exists — no bundle execute,
 * no feed fetch, no modal mount, no preconnect. Tags present at evaluation
 * load the bundle immediately; tags added later are caught by a one-shot
 * observer that disconnects after loading. Off the critical path the shim
 * queues a low-priority `prefetch` for the bundle (skipped on Save-Data) so
 * a later listing page usually hits the HTTP cache — prefetch fetches but
 * never executes.
 */
(function () {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  var w = window as unknown as {
    __3DWEB_ESM_URL__?: string;
    __3DWEB_LOADER__?: boolean;
  };
  // First writer wins so duplicate loader tags never double-load the bundle.
  if (w.__3DWEB_LOADER__) {
    return;
  }
  w.__3DWEB_LOADER__ = true;

  var TAG_SELECTOR = 'property-listings,listing-grid,listing-card,listing-filters,listing-details';

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

  var bundleLoaded = false;
  var prefetchQueued = false;
  var observer: MutationObserver | null = null;

  function setEsmUrl(href: string): void {
    w.__3DWEB_ESM_URL__ = href;
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

  function ensureBundle(): void {
    if (bundleLoaded) {
      return;
    }
    bundleLoaded = true;
    if (observer) {
      try {
        observer.disconnect();
      } catch {
        // ignore disconnect failures; the loaded flag already gates reloads
      }
      observer = null;
    }
    if (ref) {
      setEsmUrl(bundleFile('bundle.esm.js'));
      loadClassic(bundleFile('bundle.js'), function () {
        setEsmUrl(distFile('bundle.esm.js'));
        loadClassic(distFile('bundle.js'));
      });
    } else {
      setEsmUrl(distFile('bundle.esm.js'));
      loadClassic(distFile('bundle.js'));
    }
  }

  function hasListingTag(): boolean {
    try {
      return document.querySelector(TAG_SELECTOR) !== null;
    } catch {
      return false;
    }
  }

  function isSaveData(): boolean {
    try {
      var nav = (typeof navigator !== 'undefined' ? navigator : undefined) as
        (Navigator & { connection?: { saveData?: boolean } }) | undefined;
      return nav?.connection?.saveData === true;
    } catch {
      return false;
    }
  }

  // Best-effort fetch-without-execute so a later listing page hits the cache.
  function prefetchBundle(): void {
    if (bundleLoaded || prefetchQueued) {
      return;
    }
    var href: string;
    try {
      href = bundleFile('bundle.js');
    } catch {
      return;
    }
    try {
      var existing = document.querySelectorAll('link[rel="prefetch"]');
      for (var i = 0; i < existing.length; i++) {
        var candidate = existing[i] as HTMLLinkElement;
        if (candidate.getAttribute('href') === href || candidate.href === href) {
          prefetchQueued = true;
          return;
        }
      }
    } catch {
      // fall through to queueing below
    }
    try {
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.setAttribute('as', 'script');
      link.setAttribute('href', href);
      link.setAttribute('data-3dweb-prefetch', 'bundle');
      document.head.appendChild(link);
      prefetchQueued = true;
    } catch {
      // prefetch is advisory; a listing page cold-loads when it fails
    }
  }

  function scheduleIdlePrefetch(): void {
    if (bundleLoaded || prefetchQueued || isSaveData()) {
      return;
    }
    var run = function (): void {
      prefetchBundle();
    };
    try {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () {
          run();
        });
        return;
      }
    } catch {
      // fall through to the timer below
    }
    try {
      globalThis.setTimeout(run, 3000);
    } catch {
      // no scheduler available; listing pages cold-load on demand
    }
  }

  function watchForTags(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    try {
      observer = new MutationObserver(function () {
        if (hasListingTag()) {
          ensureBundle();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      observer = null;
    }
  }

  if (ref) {
    try {
      document.documentElement.dataset.preview = ref;
    } catch {
      // dataset is advisory only
    }
    try {
      console.info('[3dweb] preview bundle: ' + ref);
    } catch {
      // logging is advisory only
    }
  }

  if (hasListingTag()) {
    ensureBundle();
    return;
  }
  watchForTags();
  scheduleIdlePrefetch();
})();
