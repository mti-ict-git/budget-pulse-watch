# Merdeka UI rollout â€” 2026-10-22

## Scope

User-authorized first slice: authenticated shell, PRF Monitoring and PRF detail
dialog. Phase 13B remains the active product phase; this is a bounded visual
workstream, not completion of Operational Intelligence.

Sources: `AGENTS.md`, `README.md`, `docs/project-onboarding.md`,
`docs/implementation-roadmap.md`, `docs/openapi.yaml`, `docs/budget-control-policy.md`,
installed merdeka-frontend SKILL.md and bundled DESIGN/travel-request patterns.

## Implementation

- Source v2 CSS/fonts/icons and MBM SVGs copied into `public/merdeka`, with hashes.
- Generated CSS prefixes vendor utility classes, preventing Bootstrap !important
  rules from resizing Tailwind controls; canonical vendor files remain intact.
- Shell includes 240/80 sidebar, local collapse preference, active links,
  fixed-width account area, mobile Sheet and application footer.
- PRF adopts compact neutral panels, search/filter layout, scroll-contained table,
  numbered pager and semantic labelled expansion/selection controls.
- PRF detail keeps all current fields/document handlers, Radix keyboard/focus,
  and adds source-like section styling with a sticky Close footer.
- DESIGN.md and UX-CONTRACT.md record ownership and preservation rules.

## Validation

Evidence and final results are appended after verification. Screenshots use
synthetic data and do not demonstrate production/backend connectivity.

## API and business scope

`docs/openapi.yaml` reviewed; no changes required because no route, payload,
auth, validation, permission or business workflow contract changed. No backend
files, environment values or database records are modified. Existing action
handlers remain in place. No push or deployment is included.

## Baseline limitations

- Full application TypeScript check reports existing BudgetOverview.tsx TS2367
  and Dashboard.tsx TS1355 assertions; these precede this visual slice.
- The project-wide static UI audit may flag legacy workflows outside this slice;
  the rollout does not claim whole-application UX compliance.
- AGENTS.md names functional-specification.md and product-principles.md that do
  not exist in this checkout; existing maintained sources govern this UI-only work.

## Browser verification completed in ChatGPT built-in browser

- Compared the bundled Travel Request pattern with the React adaptation.
- Desktop 1440x1000: local logos load, computed sidebar 240px, InterVariable font,
  table overflow stays local (no horizontal document overflow).
- Sidebar collapse/expand and persistence after reload verified.
- PRF detail opens with existing field/document values; Close and Escape restore
  trigger focus. Phone width is 358px at a 390px viewport with no padding override.
- Item expansion and page-scoped selection expose existing bulk controls.
- Numbered pager navigates to range 51–100, and remains there after search debounce.
- Status popup/select, no-results search and Clear search verified.
- Synthetic HTTP 503 error shows Retry, and Retry restores the data view.
- Mobile 390x844: MBM header, reflowed filters, swipeable table and drawer inspected.
  Drawer Escape restores focus to Open navigation after using Radix SheetTrigger.
- Existing account and notification popovers open with their expected content.

The new numbered pager exposed a pre-existing bug: the old search effect depended
on page/fetch callback and always returned pages >1 to page 1 after 500ms. Search
now commits after 500ms, resets paging only on search/filter changes, and aborts
superseded list requests. This preserves API query contracts and prevents stale
responses from overwriting newer results. No mutation endpoint was exercised.

Screenshots: `artifacts/merdeka-ui/iab-desktop.png`, `iab-detail-desktop.png`,
`iab-mobile.png`, `iab-detail-mobile.png`, `iab-mobile-navigation.png`,
`iab-no-results.png`, `iab-error.png` (ignored runtime evidence).

## Verification commands and limits

- `node scripts/generate-merdeka-css.cjs`: passed; source vendor hashes verified.
- Asset resolution check: passed for all generated URLs.
- Targeted ESLint on the five changed component/page files: passed.
- Production Vite build: passed; existing large-chunk warning remains.
- Full TypeScript: fails on the existing three errors in BudgetOverview/Dashboard;
  no new type errors in the changed slice. See artifacts/merdeka-typecheck.log.
- Strict static UI audit: 54 baseline/heuristic findings across the application,
  including existing native controls, dialogs and textarea policy. It also flags
  Radix asChild triggers and cross-file scrollbar ownership heuristically.
  This is not a full-application UX compliance claim.

Other concurrent changes appeared in backend/src/routes/ocrPrfRoutes.ts during
this work. They are not part of this UI work and were left untouched.

Final checks: full-project ESLint passed with 0 errors and 8 existing Fast Refresh
warnings after the temporary reference capture was moved out of the source tree.
Local CSS/font/icon resolution verified 46 URLs with zero missing files; all 48
canonical vendor file hashes match. The Create PRF sibling route was opened in
IAB to verify the shared shell and retained form surface. Concurrent OCR changes
also touch OCRRescanDialog, PRFDetailDialog refresh props and related API/docs;
those changes were preserved and are not attributed to this visual workstream.


## Second slice — Dashboard and Budget Overview (2026-10-22)

User requested continuation with the same Merdeka style and built-in ChatGPT
browser verification. Active product phase remains 13B. Sources reviewed:
DESIGN.md, UX-CONTRACT.md, project-onboarding, budget-control policy, historical
governance, OpenAPI and the bundled dashboard pattern/README.

### Changes

- Dashboard gets source-style summary tiles, bordered data panels, a utilization
  ring based on existing metrics, compact recent PRFs, clear alerts and Refresh.
- Budget removes duplicate container padding and moves its existing summary and
  utilization before readiness/details/governance. All business controls remain.
- Tables, filters, empty states, percentages and create/edit forms match Merdeka
  typography, borders, density and portal selection colors. COA popups match the
  trigger width and remain usable on phones.
- Existing ineffective Export Report now produces CSV for visible rows. Existing
  status filter reaches the supported API query; refresh preserves active filters.
- Superseded budget list responses are ignored. No API route/payload is changed.
- Controlled create/edit no longer render duplicate internal triggers. Existing
  role/cut-off button gating therefore remains the only create entry point.
- Three pre-existing TypeScript errors in these now-in-scope pages were fixed:
  literal union inference on dashboard changes and expense-type narrowing.

### Browser evidence

All interactions used ChatGPT's built-in browser against an isolated localhost
fixture API; no external Playwright browser was launched for this slice.
Desktop 1440x1000 and phone 390x844 were inspected. Checks include:

- Dashboard refresh, totals/ring, existing alert navigation and successful recovery
  after synthetic 503. Empty datasets show existing no-PRF/no-alert/no-utilization
  messages; unavailable metrics show a dash rather than invented zero values.
- Budget expense/status/year filters, no-result search and Clear search.
- OPEX export downloaded and inspected: header plus the single visible OPEX row,
  preserving 120M annual + 5M carry-forward = 125M available, 85M spent/40M remaining.
- Existing budget editor opened with its actual fixture allocation and COA.
- Create validation rejected empty required fields before a mutation; Cancel/
  Escape return focus. COA popup and keyboard dismissal checked on desktop/phone.
- Closed FY 2025 disables Create, Import and row edit; no fiscal-close or other
  mutation action was submitted to the backend.
- Phone overflow check: document does not overflow; readiness/details tables
  retain local scroll regions. Shared mobile navigation still works.
- PRF is retained as the sibling visual/interaction baseline.

Evidence: `artifacts/merdeka-ui/dashboard-*.png`, `budget-*.png`, including before,
desktop, phone, popup, no-results, empty, error and closed-year captures.

### Contract and verification scope

OpenAPI reviewed: this slice adds no route, payload, authentication, validation or
backend business contract. Existing unrelated OCR/API/doc changes are preserved.
Financial allocation, spent/remaining definitions, carry-forward approval,
historical retention and role policies are unchanged.

Earlier first-slice TypeScript limitations are superseded by this slice's passing
full frontend TypeScript check. Full lint/build/static-audit results and final
evidence are recorded after final verification below. Static audit findings in
untouched legacy flows are not a whole-product compliance claim. Live SQL/auth,
create/update/import/carry-forward/cut-off mutation UAT remains outside fixture QA.


### Final second-slice results

- Full frontend TypeScript passed: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`.
- Full ESLint passed: zero errors, eight existing Fast Refresh warnings.
- Production Vite build passed; the existing large-chunk warning remains.
- All 48 source vendor hashes and 46 CSS/font/icon URL resolutions passed.
- `git diff --check` passed after whitespace cleanup.
- Strict static audit completed with 52 findings (13 unresolved / 39 violations)
  across legacy application code and scanner heuristics. Changed-form findings
  include Radix PascalCase Select/Trigger wrappers interpreted as native/actionless
  elements, and retained native number-field constraint validation. This rollout
  does not disable existing validation merely to satisfy that heuristic.
- Source ownership, light tokens and the existing PRF sibling were reconciled.
- Browser checklist and screenshots are indexed in
  `artifacts/merdeka-ui/overview-verification.json`.

Remaining limitations: live authentication/SQL and successful production budget
mutations were not run; the preview uses synthetic fixture data. Light mode is
the approved reference. No push or deployment was requested or performed.

Final COA popup geometry check in IAB: trigger 586.4px, popup 586.4px (equal width).


## COA Management and Reports slice (2026-10-22)

The approved Merdeka adapter now covers COA metrics, governance, filters, bulk
toolbar, table, menus, create/edit/detail and deactivation confirmation surfaces.
Reports keeps the existing Audit Log contract. Search commits on Search/Enter;
applied filters survive Refresh. Aborted/versioned requests cannot overwrite newer
results. Page-local COA counts have honest labels; protected baseline guards and
all live CRUD handlers remain. COA forms use existing React Hook Form/Zod validation
with native validation disabled. The prior unconnected detail Quick Actions are
disabled and explained; no report-generation backend is invented.

Browser evidence: ChatGPT built-in IAB, synthetic read-only API on loopback 8095,
frontend 8094. No standalone Playwright runner. Verified success, loading,
no-results/Clear, 503/Retry, paging/search reset, CAPEX/governance filters, protected
selection/deactivation, required validation, edit population, details, Escape and
row focus restoration. A floating-assistant collision with Next was reproduced,
fixed using pagination clearance, and retested. At 390px both documents stay 390px
wide, while tables scroll locally; create dialog fits with vertical scrolling.
Reports also checked at 1280px. Shared cards/tokens were compared with Dashboard.

Frontend TypeScript passes; full ESLint has zero errors/eight existing Fast Refresh
warnings. Production build passes with the existing large-chunk warning. Asset
checks verify 48 canonical hashes and 46 local CSS/font/icon references. Strict
audit initially reported the same 52 legacy/heuristic findings as the prior slice;
the changed native COA form validation declaration is corrected. The provider
`<Form>` is not a DOM form and its matching finding is a static heuristic.
Whole-product compliance is not claimed. No premium-ui.json or dedicated
accessibility/localization test command exists in the repository baseline.

Evidence: artifacts/merdeka-ui/coa-reports-verification.json, four screenshots,
artifacts/merdeka-coa-reports-{lint,build,audit}.log and audit JSON. Sources reviewed:
DESIGN.md, UX-CONTRACT.md, onboarding, existing governance and OpenAPI COA/report
contracts. No backend/API/schema changes. Live create/update/deactivate/bulk writes,
production auth/SQL and deployment UAT remain unverified. Changes are local.


Final audit rerun: 51 findings (13 unresolved ownership declarations, 38 static
violations), down from 52 after native form validation ownership was corrected.
The only remaining finding in COA/Reports files targets the React Hook Form
provider `<Form>` at COAForm.tsx:173, which does not render a native form; adding
noValidate there would be an invalid provider prop. Remaining findings are in
legacy/unmigrated surfaces or generated canonical CSS. Final scoped lint and
TypeScript pass, and production build passes (22.08s). Single and bulk deactivate
confirmation/Cancel were also verified; neither action was submitted.


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


Refinement verification: IAB against original backend on 8096/3001 confirmed
default collapse after reload, Enter/Space toggle, search 54126 (one result),
retained search on collapse, Clear restoration (192 FY records), selection enablement,
item expand/collapse and detail/Escape. No sync/import/edit/delete submitted.
Row height measured 56px; 1280px desktop freezes identity/actions, 734px tablet and
390px phone scroll columns locally with no document overflow. TypeScript and
changed-file ESLint pass; build passes (21.61s, existing chunk warning).
Evidence: artifacts/merdeka-ui/prf-refinement-verification.json and screenshots.
Backend/API contracts are unchanged. No commit or push.

Refinement strict audit: 51 existing legacy/heuristic findings (unchanged from prior slice); no new findings. This is not a claim of full application compliance.

User-approved space saving: removed the redundant Purchase request forms tab label; PRF List remains the section heading. Separate synthetic A/B/C mockups are available outside the repository at localhost:8097 for layout selection; no mock layout has been applied to the app.


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


Option-C verification: original backend IAB session at 8096/3001 exercised initial
closed state; select 54123 (28 items), select 54126, Close/focus return, Escape,
dialog Escape isolation, Show all items (189 grouped across 50 PRFs), All columns,
checkbox/bulk enablement, PRF details, item modification dialogs for first and last
item without submitting, and page-2 selection cleanup. At 1440x1000 the list and
item scroll regions measured 556px/485px; at 390px the document did not overflow
horizontally and panes stack. An end-of-scroll spacer keeps last-row actions clear
of the floating assistant. Long descriptions are limited to two visual lines.

Separate synthetic fixture at 8094 exercised 503/Retry and no-results cleanup;
fixture mode restored to success. TypeScript passes, full ESLint zero errors/eight
existing Fast Refresh warnings, Vite build passes with existing chunk warning.
Strict static audit retains 51 existing legacy/heuristic findings (13 unresolved,
38 violations), no new findings in this slice. No live mutation, deployment,
commit or push. Evidence: artifacts/merdeka-ui/prf-split-verification.json and
prf-option-c-live.png; artifacts/merdeka-prf-split-{lint,build,audit}.log / audit JSON.
The original item modification dialog's existing USD display is retained; this
layout work does not change stored currency or conversion rules.

Release update (2026-10-22): the prior no-push/no-deploy restriction above describes
pre-release verification and was superseded by explicit user publication approval.
Merdeka UI/option C and the explicitly included OCR changes are now published and
running at application revision 869fe2af883dbad9928a51fe88108e6354dab5a0.
Frontend/backend health, exact image revisions, public TLS/assets, unchanged runtime
configuration/mounts and retained Pronto worker passed. Production browser rendered
sign-in; authenticated production business/OCR apply remains user UAT. See
[deployment evidence](deployment-and-environment.md#verified-release-outcome--2026-10-22).


## Login Merdeka continuation (2026-10-22)

Implemented the captured login split composition, canonical source photo assets,
MBM logo, dedicated PMS token adapter, compact credentials form and access guide.
Existing login service/redirect/session behavior retained. SSO/reset endpoints are
not available in the application and were not copied from the static source.

Verification: TypeScript noEmit and changed-file ESLint passed; production Vite
build passed with the existing large-chunk warning. IAB at isolated origin 8098
tested blank submit/first-field focus, password show/hide, invalid credentials,
busy/disabled state, Enter submit, synthetic success redirect to Dashboard and
sign out. Guide opens, Escape closes and restores focus. 390px viewport has no
horizontal document overflow; all source images/logo loaded. Source primary button
computed #206bc4 / 4px radius. Desktop and phone screenshots saved in the local
QA evidence directory. Real user PRF session on 8096 was preserved. Success/error
responses were synthetic through localhost 8099/8095; no real credential login or
business mutation was performed. Existing actual auth service was not modified.

docs/openapi.yaml reviewed; no backend/API change. No Git commit/push or production
activation is part of this login change. Phase 13B remains In Progress.

Static audit: 51 findings (13 unresolved, 38 violations). The Login.tsx
'actionless button' finding is a static false positive for DialogTrigger asChild:
Radix owns the action, and opening/Escape/focus restoration were verified in IAB.
Other findings remain in existing flows/vendor adapter. No whole-product strict
compliance is claimed. Final preview at http://127.0.0.1:8098/login was switched
back to the real backend on 3001 after synthetic QA, reloaded unauthenticated and
left available for user testing. Temporary login fixture was stopped.

## PRF inline count and expanded item modal (2026-10-22)

Implemented user browser feedback: count inline beside PRF number; Expand control
moves the selected/current-page workspace into a wide modal and removes the side
panel. Dedicated part/cost/original-split PO columns and expanded metadata preserve
all existing item details; legacy Part: descriptions provide a display-only fallback.
Shared modification dialog gains an optional focus-return hook, with unchanged
update service. No business mutation, currency/status or permissions changes.

IAB on 8096 against the real backend: selected PRF 54123 (28 items), expanded,
confirmed one table and no inline panel, verified legacy part 6453-03-334256 in its
column, opened item modification then Escape without submitting. Parent modal
remains and focus returns to the edit button. Closing parent clears item view and
returns focus to View items for 54123. At 390x844 the document has no horizontal
overflow; modal x=8/y=12 with viewport-bound height, wide table scrolls internally.
Screenshots: prf-expanded-items.png and prf-expanded-items-mobile.png in local QA.
TypeScript noEmit and lint for all three touched TSX files pass. Vite build passes
with the existing chunk warning. Scoped strict audit of src/pages and
src/components/prf: 36 existing/heuristic findings (11 unresolved, 25 violations);
no new PRFItemsPanel finding. Existing modification form native-date/validation
findings remain outside this presentation slice; no full-product compliance claim.

DESIGN.md, UX-CONTRACT.md and roadmap updated. docs/openapi.yaml reviewed, unchanged
because no backend/API contract changed. Phase 13B remains In Progress. No commit,
push or deployment for this change.

## Sidebar fit and PRF diagnostic cleanup (2026-10-22)

User-requested refinement: header logo can shrink within available width while
preserving its aspect ratio; collapse button cannot shrink. Expanded/collapsed
branding remains 164x45 / 32x32 in the 240/80px shell. Decorative watermark is
centered 24px from the bottom and bounded to the sidebar, retaining .06 opacity.
Removed Test OneDrive button, diagnostic dialog, local state and request handler
from PRF Monitoring. Backend diagnostic route and all cloud/Pronto sync actions
are unchanged. No OpenAPI change is required; this is frontend cleanup only.

Verification: TypeScript noEmit and lint on PRFMonitoring/Sidebar passed. IAB real
backend confirmed no diagnostic button, loaded 164px logo in 240px expanded shell,
32px symbol in 80px collapsed shell, and successful expand/collapse. Expanded state
restored. Screenshot prf-sidebar-toolbar.png in local QA. No data mutation, commit,
push or deploy. Phase 13B remains In Progress.

PRF panel animation (2026-10-23): item panel opens over 240ms with a quiet fade
and slide. Desktop width reveal lets the list yield space; stacked layouts use
vertical entry without changing their existing height rules. Scoped to the inline
panel; modal and item-edit transitions stay Radix-owned. Switching selected PRFs
keeps the same panel mounted. Reduced motion disables animation. Closing keeps
the existing immediate removal and focus restoration. IAB verified desktop and
stacked animation names/duration, 28 live items, no horizontal page overflow;
CSS parse and whitespace checks passed. Screenshot prf-panel-animation.png in
local QA. No backend/API change, data mutation, commit/push or deploy.

Animation revision after user feedback (2026-10-23): width interpolation caused
repeated table layout during entry. Both entry/exit now animate only transform
(8px) and opacity for 160ms; split geometry changes once, not per frame. Closing
retains the panel for 160ms, makes it inert, restores list focus, then removes it.
Selecting another PRF cancels pending removal; timer is cleaned on unmount.
Reduced motion closes immediately. Modal motion remains unchanged. IAB with 28
live items confirmed 0.16s entry, no horizontal overflow, and close/Escape focus
return. CSS parse/whitespace passed; TypeScript/lint verification from the preceding
exit implementation remains pending if its background check has not completed.
This supersedes the earlier 240ms width-reveal and immediate-close notes.

## PRF item Excel export (2026-10-23)

User requested Export in the item workspace. Export Excel is available in both
inline panel and expanded modal, scoped to the exact loaded PRFs/items. Single
selection exports that PRF; All items on this page exports current-page items only,
not all server pages or bulk checkbox selection. Workbook contains PRFs summary
and PRF Items sheets, with part/cost/original PO/split PO, quantity, numeric unit
price/total, parent and item statuses, COA/year, pickup, notes and specifications.
Shared SheetJS dependency is reused, with a focused workbook builder in
src/lib/exportPrfItems.ts. Leading zeros and formula-like text stay string cells;
zero totals are preserved. Legacy Part: fallback matches the rendered panel.
No currency conversion or status-policy change. Export is disabled while loading,
on refresh failure, empty item sets or closing; errors use existing toast recovery.
Toast says export started because the browser owns final file saving.

IAB downloaded PRF_Items_54126_20261023_082607.xlsx. Reopened actual file with
SheetJS: two sheets, one item, matching part 9908-04-126583/cost MTIRMRAD496314,
numeric unit price. Synthetic XLSX write/read round-trip verified two-PRF scope,
leading zeros, split PO, numeric zero, and formula-like names as literal text.
390px modal test confirmed button bounds/no document horizontal overflow.
TypeScript and changed-file ESLint passed. CSS/whitespace passed. Screenshot:
prf-items-export.png in local QA. Production build checked separately below.
No server/API change; docs/openapi.yaml reviewed and unchanged. No business writes,
commit, push or deployment. Phase 13B remains In Progress.

Final export/animation checks: TypeScript noEmit and ESLint completed successfully for the animation and export changes. Vite production build passed (2068 modules; existing large-chunk warning). Scoped strict audit retains 36 existing/heuristic findings (11 unresolved, 25 violations), no PRFItemsPanel findings; no full-product compliance claim.

## Styled PRF Excel workbook (2026-10-23)

The item export now writes styled XLSX through ExcelJS 4.4, dynamically imported
only on Export. Existing SheetJS row mapping remains authoritative. Both sheets
have Merdeka blue title/header, export timestamp and scope counts, native table
filters, striped rows, wrapped text, appropriate column widths/row heights and
frozen first column plus four header rows. Gridlines hidden; landscape print
setup repeats header rows and includes page numbers. Prices use numeric accounting
format; count/ID/year integers have no trailing decimal. Data/status/currency
semantics and current selection/page scope are unchanged. Export button has stable
width and busy/duplicate-submit guard; failures remain recoverable through toast.

Browser-generated styled file PRF_Items_54126_20261023_090545.xlsx was reopened
with ExcelJS: correct part/cost/price and actual stored fills, frozen panes,
number formats and table definitions. Synthetic write/read round-trip checks
leading zeros, zero totals, formula-like literal names and numeric price types.
Imported actual workbook into bundled spreadsheet renderer; summary PNG visually
reviewed. TypeScript/lint and Vite production build passed; ExcelJS is a separate
lazy chunk. Existing chunk-size warning remains. No backend/API contract change;
OpenAPI reviewed unchanged. No commit, push or deployment.

## MTI corporate branding (2026-10-23)

User supplied Downloads/mti-corporate.svg. Copied byte-identically to
public/merdeka/branding/mti-corporate.svg. Login places MTI beside MBM; expanded
sidebar/mobile drawer stacks MTI below MBM to preserve wordmark legibility in the
240px shell. Collapsed 80px sidebar retains the existing MBM symbol. Both logos
have meaningful alt text, reserved sizes and object-fit contain. No SVG/vendor
modification, route/auth behavior or sidebar preference change.

IAB confirmed both logo images load, sidebar MBM/MTI widths 164/138px, collapsed
width 80px with compact symbol and re-expanded branding restored. Login pair has
no horizontal document overflow. Screenshots login-mbm-mti.png and
sidebar-mbm-mti.png in local QA. TypeScript/lint passed. No backend/API change;
OpenAPI unchanged. No commit/push/deploy. Phase 13B remains In Progress.

Sidebar brand refinement (2026-10-23): user requested smaller, side-by-side logos. Expanded sidebar now pairs MBM 92x30 and MTI 84x30 with 8px gap and centered alignment; collapse control 24px, shell remains 240/80px. Login unchanged. This supersedes stacked sidebar branding. IAB confirmed both loaded and identical y=23/height=30; CSS parse and whitespace passed. Screenshot sidebar-logos-inline.png. No API change, commit/push/deploy.

Sidebar clarification (2026-10-23): user identified the lower MBM watermark,
not the header logos, as the intended reference-review target. Reference custom.css
uses sidebar-background width 240px anchored bottom 0. Watermark now fills the
240/80px sidebar, with zero inset/padding and .06 opacity, original symbol intact.
Header pair restored to previously approved compact MBM 92x30 / MTI 84x30 inline;
MTI remains in header. Inter 13px / weight 400, menu 40px and shell 240/80px retained.
No navigation, permission, route or vendor CSS change. CSS parsed; browser geometry
and screenshots checked. Earlier experimental MTI footer placement was reversed.

Page-by-page visual audit completed 2026-10-23. See merdeka-visual-review-2026-10-23.md for per-page assessment, measured source/application differences, priorities and evidence. Create PRF/Settings remain visually unmigrated; Alerts incomplete; Budget long-value wrap and Settings mobile tabs confirmed. No UI source changes or business writes during audit.

## Settings and Create PRF Merdeka migration (2026-10-23)

Scope: user-approved first fixes from docs/merdeka-visual-review-2026-10-23.md.
Added the scoped merdeka-form-page long-form variant, shared card header/body
markers and portal form/popover variants. Settings/Create PRF use 22px/600 headings,
14px panel titles, 34px controls, gray source-style panel headers, 12px field text,
quiet borders and blue underline tabs. Two-line OCR model choices use a deliberate
48px minimum to retain help text. Forms scroll naturally; 88px end clearance keeps
last actions reachable beside the floating assistant. Source vendor CSS untouched.

Settings is full content width, without the previous double padding/narrow centered
container. All four tabs wrap into two rows on phones. The same styling covers
OCR/General/Pronto and Local/LDAP user sections. Create/Edit local-user overlays
now reuse the existing Radix Dialog owner with labels, initial field focus, focus
trap, Escape/backdrop and explicit trigger restoration. Existing save/update handlers
are unchanged. Role remains the existing native select with platform popup; existing
role options/gates are untouched. API-key toggle gains an accessible name/state.

Create PRF keeps OCR Upload and Manual Entry with source-style tabs and compact
nested panels. Phone Back/title stack, inner two-column groups become one column,
item actions wrap, and dropzone/steps retain their existing handlers. OCRUpload
receives only card class markers, styled within this page. Manual Priority select
has a label association; remove-item buttons now have accessible names. No change
to native validation, upload/OCR limits, source copy, financial policy or currency
conversion. Existing USD display in manual item totals is preserved, not redefined.

Verification (local IAB real backend): Settings OCR/General/Pronto/Users, Local/LDAP
panes, authored popup open/Escape and exact trigger width, keyboard ArrowRight tab
navigation; Create/Edit User open/cancel/Escape and focus return. At 390x844 all
four tabs remain visible; document and main-content widths do not overflow.
Create-user dialog x16/width358/height~694 fits viewport, focus starts at First Name,
Tab from last control wraps inside, Escape returns to Create User. No user created.

Create PRF desktop and phone OCR/manual inspected. Draft add item, set quantity 2
and unit price 1500, Calculate Total produced 3000, then remove item returned to
empty state without submitting. Phone title is 22px with column layout; no horizontal
overflow. Popup width matched trigger after correcting the viewport's extra 2px.
Auth/API settings remained masked; no save, connection test, access grant/revoke,
API-token generation, document upload, OCR extraction or real PRF mutation ran.

TypeScript noEmit and changed-file ESLint passed. AST comparison with HEAD proved
14 selected business handlers unchanged (7 Settings, 5 Create PRF, 2 OCRUpload).
Scoped strict audit retains the same 36 existing/heuristic findings (11 unresolved,
25 violations), zero new/resolved findings; not a full-product compliance claim.
Production build result is recorded below. Final evidence and screenshots are in
local QA: settings-create-verification.json, settings-create-audit.json,
settings-merdeka-desktop/mobile.png, create-prf-merdeka-desktop/mobile.png,
create-prf-merdeka-manual.png, and settings-user-dialog/mobile.png.

DESIGN.md, UX-CONTRACT.md, visual review and roadmap synchronized. OpenAPI reviewed;
no backend/API changes, so docs/openapi.yaml remains unchanged. Phase 13B remains
In Progress. No commit, push or deploy, per user instruction.

Final production build passed (Vite, 2072 modules, 45.26s). Existing large-chunk warning remains. Final TypeScript noEmit, changed-file ESLint and git diff --check passed.

## Budget Overview / COA audit fixes (2026-10-23)

Scope: user-requested visual follow-up, Phase 13B remains In Progress. Sources:
Merdeka skill, DESIGN.md, UX-CONTRACT.md, visual-review audit, budget-control-policy
and historical-budget-governance. No workflow or data policy change.

Budget currency metrics now have a full-width amount row at laptop widths, retaining
four cards. At 1440px, Rp 12.793.495.330 fits a single 27.3px line in 239.5px; at
1280px, it fits a 24.06px line in 199.5px. Responsive cards use two tablet columns
and one phone column. Cutoff/import spacing is compacted; actions remain intact.
COA metrics, governance, filters and Accounts heading are compacted. First table
row moved from y757.5 in the initial pass to y641 after refinement (1280/1440).
All governance values/scope and filters remain visible; table owns its overflow.
Create/edit Budget and create/edit/details COA use bounded finance dialog geometry.
Fields/details scroll inside; form actions stay visible. All 23 compared named
business handlers match HEAD after line-ending normalization.

Verification: TypeScript noEmit and changed-file ESLint passed. Production Vite
build passed: 2072 modules, 32.73s; existing large-chunk warning remains. git diff
--check passed. Existing scoped premium audit remains 36 findings (11 unresolved,
25 violations); no new findings versus prior Settings audit. That scope covers
pages/PRF, not all finance forms, and is not a whole-product compliance claim.

ChatGPT IAB real-backend checks: 1280x720 and 1440x900 desktop, 390x844 phone;
no main/document horizontal overflow in sampled routes. Budget/COA dropdowns,
Budget create/edit, COA create/protected edit/details, local no-results/Clear,
mandatory scope/protected disabled controls, pager Next (11–20 of 65), keyboard
Tab trapping/Escape and Add Account focus restoration checked. Invalid blank COA
submit displays required-code/name errors and focuses Code; no save sent.
Phone finance dialog x16,width358,height812; footer y762–827 remains visible while
body scrolls. No budget/account save, deactivation, cutoff, carry-forward, rate
fetch, import or export action executed. Currency semantics remain unchanged,
including the legacy USD formatter in COA usage details.

Screenshots in local QA: budget-merdeka-desktop/mobile.png,
budget-dialog-merdeka-mobile.png, budget-edit-merdeka-desktop.png,
coa-merdeka-desktop/mobile.png, coa-dialog-merdeka-mobile.png,
coa-edit-merdeka-desktop.png, coa-details-merdeka-desktop.png.
Related docs/roadmap updated. This work makes no backend/API change; OpenAPI review
requires no contract update. Other concurrent/uncommitted work is preserved.
No commit/push/deploy.
