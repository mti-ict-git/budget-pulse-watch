# Historical Budget Governance

## Purpose

This document locks the Phase 6 decision for historical visibility, retention, archive behavior, and destructive-cleanup policy for budget data.

It is the source of truth for how prior-year budget data must be governed after `Budget Overview` was narrowed to operational HR / IT use.

## Decision Summary

The Phase 6 decision is:

- historical budget visibility is satisfied by `FiscalYear`-based access on the live budget tables for the current product stage
- a separate archive table or snapshot mechanism is **not** required in the current phase
- prior-year budget data remains in the existing live tables and is treated as historical data once the fiscal year is closed
- hard delete of historical budget data is **not allowed** in the application workflow
- non-HR / IT budget data remains retained in the same database tables and is not deleted merely because it is no longer shown in the operational `Budget Overview` screen

## Why This Model Was Chosen

The current repository already has the core building blocks needed for historical governance:

- `Budget.FiscalYear` separates annual records
- `BudgetCutoff` provides year-close state
- `BudgetCutoffAudit` records close and reopen actions
- `AuditLog` provides a general audit foundation

Because those controls already exist, the safest immediate governance model is:

- keep history in place
- make historical years operationally read-only after close
- avoid destructive cleanup
- postpone physical archival only until there is a proven compliance, storage, or performance need

This avoids introducing premature archive complexity while still preserving auditability.

## Locked Decisions

## 1. Historical Visibility

Historical visibility is provided by querying existing budget data by `FiscalYear`.

Rules:

- prior-year data remains queryable for audit and reporting
- operational screens may apply scope filters, but that does not change the underlying retention model
- `Budget Overview` may remain focused on `HR / IT` `CAPEX/OPEX`
- broader historical data can still be surfaced in reporting, admin, or future historical views

## 2. Archive Mechanism

No physical archive table, archive database, or yearly snapshot table is required for the current phase.

Chosen model:

- use the live tables as the historical record
- use fiscal-year close status as the point where a year becomes operationally historical
- treat archive as a governance concept first, not a separate storage implementation

Future archive work is allowed only if one of these becomes true:

- compliance requires immutable export or snapshot packages
- storage growth creates operational pressure
- query performance for historical workloads becomes unacceptable
- the business requires a dedicated historical-review workspace separate from operational data

## 3. Non-HR / IT Budget Data

Non-HR / IT budget data remains retained in the same live tables.

Rules:

- it must not be hard deleted because of the `Budget Overview` scope change
- it remains part of the historical and reporting dataset
- visibility may be restricted by screen purpose, role, or future reporting design
- cleanup decisions for non-HR / IT data require a separate approved retention policy and are out of scope for the current product phase

## 4. Retention Policy

Budget data is retained indefinitely in the live database until a future approved archive-and-retention policy replaces this rule.

Rules:

- current year and prior years remain stored in the same canonical tables
- closing a fiscal year does not trigger deletion
- reopening a year does not remove historical traceability
- retention is based on preservation, not cleanup

## 5. Hard Delete Policy

Hard delete of historical budget data is not allowed through the application workflow.

Rules:

- no product feature should delete prior-year budget records as a normal operational action
- no cleanup task should remove non-HR / IT budget rows merely to match operational UI scope
- if destructive cleanup is ever requested later, it must be treated as an exceptional governed activity outside normal budget operations

Minimum prerequisites for any future destructive cleanup discussion:

- approved retention policy
- exported or otherwise preserved historical data
- documented approval authority
- rollback or recovery strategy
- explicit documentation update before execution

## 6. Audit Requirements

The following events must be auditable:

- fiscal year close
- fiscal year reopen
- future carry-forward approval
- future archive/export execution if introduced

Locked rule:

- `BudgetCutoffAudit` remains the authoritative log for close and reopen actions
- future carry-forward and archive operations must create explicit auditable records and must not rely only on silent data mutation
- historical visibility itself does not require a new access-audit mechanism in the current phase

## 7. Year-Close Definition

A fiscal year becomes historical when:

- the fiscal year exists in the budget dataset, and
- the corresponding year is marked closed in `BudgetCutoff`

Operational meaning:

- the year remains readable
- ordinary budget write actions stay blocked by cutoff enforcement
- the year becomes the historical source for audit, comparison, and possible future carry-forward reference

## 8. Implications For Next Phases

### Phase 7

- implement `Need Attention` and carry-forward without changing the retention model
- keep historical data in place while adding explicit carry-forward traceability

### Phase 8

- add better operational visibility in `COA Management`
- optionally add a historical or admin-oriented view if business users need broader access than the narrowed `Budget Overview`

### Phase 9

- validate that UAT, deployment notes, and handoff docs still match the locked historical-governance model

## Verification Basis

The decision was locked after reviewing:

- `docs/implementation-roadmap.md`
- `docs/budget-control-policy.md`
- `docs/openapi.yaml`
- `backend/database/schema.sql`
- `backend/src/routes/budgetRoutes.ts`

Review result:

- current schema already supports fiscal-year-based historical separation
- current API contract does not need to change for this governance decision
- current cut-off workflow already supports the read-only historical model

## Result

Phase 6 is considered closed once this document, the roadmap, the policy, and the checklist are synchronized to this decision.
