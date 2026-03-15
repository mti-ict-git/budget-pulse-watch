# Phase 4 Data Quality Report (FY2026)

Generated from:

- `docs/reports/phase4-pic-backfill-2026-03-15T09-13-42-836Z.json`
- `docs/reports/phase4-opex-reconciliation-2026-03-15T09-13-51-607Z.json`

## PIC Completeness

- Candidate rows: 12
- Resolved by `UpdatedBy` metadata: 0
- Resolved by Excel PIC mapped to active user: 0
- Resolved by Excel PIC text fallback: 0
- Unresolved: 12
- Planned updates in dry-run: 0
- Applied updates: 0

Current finding:

- Existing missing PIC cases are outside reliable match conditions for `UpdatedBy` and Excel `PIC pickup`.
- No automatic update is safe without expanding fallback policy.

Recommended next action:

- Review unresolved PRF item IDs in the JSON report and confirm fallback policy:
  - keep unresolved, or
  - apply `UNKNOWN (BACKFILL)` using `--fallback-unknown`.

## FY2026 OPEX Reconciliation

- Rows analyzed: 15
- Insert candidates: 8
- Update candidates: 1
- Rejected: 6

Rejected reason breakdown:

- `COA expense type is not OPEX`: 6

Rejected COA codes:

- AMITCM16.6250
- AMITCM19.6250
- AMITCM20.6250
- AMITINO1.6250
- AMPLCM01.6250
- AMPLME05.6250

Operational interpretation:

- FY2026 import can proceed for 9 rows (8 inserts + 1 update) after final approval.
- 6 rows require COA master-data correction or explicit CAPEX handling policy before import.
