---
version: alpha
name: Budget Pulse Watch â€” Merdeka
description: Dense internal procurement UI matching the captured Merdeka Services v2 template.
colors:
  primary: "#2563eb"
  background: "#ffffff"
  sidebar: "#f8fafc"
  text: "#182433"
  border: "#e2e8f0"
  muted: "#64748b"
typography:
  sans:
    fontFamily: "InterVariable, Inter, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "6px"
  card: "8px"
spacing:
  page: "24px"
  panel: "16px"
  section: "20px"
components:
  sidebar:
    width: "240px"
    collapsedWidth: "80px"
  control:
    height: "34px"
---

# Budget Pulse Watch design context

## Overview

Reference: user-provided `merdeka-frontend` skill, authenticated Merdeka Services v2,
Travel Request table pattern and request-detail panels. Explicit user approval on
2026-10-22 establishes visual fidelity as the direction. Register is internal product:
procurement/document-control users monitoring PRFs, budgets and operational status.
Existing English labels and Indonesian date/currency formatting remain authoritative.
No market expansion or translation is part of this work.

Approved rollout now covers authenticated shell, `/prf`, PRF detail, Dashboard,
Budget Overview and its create/edit dialogs, COA Management and Reports (Audit Log). Other page bodies and their workflows
retain the existing design pending later rollout.
Login now follows the separate captured Merdeka login composition. Avoid marketing hero treatments,
oversized controls, ornamental gradients, invented dashboard data, and mixed login/v2 themes.

## Runtime token ownership (Model B)

Unchanged captured CSS in `public/merdeka/` is canonical. `SHA256SUMS.json` records
its integrity. `scripts/generate-merdeka-css.cjs` generates
`src/styles/merdeka-vendor.generated.css`: selectors receive `mdka-v-` class
namespaces, relative asset URLs are rebased, and import/charset statements are
resolved. Declarations and palette values are preserved. This prevents Bootstrap
`!important` utilities such as `.p-6` and `.h-4` from overriding Tailwind classes.
Do not edit generated CSS or vendor assets directly.

`src/styles/merdeka.css` is the React layout/component adapter. Canonical tokens
flow through this adapter into shell, PRF table and detail classes. The shadcn HSL
primary alias mirrors `--mdka-blue-600`; verify it when changing palette sources.
Other existing global tokens remain owned by `src/index.css` and Tailwind.

| Role | Source | Runtime consumers |
|---|---|---|
| Action/focus | `--mdka-blue-600` / brand-600 | PRF primary buttons, sidebar selection, focus |
| Muted surface | `--mdka-gray-50` | sidebar, panel/table headers |
| Dividers | `--mdka-gray-200` | panels, table, footer |
| Text | `--tblr-body-color` | shell and detail |
| Type | captured InterVariable font files | shell, table, detail |
| Geometry | adapter CSS | 240/80 sidebar, 34px fields, 48px table rows |

## Typography and layout

Use local InterVariable/Inter, 13px body, 12px table/control text, 11px table
headers and field labels, 22px page headings. Source badges are compact pills.
Page padding is 24px desktop, 16px tablet, 12px phone. Panel borders and quiet
gray headers carry hierarchy. Controls have 6px radii; panels/dialogs 8px.
Shadows are restrained. No image/font network dependency is required.

Desktop sidebar is 240px expanded and 80px collapsed. MBM horizontal SVG is
164x45px, symbol 32x32px, decorative watermark opacity .06. Below 992px,
navigation becomes an accessible Radix Sheet. The table owns horizontal and
vertical overflow; selection, expansion, PRF number and actions remain sticky on desktop; on phones,
all columns scroll together to avoid overlapping frozen columns.
Filters reflow to two columns, with full-width search. Account width is 246px
desktop and avatar-only at narrow widths. Footer is secondary.

## Components and states

Keep existing Radix primitives for menus, selects, dialogs and mobile Sheet.
Use native semantic buttons/links/table. Existing outline Lucide icons align
with captured source SVG style; local Tabler webfont is also retained in assets.
Do not load Bootstrap/Select2 JS over React-owned state.

Buttons retain handler, permission, disabled, busy and error behavior. Loading
uses the existing spinner; no new skeleton. Filter/search, paging, selection,
item expansion and import/sync/edit/delete actions preserve their data paths.
Detail uses a neutral header, section panels, existing fields/documents and
sticky Close footer; Escape/focus restoration remain Radix-owned.

All clickable controls need visible focus and meaningful accessible labels.
Reduced motion removes animated transitions; forced colors preserve focus and
selection. Shared scrollbar styling keeps scrollable regions visible.
Light Merdeka surfaces are the accepted reference for this rollout; existing
dark tokens elsewhere are not reauthored or claimed verified.

## Verification

See `docs/merdeka-ui-rollout.md` for checks, evidence, limitations and commands.
Compare the captured Travel Request reference and a sibling page before
extending the rollout. Preserve vendor hashes and regenerate the adapter.


## Dashboard and Budget Overview continuation (2026-10-22)

The same captured v2 tokens now drive `.merdeka-overview`, `.merdeka-dashboard`,
`.merdeka-budget`, `.merdeka-budget-dialog` and portal-owned
`.merdeka-budget-popover`. No vendor declarations are edited. Portal surfaces
share the existing HSL adapter so their selected/hover states stay blue rather
than inheriting the earlier application's green accent.

Summary cards follow the source's 16px radius, quiet shadow, colored 52px icon
tile, light outer tint and small translucent corner detail. Body labels remain
12px, summary values 25px (currency values scale 16–23px), with tabular numerals.
Blue/green/amber/violet use canonical `--mdka-*` palette values. Chart and data
panels keep 8px borders/radius, gray headers and 14px section titles. Alert text
uses amber-700 for contrast while retaining amber decoration.

Dashboard presents PRF totals, real budget totals/utilization, recent PRFs and
existing alert links. The utilization ring derives from the same live dashboard
metric; only its visual fill is clamped to 0–100. Unavailable metrics use an em
dash, while a successful zero dataset remains zero. No map, sample activity or
fabricated trend is added to the application.

Budget Overview places filters, summary cards and utilization first, followed by
readiness, budget details and the retained cut-off/import controls. Tables own
their scroll regions; the document must not overflow horizontally. On phones,
cards stack and filter controls use two columns. Numeric fields, Indonesian IDR
formatting, HR / IT scope and CAPEX/OPEX definitions remain existing contracts.

Create/edit dialogs use source-style headers, compact fields and bordered inner
panels. Authored COA popup width matches its trigger and remains collision-bound.
Radix owns focus/keyboard behavior; controlled create returns focus to Create
Budget and controlled edit returns it to the budget table region. Internal
duplicate triggers are shown only for standalone/uncontrolled use.


## COA and Reports continuation (2026-10-22)

COA uses the shared MetricCard, source panel headers, compact table and Radix
menus/forms. All captured vendor assets stay unchanged. Page-local counts are
explicitly labeled; total accounts comes from server pagination. Scope controls
show the effective HR / IT and OPEX values while governed. Reports retains its
existing Audit Log scope, timestamps, actor, action and change payloads.

Both tables own overflow. The existing floating assistant has 100px clearance
beside pagination. Phone layout keeps the 390px document width, scrolls wide
tables locally and bounds dialogs to viewport width with internal vertical scroll.


## PRF filter and master-table refinement (2026-10-22)

Filters now starts collapsed on mount. A native heading button exposes expanded
state and controls the hidden filter body; controls stay mounted, so collapsing
does not reset applied search/filters. The heading shows the active-filter count,
including the default fiscal year. Keyboard Enter/Space works through the native
button, with visible focus and no height animation.

The table follows the captured Employee Master pattern: 12px header, quiet gray
hover, compact neutral item count below the PRF number, tinted 27x26 action buttons,
single-line status pills and a table-owned sticky header. Desktop retains frozen
selection/PRF/action columns with corrected offsets; below 992px columns scroll
together. All existing details/edit/delete/sync/selection/expansion handlers remain.


## Selected-item workspace / option C (2026-10-22)

User selected the tested option-C mockup for PRF Monitoring. Initial state uses
the full-width list with no item panel. Selecting a row or its keyboard-accessible
item button opens a single nonmodal panel; another selection replaces its data.
Close or Escape returns list width and focus to the initiating item button, with
the list region as fallback. Escape does not close the panel while a dialog/menu/
listbox owns the key. Panel identity is an ID resolved from current server results;
it closes when the selected record leaves the page/filter and does not hold a stale
record snapshot. Refresh/retry resolves item values from current data.

The previous expand-all capability becomes Show all items (grouped items for the
current page); Close items replaces Collapse all. Bulk checkbox selection remains
independent of the active panel row. A compact list column set is used beside the
panel, and All columns restores every existing field. Long descriptions show two
lines with the existing full-value title. Details/edit/delete/cloud/Pronto/bulk
handlers and permission gates are retained. No backend or OpenAPI contract changes.

PRFItemsPanel reuses a shared PRFItem type, existing status/currency/COA formatters
and the existing modification dialog/update handler. Item quantity, unit/total price,
part/cost code, PO/split, COA, year, pickup, notes and specifications remain available.
Secondary metadata is in native Details disclosures. Malformed legacy specification
text safely falls back to plain text. Status display retains existing parent-PRF
semantics. No mutation policy or currency conversion is introduced.

The list and item table scroll independently; page heading/filter and list toolbar
are compact. Desktop uses two columns from 1200px; narrower viewports stack the
panes with independent scroll regions. Item edit actions remain pinned at the right
edge. Existing portal dialogs remain Radix-owned. Login and other page layouts are
outside this slice. No commit or push.


## Login continuation (2026-10-22)

The user requested Merdeka login fidelity. Login uses the source 7:5 photo/form
split, 20px card radius, darkened BG_LOGIN photograph, three manually selected
source photographs, MBM branding and a white form. No automatic carousel motion.
Below 992px the photograph stacks above the form. Document scrolling keeps every
field/action reachable on short screens; no fixed-height clipping.

Login has a dedicated scoped adapter, src/styles/merdeka-login.css. Its login
tokens mirror archived Tabler PMS (#206bc4 primary, #667382 secondary, #182433
text, #dadfe5 border, #f6f8fb inputs, 4px controls). Canonical login assets/CSS
are archived unchanged in public/merdeka/login with SHA256SUMS.json. The login
vendor stylesheet is not loaded globally and v2 classes are not used on login;
the existing local InterVariable font is reused. Do not mix login and v2 tokens.

Only the existing credentials flow is rendered. No SSO, forgot-password endpoint,
CAPTCHA or new identity/storage policy is inferred from the template. Input,
Button, Label and Radix Dialog remain shared canonical primitives. The guide
dialog is the named login variant, scoped even though rendered through a portal.

## PRF items modal continuation (2026-10-22)

Item count sits inline beside the PRF number to reduce row height. The item panel
has an Expand items to modal action. A single item workspace moves into a wide
Radix Dialog; the side panel unmounts and list returns to full width. Closing the
modal clears selection and restores the initiating list trigger. The modal uses
the shared Merdeka detail theme and viewport-bound geometry, with table-owned
scroll and sticky edit actions. Desktop shows dedicated part number, cost code,
original/split PO columns; all other item metadata/specifications are expanded.
Absent values show an em dash, not inferred data. Legacy descriptions matching
Part: value supply the part column only when ItemCode is absent. No data is saved
by this presentation fallback. Narrow screens keep the wide table in its scroller.

Sidebar refinement: header brand scales down only when space requires it; collapse control remains fixed. Watermark is bounded and anchored 24px above the bottom. Canonical assets are unchanged.
