# Budget Control Policy Proposal

## Purpose

This document defines the proposed operating policy for annual budget control, mandatory HR/IT COA coverage, new-year reset behavior, and carry-forward handling.

It is intended to mature the current budget-control behavior before implementation changes are applied to API, database, and UI layers.

The active execution order for this policy is tracked in `docs/implementation-roadmap.md`.

## Current State Review

## Execution Status

- Baseline mandatory HR / IT COA verification completed on `2026-07-22`
- Reproducible data migration added to ensure mandatory COA coverage and business-label normalization
- Execution checklist maintained in `docs/budget-control-checklist.md`

### Existing System Behavior

The current system already has:

- budget records keyed by `FiscalYear`
- budget write lock using `BudgetCutoff`
- COA management with `COACode`, `COAName`, `Department`, `ExpenseType`, and `IsActive`
- budget overview pages filtered by fiscal year

The current backend does not yet define an explicit carry-forward policy. This means annual budget continuity is still driven by manual yearly data entry or import.

### HR / IT Mandatory COA Verification

The following GL / COA codes were checked directly in `ChartOfAccounts` on `2026-07-22` after the baseline correction migration was applied.

| COA Code | Expected Name | Current DB Name | Department | Expense Type | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| MTIRMRAD496137 | Software Maintenance | Software Maintenance | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496232 | Repairs and maintenance | Repairs and maintenance | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496769 | Tools | Tools | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496250 | IT consumeables | IT consumeables | HR / IT | OPEX | Present | Aligned to approved label |
| MTIRMRAD496313 | Internet | Internet | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496315 | Stationery and postage | Stationery and postage | HR / IT | OPEX | Present | Added |
| MTIRMRAD496326 | Other permit & licenses | Other permit & licenses | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496328 | Subscriptions | Subscriptions | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496014 | Training and seminars | Training and seminars | HR / IT | OPEX | Present | Aligned |
| MTIRMRAD496314 | Telephone and mobile comms | Telephone and mobile comms | HR / IT | OPEX | Present | Aligned |

### Immediate COA Management Gap

For the mandatory HR / IT OPEX list:

- all 10 required COA codes now exist
- baseline naming has been aligned to the approved business labels used in this policy
- remaining gaps are functional follow-up items in UI and yearly-budget governance, not baseline COA master data

## Proposed Budget Policy

## 1. Annual Budget Is Year-Bound

Budget must be treated as an annual allocation, not as a continuously rolling balance.

Policy:

- Every budget belongs to exactly one `FiscalYear`
- On `1 January`, the active working budget year changes to the new fiscal year automatically
- The new fiscal year starts with `0` allocated budget unless a new yearly budget is created or imported
- Prior-year remaining balance must not automatically appear in the new year
- any prior-year remaining amount may be shown only as an audit/reference source for optional carry-forward approval, not as current-year available budget

Practical meaning:

- FY2026 budget remains historical data after 31 December 2026
- On 1 January 2027, the working year becomes FY2027
- If FY2027 has no budget yet, the system should show zero allocation and a clear attention state

## 2. New Year Must Trigger Attention

When the system enters a new fiscal year, active COA codes that do not yet have a budget row for the current year must be flagged.

Recommended behavior:

- default budget page filter auto-selects the current calendar year
- active mandatory COAs without a current-year budget appear in `Need Attention`
- utilization cards and tables show `0` allocation until the new annual budget is created
- users with budget authority see actions such as:
  - `Create FY Budget`
  - `Import FY Budget`
  - `Mark as Carry Forward`
- zero-budget placeholders are rendered virtually in UI/readiness responses rather than inserted as standalone placeholder rows

This avoids silent reuse of prior-year numbers.

## 3. Carry-On Must Be Explicit

Carry-on should be treated as an exception, not the default rule.

Recommended policy:

- carry-on is allowed only when explicitly approved
- carry-forward approval is restricted to `admin`
- carry-on must be recorded per COA and fiscal year
- carry-on must store traceability back to the previous fiscal year
- carry-on must not overwrite the original annual allocation history

Implemented carry-forward model:

- dedicated table `BudgetCarryForward`
- `COAID`
- `SourceBudgetID`
- `SourceFiscalYear`
- `TargetFiscalYear`
- `CarryForwardAmount`
- `CurrencyCode`
- `ExchangeRateToIDR`
- `Notes`
- `ApprovedBy`
- `ApprovedAt`
- `CreatedBy`
- `CreatedAt`

Recommended behavior:

- if no carry-on is approved, new year allocation starts at `0`
- if carry-on is approved, the carried amount remains a separately visible carry-forward component and is added to `Total Available Budget`
- UI must clearly distinguish:
  - `Annual Allocation`
  - `Carry Forward`
  - `Total Available Budget`

## 4. Mandatory HR / IT COA Control

The following codes should be treated as mandatory active COAs for `Department = HR / IT` and `ExpenseType = OPEX`:

- `MTIRMRAD496137` Software Maintenance
- `MTIRMRAD496232` Repairs and maintenance
- `MTIRMRAD496769` Tools
- `MTIRMRAD496250` IT consumeables
- `MTIRMRAD496313` Internet
- `MTIRMRAD496315` Stationery and postage
- `MTIRMRAD496326` Other permit & licenses
- `MTIRMRAD496328` Subscriptions
- `MTIRMRAD496014` Training and seminars
- `MTIRMRAD496314` Telephone and mobile comms

COA Management should support these controls:

- ensure each mandatory code exists
- ensure each mandatory code remains active unless explicitly retired
- prevent accidental duplicate code creation
- allow name normalization to match business-approved labels
- show whether the current fiscal year already has a budget row for each mandatory COA
- show protected baseline status directly in `COA Management`
- block deactivation, hard delete, department change, and expense-type change for protected baseline COAs
- surface label mismatch when a stored COA name drifts from the approved baseline label

## 5. Recommended UI Behavior

### COA Management

Recommended additions:

- a `Mandatory HR / IT OPEX` filter or section
- a coverage status per code:
  - `COA Exists`
  - `Current FY Budget Exists`
  - `Needs New FY Budget`
  - `Carry Forward Approved`
- a mismatch indicator when business-approved name differs from current stored name
- a protected baseline badge so operators know which COAs are governed and not eligible for normal deactivation

### Budget Overview

Recommended additions:

- auto-focus on current fiscal year when opening the page
- scope the current `Budget Overview` screen to `HR / IT` budgets only
- limit visible records to `ExpenseType IN (CAPEX, OPEX)` for `Department = HR / IT`
- show a `New Fiscal Year Attention` card when current-year budgets are incomplete
- show zero-value rows for mandatory COAs that exist but have no budget yet for the selected year
- show carry-forward as a separate badge or amount, not hidden inside allocation
- when the new fiscal year is opened, `Previous Remaining` in the operational readiness grid must stay visually reset to `0` unless a carry-forward entry has been explicitly approved into the selected year

## 6. Recommended Year-End / New-Year Workflow

### End Of Year

1. Close the outgoing fiscal year after final review
2. Freeze budget write operations for the closed year
3. Review remaining balances by COA
4. Decide which balances are eligible for carry-forward

### Start Of New Year

1. Auto-switch the default working year to the current year
2. Create or import annual budgets for the new fiscal year
3. Show `Need Attention` for mandatory COAs without budget entries
4. Apply approved carry-forward entries explicitly
5. Keep prior-year history read-only and separated

## 7. Historical Audit And Archive Direction

Historical budget data should remain reviewable per fiscal year even when the working `Budget Overview` scope is narrowed to `HR / IT`.

Locked policy direction:

- prior-year budgets remain accessible for audit and historical review
- narrowing `Budget Overview` scope must not imply destructive deletion of historical records
- non-HR / IT budget data remains retained in live tables even if not shown in the current operational `Budget Overview`
- the current archive model uses live tables plus `FiscalYear` and `BudgetCutoff` governance rather than separate archive tables
- destructive cleanup is not allowed in normal application workflow
- if physical archival is required later, it must preserve fiscal-year traceability and read-only visibility first

The locked design and retained residual questions are tracked in:

- `docs/implementation-roadmap.md`
- `docs/historical-budget-governance.md`
- `docs/open-questions-and-challenges.md`

## 8. Recommended Implementation Direction

To support this policy cleanly, future implementation should include:

- COA validation for mandatory HR / IT codes
- a current-year completeness check for active mandatory COAs
- an explicit carry-forward data model
- dashboard and budget overview attention states for missing yearly budgets
- optional automation job if virtual placeholders are ever replaced by persisted opening rows

## 9. Decision Recommendations

Recommended decisions:

- annual budget resets to `0` on the new fiscal year by default
- carry-on is opt-in and traceable
- mandatory HR / IT OPEX COAs are controlled as a governed list
- the COA baseline must stay protected so `MTIRMRAD496315` is not lost or deactivated unintentionally
- the normalized names for `MTIRMRAD496137`, `MTIRMRAD496250`, and `MTIRMRAD496014` should remain the approved reference labels
- historical data should be retained per fiscal year until archive and cleanup policy is formally approved

## 10. Open Questions

The following business rules should be locked before implementation:

- should mandatory COA coverage apply only to `HR / IT`, or become a reusable rule for other departments later
