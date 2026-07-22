# Budget Pulse Watch Project Onboarding

## Purpose

This document captures a practical understanding of the repository so new contributors can quickly identify the system shape, source-of-truth documents, major workflows, and current documentation gaps.

## Product Summary

Budget Pulse Watch is a PRF and budget monitoring platform used to track purchasing activity, budget utilization, supporting documents, and operational workflow data. The system combines web-based monitoring, backend business rules, SQL Server persistence, reporting, and multiple integration points.

Main functional areas:

- PRF monitoring and item-level tracking
- Budget planning, utilization, and fiscal-year control
- COA management and budget mapping
- Reporting and dashboard metrics
- Document upload and shared-folder storage
- OCR-assisted PRF extraction
- OneDrive Excel synchronization
- Pronto synchronization
- User, LDAP, API key, and notification management

## Repository Map

### Root

- `README.md`: repository entry point
- `AGENTS.md`: working rules for AI agents and change-control expectations
- `docker-compose*.yml`: environment-specific runtime definitions
- `src/`: frontend application
- `backend/`: backend API, SQL, scripts, worker, and operational tooling
- `docs/`: source-of-truth documents and generated readiness/backfill reports

### Frontend

- `src/main.tsx`: frontend bootstrap
- `src/App.tsx`: route tree, providers, and protected layout composition
- `src/contexts/AuthContext.tsx`: session bootstrap and token validation
- `src/components/layout/`: shell layout and navigation
- `src/pages/`: page-level feature modules
- `src/components/prf/`: PRF dialogs, detail views, and item modification UI
- `src/services/`: browser-side API wrappers for auth, budget, COA, and notifications

Main page responsibilities:

- `Dashboard.tsx`: executive summary cards and alerts
- `PRFMonitoring.tsx`: operational PRF list, filters, detail, item actions, and sync triggers
- `BudgetOverview.tsx`: budgets, fiscal-year cut-off, OPEX import, and utilization views
- `COAManagement.tsx`: account mapping and maintenance
- `Reports.tsx`: report-oriented access
- `Settings.tsx`: operational settings, maintenance, sync, LDAP, API keys, and diagnostics

### Backend

- `backend/src/index.ts`: Express bootstrap, middleware, Swagger serving, route mounting, DB startup
- `backend/src/config/`: DB connectivity and initial table bootstrapping
- `backend/src/routes/`: route-level business behavior
- `backend/src/models/`: SQL-backed model helpers and shared types
- `backend/src/services/`: integration and processing services
- `backend/src/scripts/`: maintenance, migration, reconciliation, and readiness scripts
- `backend/database/migrations/`: forward schema evolution
- `backend/pronto-sync/`: dedicated Python worker for Pronto sync

## Runtime Architecture

The runtime architecture is split into three main execution layers:

1. React frontend
   - Runs as the user-facing web application
   - Handles routing, auth state, and page-specific data fetching

2. Express backend
   - Exposes REST APIs under `/api/*`
   - Serves Swagger UI from `docs/openapi.yaml`
   - Applies auth, validation, SQL access, file processing, and integration logic

3. External dependencies
   - SQL Server for transactional data
   - Shared folder/CIFS mount for PRF documents
   - Microsoft Graph/OneDrive for shared Excel sync
   - LDAP for user lookup/auth support
   - OCR model providers for document extraction
   - Pronto system through the dedicated sync worker

The default Docker runtime also includes a `pronto_sync` service alongside `frontend` and `backend`.

## Key Data Flows

### 1. Authentication And Session Startup

- Frontend login calls `/api/auth/login`
- Token and user metadata are stored client-side
- `AuthContext` validates the session with `/api/auth/verify` during app startup
- Protected routes are enforced before loading the main layout

### 2. Dashboard And Reporting

- Dashboard aggregates multiple backend endpoints
- Backend reports combine PRF, budget, and account data into ready-to-render summaries
- Alerts include high-utilization, over-budget, and pending-action signals

### 3. PRF Monitoring

- Users work primarily in the PRF Monitoring page
- The page loads PRFs with items, applies filters, opens detail dialogs, and triggers updates
- Backend PRF routes enforce business rules, write audit-relevant changes, and can trigger notifications

### 4. Budget Control

- Budget views pull fiscal-year budget data, summary cards, and utilization metrics
- FY cut-off endpoints control write-lock behavior for closed years
- OPEX import validates budget year, COA, and expense type before applying changes

### 5. File And Document Handling

- PRF-related files are uploaded through backend routes
- Files are staged locally and then copied to shared storage
- File metadata is stored in SQL Server for UI retrieval and history

### 6. OCR PRF Ingestion

- Uploaded files are parsed by OCR services
- Extracted PRF data is normalized and inserted into PRF header/item tables
- Source files are retained for traceability

### 7. Cloud And Pronto Sync

- Cloud sync updates shared Excel content in OneDrive
- Pronto sync runs in a dedicated worker and has its own operational configuration and safeguards

## Main Backend Domains

### PRF Domain

- CRUD and filtered retrieval for PRFs
- Item-level status changes and operational updates
- Sync-aware protections to avoid unsafe status regression

### Budget Domain

- Budget CRUD and summary reporting
- Fiscal-year cut-off control
- Currency normalization to IDR for budget math
- OPEX import and reconciliation support

### COA Domain

- Chart of accounts maintenance
- Mapping support between cost code, budget, and PRF spend

### Reporting Domain

- Dashboard metrics
- Utilization and budget summary outputs
- Export-oriented report endpoints
- Audit-oriented reporting for sync and operational review

### Admin And Operations Domain

- Settings, maintenance tools, LDAP users, local users, API keys, and notifications

## Documentation Map

Use the following documents in this order when working on non-trivial changes:

1. `AGENTS.md`
2. `README.md`
3. `docs/implementation-roadmap.md`
4. `docs/openapi.yaml`
5. Feature- or phase-specific documents, especially:
   - `docs/historical-budget-governance.md`
   - `docs/open-questions-and-challenges.md`
   - `docs/budget-control-checklist.md`
   - `docs/budget-control-policy.md`
   - `docs/upgrade-feature.md`
   - `docs/phase4-runbook.md`
   - `docs/phase5-uat-checklist.md`
   - `docs/phase5-deployment-rollback.md`
   - `docs/pronto-sync.md`

## Current Phase Assessment

The formal roadmap has now been restored in `docs/implementation-roadmap.md`.

Current active phase:

- `None - Release Verification Complete`

Current working interpretation:

- the baseline HR / IT budget-control hardening work is completed
- historical data governance is now locked to live-table retention by `FiscalYear` with cutoff-based read-only history
- destructive cleanup remains blocked in normal application workflow
- new-year readiness is implemented with virtual placeholders and explicit carry-forward approval
- COA governance visibility is implemented with protected baseline controls and fiscal-year coverage status in `COA Management`
- release verification and operational handover artifacts are completed

## Current Documentation Gaps

These gaps were observed during repository study:

- several mandatory planning documents listed in `AGENTS.md` are not present in `docs/`
- `docs/api-documentation.md` looks legacy and conflicts with the currently mounted routes and auth approach

For backend work, prefer `docs/openapi.yaml` over `docs/api-documentation.md`.

## Safe Working Rules

- Treat `docs/` as the implementation source of truth
- Review `docs/openapi.yaml` for every backend change
- Update documentation in the same work item when behavior changes
- Keep UI text in English
- Do not use `any` in TypeScript
- Verify migrations/scripts before assuming schema state

## Recommended First Reads By Role

### Full-Stack Contributor

1. `AGENTS.md`
2. `README.md`
3. `docs/project-onboarding.md`
4. `docs/openapi.yaml`
5. `docs/upgrade-feature.md`

### Backend Contributor

1. `backend/src/index.ts`
2. `backend/src/routes/`
3. `backend/src/config/database.ts`
4. `backend/database/migrations/`
5. `docs/openapi.yaml`

### Frontend Contributor

1. `src/App.tsx`
2. `src/contexts/AuthContext.tsx`
3. `src/pages/PRFMonitoring.tsx`
4. `src/pages/BudgetOverview.tsx`
5. `src/pages/Settings.tsx`

## Verification References

Useful commands for manual validation:

```bash
npm run lint
npx tsc --noEmit
npm --prefix backend run build
npm --prefix backend run phase5:readiness
```

Use the generated reports under `docs/reports/` when checking the last recorded phase-4 and phase-5 verification evidence.
