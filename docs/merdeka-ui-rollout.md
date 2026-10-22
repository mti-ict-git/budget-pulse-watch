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
