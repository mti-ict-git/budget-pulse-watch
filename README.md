# Budget Pulse Watch

Budget Pulse Watch is a PRF and budget monitoring system for operational purchasing workflows. The repository is a monorepo that combines a React web application, an Express API, SQL Server persistence, and supporting sync/document-processing utilities.

## What This Repository Contains

- `src/`: React + Vite frontend for dashboard, PRF monitoring, budget overview, reports, settings, and admin flows.
- `backend/src/`: Express + TypeScript backend for API routes, business rules, SQL access, file handling, OCR, and integrations.
- `backend/database/`: schema and SQL migrations.
- `docs/`: source-of-truth product, API, rollout, and operational documents.
- `mobile/`: optional mobile client references when present in the working copy.

## Core Business Capabilities

- PRF monitoring with PRF items, status tracking, detail dialogs, and activity history.
- Budget management with fiscal year views, budget utilization, budget cut-off, and OPEX import.
- COA management for account mapping and budget alignment.
- Reporting for dashboard metrics, alerts, budget summaries, utilization, and audit-style outputs.
- Document handling for PRF files and shared-folder storage.
- OCR-assisted PRF ingestion from uploaded files.
- Sync integrations for OneDrive Excel and a dedicated Pronto sync worker.
- Access control via JWT auth, local users, LDAP lookup, and API keys.

## Architecture At A Glance

### Frontend

- Stack: React 18, Vite, TypeScript, Tailwind CSS, shadcn-ui, React Router, TanStack Query.
- App entry: `src/main.tsx`
- Route composition: `src/App.tsx`
- Main pages:
  - `src/pages/Dashboard.tsx`
  - `src/pages/PRFMonitoring.tsx`
  - `src/pages/BudgetOverview.tsx`
  - `src/pages/COAManagement.tsx`
  - `src/pages/Reports.tsx`
  - `src/pages/Settings.tsx`

### Backend

- Stack: Express 5, TypeScript, `mssql`, Swagger UI, LDAP, Microsoft Graph, OCR integrations.
- API entry: `backend/src/index.ts`
- Main route groups:
  - `/api/prfs`
  - `/api/budgets`
  - `/api/coa`
  - `/api/reports`
  - `/api/auth`
  - `/api/settings`
  - `/api/import`
  - `/api/cloud-sync`
  - `/api/prf-files`
  - `/api/prf-documents`
  - `/api/notifications`

### Runtime Services

- `frontend`: serves the web UI.
- `backend`: serves the API and Swagger docs.
- `pronto_sync`: Python worker for scheduled/manual Pronto synchronization.
- SQL Server runs outside the compose stack and is configured through environment variables.

## Source-Of-Truth Documents

Start here before changing behavior:

- `AGENTS.md`: repository working method and mandatory documentation rules.
- `docs/implementation-roadmap.md`: formal phase tracker and active execution order.
- `docs/openapi.yaml`: current backend API contract.
- `docs/upgrade-feature.md`: feature-delivery plan for FY2026 budget cut-off and Picking PIC.
- `docs/budget-control-policy.md`: budget-control policy for yearly budget reset, new-year attention, and carry-forward handling.
- `docs/budget-control-checklist.md`: execution checklist for mandatory HR / IT OPEX COA coverage and budget-control follow-up items.
- `docs/historical-budget-governance.md`: locked historical visibility, retention, archive, and hard-delete policy.
- `docs/open-questions-and-challenges.md`: unresolved business and technical decisions that must be locked before risky changes.
- `docs/phase4-runbook.md`: data backfill and reconciliation procedure.
- `docs/phase5-uat-checklist.md`: UAT checklist for release validation.
- `docs/phase5-deployment-rollback.md`: deployment and rollback procedure.
- `docs/pronto-sync.md`: Pronto synchronization behavior and safeguards.
- `docs/project-onboarding.md`: repository understanding and architecture summary.

## Current Delivery Status

The active roadmap is now restored in `docs/implementation-roadmap.md`. The current documented delivery status is:

- Completed baseline hardening for mandatory HR / IT COA coverage and `Budget Overview` scope control
- Completed historical governance decision for retention, live-table history, and no-hard-delete policy
- Completed Phase 7 for current-year readiness, virtual zero placeholders, and explicit carry-forward workflow
- Completed Phase 8 for COA governance visibility, protected baseline controls, and current-year coverage visibility in `COA Management`
- Completed Phase 9 for release verification and operational handover
- Current roadmap status: release-ready verification package completed

## Safe Start Checklist

1. Read `AGENTS.md`.
2. Read the relevant `docs/` source documents for the area you will change.
3. Review `docs/openapi.yaml` before any backend or contract change.
4. Run pending database migrations before relying on new schema behavior.
5. Keep UI text in English and avoid `any` in TypeScript.

## Local Development

### Prerequisites

- Node.js and npm
- Access to the target SQL Server instance
- Backend environment file with database and integration settings

### Install Dependencies

```bash
npm install
npm --prefix backend install
```

### Run The App

```bash
npm run dev:full
```

Useful alternatives:

- Frontend only: `npm run dev:frontend`
- Backend only: `npm run dev:backend`
- Mobile client: `npm run dev:mobile`

### Database Migrations

Run the latest pending SQL migration:

```bash
npm run db:migrate
```

Run all pending migrations:

```bash
DB_MIGRATE_MODE=all npm run db:migrate
```

## Docker Runtime

The default compose file defines:

- Frontend on host port `9007`
- Backend on host port `5004`
- Pronto sync worker as a companion service

The backend mounts:

- `./backend/data`
- `./backend/temp`
- `./docs`

It also expects network-share and document-storage related environment variables for production-like behavior.

## API Documentation

The backend serves Swagger UI and the raw OpenAPI spec:

- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI YAML: `http://localhost:3001/api/docs/openapi.yaml`

Protected endpoints require a Bearer JWT or another supported auth mechanism for the target route.

## Key Operational Features

### Budget Cut-Off And OPEX Import

- Budget cut-off endpoints exist under `/api/budgets/cutoff/:fiscalYear`.
- Closed fiscal years block budget create, update, and delete actions.
- OPEX import is handled through `/api/budgets/opex/import`.
- Currency handling supports `IDR` and `USD` with exchange-rate normalization.

### Picking PIC Enforcement

- PRF items marked as `Picked Up` require PIC information and pickup date.
- Picking PIC editing is restricted to authorized roles such as DocCon/Admin.

### Data Maintenance

- Duplicate PRF item maintenance is exposed from Settings and the backend maintenance endpoint.
- Phase 4 utilities include PIC backfill and OPEX reconciliation scripts.

## Quality And Verification

Recommended validation commands:

```bash
npm run lint
npx tsc --noEmit
npm --prefix backend run build
```

Release-readiness helper:

```bash
npm --prefix backend run phase5:readiness
```

## Documentation Notes

- `docs/` is the documentation source of truth for implementation and operations.
- `docs/api-documentation.md` appears to be legacy and does not reflect the current mounted routes as accurately as `docs/openapi.yaml`.
- If you change backend behavior, review and update `docs/openapi.yaml` in the same work item.

## Lovable Integration

This repository is connected to Lovable:

- Project URL: [lovable.dev/projects/2161adca-98cc-4f2f-ac94-84a8dd852b12](https://lovable.dev/projects/2161adca-98cc-4f2f-ac94-84a8dd852b12)
- Avoid rewriting published history that has already synced to Lovable.
