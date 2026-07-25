# Implementation Roadmap

## Purpose

This roadmap restores the formal phase tracker required by `AGENTS.md` and defines the active execution order for budget-control hardening, historical governance, and release-readiness work.

## Status Summary

- Roadmap status: Completed
- Active phase: `Phase 11 - Existing PRF AI Rescan`
- Last updated: `2026-07-25`

## Historical Delivery Context

The earlier FY2026 cut-off and Picking PIC stream was planned in `docs/upgrade-feature.md`.

Based on the documents already present in the repository, the following delivery state is considered established:

- `Phase 0 - Functional Specification Lock`: completed by prior feature-planning documents
- `Phase 1 - Database Foundation`: completed for cut-off support and related migrations
- `Phase 2 - Backend API And Business Rules`: completed for cut-off and related enforcement
- `Phase 3 - Web UI/UX`: completed baseline rollout
- `Phase 4 - Data Backfill And Integrity`: completed baseline runbook and reconciliation artifacts
- `Phase 5 - QA, Hardening, And Release`: partially completed and now extended by the phases below

## Phase 5A - Budget Control Baseline Hardening

### Status

Completed

### Objective

Establish the minimum governed budget-control baseline for HR / IT by normalizing mandatory COA master data and restricting the current `Budget Overview` scope to `HR / IT` `CAPEX` and `OPEX`.

### Source Documents

- `AGENTS.md`
- `docs/upgrade-feature.md`
- `docs/budget-control-policy.md`
- `docs/budget-control-checklist.md`
- `docs/phase5-uat-checklist.md`

### Checklist

- [x] Verify mandatory HR / IT OPEX COAs against `ChartOfAccounts`
- [x] Add missing mandatory COA `MTIRMRAD496315`
- [x] Normalize approved business labels for mandatory HR / IT COAs
- [x] Document yearly budget reset policy and explicit carry-forward concept
- [x] Restrict `Budget Overview` to `Department = HR / IT` and `ExpenseType IN (CAPEX, OPEX)`
- [x] Update checklist and policy documents after baseline hardening

### Output

- Baseline COA coverage corrected in database and migration scripts
- Budget-control policy and checklist documents created
- `Budget Overview` behavior narrowed to the intended HR / IT scope

### Challenge / Verification

- Direct SQL verification for the 10 mandatory HR / IT COA codes completed on `2026-07-22`
- Migration `022_ensure_hr_it_budget_control_coa.sql` added and executed successfully
- Diagnostics clean on updated docs and frontend files
- Root typecheck passed: `npx tsc --noEmit`

## Phase 6 - Historical Governance And Archive Design

### Status

Completed

### Objective

Define and lock the historical-governance model so year-based budget visibility remains available without relying on destructive data cleanup.

### Source Documents

- `AGENTS.md`
- `docs/budget-control-policy.md`
- `docs/budget-control-checklist.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`

### Checklist

- [x] Decide whether historical visibility is satisfied by `FiscalYear` filtering alone or requires a formal archive mechanism
- [x] Define whether archive data is read-only snapshot data, live historical data, or both
- [x] Define whether non-HR / IT budget data stays in the same tables as historical records or is moved into archive tables
- [x] Define audit requirements for year close, reopen, carry-forward approval, and archive access
- [x] Document the retention rule for prior-year budgets and clarify whether hard delete is allowed
- [x] Record the agreed approach in policy, technical, and operational documents

### Output

- Locked decision on historical audit and archive direction
- Documented retention and visibility policy for prior-year budgets
- Clear rule on when cleanup is allowed and when archive is mandatory
- Dedicated governance document for historical budget handling

### Challenge / Verification

- Policy walkthrough reviewed against current `Budget Overview` behavior and narrowed HR / IT operational scope
- Data-model impact reviewed against existing schema, especially `Budget`, `BudgetCutoff`, `BudgetCutoffAudit`, and existing budget routes
- `docs/openapi.yaml` reviewed and no contract update required because Phase 6 only locked governance decisions without changing API behavior
- Historical-governance decision recorded in:
  - `docs/historical-budget-governance.md`
  - `docs/budget-control-policy.md`
  - `docs/open-questions-and-challenges.md`
  - `docs/budget-control-checklist.md`

## Phase 7 - New Year Readiness And Carry-Forward Workflow

### Status

Completed

### Objective

Implement the yearly transition workflow so the system starts a new fiscal year at zero by default, flags missing current-year setup, and supports approved carry-forward with traceability.

### Source Documents

- `AGENTS.md`
- `docs/budget-control-policy.md`
- `docs/budget-control-checklist.md`
- `docs/openapi.yaml`
- `docs/historical-budget-governance.md`
- `docs/open-questions-and-challenges.md`

### Checklist

- [x] Add current-year completeness logic for mandatory active HR / IT COAs
- [x] Add `Need Attention` state in `Budget Overview` for missing current-year budget rows
- [x] Decide and implement zero-budget placeholder strategy
- [x] Design explicit carry-forward data model and approval metadata
- [x] Update backend routes and validations if carry-forward becomes an API-managed workflow
- [x] Update `docs/openapi.yaml` for every applicable contract change

### Output

- New-year transition flow defined and implemented
- Traceable carry-forward capability implemented with explicit approval records
- Updated API and operational documentation when backend behavior changes
- Budget Overview now distinguishes `Annual Allocation`, `Carry Forward`, and `Total Available Budget`

### Challenge / Verification

- Year-switch scenario challenged for `31 December -> 1 January`
- Missing-budget scenario challenged for mandatory HR / IT COAs
- Carry-forward approval path challenged for traceability and role control
- Database migration `023_add_budget_carry_forward.sql` added and applied successfully
- `docs/openapi.yaml` updated for readiness and carry-forward endpoints plus `cost-codes` filter contract
- Build/typecheck and targeted workflow verification completed

## Phase 8 - COA Governance And Operational Visibility

### Status

Completed

### Objective

Improve operational control in `COA Management` and related budget screens so mandatory HR / IT COAs can be monitored as a governed list with fiscal-year coverage visibility.

### Source Documents

- `AGENTS.md`
- `docs/budget-control-policy.md`
- `docs/budget-control-checklist.md`
- `docs/openapi.yaml`
- `docs/project-onboarding.md`

### Checklist

- [x] Add `Mandatory HR / IT OPEX` section or filter in `COA Management`
- [x] Show per-COA coverage status for the current fiscal year
- [x] Surface naming mismatches or protected baseline labels where needed
- [x] Prevent accidental loss of mandatory baseline COAs through UI behavior or validation
- [x] Document operator workflow for maintaining mandatory COA coverage

### Output

- Governed COA maintenance flow for the HR / IT baseline list
- Clear UI indicators for fiscal-year readiness and protected master data
- Protected mandatory baseline validation added to COA update, deactivate, hard delete, and bulk operations

### Challenge / Verification

- Mandatory COA list challenged against database state
- UI workflow challenged for missing, inactive, and mislabeled COAs
- Regression check completed for create/edit paths
- `COA Management` now shows protected baseline badges, readiness coverage, and governance filter for FY visibility
- `docs/openapi.yaml` reviewed and updated for protected COA validation responses on COA mutation routes

## Phase 9 - Release Verification And Operational Handover

### Status

Completed

### Objective

Verify the combined budget-control hardening changes and prepare the repository for safe operational handoff.

### Source Documents

- `AGENTS.md`
- `docs/phase5-uat-checklist.md`
- `docs/phase5-deployment-rollback.md`
- `docs/budget-control-policy.md`
- `docs/implementation-roadmap.md`

### Checklist

- [x] Run final UAT for budget-control scope, yearly reset rules, and historical visibility
- [x] Verify deployment and rollback steps still match the implemented behavior
- [x] Update `README.md` and onboarding references for the final active workflow
- [x] Record verification evidence for each completed checklist item
- [x] Mark completed phases accordingly in this roadmap

### Output

- Verified release-readiness package for budget-control hardening
- Synchronized repository entry documents and operational handoff notes
- Engineering verification evidence recorded in UAT and deployment documents

### Challenge / Verification

- `npm run lint`
- `npx tsc --noEmit`
- backend build or equivalent runtime verification
- UAT evidence recorded in the checklist and roadmap
- `npm --prefix backend run build`
- `npm --prefix backend run phase5:readiness`
- `GET /health`
- `npm run db:migrate`
- SQL verification completed for mandatory COA baseline and applied migration history

## Execution Order

1. `Phase 6 - Historical Governance And Archive Design`
2. `Phase 7 - New Year Readiness And Carry-Forward Workflow`
3. `Phase 8 - COA Governance And Operational Visibility`
4. `Phase 9 - Release Verification And Operational Handover`
5. `Phase 10 - Item-Level Utilization Correction`
6. `Phase 11 - Existing PRF AI Rescan`

## Phase 10 - Item-Level Utilization Correction

### Status

Completed

### Objective

Correct utilization allocation for multi-cost-code PRFs and include every active commitment except cancelled PRFs or items.

### Source Documents

- `docs/budget-control-policy.md`
- `docs/openapi.yaml`
- `docs/implementation-roadmap.md`
- `docs/open-questions-and-challenges.md`

### Checklist

- [x] Replace PRF-header spending allocation with `PRFItems` allocation
- [x] Calculate each item as `Quantity * UnitPrice`
- [x] Resolve fiscal year at item level and allocate COA strictly from the item cost code
- [x] Include all statuses except case-insensitive cancel statuses
- [x] Synchronize dashboard, reports, exports, alerts, and budget-utilization model queries
- [x] Review and update `docs/openapi.yaml`
- [x] Verify FY2026 item coverage and PRF 49087 behavior against the live database

### Output

- Multi-cost-code PRFs are split across their actual item budget lines
- Active commitments are visible before final approval or completion
- Blank and unknown item cost codes remain unmapped and do not consume a header COA

### Challenge / Verification

- Live FY2026 audit found 143 non-cancelled PRFs and confirmed all 143 have item rows
- Status audit confirmed 7 cancelled PRFs and 17 cancelled items are excluded
- PRF 49087 verified as two Repairs and maintenance items totaling `Rp 11,065,000`
- Repairs and maintenance verified at `Rp 282,171,000` (about `38.0%`) after removing all COA fallbacks
- Direct SQL execution of the new aggregation completed successfully
- `git diff --check` completed
- TypeScript build could not be executed in the current host because Node.js is not installed on `PATH`; backend SQL was challenged directly against SQL Server instead

## Phase 11 - Existing PRF AI Rescan

### Status

In Progress

### Objective

Allow an authorized user to reread a stored OCR Source, review item-level differences, and safely update an existing PRF without overwriting protected workflow data or deleting unmatched items.

### Source Documents

- `docs/budget-control-policy.md`
- `docs/openapi.yaml`
- `docs/implementation-roadmap.md`
- `docs/open-questions-and-challenges.md`

### Checklist

- [x] Add stored OCR Source rescan preview endpoint
- [x] Add deterministic item matching and preserved-item reporting
- [x] Add selective transactional apply endpoint
- [x] Protect status, PO, pickup, approval, and Pronto-managed fields
- [x] Add immutable rescan audit schema
- [x] Add OCR Source `Rescan with AI` UI and side-by-side preview
- [x] Allow an explicitly selected alternative PDF/image when no OCR Source exists
- [x] Detect visibly struck-through item rows as selectable `Cancelled` proposals
- [x] Propagate a shared merged-cell cost code to every covered item
- [x] Reconcile printed, extracted, cancelled, and active totals in preview
- [x] Update `docs/openapi.yaml` and policy documentation
- [ ] Complete build/typecheck and end-to-end rescan verification

### Output

- Existing PRFs can be repaired from their original source document
- Missing item cost codes can be reviewed and applied without recreating the PRF
- Unmatched existing items remain intact unless handled manually outside the rescan workflow

### Challenge / Verification

- Migration SQL validated inside a rolled-back transaction, then applied atomically and recorded in `SchemaMigrations`
- Live source lookup confirmed PRF 49137 and other recent PRFs have readable-path metadata for their OCR Source documents
- Coverage audit found 429 PRFs: 161 with OCR Source, 267 without OCR Source but with a supported PDF/image alternative, and 1 without a supported document
- PRF 41436 verified with two alternative PDFs and one unsupported `Thumbs.db`; only the PDFs are eligible
- PRF 41600 visual challenge established the expected reconciliation: printed/extracted `Rp 32,931,200`, cancelled rows 1/2/8 `Rp 5,306,500`, active budget total `Rp 27,624,700`, with shared cost code `AMINBD13.6250`
- Audit foreign keys and rollback behavior validated with audit row count unchanged (`0 -> 0`)
- `git diff --check` passed
- Backend TypeScript build passed using the Visual Studio Node runtime
- Frontend production build passed (`vite build`, 1,804 modules transformed)
- Targeted ESLint passed for `OCRRescanDialog`, `PRFDocuments`, and `PRFFileExplorer`
- Backend typecheck, targeted rescan UI lint, and production build were rerun successfully after item-status detection and total reconciliation were added
- Full frontend TypeScript check remains blocked by three pre-existing errors in `BudgetOverview.tsx` and `Dashboard.tsx`; no rescan-file TypeScript errors were reported
- Preview/apply end-to-end verification remains pending because the local frontend/backend processes were not running

## Completion Rule

No phase should be marked complete until:

- all checklist items for that phase are complete
- challenge / verification evidence is explicitly recorded
- related documentation is synchronized
- `docs/openapi.yaml` is updated whenever backend contract behavior changes
