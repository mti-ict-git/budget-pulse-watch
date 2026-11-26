# Database schema specification

`backend/database/schema.sql` remains the schema baseline. Phase 14 adds `AppSettings.UploadExtractionMethod NVARCHAR(10) NOT NULL`, constrained to `llm` or `local` with default `llm`. Migration 026 adds the column idempotently without changing provider, enabled state, API keys or model.

Phase 27 (Pronto sync resilience) adds `AppSettings.ProntoSyncLastRunError NVARCHAR(1000) NULL` (failing step and its last error line) and `AppSettings.ProntoSyncLastRunKind NVARCHAR(20) NULL` (`scheduled` or `run-now`). Migration 030 adds them idempotently, and the backend adds them at startup (`initializeDatabase.ts`).

Migration 031 changes `vw_PRFSummary` to LEFT JOIN `Users` and `ChartOfAccounts`, so a PRF with a missing requestor or COA (for example `RequestorID = 0`) is still listed; `RequestorName` falls back to `SubmitBy`. It must be run by hand.

The preview receipt is bounded in-memory state (15 minutes), not a new SQL entity. Reviewed upload creation writes PRF header and PRFItems in the same transaction. Existing rescan audit schema and rescan statements remain unchanged.

ItemCode retains the part number (64 characters). ItemName is a 200-character display label; the full reviewed description is stored separately in Description (up to 1000). Quantities follow the existing INT schema; money follows existing decimal precision. PRF notes retain a bounded review summary and literal document notes.

## PRF.RequiredASAP (migration 029)

`PRF.RequiredASAP BIT NOT NULL DEFAULT 0` marks a Date Required written as "ASAP" on the PRF (product owner, 2026-11-24). `RequiredDate` stays NULL in that case, so no artificial date is stored; if a real date becomes known later (for example from the Pronto sync), both are kept and the UI shows "ASAP · date". It is set by the reviewed upload (`dateRequired = "ASAP"`), the PRF create forms (ASAP checkbox), and PUT `/api/prfs/{id}`; it is read through the PRF list queries (`prf.RequiredASAP` next to `vw_PRFSummary`) and the follow-up list. Follow-up rules are unchanged: `past_required_date` still needs a date.

## PRF.AllocatedBuyer (migration 028)

`PRF.AllocatedBuyer NVARCHAR(200) NULL` holds the buyer responsible for the PO in Pronto. The Pronto header sync fills it from the Purchase Orders grid: `Buyer allocation`, or `Officer` (the buyer who converted the requisition into the PO) when `Buyer allocation` is empty. The fallback was confirmed by the product owner on 2026-11-16. It is read through the PRF list queries (`prf.AllocatedBuyer` joined next to `vw_PRFSummary`, like `ApprovedByName`) and shown in the PRF detail dialog.

## Pronto approval history (migration 027)

`PRFProntoApprovalHistory` stores the Pronto **Approval Status** list of every PO linked to a PRF: the original PO (same number as the PRF) and any split POs. The Pronto sync worker reads it from PO E001 > Approval Status and replaces the rows of one `(PRFID, PONumber)` pair per sync, in a transaction.

- `EntrySeq` is the position in the Pronto list (1-based) and is unique per PRF and PO. `LINENO` is a T-SQL reserved word, so it is not used as a column name.
- `ActionAt` is Pronto site wall-clock time without a time zone; `ActionAtRaw` keeps the original text (e.g. `29-SEP-2026 16:37:03`).
- Rows are deleted with their PRF (`ON DELETE CASCADE`).
- This is separate from `PRFApprovals`, which models POMON's own internal approvers by user ID.

## Pronto Immediate Action queue (migration 032)

`ProntoActionQueue` holds the last successful read of Pronto PO M094 "Approve/Review Requisitions (Immediate Action Req'd)", one row per requisition (`OrderNo` is the primary key). The Pronto worker reads the queue every hour; `POST /api/pronto-queue/snapshot` replaces the whole table in one transaction. A failed read does not touch the table.

- List columns as shown in Pronto: `Supplier`, `Warehouse`, `DueDate`, `RequestUser`, `CostCategory`, `ReqTotal`, `Currency`, `LocalValue`, `Auth`, `ActionGroup` (the list's Action column), `Buyer`, `StockGroup`, `Priority`.
- `NextActionByJson` and `ApprovalsJson` are JSON arrays of the Next Action By rows (`name`, `user`, `hierarchy`) and the Approval Status rows (`lineNo`, `approvalUser`, `actionAt` as Pronto wall-clock time, `actionAtRaw`, `status`, `comment`). They are only shown, never queried, so they are not split into tables.
- `ReadErrors` lists problems reading that row (for example a card that showed another requisition).
- There is no foreign key to `PRF`: the queue can hold requisitions that are not in POMON. `GET /api/pronto-queue` matches `OrderNo` to `PRF.PRFNo` or `PRFItems.SplitPONumber` when it is read.
- Read status lives in `AppSettings`: `ProntoQueueCheckedAt` (last attempt), `ProntoQueueLastSuccessAt`, `ProntoQueueUser` (the Pronto account that read the queue; used to decide "Next Action By is IT"), `ProntoQueueError` (error of the last attempt, NULL on success).
- The backend creates the table and columns at startup if they are missing (same definition as migration 032).
