# Phase 4 Runbook — Data Backfill and Integrity

## Scope

- Detect PRFItems with `Status = Picked Up` and missing PIC fields.
- Backfill PIC using metadata-first strategy and Excel fallback.
- Reconcile FY2026 OPEX source rows against ChartOfAccounts and existing Budget rows.
- Produce auditable JSON/CSV outputs under `docs/reports`.

## Commands

### 1) PIC Completeness Detection + Backfill Plan

Dry-run only:

```bash
npm --prefix backend run phase4:pic:dry -- --year=2026 --excel="/Users/widjis/Documents/Projects/budget-pulse-watch/PRF IT MONITORING - NEW UPDATED.xlsx"
```

Apply updates:

```bash
npm --prefix backend run phase4:pic:apply -- --year=2026 --excel="/Users/widjis/Documents/Projects/budget-pulse-watch/PRF IT MONITORING - NEW UPDATED.xlsx"
```

Apply updates with unknown fallback:

```bash
npm --prefix backend run phase4:pic:apply -- --year=2026 --fallback-unknown --excel="/Users/widjis/Documents/Projects/budget-pulse-watch/PRF IT MONITORING - NEW UPDATED.xlsx"
```

### 2) FY2026 OPEX Reconciliation

```bash
npm --prefix backend run phase4:opex:reconcile -- --excel="/Users/widjis/Documents/Projects/budget-pulse-watch/PRF IT MONITORING - NEW UPDATED.xlsx"
```

## Backfill Strategy

1. Candidate filter:
   - `PRFItems.Status = 'Picked Up'`
   - `PickedUpBy IS NULL or empty`
   - `PickedUpByUserID IS NULL`
2. Resolve priority:
   - `UpdatedBy` user when role is DocCon/Admin and active
   - Excel `PIC pickup` value mapped to active DocCon/Admin user
   - Excel `PIC pickup` as text-only value
   - optional fallback: `UNKNOWN (BACKFILL)`
3. Safety:
   - dry-run default
   - apply mode required to write changes
   - outputs include decision and reason per PRF item

## OPEX Reconciliation Rules

For each Budget Detail row:

- Reject when COA code not found.
- Reject when COA inactive.
- Reject when COA `ExpenseType != OPEX`.
- Reject when amount is null or non-positive.
- Mark `update` when FY2026 budget already exists for COA.
- Mark `insert` when FY2026 budget does not exist for COA.

## Output Artifacts

- `docs/reports/phase4-pic-backfill-*.json`
- `docs/reports/phase4-pic-backfill-*.csv`
- `docs/reports/phase4-opex-reconciliation-*.json`
- `docs/reports/phase4-opex-reconciliation-*.csv`

## Operational Sequence

1. Run PIC dry-run.
2. Review unresolved rows and update policy.
3. Run OPEX reconciliation.
4. Review rejected rows for COA remediation.
5. Run PIC apply only after stakeholder sign-off.
