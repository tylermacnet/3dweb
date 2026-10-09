# 3dweb — Property Listings Embed (internal)

Internal tool. Source is publicly viewable for transparency; all rights reserved, no reuse or redistribution (see `LICENSE`).

## Usage

Embed on any site with the universal loader (production bundle served from GitHub Pages):

```html
<script defer src="https://tylermacnet.github.io/3dweb/dist/loader.js"></script>
<property-listings></property-listings>
```

Put the script tag in the site-wide `<head>` — it is a dependency-free shim
that stays idle on pages without listing elements (no bundle execution, no
feed fetch, no modal) and only queues a low-priority bundle `prefetch` off
the critical path, so listing pages usually hit the HTTP cache.

Composable primitives (same bundle, shared per-document store):

```html
<listing-filters></listing-filters> <listing-grid view="card"></listing-grid>
<!-- card | compact | list -->
<listing-card></listing-card>
<listing-details listing-id="..."></listing-details>
```

Branch previews: append `?preview=<branch>` (branch snapshots under `preview/<ref>/`; default is production `main`).

The demo host page `public/index.html` is the canonical embed example. `public/dev.html` (static sample), `public/test.html` (frozen baseline), and `public/migration.html` (historical report) are internal-only.

## Contributing

Solo GitHub Flow, no pull requests. Full workflow lives in `docs/DEVELOPMENT.md`; agent rules in `AGENTS.md`.

```text
mise trust            # one-time per checkout
mise install          # toolchain + deps
mise run dev          # local dev host
mise run check        # format → lint → type → test → build (required gate)
```

Branching: cut any short kebab branch off `main`, `git rebase` onto `origin/main`, merge locally (squash default), delete the branch. Releases are `v*` tags on `main`; regenerate `CHANGELOG.md` with the tag commit.

Docs: `docs/DEVELOPMENT.md` (workflow, architecture, policies), `docs/STYLE_GUIDE.md` (tokens, layout, a11y), `docs/ROADMAP.md` (deferred work). Historical migration record: `docs/archive/MIGRATION_PLAN.md`.
