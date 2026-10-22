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

The demo host page `public/index.html` is the canonical embed example. `public/dev.html` is a static sample generated from `dev.template.html` and the sample feed; never commit the generated output.

## Contributing

GitHub Flow, PR-gated: branch, push, open a pull request, wait for the `check` workflow, then squash-merge — never push to `main`. Full workflow lives in `docs/DEVELOPMENT.md`; agent rules in `AGENTS.md`.

```text
mise trust            # one-time per checkout
mise install          # toolchain (deps install automatically before tasks)
mise generate git-pre-commit --write --task=pre-commit  # one-time per checkout
mise run dev          # local dev host
mise run check        # lint + type + test + build in parallel (required gate; tree must already be formatted)
```

Docs: `docs/DEVELOPMENT.md` (workflow, architecture, releases, policies), `docs/STYLE_GUIDE.md` (tokens, layout, a11y), and `docs/ROADMAP.md` (deferred work).
