# Implementation Roadmap

## Purpose

This roadmap restores the formal phase tracker required by `AGENTS.md` and defines the active execution order for budget-control hardening, historical governance, and release-readiness work.

## Status Summary

- Roadmap status: Completed
- Active phase: `None - Release Verification Complete`
- Last updated: `2026-07-22`

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

## Completion Rule

No phase should be marked complete until:

- all checklist items for that phase are complete
- challenge / verification evidence is explicitly recorded
- related documentation is synchronized
- `docs/openapi.yaml` is updated whenever backend contract behavior changes
