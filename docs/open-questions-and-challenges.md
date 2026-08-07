# Open Questions And Challenges

## Purpose

This document records unresolved business and implementation questions that must not be skipped when changing budget-control behavior.

## Resolved Questions

### Item-Level Utilization

- Utilization is calculated from `PRFItems.Quantity * PRFItems.UnitPrice`, not the PRF header amount
- Multi-cost-code PRFs are split across item-level COAs
- All PRF and item statuses count except statuses containing `cancel`, case-insensitively
- Blank and unknown item cost codes remain unmapped; neither item nor parent header COA fields are allocation fallbacks
- The FY2026 live-data audit confirmed every non-cancelled PRF currently has item rows

### Existing PRF AI Rescan

- Existing items absent from an OCR rescan are preserved and never auto-deleted
- Users approve item proposals individually after a side-by-side preview
- Status, PO, pickup, approval, and Pronto-managed fields are protected from OCR updates
- A clear visual strikethrough/cross-out is proposed as item-level `Cancelled`, remains unchecked by default, and becomes a status override only after that item proposal is explicitly approved
- Active OCR rows do not reset an existing workflow status
- Shared/merged cost codes are materialized per item, and preview separates printed, extracted, cancelled, and active totals
- Apply is transactional and writes a dedicated immutable audit snapshot
- If no OCR Source exists, Admin/DocCon may select another stored PDF or supported image; the preview identifies it as an alternative source

### PRF AI Chatbot

- All authenticated users may query all PRFs; the initial release does not apply per-user PRF visibility filters
- The chatbot is read-only and cannot mutate PRF, item, approval, budget, or attachment data
- OpenAI is the only chatbot provider; OCR may continue using either OpenAI or Gemini independently
- Attachment contents are not sent to or read by the model; only stored metadata is queryable
- Attachment answers include authenticated preview/download actions when the stored file is available
- Chat history is stored only in browser `sessionStorage`, removed on logout or tab close, and never persisted in SQL Server
- OpenAI API requests use `store: false`
- Arbitrary model-generated SQL is prohibited; the assistant may use only fixed, parameterized, bounded read-only tools
- Materially ambiguous terms are resolved with explicit UI choices before querying; selected definitions remain visible as removable session context
- Phase 13A supports three purchase definitions: active item with PO, non-cancelled requested item, or item with Picked Up status
- Calculation evidence and follow-up actions are structured backend data rather than model-formatted commands

### PRF Attachment Storage Compatibility

- Preview, download, folder scan/sync, and AI rescan must use one shared path resolver
- The resolver supports direct `<root>/<PRFNo>` folders, the legacy company-nested folder, legacy Windows UNC metadata, and forward-slash CIFS metadata
- PRF 49099 is the production compatibility reference for an attachment that can already be previewed
- A zero-file scan remains ambiguous between an empty/missing folder and an access error; a later contract revision should expose a structured scan status instead of silently collapsing all filesystem failures to zero

### Phase 13B Budget Intelligence

- Chatbot budget utilization must match dashboard/report item-level allocation and must not use PRF header totals
- Total available budget includes annual allocation and approved carry-forward, normalized to IDR
- Initial risk bands are explicit query parameters with a default attention threshold of 80%; over budget means utilization above 100%
- CAPEX/OPEX and department filters come from the matched active COA, not free-form inference
- Missing/unknown cost-code items remain excluded from a COA budget and should be surfaced later as workflow/data-quality intelligence
- Forecasting remains outside the first Phase 13B slice until an approved forecasting definition exists

### Phase 13B Workflow Intelligence

- Default stale threshold is 30 days when the user does not specify one; the evidence block must expose the applied threshold
- Completed/cancelled PRFs are excluded from stale detection, while cancelled items are excluded from PO, cost-code, and amount checks
- Header/item mismatch is a review signal, not proof that either value is wrong
- Missing attachment currently means no database attachment metadata; physical file availability is a separate attachment-integrity check
- The first slice reports issues only and does not create tickets, alerts, assignments, or mutations

### Phase 13B Attachment Metadata Intelligence

- Duplicate-looking files are matched only within the same PRF using normalized exact filenames; similar semantic content is not inferred
- Initial supported extensions follow the current upload allow-list: PDF, Word, Excel, common image formats, and TXT
- Oversized threshold defaults to 25 MB but remains an explicit bounded tool parameter
- `PRF.UpdatedAt > latest PRFFiles.UploadDate` is a review signal that attachments may need refreshing, not proof that an attachment is obsolete
- Physical existence/readability is not inferred from metadata and remains verified only through authenticated Preview/Download

### PRF Recency Semantics

- `PRF terbaru` is defined as newest effective request date: `DateSubmit`, then `RequestDate`, then `CreatedAt`
- `terakhir diperbarui` is a separate intent ordered by `UpdatedAt`
- `nomor PRF tertinggi` is a separate intent ordered by numeric `PRFNo`
- Recency words are not text-search keywords; the backend defensively removes a standalone `terbaru/latest/newest` query

### Phase 13B On-Demand Daily Briefing

- Briefing date defaults to the current `Asia/Jakarta` date and is always shown in evidence
- `UpdatedAt` and item activity indicate a record changed, but do not identify the changed field without a matching audit event
- Status movement is reported only from `AuditLog`; absence of an audit event is not interpreted as no business change
- Budget attention reuses the Phase 13B item-level utilization definition and an explicit 80% default threshold
- The briefing remains on-demand/session-only; scheduled delivery and notification subscriptions stay in later governed phases

### Historical Visibility Model

- Prior-year visibility is considered sufficient through `FiscalYear` filtering on live tables for the current product phase
- A formal physical archive mechanism is not required at this stage
- Non-HR / IT budgets remain retained in the same live tables and are not deleted because of `Budget Overview` scope narrowing

### Destructive Cleanup Policy

- Hard delete of historical budget data is not allowed in normal application workflow
- Any future destructive cleanup requires a separate retention decision, preserved historical data, documented approval authority, and explicit documentation updates
- Archive preservation must be addressed before any future destructive cleanup is considered

### Year-End Governance

- A fiscal year becomes operationally historical when it is marked closed in `BudgetCutoff`
- Close and reopen remain auditable through `BudgetCutoffAudit`
- Carry-forward approval is restricted to `admin`
- Zero-budget placeholders are rendered virtually in readiness/UI instead of being persisted as standalone rows
- Carry-forward remains a separate visible component and contributes to `Total Available Budget`

## Active Questions

### PRF Assistant Enhancements

- Which definition should be the default for `bought`: item has PO, PRF approved, or item picked up?
- Which aging thresholds and severity levels should apply to each PRF status?
- Should saved questions remain browser-local or become cross-device user records?
- Which roles may create notification subscriptions, and which event types are allowed?
- Is browser-based voice input acceptable on the supported corporate browsers?
- What retention and approval rules would apply to generated PDF reports or shareable result links?
- Document understanding remains blocked until document privacy, indexing, retention, deletion, and citation rules are approved
- Safe action drafts remain blocked until permission, confirmation, audit, idempotency, and rollback rules are approved

### Scope Expansion

- Should mandatory COA coverage apply only to `HR / IT`, or become a reusable rule for other departments later?

## Current Recommendation

- Do not hard delete historical budget data in normal application workflow
- Prefer year-based visibility plus protected historical retention first
- Keep archive as a governance model on live tables until there is a justified need for physical archival
- Implement PRF Assistant Phase 13A first because it improves trust and context control without new durable storage or write permissions
- Keep document-content retrieval and PRF mutations outside the immediate chatbot scope

## Challenge Notes

- The repository already treats budget data as fiscal-year based, so basic historical lookup exists
- Phase 6 locks the governance baseline around retention, non-destructive history, and cutoff-based historical state
- Phase 7 locks the new-year readiness baseline around virtual placeholders, explicit carry-forward, and admin-only approval
- What remains open is scope expansion beyond `HR / IT`
- Any future backend change in this area requires explicit `docs/openapi.yaml` review
