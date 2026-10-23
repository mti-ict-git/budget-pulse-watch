# Implementation Roadmap

## Purpose

This roadmap restores the formal phase tracker required by `AGENTS.md` and defines the active execution order for budget-control hardening, historical governance, and release-readiness work.

## Status Summary

- Roadmap status: In Progress
- Active phase: `Phase 13B - Operational Intelligence`
- Last updated: `2026-10-22`

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
- [x] Separate the literal Project Description/Area value from the semantic PRF description
- [x] Normalize Title, Description, summary, and Required For deterministically from active item rows
- [x] Show raw OCR header values beside normalized proposals before optional header apply
- [x] Keep single-document and per-page OCR prompts semantically equivalent
- [x] Expose every unmatched existing item with an explicit Keep or Mark Cancelled reconciliation choice
- [ ] Generate contextual semantic Title and Description separately from literal item specifications and Project Area
- [x] Update `docs/openapi.yaml` and policy documentation
- [ ] Complete build/typecheck and end-to-end rescan verification

### Output

- Existing PRFs can be repaired from their original source document
- Missing item cost codes can be reviewed and applied without recreating the PRF
- Unmatched existing items remain intact unless handled manually outside the rescan workflow
- Short area labels such as `AIM` are preserved as `ProjectArea` and are not reused as the user-facing description
- Rescan apply is bound to the exact server-generated preview snapshot rather than trusting client-edited OCR payloads
- Unmatched historical items are never hard-deleted by rescan; an authorized user may explicitly mark them Cancelled with audit evidence

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
- Rescan reconciliation now exposes explicit per-item decisions for matched OCR rows and unmatched existing rows; automatic position-based matching was removed
- Targeted ESLint passed for `OCRRescanDialog`, `PRFDocuments`, and `PRFFileExplorer`
- Backend typecheck, targeted rescan UI lint, and production build were rerun successfully after item-status detection and total reconciliation were added
- Full frontend TypeScript check remains blocked by three pre-existing errors in `BudgetOverview.tsx` and `Dashboard.tsx`; no rescan-file TypeScript errors were reported
- Preview/apply end-to-end verification remains pending because the local frontend/backend processes were not running
- Semantic normalization challenge passed for PRF-like input with raw area `AIM`: `ProjectArea` remained `AIM`, the title used the active handset item, and the description included both the handset and beneficiary context
- Backend TypeScript build, targeted rescan UI ESLint, frontend production build (2,060 modules), and `git diff --check` passed after the semantic-header correction
- Migration `025_add_prf_project_area.sql` was applied successfully; live verification confirmed `PRF.ProjectArea` is `NVARCHAR(100)`, `vw_PRFSummary` exposes it, and `SchemaMigrations` records the migration
- Live create/rescan UAT remains pending before Phase 11 can close

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

Completed

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
- [x] Complete targeted browser UAT for clarification choices, evidence disclosure, follow-up actions, and context removal

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
- Browser UAT accepted by the product owner; Phase 13A is complete

## Phase 13B - Operational Intelligence

### Status

In Progress

### Objective

Add governed read-only operational intelligence to the assistant, beginning with CAPEX/OPEX budget utilization, remaining budget, risk thresholds, and contributing PRFs using the same item-level definition as the dashboard and reports.

### Source Documents

- `docs/prf-ai-chatbot.md`
- `docs/prf-ai-chatbot-enhancement-roadmap.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`
- `docs/budget-control-policy.md`

### Budget Intelligence Checklist

- [x] Add a bounded budget summary/breakdown tool filtered by fiscal year, CAPEX/OPEX, department, COA, and risk threshold
- [x] Add a bounded contributing-PRF tool for a selected COA/cost code
- [x] Use non-cancelled `PRFItems.Quantity * UnitPrice` and item cost-code-to-COA allocation
- [x] Include annual allocation plus approved carry-forward in total available budget
- [x] Return structured evidence, safe follow-up actions, and PRF references
- [x] Add visible/removable fiscal-year and expense-type session context
- [x] Update `docs/openapi.yaml` for chatbot context and response behavior
- [x] Complete typecheck, build, lint, and deterministic SQL-shape tests
- [ ] Complete live SQL/OpenAI verification from a network-authorized environment
- [x] Complete targeted browser UAT for CAPEX/OPEX summary, risk list, contributor references, and context removal

### Workflow Intelligence Checklist

- [x] Add a bounded workflow-issue tool for stale PRFs, missing PO, missing attachment, missing/unknown cost code, and header/item amount mismatch
- [x] Exclude cancelled PRFs/items from actionable issue calculations where applicable
- [x] Make aging threshold explicit and return per-issue counts plus matching PRF references
- [x] Support fiscal-year, department, CAPEX/OPEX, issue-type, and result-limit filters
- [x] Return structured evidence and allow-listed follow-up actions
- [x] Update `docs/openapi.yaml` and chatbot behavior documentation
- [x] Complete typecheck, build, lint, and deterministic SQL-shape tests
- [ ] Complete live SQL/OpenAI verification from a network-authorized environment
- [x] Complete targeted browser UAT for workflow issue summary and drill-down

### Attachment Metadata Intelligence Checklist

- [x] Add a bounded metadata-only attachment issue tool for missing files, duplicate-looking names, unsupported types, oversized files, and PRFs updated after their latest attachment
- [x] Keep physical-file availability separate from database metadata presence
- [x] Return exact filenames plus trusted Preview/Download and View PRF references
- [x] Support fiscal-year, department, issue-type, maximum-size, and result-limit filters
- [x] Return structured evidence and allow-listed follow-up actions
- [x] Update `docs/openapi.yaml` and chatbot behavior documentation
- [x] Complete typecheck, build, lint, and deterministic SQL-shape tests
- [ ] Complete live SQL/OpenAI verification from a network-authorized environment
- [ ] Complete targeted browser UAT for attachment issue summary and inline table actions

### On-Demand Daily Briefing Checklist

- [x] Add a bounded briefing tool using an explicit Asia/Jakarta calendar date
- [x] Include new PRFs, recently updated PRFs, audited status changes, PO-bearing item activity, and attachment uploads
- [x] Include stale PRF attention and CAPEX/OPEX budget-risk summaries using governed existing definitions
- [x] Return exact filenames and trusted PRF/file references
- [x] Support fiscal-year, department, CAPEX/OPEX, aging threshold, date, and result-limit filters
- [x] Keep briefing on-demand and session-only with no scheduler or durable briefing records
- [x] Update `docs/openapi.yaml` and chatbot behavior documentation
- [x] Complete typecheck, build, lint, and deterministic tests
- [ ] Complete live SQL/OpenAI verification from a network-authorized environment
- [ ] Complete targeted browser UAT for daily briefing sections and drill-down actions

### Output

- Read-only CAPEX/OPEX utilization and remaining-budget answers
- COA-level budget risk visibility with explicit thresholds
- Traceable contributing PRFs without arbitrary SQL
- Shared definitions between chatbot, dashboard, reports, and exports

### Challenge / Verification

- Backend TypeScript build passed: `npm --prefix backend run build`
- Root TypeScript check passed: `npx tsc --noEmit`
- Frontend production build passed: `npm run build` (2,060 modules transformed; existing bundle-size warning remains)
- Full ESLint completed with zero errors and nine pre-existing Fast Refresh warnings
- `docs/openapi.yaml` parsed successfully and `git diff --check` passed
- Deterministic budget-tool challenge passed eight checks: item-level value, item cost-code allocation, cancelled exclusion, fiscal-year fallback, carry-forward inclusion, bounded results, CAPEX/FY context, and PRF references
- Live SQL verification is blocked from this workspace because SQL Server `10.60.10.47:1433` is unreachable
- Live OpenAI tool-selection verification is blocked from this workspace by an outbound connection error
- Phase 13B remains `In Progress` pending network-authorized live SQL/OpenAI verification and the remaining planned slices
- Workflow-intelligence deterministic challenge passed nine checks: bounded results, cancelled exclusion, explicit stale threshold, missing PO, missing attachment metadata, missing/unknown cost code, amount mismatch, CAPEX/OPEX filtering, and PRF references
- Backend build, root TypeScript check, full ESLint (zero errors; nine existing warnings), OpenAPI YAML parse, and `git diff --check` passed after the workflow-intelligence slice
- Workflow-intelligence live SQL/OpenAI verification inherits the same network blockers recorded above
- Browser UAT for the delivered Phase 13B Budget and Workflow Intelligence slices was accepted by the product owner
- Attachment references named in Markdown table rows now render trusted Preview/Download actions inline; only unmatched references use fallback cards
- Backend reference filtering no longer renders unrelated attachment cards whose exact filenames were not used in the answer
- `docs/openapi.yaml` was reviewed for the attachment-table refinement; no update was required because request and response contracts did not change
- Attachment-intelligence deterministic challenge passed nine checks: bounded query, metadata-only operation, duplicate filenames, unsupported types, size threshold, PRF-update freshness, missing metadata, trusted file reference, and trusted PRF reference
- Backend build, root TypeScript, frontend production build, full ESLint (zero errors; nine existing warnings), OpenAPI YAML parse, and `git diff --check` passed after the attachment-intelligence slice
- Attachment-intelligence live SQL/OpenAI verification remains pending in a network-authorized environment
- Corrected PRF recency semantics: newest request, latest update, and highest PRF number are explicit bounded sort modes; standalone `terbaru/latest/newest` is not used as a search keyword
- PRF-recency deterministic challenge passed six checks: literal recency term removal, explicit sort mode, effective request-date ordering, separate update ordering, separate numeric PRF ordering, and bounded result limit
- Backend/root TypeScript, frontend production build, full ESLint (zero errors; nine existing warnings), OpenAPI YAML parse, and `git diff --check` passed after the recency correction
- Daily-briefing deterministic challenge passed nine checks: Jakarta date, explicit date, bounded sections, new PRFs, audited status changes, PO caveat, trusted attachment reference, stale attention, and budget attention
- Backend/root TypeScript, frontend production build, full ESLint (zero errors; nine existing warnings), OpenAPI YAML parse, and `git diff --check` passed after the daily-briefing slice
- Daily-briefing live SQL/OpenAI verification remains pending in a network-authorized environment

## Completion Rule

No phase should be marked complete until:

- all checklist items for that phase are complete
- challenge / verification evidence is explicitly recorded
- related documentation is synchronized
- `docs/openapi.yaml` is updated whenever backend contract behavior changes


## Merdeka UI workstream — first slice (2026-10-22)

Status: UI slice implemented and browser-verified locally. Phase 13B remains In Progress.

### Objective and sources

Match authenticated shell, PRF Monitoring and one detail dialog to the approved
merdeka-frontend template while preserving existing data/permission handlers.
Sources: AGENTS.md, README.md, docs/project-onboarding.md, docs/openapi.yaml,
docs/budget-control-policy.md, installed Merdeka skill and bundled source patterns.

### Checklist

- [x] Vendor assets copied unchanged; namespaced generated adapter avoids utility collisions
- [x] Shell and mobile drawer adapted; logo and collapse preference verified
- [x] PRF table/filter/pager and detail panel adapted; API contracts unchanged
- [x] Search/pager reset bug and stale list request race corrected within PRF view
- [x] IAB desktop/phone interaction checks and screenshots recorded
- [x] DESIGN.md, UX-CONTRACT.md and docs/merdeka-ui-rollout.md maintained
- [x] Frontend TypeScript baseline errors resolved in the second UI slice
- [ ] Legacy application-wide static-UX debt remains outside the UI rollout

### Output and challenge / verification

Production build and changed-file lint passed. Browser checks include filtering,
no-results/clear, page 2 stability, expansion, selection, detail Escape/Close,
sidebar persistence, mobile drawer focus and synthetic 503/Retry recovery.
Evidence and limitations: docs/merdeka-ui-rollout.md and artifacts/merdeka-ui/.
No backend deployment, production authentication, sync/upload/delete UAT or full
Phase 13B completion is claimed. docs/openapi.yaml reviewed; no contract change.


## Merdeka UI workstream — Dashboard / Budget slice (2026-10-22)

Status: implemented and locally verified. Phase 13B remains In Progress.

### Objective and source documents

Continue the approved Merdeka v2 design on Dashboard and Budget Overview while
preserving budget calculations, HR / IT scope, fiscal-year governance and API
handlers. Sources: DESIGN.md, UX-CONTRACT.md, docs/project-onboarding.md,
docs/budget-control-policy.md, docs/historical-budget-governance.md,
docs/openapi.yaml and the installed merdeka-frontend dashboard template.

### Checklist

- [x] Source-style metric tiles, Dashboard budget ring/panels and alerts
- [x] Budget filters, summary, utilization, readiness and detail tables
- [x] Retained cut-off/import/carry-forward controls and server contracts
- [x] Budget create/edit styling, COA popup, keyboard and return focus
- [x] Visible-row CSV export and filter-preserving refresh
- [x] Superseded request guard and frontend TypeScript baseline corrections
- [x] Desktop/phone success, empty, no-results, error, closed-year checks in IAB
- [x] DESIGN/UX contract and rollout evidence maintained

### Output and challenge / verification

Frontend typecheck, full lint (zero errors/eight existing warnings), production
build and vendor asset checks passed. Browser UAT covered refresh, navigation,
filters, CSV, create validation, edit population, Escape/Cancel, popup geometry,
closed-year gating and phone-local scrolling. Strict static audit retained 52
legacy/heuristic findings; whole-product UX compliance is not claimed.

Evidence: docs/merdeka-ui-rollout.md and
artifacts/merdeka-ui/overview-verification.json. No live mutation or release UAT
is claimed. OpenAPI reviewed; this UI slice required no backend contract change.


## Merdeka UI workstream - COA / Reports slice (2026-10-22)

Status: implemented and locally verified. Phase 13B remains In Progress.

### Objective and source documents

Extend captured Merdeka v2 styling to COA Management and Reports/Audit Log while
preserving mandatory COA governance and existing service handlers. Sources:
DESIGN.md, UX-CONTRACT.md, docs/project-onboarding.md, budget governance documents,
docs/openapi.yaml and installed Merdeka Employee Master/table/dialog patterns.

### Checklist

- [x] Shared summary cards, compact master table, filters and bulk toolbar
- [x] COA create/edit/detail/menu/confirmation styling and protected baseline rules
- [x] Honest page-local counts, filter page resets, eligible selection and Retry
- [x] Audit Log styling, applied search, request aborts and server pagination
- [x] IAB desktop/390px, loading/empty/error recovery and keyboard dialog checks
- [x] Typecheck/lint/build/vendor checks and design/behavior/evidence documentation

### Output and challenge / verification

See docs/merdeka-ui-rollout.md and artifacts/merdeka-ui/coa-reports-verification.json.
Typecheck/build pass; lint zero errors/eight existing warnings. Strict audit legacy
and heuristic findings remain documented. OpenAPI reviewed: no backend contract
changes. No production mutation, sync, authentication or deployment UAT is claimed.


## Merdeka UI workstream - PRF refinement (2026-10-22)

Status: implemented and verified locally against original backend. Phase 13B
remains In Progress. Sources: user browser comments, DESIGN.md, UX-CONTRACT.md,
Merdeka Employee Master/table reference and existing PRF contracts.

- [x] Default-collapsed accessible Filters, retained state and active count
- [x] Source-style compact identity/badges/actions and 56px table rows
- [x] Sticky table header and desktop column offsets; tablet/phone local scroll
- [x] IAB original-backend search/selection/expansion/detail checks
- [x] TypeScript, changed-file lint, production build and evidence documentation

Output/evidence: docs/merdeka-ui-rollout.md and
artifacts/merdeka-ui/prf-refinement-verification.json. Mutation operations were
not submitted, and no commit/push/deployment was performed.


## Merdeka UI workstream - selected-item workspace / option C (2026-10-22)

Status: implemented and locally verified. Phase 13B remains In Progress.

### Objective and sources

Implement the user-approved option C with a full-width initial list and an item
panel only after selection. Sources: selected mockup, DESIGN.md, UX-CONTRACT.md,
existing PRF/item service contracts, project onboarding and governance documents.

### Checklist

- [x] ID-based panel state, current-data resolution, Close/Escape/focus behavior
- [x] Independent table scroll, compact shared toolbar and responsive stacked panes
- [x] Retained all-page item view, complete columns and all existing action handlers
- [x] Item table with secondary metadata and original edit dialog/update handler
- [x] Original-backend browser navigation/dialog checks and fixture failure/empty UAT
- [x] TypeScript, full lint, production build, static audit and evidence documentation

### Output and verification

Evidence and limitations: docs/merdeka-ui-rollout.md and
artifacts/merdeka-ui/prf-split-verification.json. Strict audit legacy findings remain
documented. No new API or backend changes; no mutation policy/currency change.
User will test live mutations before Git push. No commit or push was performed.


## Merdeka UI workstream — login (2026-10-22)

Status: implemented and locally verified; Phase 13B remains In Progress.
Sources: user request, skill login source, DESIGN.md, UX-CONTRACT.md and
docs/openapi.yaml credentials contract.

- [x] Source login composition/assets and dedicated scoped PMS token adapter
- [x] Existing credentials service, redirect and session behavior retained
- [x] Required validation, busy guard, password toggle and Radix access guide
- [x] IAB desktop/390px, invalid/loading/synthetic-success, keyboard and dialog QA
- [x] TypeScript, changed-file lint and production build passed

Output/evidence and limits: docs/merdeka-ui-rollout.md, local QA screenshots and
static audit. No new backend contract, real login mutation or production release.

## Merdeka UI workstream — expanded PRF items (2026-10-22)

Status: implemented and locally verified. Phase 13B remains In Progress.
Objective/sources: user browser comments, DESIGN.md, UX-CONTRACT.md and existing
PRF item/API response and modification contracts.

- [x] Inline item count next to PRF number
- [x] Single workspace moved to wide Radix modal, inline panel closed automatically
- [x] Direct part/cost/PO split columns and expanded metadata, legacy part fallback
- [x] Existing edit handler retained; nested Escape/focus and phone overflow verified
- [x] TypeScript/lint/build and scoped static audit recorded

Output/challenge evidence and limits: docs/merdeka-ui-rollout.md. Real-backend UI
reads and open/cancel only; no business writes, Git publish or deployment.

Merdeka UI follow-up (2026-10-22): [x] sidebar logo/watermark fit and removal of PRF Test OneDrive diagnostics. TypeScript/lint and IAB expanded/collapsed checks passed; evidence in docs/merdeka-ui-rollout.md. Phase 13B remains In Progress; no backend/API change.

Merdeka UI follow-up (2026-10-23): [x] inline item-panel opening animation with reduced-motion override. CSS parse and IAB desktop/stacked checks passed; evidence in docs/merdeka-ui-rollout.md. Phase 13B remains In Progress; no API change.

PRF animation follow-up (2026-10-23): [x] exit presence, cancellation and focus return; [x] replace width tween with 160ms transform/opacity after user feedback. CSS parse/IAB checked; see rollout notes. No API change or Git publication.

PRF item export follow-up (2026-10-23): [x] scoped panel/modal Excel export; [x] PRF summary and detailed items; [x] actual browser download/read-back and synthetic workbook round-trip; [x] TypeScript/lint and phone bounds checked. See rollout evidence. Phase 13B remains In Progress; no API change.

Styled PRF Excel follow-up (2026-10-23): [x] Merdeka workbook styling/filter/freeze/number formats; [x] lazy writer and busy/error guard; [x] actual XLSX read-back and rendered summary review, synthetic preservation checks, TypeScript/lint/build. Evidence in rollout notes. Phase 13B remains In Progress; no API change.

MTI brand follow-up (2026-10-23): [x] original corporate SVG added to login/sidebar; [x] loaded assets and expanded/collapsed layout verified in IAB, TypeScript/lint passed. Evidence in rollout notes. No API change; Phase 13B remains In Progress.

Brand refinement (2026-10-23): [x] smaller inline sidebar logos, browser geometry/loading and CSS validation passed; rollout notes contain evidence. Phase 13B unchanged.

Sidebar watermark review (2026-10-23): [x] source full-width/bottom anchoring with .06 opacity; header pair retained inline. Evidence in rollout notes. Phase 13B unchanged; no API change.

Merdeka visual audit (2026-10-23): [x] nine route bodies/shared shell plus representative dialogs and 390px inspection reviewed against skill/source. Findings and remaining migration priorities: docs/merdeka-visual-review-2026-10-23.md. Audit complete; fixes remain outstanding. Phase 13B remains In Progress; no API change.

## Merdeka UI — Settings and Create PRF audit fixes (2026-10-23)

Status: implemented and verified locally; Phase 13B remains In Progress.
Sources: user request, merdeka-frontend long-form/login separation, DESIGN.md,
UX-CONTRACT.md, visual-review report and existing OCR/Settings/PRF API contracts.

- [x] Compact shared long-form typography, cards, fields and blue tabs
- [x] Mobile Settings tab wrap and Create PRF Back/title/field stacking
- [x] Existing OCR/manual/settings handlers and permissions retained
- [x] Shared user dialogs, field labels, popup dimensions and focus behavior
- [x] Read-only real-backend IAB states plus local draft item arithmetic/removal
- [x] TypeScript/lint, static audit comparison and build evidence in rollout notes

Output: docs/merdeka-ui-rollout.md and local QA screenshots/JSON. Settings writes,
OCR execution and actual PRF/user creation were not performed. No OpenAPI change,
commit/push or deployment. Other audit findings remain outstanding.


OCR rescan follow-up (2026-10-23), Phase 13B: backend extraction validation, source/snapshot binding and PDF completeness guards implemented. Regression checks pass for wrong PRF, zero item overlap, screenshot-style totals, missing/invalid quantities, ambiguous matching and cancellation reconciliation. Backend typecheck passed (`node node_modules/typescript/bin/tsc --noEmit`). Isolated route regressions passed (`node scripts/test-ocr-rescan.cjs`): invalid preview/apply, stale source/items and legacy tokens rejected before any transaction. Pure validation tests passed (`node -r ts-node/register src/services/rescanValidation.test.ts`). Live PDF OCR has not been re-run; original source/AI mismatch root cause remains unproven. OpenAPI reviewed/updated (422/409). No PRF data repair, sync, commit, push or deployment performed.

## Merdeka UI — Budget / COA audit fixes (2026-10-23)
Status: implemented and verified locally; Phase 13B remains In Progress.
Sources: visual review, Merdeka skill, DESIGN/UX contract and budget governance docs.
- [x] Full Budget currency values at laptop widths and responsive metric layout
- [x] Compact COA summary/governance/filter/table hierarchy
- [x] Bounded Budget/COA dialogs with internal body scroll and stable actions
- [x] Existing handlers, mandatory protections and data policy retained
- [x] IAB desktop/phone, dropdowns, invalid form, keyboard and paging checked
- [x] TypeScript, lint, build and verification evidence in merdeka-ui-rollout.md
No business writes during QA. No API change or Git/deployment publication.

OCR release (2026-10-23): commit 5b0e6ba deployed backend-only; image/revision health, API proxy, TLS and protected CIFS storage verified; frontend/worker retained. Evidence: docs/releases/2026-10-23-ocr-rescan.md. Phase 13B remains In Progress; live AI/UAT not claimed.

Merdeka frontend publication (2026-10-23): completed Pomon Work changes committed/pushed, final frontend image revision 821eca3 deployed and healthy. Production IAB confirmed new login with MBM/MTI logos; API/public assets/TLS verified. Backend OCR and worker retained; Phase 13B remains In Progress. Evidence: docs/releases/2026-10-23-merdeka-frontend.md.

OCR native PDF follow-up (2026-10-23), Phase 13B: reproduced PRF 54123 image OCR misread (UPS 6.3m vs source 6.6m); candidate adds embedded text + high-detail image evidence. Backend compile, offline prompt and prior guard/route regressions passed. Live candidate AI test awaits explicit document/provider approval; not marked verified or deployed. See budget-control-policy.md. No API contract change.

OCR native PDF verification (2026-10-23): after explicit user authorization, read-only OpenAI retest on original PRF 54123 matched all 19 rows including part/cost codes, quantities/prices/totals/statuses; total 54,904,429, UPS 6,600,000. Header/item hashes unchanged. Candidate remains uncommitted/undeployed; no apply or data repair. Phase 13B still In Progress.

Native PDF OCR release requested (2026-10-23): backend-only publication authorized after PRF 54123 read-only verification. Scope excludes scan apply, PRF repair and schema changes; frontend/Pronto worker must be retained. OpenAPI reviewed: no request/response contract change.

Native PDF OCR release verified (2026-10-23): 995d607 published and deployed backend-only, healthy; final image offline regressions/API proxy/TLS/CIFS checks passed. Frontend/worker retained, PRF 54123 and 52726 hashes unchanged. No scan apply/data repair/migration. Evidence: docs/releases/2026-10-23-native-pdf-ocr.md. Phase 13B remains In Progress.
