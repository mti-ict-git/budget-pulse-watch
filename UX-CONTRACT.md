# UX Contract â€” Merdeka UI rollout

## Product context and business sources

Internal purchasing/document-control UI for PRF and budget monitoring. Existing
English UI, `id-ID` dates and currency formatting are retained. Accessibility
target: keyboard-operable controls, visible focus, responsive layout and WCAG AA
contrast. No new business policy is introduced.

Authoritative sources: `docs/project-onboarding.md`, `docs/budget-control-policy.md`,
`docs/historical-budget-governance.md`, `docs/openapi.yaml`, `docs/prf-ai-chatbot.md`,
and `AGENTS.md`. Existing frontend behavior is implementation evidence, not a new
backend contract. Baseline mandatory specification/product-principles documents
named by AGENTS.md are absent; no business changes are inferred from that gap.

## Visual contract

See `DESIGN.md`. Model B: captured source tokens remain canonical, namespaced
vendor adapter is generated, React overrides live in `src/styles/merdeka.css`.
Rollout covers shell, PRF Monitoring/detail, Dashboard, Budget Overview and budget
create/edit dialogs, COA Management/forms/details and Reports (Audit Log). Other page bodies remain unchanged.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | PRFMonitoring | src/pages/PRFMonitoring.tsx | current page | IAB selection/bulk enablement |
| Select/Listbox | Radix Select | src/components/ui/select.tsx | authored popup | IAB popup/keyboard |
| Date | existing formatters | src/components/prf/PRFDetailDialog.tsx | read-only id-ID | detail inspection |
| Form | existing PRF forms | src/components/prf/PRFEditDialog.tsx | existing behavior | outside visual slice |
| Scrollbar | Merdeka adapter | src/styles/merdeka.css | table-owned overflow | desktop/phone |
| Toast | existing Toaster/Sonner | src/App.tsx | existing severity | existing owners retained |
| CRUD | existing handlers/API | docs/openapi.yaml | existing routes/permissions | no backend writes in visual QA |

## Dataset navigation

Preserve existing React search/filter/page state and existing `?search=` deep link.
URL persistence for every filter is not added during this visual-only migration.
Search commits after 500ms; superseded requests are aborted. Clear resets text.
Changing search/filter resets page 1; page navigation alone must never reset it. Page sizes remain 50/100/500.
Numbered pager calls existing setPagination handlers and keeps Previous/Next.
Selection stays page-scoped and existing data-change clearing is retained.
Keep loading, empty/no-results, error/Retry states and numeric range/total.
Retain existing mutation confirmation and server permission checks.

## Flow ledger

| Operation | Owner | Success | Failure/recovery | Focus |
|---|---|---|---|---|
| Search/filter | PRFMonitoring handlers | existing filtered request | existing error + Retry | input/select retained |
| Paging | setPagination | request chosen page | existing error + Retry | chosen pager button |
| Read detail | PRFDetailDialog | existing fields and documents | existing document errors | Close/Escape returns trigger |
| Item expansion | toggleRowExpansion | existing nested items | existing data/loading states | semantic expansion button |
| Bulk/import/sync | existing PRF handlers | existing toast/refresh | existing error paths | unchanged owner |
| Create/edit/delete | existing forms/dialogs/API | existing refresh | existing validation/permissions | unchanged owner |

## Navigation and responsive behavior

Sidebar role filters, route names and report disclosure remain existing behavior.
Collapse is persisted locally under `merdeka.sidebar.collapsed`; storage failure
must not break navigation. On phones, Sheet owns focus trapping, Escape and
focus return. Route navigation closes the drawer. Account and notifications keep
existing handlers. Header search navigates to the existing PRF search deep link.
Truncated table text retains existing title access. Table overflow remains local.

## Overlays, resilience and verification scope

Radix Dialog/Sheet/menu/select own focus, keyboard and portals. Detail Close
footer remains visible while scrolling. Existing destructive confirmations and
mutation error handling are preserved, not redesigned. No browser-native dialogs
are introduced. The retained baseline bulk `confirm()` calls are known legacy
debt outside this slice. Keep API behavior/auth/backend unmodified.

Browser QA uses a loopback-only dummy API with synthetic `example.invalid`
identity, isolated origin and no database/production connection. It verifies UI
behavior only. Live sync, upload, mutation and production auth UAT remain separate.


## Dashboard / budget continuation

- Dashboard Refresh reloads the existing four data sources; the button is disabled
  during work. Existing alerts keep their `/budget` and `/prf` destinations.
- Budget filters retain 300ms debounce and existing FY/HR-IT/CAPEX-OPEX semantics.
  Status now reaches the already-supported cost-code query. Refresh and post-save
  reloads preserve the current search/status/type. A request counter ignores
  responses superseded by a newer list request.
- Export Report downloads CSV from the currently displayed budget rows, with
  annual/carry-forward/available/spent/remaining values. Quoting, UTF-8 BOM and
  spreadsheet-formula escaping are local export concerns; no API call is added.
  Export is unavailable when loading, errored, or the table is empty.
- Cut-off and role checks remain the existing owners. Read-only historical data
  stays queryable; no deletion/retention rules change. Controlled dialog triggers
  cannot expose an extra unguarded New Budget/Edit entry point.
- Create/edit fields, validation and save handlers remain existing. Empty create
  submission surfaces the existing validation toast without making a mutation.
  Cancel/Escape preserve the documented return-focus destinations.
- COA autocomplete and filter portals reuse Radix and Merdeka tokens. Test both
  the trigger and the open popup on desktop/phone, including Escape.
- Empty readiness gets an explicit row instead of an unexplained blank body.
  Percentage labels retain actual values above 100; only bar/ring fill is clamped.
- Browser UAT uses loopback fixture data and no database. Production mutations,
  cut-off changes, carry-forward approvals and imports are not executed in QA.


## COA Management and Audit Log behavior

COA uses existing coaService CRUD/bulk contracts and mandatory protection rules.
Filters reset page 1 and clear selection; page changes/page-size changes also
clear selection. Select All selects only eligible visible rows. Request versions
discard late list responses. Failure leaves a persistent Retry action in the
table. Empty datasets show 0 to 0. Coverage failure says Unavailable instead of
remaining Loading. Categories/active/readiness counts describe the current page.

Audit Log search commits on Search/Enter, resets page 1, aborts superseded
requests and retains the applied query on Refresh. Previous/Next exposes existing
server pagination (50 rows). Errors have Retry and disable page controls. No new
report types or API endpoints are introduced. The existing COA detail Quick
Actions had no handlers; they are now explicitly unavailable rather than clickable.
Existing create/edit/deactivate/bulk handlers and backend policy remain unchanged.


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
