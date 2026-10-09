# 3D Property Listings Style Guide

This guide documents the visual language shown in the supplied production screenshot. It
separates the host site's chrome from the property-listings web component so the component can
be embedded in another production page without requiring the host navigation or hero.

## Visual Direction

The host shell presents a dark branded sidebar and logo beside the property listings area. The
listing page has freedom to evolve visually; it should remain practical, readable, responsive, and
visually compatible with the host brand without copying the host shell.

The host shell visible in the screenshot owns:

- Dark textured sidebar and brand logo
- Primary navigation and icon treatment

- Filter toolbar
- Result count
- Responsive listing grid
- Listing cards
- Loading, empty, and error states

Do not make the reusable component depend on the host sidebar, logo, hero asset, navigation, or
global page layout.

## Color Tokens

Use these tokens as CSS custom properties at the component boundary. The values match the visual relationships in the screenshot.

| Token                      | Value     | Usage                                                                                                                                                          |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--sc-brand-primary`       | `#0284c7` | Links, range thumb, active controls, focus rings                                                                                                               |
| `--sc-brand-primary-hover` | `#0369a1` | Hover and pressed interactive states                                                                                                                           |
| `--sc-brand-text`          | `#0369a1` | Small text: location, rent, price output (5.93:1 on white; intentionally deeper than legacy `#0284c7`, which measures 4.10:1 and fails WCAG AA for small text) |
| `--sc-brand-deep`          | `#0f2c59` | Primary dark actions and brand authority                                                                                                                       |
| `--sc-surface-bg`          | `#ffffff` | Cards, controls, and main content surfaces                                                                                                                     |
| `--sc-surface-alt`         | `#f8fafc` | Filter panel, card footer, muted backgrounds                                                                                                                   |
| `--sc-border-color`        | `#cbd5e1` | Form controls and visible component boundaries                                                                                                                 |
| `--sc-border-light`        | `#e2e8f0` | Low-emphasis separators and card borders                                                                                                                       |
| `--sc-text-main`           | `#0f172a` | Headings and primary content                                                                                                                                   |
| `--sc-text-label`          | `#475569` | Form labels and secondary labels                                                                                                                               |
| `--sc-text-muted`          | `#64748b` | Result counts and supporting copy                                                                                                                              |
| `--sc-state-danger`        | `#ef4444` | Reset hover or destructive feedback                                                                                                                            |
| `--sc-state-danger-bg`     | `#fef2f2` | Destructive hover background                                                                                                                                   |

The host shell may use a darker charcoal/navy palette independently. Avoid leaking host-shell
styles into the shadow DOM of the listings components.

## Host Logo and Sidebar Palette

These tokens describe only the host site's logo and dark sidebar shown in the reference screenshot.
They belong to the production host, not to the reusable listing-page components.

| Token                    | Value              | Usage                                           |
| ------------------------ | ------------------ | ----------------------------------------------- |
| `--host-sidebar-bg`      | `#222222`          | Sidebar base and dark structural canvas         |
| `--host-sidebar-overlay` | `rgb(0 0 0 / 30%)` | Navigation grouping and subdued sidebar panels  |
| `--host-logo-navy`       | `#0f2c59`          | Logo primary authority and dark logo segments   |
| `--host-logo-blue`       | `#1d4ed8`          | Logo inner blue accent                          |
| `--host-logo-sky`        | `#0284c7`          | Logo outer blue accent                          |
| `--host-sidebar-active`  | `#38bdf8`          | Optional active or focused navigation treatment |
| `--host-sidebar-text`    | `#ffffff`          | Primary navigation labels and logo text         |
| `--host-sidebar-muted`   | `#9a9a9a`          | Secondary sidebar labels and supporting text    |
| `--host-sidebar-line`    | `#333333`          | Navigation separators and subtle borders        |

### Logo and Sidebar Treatment

The logo combines navy, blue, sky, and white against a dark textured sidebar. Preserve generous
clear space around the logo and keep it visually dominant at the top of the sidebar. The host
implementation constrains the logo to approximately `270px` maximum width on large screens and
reduces it at narrower breakpoints. Texture should remain subtle and never compete with navigation
labels.

Sidebar navigation is vertically stacked with generous row height, strong icon silhouettes, and
uppercase condensed labels. The host shell is approximately `310px` wide on desktop. Use subtle
separators, preserve keyboard focus visibility, and ensure active navigation is communicated by
more than color alone.

- Use `--host-sidebar-bg` as the sidebar foundation.
- Use `--host-sidebar-overlay` for grouped or secondary navigation surfaces.
- Use the three logo tokens for artwork, not for small navigation text.
- Use `--host-sidebar-text` for primary navigation labels.
- Use `--host-sidebar-muted` for supporting sidebar copy.
- Use `--host-sidebar-line` for separators instead of pure white borders.
- Use `--host-sidebar-active` for focus or selected states when contrast is sufficient.

The production host owns sidebar markup, logo assets, responsive behavior, and layout. Do not make
`property-listings` depend on those elements.

The host site currently loads Ubuntu for general UI text, Oswald Bold for large condensed headings,
Oswald ExtraLight for lighter condensed display text, and Crafty Girls for decorative quote text.
These fonts are host concerns; embedded listing components should retain a resilient system-font
stack unless the host explicitly opts into font inheritance.

## Typography

Use a system sans-serif stack for the embed:

```css
font-family:
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  sans-serif;
```

| Token                 | Value       | Usage                               |
| --------------------- | ----------- | ----------------------------------- |
| `--sc-font-size-xs`   | `0.6875rem` | Compact uppercase labels and badges |
| `--sc-font-size-sm`   | `0.8125rem` | Results, card metadata, controls    |
| `--sc-font-size-base` | `0.875rem`  | Form controls and body copy         |
| `--sc-font-size-lg`   | `1.125rem`  | Rent and prominent card metadata    |
| `--sc-font-size-xl`   | `1.25rem`   | Listing titles                      |

Use `font-weight: 700` for labels and important values. Listing addresses are the strongest card
text; supporting location, metadata, and hooks use muted slate. Keep uppercase labels letter-spaced
at approximately `0.05em`.

## Layout

The production screenshot uses a centered content column beside a fixed host sidebar. The
reusable component must not assume that sidebar exists.

Recommended component layout:

```text
property-listings
├── listing-filters
├── result status
└── listing grid
    └── listing-card
```

Use a full-width component root with a sensible maximum width supplied by the host page. The
listing grid uses:

- `grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr))`
- `gap: 1.25rem` on larger screens
- `gap: 1rem` on narrow screens
- A single column below the mobile breakpoint

Do not add page-level hero, sidebar, or navigation markup to `property-listings`.

## Filter Toolbar

The filter toolbar is a pale alternate surface with a light border, rounded corners, and compact
internal spacing:

- Background: `--sc-surface-alt`
- Border: `1px solid var(--sc-border-light)`
- Radius: `0.75rem`
- Desktop padding: `1rem`
- Desktop grid: adaptive columns with a minimum width of `11.25rem`
- Mobile grid: two columns
- Price range control: full row on mobile

Each control needs a visible, uppercase label and a minimum touch target of `2.75rem`. Selects
should remain full width and use the brand blue for focus and hover borders. The reset action is a
secondary outlined control, not a primary blue call to action.

The current filter policy is configured in `src/config/listing-filters.ts`; labels and ordering
must come from that configuration rather than being duplicated in templates.

## Listing Cards

Cards are white, bordered, and image-led:

- Border: `1px solid var(--sc-border-light)`
- Radius: `0.75rem`
- Overflow: hidden
- Image ratio: `16 / 10`
- Image: full width, `object-fit: cover`
- Hover: slight upward movement, soft shadow, and brand border

The card hierarchy is:

1. Property image (decorative; the card link provides the accessible name)
2. Address line one, strongly emphasized
3. Address line two, muted and secondary
4. Location in `--sc-brand-text` blue
5. Bedroom/bathroom metadata
6. Rent in `--sc-brand-text` blue
7. Optional description hook
8. Details action in the card footer (visual only; the whole card is one stretched link)

Reserve consistent title space so cards in the same row align even when one address has a second
line and another does not. Keep the single card link keyboard accessible with one tab stop per
card; the footer call-to-action is `aria-hidden` and must never be a separate control.

## Responsive Behavior

Responsive behavior must follow the screenshot's compact control pattern rather than simply
shrinking desktop controls:

- Desktop: adaptive filter columns and multi-column card grid
- Mobile: two filter columns
- Mobile: price range spans the full filter width
- Mobile: reset spans the full filter width
- Mobile: listing cards become one column
- Labels and controls remain readable without horizontal scrolling
- Touch targets remain at least `2.75rem` (slider thumbs at least `24px` per WCAG target-size minimum)

Use CSS media queries inside the component stylesheet, nested directly inside the affected
element's rule. Component-owned styles must be declared
by the owning Lit component with `componentStyles()` from `src/styles/component-styles.ts` (the
project's single `unsafeCSS` trust boundary for first-party build-time CSS) and bundled through
the single bundle entry; the bundle entry must not own presentation styles. See
`docs/DEVELOPMENT.md` for the native-nesting rules (`:host` boundary, flat internals, states and
responsive contexts only, max depth 3). The adapter-backed
details popover is the exception: it lives in light DOM, so `BrowserDetailsModal` owns
`src/adapters/browser-details-modal.css` and applies it via a constructed stylesheet. Its
stylesheet mirrors the tokens it needs under `:root` with literal `var()` fallbacks, because
`:host` tokens do not resolve outside shadow roots (unresolved tokens rendered the popover
transparent in an earlier attempt).

Shadow-DOM internals use short semantic class names without a prefix (the shadow boundary is
the namespace); the light-DOM popover keeps the `sc-` prefix, and `--sc-*` tokens are unchanged
as the public theming API.

## Accessibility

- Use semantic `section`, `fieldset`, `legend`, `label`, `output`, `ol`, and `li` elements where
  they represent the content structure.
- Keep the filter group discoverable as a search region with an accessible label.
- Associate every form control with a label. `listing-filters` omits `aria-controls`
  intentionally: cross-root `idref` would be invalid inside shadow DOM; wiring is
  via `listing-filters-changed` (composed/bubbles) + `ListingFilterStore`.
- Keep card interaction to a single stretched link per card so keyboard users get one tab stop;
  never intercept modified or non-primary clicks. Modal is gated by
  `pointer:fine` (capability) not viewport width — see `listing-card.ts:22`.
- Name the details popover from its visible listing title (`aria-labelledby`), not a generic label.
- Use `role="status"` and `aria-live` for changing result counts and loading states.
- Provide visible `:focus-visible` indicators with at least a `2px` outline and offset.
- Keep overlay motion short (at most `0.2s`, ease-out, opacity/transform only) and disable it
  entirely under `prefers-reduced-motion` (including any residual transform).
- Preserve readable contrast for all text and controls.
- Do not use color alone to communicate loading, empty, error, or active states.

## Implementation Boundaries

Production-facing custom elements are independent; there is no root component.
Each works standalone on an external site once the single bundle is loaded:

- `property-listings`: thin legacy shell (`listing-filters` + `listing-grid view="card"`)
- `listing-grid`: composable primitive with `view="card|compact|list"`, usable standalone
- `listing-filters`: filter controls and configured options, usable standalone
- `listing-card`: one listing presentation, usable standalone
- `listing-details`: standalone iframe-to-listing element accepting `listing-id` with a `src` override

Application behavior belongs in `src/application/`, not in a component:
`ListingStore` (per-`Document` singleton) drives feed loading through the `ListingFeed` port and
owns filter state, while safe defaults are assembled in
the bundle entry (`src/index.tsx`) and overridable per element. The browser details
experience is an adapter-backed popover modal, not a `property-modal` custom element. Shared
details concerns live in `src/config/application.ts`: the canonical details URL
(used by the card link, the adapter, and `listing-details`), the iframe-only
`hidenav` variant (enforced by `resolveDetailsIframeUrl()`), and the
location-prefixed popover title.

The host page owns surrounding branding and layout. Each component owns its internal presentation and
ships its styles through the single bundle; the bundle entry itself owns no styles.

For development workflow, command reference, and architecture constraints, see `AGENTS.md` and
`docs/DEVELOPMENT.md`. Within `.mise/tasks/*`, call bare binaries via `npx --no-install`; `mise`
provides them via `node_modules/.bin` on `PATH`.

## Address display policy

Address formatting and New Brunswick location resolution are domain policies, not presentation
concerns. The normalizer preserves a stable two-line representation and is idempotent for the
supported feed formats. Unknown or ambiguous location data is represented by the domain's
`OTHER` region; components must not guess a region or select a shared-FSA area themselves.
