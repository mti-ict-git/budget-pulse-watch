# Database schema specification

`backend/database/schema.sql` remains the schema baseline. Phase 14 adds `AppSettings.UploadExtractionMethod NVARCHAR(10) NOT NULL`, constrained to `llm` or `local` with default `llm`. Migration 026 adds the column idempotently without changing provider, enabled state, API keys or model.

The preview receipt is bounded in-memory state (15 minutes), not a new SQL entity. Reviewed upload creation writes PRF header and PRFItems in the same transaction. Existing rescan audit schema and rescan statements remain unchanged.

ItemCode retains the part number (64 characters). ItemName is a 200-character display label; the full reviewed description is stored separately in Description (up to 1000). Quantities follow the existing INT schema; money follows existing decimal precision. PRF notes retain a bounded review summary and literal document notes.

## Pronto approval history (migration 027)

`PRFProntoApprovalHistory` stores the Pronto **Approval Status** list of every PO linked to a PRF: the original PO (same number as the PRF) and any split POs. The Pronto sync worker reads it from PO E001 > Approval Status and replaces the rows of one `(PRFID, PONumber)` pair per sync, in a transaction.

- `EntrySeq` is the position in the Pronto list (1-based) and is unique per PRF and PO. `LINENO` is a T-SQL reserved word, so it is not used as a column name.
- `ActionAt` is Pronto site wall-clock time without a time zone; `ActionAtRaw` keeps the original text (e.g. `29-SEP-2026 16:37:03`).
- Rows are deleted with their PRF (`ON DELETE CASCADE`).
- This is separate from `PRFApprovals`, which models POMON's own internal approvers by user ID.
