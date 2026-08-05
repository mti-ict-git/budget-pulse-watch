# Implementation Roadmap

## Purpose

This roadmap restores the formal phase tracker required by `AGENTS.md` and defines the active execution order for budget-control hardening, historical governance, and release-readiness work.

## Status Summary

- Roadmap status: In Progress
- Active phase: `Phase 13A - Trust And Conversation Control`
- Last updated: `2026-08-05`

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
7. `Phase 12 - PRF AI Chatbot`

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

## Phase 12 - PRF AI Chatbot

### Status

Completed

### Objective

Allow any authenticated user to ask read-only natural-language questions about all PRFs and receive evidence-backed PRF and attachment references without exposing arbitrary SQL or sending attachment contents to the AI provider.

### Source Documents

- `docs/prf-ai-chatbot.md`
- `docs/prf-ai-chatbot-enhancement-roadmap.md`
- `docs/openapi.yaml`
- `docs/implementation-roadmap.md`
- `docs/open-questions-and-challenges.md`
- OpenAI Responses API and model guidance

### Checklist

- [x] Lock product scope, provider, retention, and attachment behavior
- [x] Add authenticated chatbot endpoint and bounded request validation
- [x] Add fixed read-only PRF search, detail, statistics, and attachment tools
- [x] Use OpenAI Responses API with `store: false` and safety identifiers
- [x] Add authenticated attachment preview/download endpoint
- [x] Add protected-layout chat drawer with session-only history
- [x] Add clickable PRF and attachment references
- [x] Add safe GitHub-Flavored Markdown rendering and responsive tables
- [x] Add user-controlled full-window chat mode
- [x] Secure OCR key reveal behind admin authentication and no-store responses
- [x] Update `docs/openapi.yaml`, README, onboarding, and open questions
- [x] Complete build, typecheck, lint, and targeted runtime verification

### Output

- Read-only AI assistant available throughout the authenticated application
- Natural-language access to all structured PRF and item data
- Attachment availability answers with secure preview/download actions
- No database-backed chat retention and no attachment-content ingestion

### Challenge / Verification

- Backend TypeScript build passed: `npm --prefix backend run build`
- Root TypeScript check passed: `npx tsc --noEmit`
- Frontend production build passed: `npm run build` (1,807 modules transformed; existing bundle-size warning remains)
- Full ESLint passed with zero errors and nine pre-existing Fast Refresh warnings
- Targeted chatbot/backend ESLint passed with zero findings
- `docs/openapi.yaml` parsed successfully as YAML
- `git diff --check` passed
- Static challenge confirmed authentication on chat and file-content routes, 20-message/4,000-character limits, bounded tool rounds/results, `store: false`, parameterized SQL, and no write tools
- End-to-end service verification passed against live SQL Server and OpenAI for `cari prf 49656`; the assistant returned PRFNo `49656` (`PRFID 18271`) with the correct reference
- End-to-end alias-expanded verification passed for `cari prf terkait kamera`; the assistant returned camera-related PRFs including `46934`, `47649`, `43030`, `43365`, and `41437`
- Context-isolation and relative-period verification passed on `gpt-5.4-mini`: after a prior `46934` conversation, `ada berapa item yang dibeli minggu ini` used the Asia/Jakarta week `2026-08-03` through `2026-08-09` and returned 2 line items / quantity 2 from PRFs `49656` and `49642`
- Markdown/full-window frontend production build passed with 2,060 modules transformed; root typecheck, targeted ESLint, backend build, and `git diff --check` passed
- Monthly-list reference verification passed against live SQL/OpenAI: `tampilkan seluruh list PRF dalam bulan ini` returned only PRFs `49642` and `49656`; their View PRF actions are embedded in the Markdown table and unrelated intermediate references are filtered in both backend and frontend
- Production dependency audit reports 12 existing findings (11 high, 1 moderate), including an unpatched `xlsx` advisory; no automatic audit fix was applied because it would broaden dependency changes beyond this feature
- Browser UAT accepted by the product owner on `2026-08-05`

## Planned Phase 13 - PRF Assistant Enhancements

### Status

Planned - not started

### Objective

Evolve the assistant from read-only search into an auditable operational copilot while preserving fixed tools, application-enforced authorization, session-only conversation history, and the no-document-content boundary.

### Source Documents

- `docs/prf-ai-chatbot.md`
- `docs/prf-ai-chatbot-enhancement-roadmap.md`
- `docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Approved Planning Order

1. Phase 13A: evidence, follow-up actions, structured session context, and ambiguity resolution
2. Phase 13B: analytics, workflow intelligence, attachment metadata intelligence, and on-demand briefing
3. Phase 13C: charts, exports, local saved questions, role-aware presentation, and optional voice input
4. Phase 13D: scheduled briefing, durable saved queries, governed sharing, and notification subscriptions after foundation approval
5. Future governed expansion: document understanding and safe write-action drafts remain outside the immediate scope

### Completion Gate

No Phase 13 item is considered active or complete until it has its own checklist, applicable OpenAPI updates, business-definition decisions, and recorded live verification evidence.

## Phase 13A - Trust And Conversation Control

### Status

In Progress

### Objective

Make assistant answers auditable and conversationally safe by exposing calculation evidence, limiting follow-up actions to application-approved choices, making session context visible/removable, and resolving materially ambiguous business terms before querying.

### Source Documents

- `docs/prf-ai-chatbot.md`
- `docs/prf-ai-chatbot-enhancement-roadmap.md`
- `docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Checklist

- [x] Return structured calculation evidence from read-only tools
- [x] Return allow-listed follow-up actions rather than unsupported prose suggestions
- [x] Add visible/removable PRF, period, department, and purchase-definition context chips
- [x] Add ambiguity choices for materially different interpretations of `bought`, `completed`, `pending`, `value`, and `spending`
- [x] Keep all Phase 13A state in browser `sessionStorage`
- [x] Update `docs/openapi.yaml` for request and response contract changes
- [x] Complete typecheck, build, lint, and live SQL/OpenAI verification
- [x] Unify legacy/current attachment path resolution for preview, download, folder scan/sync, and AI rescan
- [ ] Complete targeted browser UAT for clarification choices, evidence disclosure, follow-up actions, and context removal

### Output

- Auditable assistant responses with filters, definitions, date basis, time zone, and result counts
- Safe one-click follow-up prompts
- User-controlled structured session context
- Clarification before executing ambiguous business queries

### Challenge / Verification

- Backend TypeScript build passed: `npm --prefix backend run build`
- Root TypeScript check passed: `npx tsc --noEmit`
- Frontend production build passed: `npm run build` (2,060 modules transformed; existing bundle-size warning remains)
- Full ESLint completed with zero errors and nine pre-existing Fast Refresh warnings
- `docs/openapi.yaml` parsed successfully and `git diff --check` passed
- Deterministic ambiguity checks returned the approved choices for completed PRFs/items, pending status/missing PO, and requested/item value
- Live resolved-query verification for `bought this week` returned two line items across PRFs 49656 and 49642, with structured evidence and allow-listed follow-up actions
- Attachment path compatibility tests passed for direct PRF folders (reference pattern PRF 49099), company-nested folders, legacy UNC paths, and forward-slash deployment paths
- Backend TypeScript build passed after preview, scan/sync, download, and AI-rescan were moved to the shared storage resolver
- `docs/openapi.yaml` was reviewed and its attachment/scan descriptions were synchronized; route shapes and response schemas did not change
- Targeted browser UAT remains pending; Phase 13A stays `In Progress` until accepted

## Completion Rule

No phase should be marked complete until:

- all checklist items for that phase are complete
- challenge / verification evidence is explicitly recorded
- related documentation is synchronized
- `docs/openapi.yaml` is updated whenever backend contract behavior changes
