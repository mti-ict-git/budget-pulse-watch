# Implementation Roadmap

## Purpose

This roadmap restores the formal phase tracker required by `AGENTS.md` and defines the active execution order for budget-control hardening, historical governance, and release-readiness work.

## Status Summary

- Roadmap status: In Progress
- Active phase: `Phase 14 - Optional Local PRF Upload Parser`
- Phase 13B remains a separate existing stream; no chatbot scope change in Phase 14.
- Last updated: `2026-10-25`

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


## Phase 14 - Optional Local PRF Upload Parser

### Status

Deployed — upload and production preview verified. Local-parser rescan integration is deferred by the user; real-document save acceptance remains pending.

### Objective

Offer an opt-in local PDF parser alongside the existing LLM method, with editable preview and explicit review before creation.

### Source Documents

- `docs/prf-local-upload.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`
- `DESIGN.md` and `UX-CONTRACT.md`

### Checklist

- [x] Preserve LLM as default and persist optional local upload method
- [x] Package the regression-tested Python parser and local OCR runtime
- [x] Bind preview to user/source and require reviewed data before create
- [x] Show editable fields, source PDF and review flags before save
- [x] Preserve existing rescan dispatch and behavior
- [x] Update API/runtime documentation and record validation evidence

### Output

Upload supports two explicit methods, with no automatic cloud fallback for local processing.

### Challenge / Verification

Implementation verified locally: 55 unique PDFs passed adapter regression against the established parser-v2 corpus; eight backend tests passed, including preview binding/review validation, edited-data save, rollback/retry, provider isolation, real annotation extraction and unchanged rescan handlers. Backend TypeScript, Vite production build and targeted ESLint passed. Browser fixture evidence is recorded in `docs/reports/prf-upload-browser.json`.

Migration 026 committed on server59 with existing settings preserved. Frontend/backend images deployed; local OCR runtime and production-proxied PDF preview verified without PRF writes or cloud calls. LLM remains the default; provider configuration and compiled rescan handlers are preserved. Pronto Sync retained its container ID. See docs/releases/2026-10-25-prf-local-upload.md for evidence and rollback. Saving a real PRF remains business acceptance, not part of preview smoke testing.

## Phase 15 - Pronto Split-PO Lines And Approval History

### Status

Merged in PR #2 (`4320d4d`) and deployed to production on 2026-11-14. Migration 027 applied to production on 2026-11-12. Production dry run on 51727 passed. See `docs/releases/2026-11-14-pronto-po-lines-approvals.md`.

### Objective

Make the item sync see every line of a requisition, including lines on split POs, and store the Pronto Approval Status history of each related PO. Backlog items 3 (Pronto as item source of truth) and 4 (Next Action By / approval history) in `docs/backlog-dashboard-pronto-2026-11.md`.

### Source Documents

- `docs/backlog-dashboard-pronto-2026-11.md` (case study 51727 / 53851)
- `docs/pronto-sync.md`
- `docs/openapi.yaml`
- `docs/database-schema-specification.md`

### Checklist

- [x] Read PO E001 Lines (with Req'n No from Line Detail) for the PRF's original and split POs
- [x] Read PO E001 Approval Status for the same POs (read-only screens only)
- [x] Merge Lines items into the item code map without overwriting INV E071 values
- [x] Store approval history: migration 027, `GET`/`PUT /api/prfs/{id}/pronto-approvals`, OpenAPI
- [x] Show the history in the PRF detail dialog
- [x] Apply migration 027 on production (2026-11-12)
- [x] Deploy backend, frontend and the pronto_sync worker (2026-11-14)
- [x] Live dry run on 51727: expect 6 matched items (2 from `po_lines`) and approval history for 51727 and 53851 (2026-11-14)

### Output

PRF 51727's PowerEdge R670 and ME5224 are linked to split PO 53851. Each PRF shows the Pronto approval steps per PO.

### Challenge / Verification

- Selectors were checked live in Pronto (read-only) on 2026-11-11 at the worker viewport (1280x800): function box, Standard tab, Find with exact-match check on `tr.dg-row.selected`, Lines grid headers, Line Detail `label.card-field` positions (Req'n No at `x:58,y:24`), Approval Status grid, card close button.
- Python: 12 offline tests pass (`backend/scripts/tests/`), built from the real 51727 / 53851 screen data. They show the old path finds 4 items and the new path finds all 6 with split 53851, and that line totals add up to IDR 8,400,000 + 3,405,276,500.
- Backend: `tsc` passes; `node --test backend/tests/` has 11 passing, 0 failing, 2 skipped (pre-existing skips). 5 of the passing tests are new payload-validation tests.
- Frontend: `tsc -p tsconfig.app.json`, `vite build` and ESLint on the changed files pass.
- Migration 027 on production `PRFMonitoringDB` (2026-11-12): applied only 027, in one transaction, from inside the backend container with its own DB settings; recorded in `SchemaMigrations`. Verified: table with 10 columns, unique `(PRFID, PONumber, EntrySeq)`, index on `(PRFID, ActionAt)`, FK to `PRF` with `ON DELETE CASCADE`, 0 rows. Backend container kept running (0 restarts). `db-migrate.js` was not used because migration 026 is applied but not recorded in `SchemaMigrations`, so its "latest unapplied" pick is unreliable.
- Local end-to-end test (2026-11-12), isolated from production: SQL Server in a local container (`azure-sql-edge`, port 14333) built from `backend/database/schema.sql`; backend from source on port 3101 with DB settings overridden by environment (the local `backend/.env` points at production and was not used for the DB); Vite on port 8101 proxying to it. PRF 51727 seeded as a test row. Payloads built with the worker's own `parse_approval_rows` + `_approval_payload` from the 51727 / 53851 screen data. Results: `PUT` saved 8 rows (51727) and 3 rows (53851); `GET` returned 11 rows with wall-clock times unchanged (`2026-09-10T08:52:28`); re-sending the same PO twice still left 11 rows (replace, not append); no token → 401, bad `actionAt` → 400, unknown PRF → 404. The PRF detail dialog showed the "Pronto Approval History" card: PO 51727 "Latest: Approved PO by <PO approver>", PO 53851 with the "Split PO" badge and "Latest: Approve by <third approver>", and the sync timestamp.
- Live Pronto run into the local backend (2026-11-12): `prf_pronto_sync.py --sync-prf-items --prfno 51727 --apply --add-missing-item`, run from the Mac against live Pronto (read-only screens) with `--base-url` pointing at the local backend. First run found 0/2 POs (`find_button_not_found`): `_click_toolbar_button` only matched `role=button`, but Pronto's Find is not always exposed that way. Fixed with exact-label fallbacks (menuitem, link, exact text; never partial matches) and a short retry. Second run: INV E071 4 rows, PO details found 2/2 (exact match on `tr.dg-row.selected`). PO 51727: 5 lines (1 item: rack `7125-03-297513`), 14 approval steps. PO 53851: 16 lines, 5 items all with `Req'n No 51727` including PowerEdge R670 `7021-03-330869` and ME5224 `7025-03-309184`, no `detail_not_refreshed`, 9 approval steps. Local DB after the run: 6 PRF items, 5 with `SplitPONumber = 53851`; approval history 14 + 9 rows (replacing the earlier test rows). The dialog showed the full history. Note: existing item values are kept on purpose, so the rack keeps its INV E071 estimated unit price (IDR 10.4M) rather than the PO line price.
- Production deploy (2026-11-14): backend, frontend and `pronto_sync` rebuilt on docker59 from the merged code; only the changed files were copied to `/root/budget-pulse-watch`, after checking that the server's copies of every changed code file matched the pre-PR version. `/health` 200; `GET`/`PUT /api/prfs/{id}/pronto-approvals` return 401 without auth; frontend bundle contains the "Pronto Approval History" card; the worker imports `pronto_po_parse`.
- Production dry run (2026-11-14), inside the deployed `pronto_sync` container: `prf_pronto_sync.py --sync-prf-items --prfno 51727 --max-prfs 1 --dry-run --add-missing-item`. PO details found 2/2; 6/6 items matched, 0 unmatched; 2 changes, both from `po_lines`: items `7021-03-330869` and `7025-03-309184` get `OriginalPONumber 51727`, `SplitPONumber 53851` and `ItemCode`; approval history 14 (51727) + 9 (53851) entries, not written (dry run).
- Not yet verified: the first scheduled apply cycle across all 2026 PRFs with the new code, including its duration.

## Phase 16 - PO E001 Recovery After A Failed Find

### Status

Merged in PR #3 (`323f4e7`) and deployed (`pronto_sync` only) on 2026-11-15. See `docs/releases/2026-11-15-po-e001-recovery.md`.

### Objective

One PO that PO E001 cannot find must not block the POs after it. Fixes the 2026-11-14 production cycle, where approval history was read for only 4 of 61 POs. Working checklist group A in `docs/backlog-dashboard-pronto-2026-11.md`.

### Source Documents

- `docs/backlog-dashboard-pronto-2026-11.md` (working checklist, group A)
- `docs/pronto-sync.md`
- Phase 15 in this roadmap

### Checklist

- [x] Diagnose the production cycle of 2026-11-14
- [x] Close Pronto's "Record not found" message box and leave Find mode after a failed Find
- [x] Before each PO, bring PO E001 back to its order list (close a card on top, reopen the function only when needed)
- [x] Retry a transient Find failure once
- [x] Record the failure reason and Pronto's message in the sync report
- [x] Find out why 41562 is not found
- [x] Offline and live tests
- [x] Deploy `pronto_sync` and run a sync; approval history filled for the 2026 PRFs (check 54850)

### Output

PO E001 reads continue after a missing PO. The sync report says why a PO was not read (`reason`, `message`).

### Challenge / Verification

- Diagnosis (production report `prf_items_batch.json`, 2026-11-14 cycle): POs are read in ascending order. 39906, 39908, 41401 and 41527 were read; 41562 returned `selected_order: ''` after 43 s; then `find_button_not_found` for 7 POs and `order_list_not_visible` for every PO after that (61 POs, 4 read, 0 errors recorded).
- Reproduced live (read-only, 2026-11-15): Find on 41562 shows a Pronto message box "Record not found with key specified" and stays in Find mode; the next Find fails with `find_button_not_found`. 41562 is Cancelled in Pronto (header sync), so it has no PO in PO E001; not finding it is correct.
- DOM checked live: the message box has its own OK (`button.pro-button`); Find mode uses `#pro-nav-ok` / `#pro-nav-cancel`. The recovery clicks only the message box OK and `#pro-nav-cancel`, never `#pro-nav-ok` (which would resubmit the Find). After Cancel the list stays usable in navigation mode, with an empty function-code label.
- Python: 16 offline tests pass, including 3 new browser tests against a static copy of that markup (message OK clicked instead of the Find OK; Find mode left without closing the list; no action on a clean list) and a report test for `reason` / `message`.
- Live gather from the Mac (read-only, 2026-11-15) for 39906, 41527, 41562, 41682, 51727, 53851, 54850 in that order: 41562 `not_found` with Pronto's message in 3.4 s; every other PO found with lines and approvals (39906: 7 lines / 7 approvals after one retry of the first Find; 41682: 20 / 17; 51727: 5 / 14; 53851: 16 / 9; 54850: 6 / 6); PO E001 never had to be reopened; total 105 s.
- Production (2026-11-15): `pronto_sync` rebuilt with the fix; the cycle after the restart read 51 of 61 POs in PO E001 (was 4). The 10 others were reported `not_found` with Pronto's message; 8 of those PRFs are Cancelled. Approval history saved for 41 POs, including 54850 (6 entries). 10 POs were rejected with HTTP 400 because their Approval Status has pending approvers (empty status and date); follow-up tracked in the working checklist (group B).

## Phase 17 - Pending Approvers In The Pronto Approval History

### Status

Implemented on branch `fix/pending-approvers`. Not deployed yet.

### Objective

Store approvers who have not acted yet, instead of rejecting the whole PO. Pronto's Approval Status lists them with an empty status and date. They are also the first data for "Next Action By" (backlog item 4, working checklist group B).

### Source Documents

- `docs/backlog-dashboard-pronto-2026-11.md` (working checklist, group B)
- `docs/openapi.yaml` (`/api/prfs/{id}/pronto-approvals`)
- `docs/releases/2026-11-15-po-e001-recovery.md` (the 10 rejected POs)

### Checklist

- [x] `PUT /api/prfs/{id}/pronto-approvals` accepts an entry with an empty status when `actionAt` is null (stored as status ""); a dated entry still needs a status
- [x] OpenAPI updated (request and response schema)
- [x] PRF detail dialog: "Waiting for" line per PO, "Waiting" badge on pending rows, "Latest" ignores pending rows
- [ ] Deploy backend and frontend; next sync saves the 10 rejected POs (check 53956)

### Output

Every PO whose Approval Status can be read is stored, and the dialog shows who the PO is waiting for.

### Challenge / Verification

- Production cause (2026-11-15 cycle): 10 POs rejected with HTTP 400 (`entries[i].status is required`). Examples from the worker report: 53956 lists "Human Resources CC" and "MTI Cost Control" with empty status and date above the dated steps; 54944 lists "BUYER" the same way.
- No database change: `Status` is `NOT NULL`, pending entries store an empty string. The worker already sends `status: ""` and `actionAt: null` for these rows.
- Backend: `tsc` and build pass; `node --test backend/tests/` 12 pass, 0 fail, 2 skipped (pre-existing). New test: the 53956 shape (pending rows with empty or missing status) is accepted; an entry with a date and no status is still rejected.
- Frontend: `tsc -p tsconfig.app.json`, ESLint on the changed file and `vite build` pass.
- Python: 16 offline tests pass (worker unchanged).

## Phase 18 - Allocated Buyer And Next Action By

### Status

Implemented on branch `feat/allocated-buyer-next-action`. Not deployed yet.

### Objective

Show who owns each PO in Pronto and who it is waiting for. Backlog items 5 (Allocated Buyer) and 4 (Next Action By); working checklist groups C and B.

### Source Documents

- `docs/backlog-dashboard-pronto-2026-11.md` (items 4 and 5, working checklist)
- `docs/database-schema-specification.md` (migration 028)
- `docs/openapi.yaml` (PRF schema)

### Checklist

- [x] Decision (product owner, 2026-11-16): use `Officer` when `Buyer allocation` is empty
- [x] Migration 028: `PRF.AllocatedBuyer NVARCHAR(200) NULL`
- [x] Header sync maps `Buyer allocation`, else `Officer`, into `AllocatedBuyer` (`--sync-allocated-buyer`, default on)
- [x] API: PRF list queries return `AllocatedBuyer`; PRF update endpoints accept it; OpenAPI updated
- [x] PRF detail dialog: "Allocated Buyer" field; "Next Action By" summary at the top of the Pronto approval card (pending approvers per PO)
- [ ] Apply migration 028 on production, deploy backend, frontend and `pronto_sync`, run the header sync

### Output

Each PRF shows its Pronto buyer and, from the approval history, who has to act next.

### Challenge / Verification

- Production data check (header report `prf_pronto_sync_2026.json`, 2026-11-16): 43 PRFs, 36 with a Pronto row; `Buyer allocation` filled on 14, `Officer` used on 22.
- Python: 20 offline tests pass, including 4 new ones (buyer allocation wins, Officer fallback, none when both empty, desired update and change check).
- Backend: `tsc` and build pass; `node --test backend/tests/` 12 pass, 0 fail, 2 skipped (pre-existing).
- Frontend: `tsc -p tsconfig.app.json`, ESLint on the changed files and `vite build` pass.

## Phase 19 - Follow-up Modal After Login

### Status

Deployed on 2026-11-16 (PR #6, merge `71bece2`). The 90-day limit on past Required Date follows in PR #7.

### Objective

Right after login, show the PRFs that need follow-up with their latest status, who they wait for and the buyer. Backlog item 1; working checklist group D.

### Source Documents

- `docs/backlog-dashboard-pronto-2026-11.md` (item 1, working checklist D)
- `docs/openapi.yaml` (`GET /api/prfs/follow-up`)
- Phases 15, 17 and 18 (approval history, pending approvers, Allocated Buyer)

### Checklist

- [x] Decisions (product owner, 2026-11-16): an approver waiting more than 3 days counts; every user sees every PRF; build it today
- [x] Rules and `GET /api/prfs/follow-up` (no database change)
- [x] Modal after login: PRF, status, Next Action By, buyer, reasons; "Open" goes to the PRF; "Remind me later" (until the next login) and "Don't show again today" (per user)
- [x] Deploy backend and frontend; check the modal in production (2026-11-16, PR #6: 31 PRFs listed)
- [x] Limit `past_required_date` to the last 90 days (product owner, 2026-11-16, after seeing PRFs overdue by up to 268 days)

### Output

Users see the stuck PRFs as soon as they log in.

### Challenge / Verification

- Scope: active PRFs of the current budget year only. In production (2026-11-16) there are 35 active 2026 PRFs, but also 67 "active" 2025 PRFs whose status is stale because the Pronto sync only covers 2026; including them would show outdated reasons. `budgetYear` can be passed to widen the scope later.
- Rules (thresholds in `FOLLOW_UP_THRESHOLDS`): approval waiting > 3 days since the last approval step; Required Date passed; "Req. Approved" with no approval step for > 7 days (the 7-day value was proposed and accepted with the 3-day one).
- Backend: `tsc` and build pass; `node --test backend/tests/` 18 pass, 0 fail, 2 skipped (pre-existing); 6 new rule tests (approval waiting over and under 3 days, past Required Date, Req. Approved idle over and under 7 days, closed statuses, sort order).
- Frontend: `tsc -p tsconfig.app.json`, ESLint on the changed files and `vite build` pass.
- Production (2026-11-16, PR #6): the modal appeared after login with 31 PRFs (5 approval waiting, 29 past Required Date, most waiting for BUYER); `GET /api/prfs/follow-up` returns 401 without auth. Some overdue PRFs were up to 268 days past their Required Date, so the product owner limited that rule to 90 days (PR #7; 7 rule tests).

## Phase 20 - Microsoft 365 Sign-in (Entra ID SSO)

### Status

Deployed on 2026-11-24 (PR #11, merge `a91b860`) and verified in production by the product owner the same day. The login page offers Sign in with Microsoft by default and Corporate Account (AD) on request (commit `880b29d`, deployed 2026-11-24).

### Objective

Let users sign in to POMON with their office Microsoft 365 account, while POMON access and roles stay on the existing access list.

### Source Documents

- `docs/m365-sso.md` (design, configuration, Entra ID setup, rollout)
- `docs/openapi.yaml` (`/api/auth/microsoft/*`)
- `docs/open-questions-and-challenges.md` (HTTPS redirect host)

### Checklist

- [x] Backend: OIDC authorization code flow with PKCE, state and nonce; ID token claim checks; match to `LDAPUserAccess` by email, then sign-in name; one-time handoff code in the URL fragment
- [x] LDAP password login and Microsoft 365 sign-in share one session helper (`issueLdapSession`)
- [x] Login page: "Sign in with Microsoft 365" when enabled, error messages for no access, cancelled and expired
- [x] Documentation: setup guide, OpenAPI, env template
- [x] Decide the HTTPS redirect host: `https://pomon.merdekabattery.com` (product owner, 2026-11-24)
- [x] Entra ID app registration (tenant administrator, 2026-11-24)
- [x] Accept the `MS_GRAPH_*` / `MS_SSO_REDIRECT_URI` / `APP_URL` names and a frontend redirect path `/auth/microsoft/callback` that forwards to the backend callback
- [x] Deploy, configure the values in `backend/.env.production` on docker59 (file mode now 600), verify: `/api/auth/microsoft/config` enabled, `/login` redirects to the tenant authorize endpoint with the registered redirect URI and Microsoft shows its sign-in page without an AADSTS error; a real sign-in succeeded (product owner, 2026-11-24)
- [x] Login page: Microsoft as the default choice, Corporate Account (AD) opens the form (checked in a browser locally and in production)

### Output

A "Sign in with Microsoft 365" option that is off until it is configured, with username/password login unchanged.

### Challenge / Verification

- Backend `tsc` and build pass. `node --test backend/tests/microsoft-sso.test.cjs`: 9 tests pass, including the alternative variable names, `APP_URL` → `/login`, `M365_SSO_ENABLED=false` and precedence of `M365_*`; (config gating and GUID tenant, PKCE S256, authorize URL parameters, email then UPN order, rejection of wrong audience, tenant, issuer, nonce, expiry and missing email, malformed token, single-use and expiring store, fragment redirect).
- Endpoint smoke test on a throwaway Express app with a fake tenant: `/config` returns enabled; `/login` returns 302 to the tenant authorize endpoint with state, nonce and PKCE; `/callback` with an unknown state redirects to `#sso_error=expired`, `error=access_denied` to `#sso_error=cancelled`; `/exchange` with an unknown code returns 400.
- Frontend `tsc -p tsconfig.app.json` and ESLint on the changed files pass (one pre-existing fast-refresh warning in `AuthContext.tsx`).
- Not yet verified: the login page in a browser, and a real sign-in against Entra ID (needs the app registration).

## Phase 21 - OCR Reliability

### Status

Deployed on 2026-11-24 (PR #10, merge `9af9831`).

### Objective

Make PRF document reading dependable before improving its accuracy: page rendering that works in the container, a clear message when the AI provider fails, PDF support and a current model for Gemini, an optional second provider, and time limits on provider calls.

### Source Documents

- `docs/prf-local-upload.md` (upload methods)
- `docs/openapi.yaml` (`/api/ocr-prf/preview-extraction`, `/api/ocr-prf/rescan/{prfId}/file/{fileId}/preview`)
- Production logs 2026-11-16 to 2026-11-24 (below)

### Findings (production, 2026-11-16 to 2026-11-24)

- 10 OCR previews. Page rendering failed on 7 with Puppeteer "Timed out after 30000 ms while waiting for the WS endpoint URL", so every affected PDF was sent whole, without the per-page text-layer hint that guards against misread numbers. Launching Chromium by hand in the same container, also as the app user, worked in about 1 s, so the root cause was not reproduced.
- 3 previews failed because the OpenAI account had no credit (HTTP 429 `insufficient_quota`); users saw the generic "Document extraction failed".
- Settings: provider OpenAI, model `gpt-4o`, no Gemini key. Gemini PDFs were refused in code, and its default model (`gemini-1.5-flash`) is retired.

### Checklist

- [x] Render PDF pages with poppler (`pdfinfo`, `pdftoppm` at 144 dpi, `pdftotext -layout`), already in the backend image; Chromium only as a backup (now with `--disable-gpu`, `--disable-dev-shm-usage` and a 60 s launch limit); whole-PDF extraction stays the last resort. The page limit (`OCR_PDF_MAX_PAGES`, default 6) is unchanged.
- [x] Provider errors mapped to codes with user-facing messages: PROVIDER_NO_CREDIT, PROVIDER_RATE_LIMITED, PROVIDER_AUTH, PROVIDER_TIMEOUT, PROVIDER_UNAVAILABLE, PROVIDER_FAILED; `OCR_NOT_CONFIGURED` when the provider has no key. Upload preview and rescan preview return them as HTTP 503 with `code` and `message`.
- [x] Gemini reads PDFs (inline, up to about 18 MB; larger files get `FILE_TOO_LARGE_FOR_PROVIDER`). Default Gemini model is `gemini-2.5-flash`; a stored retired 1.x model is mapped to it; the 1.x choices are removed from Settings.
- [x] Optional fallback (`OCR_PROVIDER_FALLBACK=true`, off by default): a provider-side failure is retried once with the other provider when it has a key, using that provider's default model. Document errors (for example conflicting PRF numbers across pages) are not retried. The preview debug output records `provider` and `fallbackFrom`.
- [x] Provider calls time out (`OCR_PROVIDER_TIMEOUT_MS`, default 120 s); the OpenAI client retries at most once.
- [ ] Deploy; upload one PDF and check the log shows `Rendered N PDF page(s) with poppler`
- [ ] Decide whether to add a Gemini key and enable `OCR_PROVIDER_FALLBACK` (sends documents to a second provider)

### Output

PDF pages are rendered in about a second without a browser; provider problems tell the user what to do; Gemini is a usable alternative.

### Challenge / Verification

- Poppler renderer on 10 real PRF PDFs inside the production container, as the app user (no AI call, no database write): 9 rendered in 0.35 to 1.7 s (1 to 2 pages, 218 to 873 KB of PNG), and the 10-page PDF was refused with `PdfRenderLimitError` and goes whole, as before. The PRF 54123 text layer keeps the row `UPS APC SMC1000I-2UC ... 6,600,000` that vision once misread as 6,300,000. The Chromium path took 7 s on the same kind of file when it worked.
- `node --test backend/tests/ocr-reliability.test.cjs`: 9 pass (no-credit message for OpenAI's two wordings; rate limit, key, timeout, outage and unknown errors told apart for OpenAI and Gemini; retired model mapping; poppler helpers; fallback off by default; fallback to Gemini with its default model; no fallback without a key or for document errors; missing key; Gemini size limit).
- `node --test backend/tests/`: 28 pass, 0 fail, 2 skipped (pre-existing). `scripts/test-ocr-native-text.cjs`, `scripts/test-ocr-rescan.cjs` and `rescanValidation.test.ts` pass.
- Backend `tsc` and frontend `tsc -p tsconfig.app.json` pass; ESLint on `src/pages/Settings.tsx` passes.
- Not verified: a real extraction with Gemini (no key in production) and the fallback against live providers.

## Phase 22 - OCR Accuracy Checks And ASAP Date Required

### Status

Deployed on 2026-11-25 from branch `feat/ocr-accuracy` (commit `3c4d3eb`), backend and frontend. Migration 029 applied in production on 2026-11-24.

### Objective

Catch AI misreads before a PRF is saved, read dates the Indonesian way, and accept "ASAP" as Date Required.

### Source Documents

- `docs/openapi.yaml` (`/api/ocr-prf/preview-extraction`, PRF `RequiredASAP`, follow-up `requiredAsap`)
- `docs/database-schema-specification.md` (migration 029)
- Phase 21 (OCR reliability)

### Checklist

- [x] Cross-check AI results against the PDF text layer (`pdftotext -layout`, whole document): an item unit price or line total, or the document total, that does not appear becomes a `number-not-in-pdf` review warning (upload) or a rescan warning. Separators are read both ways (6,600,000 / 6.600.000 / 1.234,50). PDFs without a usable text layer are not judged. The local parser is not affected.
- [x] Dates: day-first parsing (`05/11/2026` is 5 November), Indonesian and English month names (`17 Nopember 2026`, `1 Agustus 2026`), impossible dates left as printed for the reviewer.
- [x] Date Required "ASAP" (product owner, 2026-11-24): migration 029 `PRF.RequiredASAP`; OCR returns `ASAP`; the upload review accepts it; create forms have an ASAP checkbox; list, detail and follow-up show ASAP.
- [x] Multi-page PDFs (product owner, 2026-11-24: accuracy drops on multi-page PDFs and PDFs with many items): every page reports `pageType` (`prf_form` or `attachment`: quotation, CBE/TBE, specification, Pronto print, ...); items, header and total come from PRF form pages only, with an `attachment-pages-skipped` review flag naming the skipped pages, or `no-prf-form-page` when none is found. Rows are de-duplicated only when number and content match (a shared row number no longer drops an item). The total is the last form page's total, not the largest number on any page. Whole-PDF mode (over `OCR_PDF_MAX_PAGES`) allows 16,000 output tokens instead of 4,000 and flags `output-truncated` when the answer is cut off.
- [x] OCR evaluation bench `backend/scripts/ocr-bench.cjs` (read-only; real AI cost): scores extraction against reviewed rescans (`--source rescan`) or stored items (`--source files`), per model.
- [x] Apply migration 029 in production (2026-11-24; 485 PRFs, all `RequiredASAP = 0`)
- [x] GL code cross-check: an item GL code that does not appear in the PDF text (O/0, D/0, I/1 confusions) is part of the same review warning.
- [x] Deploy (2026-11-25); backend healthy, new code present in the running build
- [ ] Check an upload and a rescan in production (product owner)

### Output

Misread prices are flagged on the item in the review screen; ASAP PRFs can be saved.

### Challenge / Verification

- Real data, read-only, no AI call (2026-11-24): the cross-check applied to the stored (already reviewed) items of the 40 latest PRFs with an original PDF (138 items) flagged 2 items and 2 document totals; each was a real difference between the database and the PDF, not a false alarm:
  - PRF 54123 item 8 is still stored as 6,300,000, the known misread of 6,600,000;
  - PRF 55690 is stored as 84,915,000 against a printed total of 76,245,000. Correction (2026-11-25): the stored value is right; the form's printed TOTAL leaves out row 3 (see Phase 25);
  - PRF 54345 is stored with a total of 10;
  - PRF 52726 item 10 (4,468,172) does not appear in its PDF, although the document total matches.

  1 of the 40 PDFs had no text layer and was skipped.
- `node --test backend/tests/ocr-accuracy.test.cjs`: 8 pass (day-first and month-name dates, no invented dates, separator readings, misread price flagged on its item, wrong total flagged, scans not judged, ASAP accepted in review and other text rejected, follow-up `requiredAsap`).
- `node --test backend/tests/`: 45 pass, 0 fail, 2 skipped (pre-existing). OCR regression scripts pass. Backend and frontend `tsc` pass; ESLint on changed frontend files passes.
- OCR bench, 2026-11-24/25, real AI calls, about US$1.5 in total:
  - **20 PRF source PDFs** (`--source files`): the 10 small PRFs (1 to 8 items, all 1 page) were read 100% right (items, quantity, price, GL, total) by both gpt-4o and gpt-4o-mini.
  - **Large PRFs scored against stored items were unreliable**: some "original" files are not PRF forms (PRF 42042 is a 2-page CBE/TBE with 56 priced rows; PRF 39247 is a 13-page Pronto print), and older items come from Excel import or Pronto.
  - **10 reviewed rescans with 8 to 22 items** (`--source rescan`, all 1-page):
    - quantities and prices correct on every matched row;
    - baseline (`12ace2e`) and the multi-page change gave identical results, so there is no regression;
    - gpt-4o-mini matched gpt-4o on every measure at US$0.06 against US$0.27;
    - GL "mismatches" (41609, 30183, 43702) were wrong stored codes from older rescans; the current reading equals the PDF text (`AMINFO12.6250`, `MTIRMRPRC06250`, `AMITCM19.6250`).
  - **Cost per 20 PDFs**: gpt-4o US$0.49, gpt-4o-mini US$0.14.
- The new GL cross-check on the stored items of the same 40 PRFs flagged 9 items, all in PRF 54123 (stored `AMINB043.6250`, printed `AMINBD43.6250`).
- Not yet shown on a real multi-page PRF form: the bench had no multi-page PRF form with reviewed items. For PRF 42042 (CBE/TBE) the model classified both pages as `prf_form`, so the page-type filter did not apply.
- Follow-up: the PRFs above should be corrected by the document controller:
  - 54123: item 8 price; GL codes on 9 items;
  - 55690: total;
  - 54345: total;
  - 52726: item 10;
  - 41609, 30183, 43702: GL codes.


## Phase 23 - Remove Duplicate Items On OCR Rescan

### Status

Deployed on 2026-11-25 (PR #13, merge `19f4d9f`), backend and frontend.

### Objective

Let the reviewer remove leftover duplicates during an OCR rescan. Product owner, 2026-11-25: PRF 54123 has 19 items on the PDF but 28 in POMON, and the rescan only offered Keep existing or Mark Cancelled for the 9 extra rows.

### Source Documents

- `docs/openapi.yaml` (`/api/ocr-prf/rescan/{prfId}/file/{fileId}` preview and apply)
- Phase 22 (OCR accuracy)

### Checklist

- [x] Cause, from production data (read-only): PRF 54123's first scan on 2026-10-19 stored 9 misread rows (no item code, GL `AMINB043`, UPS at 6,300,000); the corrected rows were added on 2026-10-20 without removing them. The rescan matches the corrected rows and lists the misread ones as "not found by OCR".
- [x] Preview: an unmatched existing item gets `likelyDuplicateOf` when it has the same quantity, a unit price within 10% and a word similarity of at least 0.3 to an item the OCR matched (`backend/src/services/rescanDuplicates.ts`). Each matched item is paired once, best match first; cancelled items are never paired.
- [x] Apply: new preserved-item decision `remove` deletes the row inside the rescan transaction; the row stays in the audit `BeforeSnapshot`. The response reports `removedItemCount`.
- [x] Rescan dialog: "Remove (duplicate)" option; likely duplicates default to it and show "Likely duplicate of: ...". Other unmatched items still default to Keep existing.
- [x] Deploy (2026-11-25); backend healthy, new code present in the running build
- [ ] Rescan PRF 54123 in production (product owner)

### Output

Duplicates left by an earlier scan are proposed for removal in the rescan review instead of being marked Cancelled.

### Challenge / Verification

- `node --test backend/tests/rescan-duplicates.test.cjs`: 4 pass. The PRF 54123 data pairs all 9 stale rows with their corrected rows (lowest similarity 0.33, Access Point; UPS paired despite the 6,300,000 / 6,600,000 misread), and none of the 10 single rows is flagged. Different quantity, far price, different name and cancelled rows are not paired.
- Backend `tsc` and frontend `tsc` pass; ESLint on the dialog passes.
- Production data, read-only, no AI call (2026-11-25): the detection run on PRF 54123's stored rows (name and description), with the rows that carry an item code as the OCR-matched set, paired all 9 stale rows with their corrected rows (similarity 0.43 to 0.87).

## Phase 24 - OCR Cost And Control (Planned)

### Status

Planned, not started. Recorded on 2026-11-25 at the product owner's request so it can be resumed later (possibly from another laptop). This is the third of the three OCR areas agreed in November 2026: 1. reliability (Phase 21, done), 2. accuracy (Phases 22 and 23, done), 3. cost and control (this phase).

### Objective

Know what each OCR call costs, spend less where accuracy allows, and stop saving uploaded PRFs with a placeholder COA.

### Source Documents

- Phase 21 (OCR reliability) and Phase 22 (OCR accuracy, bench results)
- `backend/src/services/ocrService.ts`, `backend/src/routes/ocrPrfRoutes.ts`, `backend/scripts/ocr-bench.cjs`
- `docs/openapi.yaml`, `docs/database-schema-specification.md`

### Checklist

- [x] Time limit on AI provider calls: done in Phase 21 (`OCR_PROVIDER_TIMEOUT_MS`, default 120 s).
- [ ] Token and cost record per upload and per rescan. Today usage is only visible in the OpenAI dashboard, not per PRF. Suggested start: store provider, model, prompt and completion tokens, estimated USD, PRF and file ID for every call (new table or the existing rescan audit); show totals in Settings → OCR. `backend/scripts/ocr-bench.cjs` already shows how to read `usage` from the OpenAI client.
- [ ] Automatic COA mapping for PRFs created from an uploaded document. `create-from-document` in `backend/src/routes/ocrPrfRoutes.ts` saves every new PRF with `COAID: 1`. Map from the item purchase cost code (GL, for example `AMINBD43.6250`) to the COA table; leave it for review when no match is found.
- [ ] Decide the default model. The Phase 22 bench showed `gpt-4o-mini` as accurate as `gpt-4o` on small and 8–22 item PRFs at about a quarter of the cost (US$0.06 vs US$0.27 per 10 PRFs). Production still uses `gpt-4o`. Switching needs no deploy (Settings → OCR); confirm with the per-call cost record above.

### Output

Cost per PRF is visible, the default model is chosen on evidence, and uploaded PRFs get a real COA.

### Challenge / Verification

To be defined when the phase starts.

## Pending Follow-ups (as of 2026-11-25)

Items outside the phases above that are still open. Check each before acting; some may have been done outside this repository.

- **Production checks by the product owner**: upload a new PRF and rescan an existing one (Phase 22); rescan PRF 54123 and confirm the 9 duplicates are proposed for removal and 19 items remain (Phase 23).
- **Multi-page PRF forms**: the page-type filter of Phase 22 is not yet proven on a real multi-page PRF form; test with a PRF number that used to read badly.
- **Data corrections for the document controller** (stored values differ from the PDF):
  - 54123: item 8 price and GL code on 9 items (duplicates now removable by rescan);
  - 54345: total (10);
  - 52726: item 10;
  - 41609, 30183, 43702: GL codes.
- **Security**: rotate the Microsoft Graph client secret (it was shared in chat on 2026-11-24); on docker59, `/root/budget-pulse-watch/.env.production` and `backend/.env.staging` are still mode 644 (`backend/.env.production` is 600).
- **Roadmap hygiene**: Phases 17 and 18 still say "Not deployed yet"; confirm against production and update.

## Phase 25 - Rescan With A Wrong Printed Total

### Status

Implemented on branch `feat/rescan-total-warning` (local commit, not pushed at the product owner's request). Not deployed.

### Objective

Do not block a rescan when the form's printed total is wrong but every item row is confirmed by the PDF. Product owner, 2026-11-25: PRF 55690 rescan failed with "Document total does not reconcile with either all item rows or active item rows".

### Source Documents

- `docs/openapi.yaml` (`/api/ocr-prf/rescan/{prfId}/file/{fileId}` preview and apply, 422)
- Phase 22 (PDF text cross-check)

### Checklist

- [x] Cause, from the production PDF (read-only): PRF 55690 prints TOTAL 76,245,000, while its three rows add up to 84,915,000; the printed total leaves out row 3 (8,670,000). The OCR read every row correctly. The stored PRF (3 items, 84,915,000) already matches the rows; the Phase 22 note that listed 55690 as a data error was wrong.
- [x] `pdfConfirmsItemRows` (`backend/src/services/ocrCrossCheck.ts`): every active row's unit price and line total appear in the PDF text layer. False for scans without a text layer.
- [x] `validateRescanExtraction` takes `rowsConfirmedByPdf`; with it and no row errors, an unreconciled printed total is not an error. Preview and apply both check it (apply re-reads the source PDF).
- [x] Preview warning `printedTotalWarning`: printed total, item sum and difference. An approved header update uses the item sum as requested amount.
- [ ] Push, review, deploy; rescan PRF 55690 in production

### Output

A form with a wrong SUM can be rescanned; the reviewer sees the difference, and a misread row or a scanned PDF still blocks.

### Challenge / Verification

- `node --test backend/tests/rescan-total-warning.test.cjs`: 5 pass (55690 rows confirmed and warning text; still blocks without PDF confirmation or with no text layer; a misread row is not confirmed; a row arithmetic error still blocks; a reconciled total gives no warning). Existing `rescanValidation.test.ts` checks pass unchanged.
- `node --test backend/tests/`: 59 pass, 0 fail, 2 skipped. Backend `tsc` passes.
- Production data, read-only, no AI call: with PRF 55690's real PDF text and its stored rows, `rowsConfirmedByPdf` is true, validation returns no errors, and the warning reads "Printed document total 76,245,000 differs from the sum of the item rows 84,915,000 (difference 8,670,000)".

## Phase 27 - Pronto Sync Resilience

### Status

Implemented on branch `fix/pronto-sync-resilience` (local commit on top of a24eb2d, not pushed). Not deployed. Phase 26 (bulk rescan) is on a separate branch; the numbers do not depend on each other.

### Objective

A failed or hung Pronto sync must not write old data, must not stall the worker, and must be visible in the app. Product owner, 2026-11-25: after the Pronto password expired, the sync failed to log in from 2026-11-24 19:45 WITA; the failure was only visible in `docker logs`, and the items step still applied the previous run's batch file (7 item changes and the approval history of 34 PRFs stamped as freshly synced).

### Source Documents

- `docs/pronto-sync.md`
- `docs/openapi.yaml` (`POST /api/settings/pronto-sync/run-now/complete`)
- `docs/database-schema-specification.md`

### Checklist

- [x] Items step: the previous `prf_items_batch.json` is deleted before the Pronto gather. When the gather writes no batch (login or navigation failed), the step fails with "Pronto gather wrote no batch (login or navigation in Pronto failed); nothing was applied" and applies nothing.
- [x] Worker step time limit `PRONTO_SYNC_STEP_TIMEOUT_SECONDS` (default 5400, 90 minutes). A step runs in its own process group; on timeout or container shutdown the step and the browser it started are stopped. A timeout reports exit code 124.
- [x] After a failed scheduled cycle the worker tries again after `PRONTO_SYNC_RETRY_MINUTES` (default 30), at most `PRONTO_SYNC_MAX_RETRIES` (default 3) times in a row, then returns to the normal interval.
- [x] Every run is reported, scheduled cycles included (`kind: scheduled` leaves a pending run-now request in place), with the failing step's last error line. Stored in `AppSettings.ProntoSyncLastRunError` and `ProntoSyncLastRunKind` (migration 030, also added at backend startup).
- [x] Settings → Pronto sync shows "Last run succeeded / failed / timed out", whether it was a scheduled cycle or a run-now request, and the error message.
- [ ] Push, review, deploy (backend first, then `pronto_sync`, while the worker is idle); confirm a scheduled cycle appears in Settings

### Output

A Pronto login failure, crash or hang stops the sync cleanly, is retried within 30 minutes, and shows its reason in Settings. Old Pronto data is never applied as new.

### Challenge / Verification

- `python3 -m unittest tests.test_pronto_sync_resilience` (in `backend/scripts`): 6 pass. A failed login removes the old batch and fails the step; a fresh batch is used; a failing step reports its error line ("items: RuntimeError: Pronto navigation not ready ..."); a hung step is stopped after its time limit with exit 124; a child process started by the hung step (stand-in for the browser) is stopped too.
- `python3 -m unittest discover -s tests` (in `backend/scripts`): 26 pass.
- Backend `tsc`, frontend `tsc` and `vite build` pass; eslint is clean on `Settings.tsx`.
- Not yet run in the container against Pronto.

## Phase 28 - Approval Status In The PRF List

### Status

Implemented on branch `feat/approval-popover` (local commit on top of Phase 27, not pushed). Not deployed.

### Objective

See who a PRF is waiting for without opening it. Product owner, 2026-11-25: in the Approved By column, show the Next Action By text and a quick menu with each approver's status and date. Completed PRFs without synced history are left as they are.

### Source Documents

- `docs/openapi.yaml` (`GET /api/prfs/with-items`, `GET /api/prfs/{id}/pronto-approvals`)
- `docs/pronto-sync.md` (approval history from PO E001 > Approval Status)

### Checklist

- [x] `GET /api/prfs/with-items` returns `PendingApprovers` per PRF, with one query per page (`PRFModel.getPendingApprovers`), using the same rule as Next Action By in the approval history card.
- [x] PRF Monitoring, Approved By column: the approver name, "Waiting: ..." when Pronto lists pending approvers, and a history button that opens a popover with Next Action By and each approval user, status and date per PO (original PO first, split POs marked). The steps load when the popover opens.
- [x] The approval history card and the popover share `src/components/prf/prontoApprovals.ts`.
- [ ] Push, review, deploy; check the column and the popover in production

### Output

The PRF list shows who each open PRF is waiting for, and one click shows the approval steps.

### Challenge / Verification

- Production data, read-only: the new pending-approver query over the 39 PRFs that have approval history returns 12 waiting PRFs, for example 55996 "Human Resources CC, MTI Cost Control" and 54123 "BUYER", which matches the approval history synced on 2026-11-25.
- Backend `tsc`, frontend `tsc` and `vite build` pass; eslint is clean on the changed frontend files.
- Not yet checked in a browser: the local backend points at the production database.

### Found While Checking

- PRF 50117 (status "Req. Approval Reqd") has `RequestorID = 0`, which matches no user (submitted by "Adhi Surahman [MTI]", probably from the retired Excel import). `vw_PRFSummary` inner-joined `Users` and `ChartOfAccounts`, so 50117 was missing from `GET /api/prfs/with-items` and the PRF detail; PRF Monitoring and the Pronto sync both skipped it.
- [x] Migration 031 (`031_prf_summary_view_keep_unknown_requestor.sql`) and `schema.sql`: both joins become LEFT JOINs; `RequestorName` falls back to `SubmitBy`. Columns are unchanged.
- [x] Read-only check on production: the new SELECT returns 486 PRFs against 485 from the current view; the only added row is 50117 (requestor "Adhi Surahman [MTI]"); no existing row changes its requestor name.
- [ ] Run migration 031 on production (it is not applied by the backend at startup), then confirm 50117 shows in PRF Monitoring and is picked up by the next Pronto sync.

