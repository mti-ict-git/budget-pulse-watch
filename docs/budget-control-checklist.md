# Budget Control Checklist

## Purpose

This checklist tracks the baseline budget-control hardening work so mandatory COA coverage, yearly-budget policy, and follow-up implementation items are not missed.

## Completed Baseline Actions

- [x] Verify the mandatory HR / IT GL / COA list against `ChartOfAccounts`
- [x] Confirm that one mandatory code was missing: `MTIRMRAD496315`
- [x] Identify name-normalization gaps for:
  - `MTIRMRAD496137`
  - `MTIRMRAD496250`
  - `MTIRMRAD496014`
- [x] Define documented policy that annual budget resets to `0` for a new fiscal year unless explicitly carried forward
- [x] Define documented requirement that the new fiscal year must show `Need Attention` when mandatory active COAs do not yet have a budget row

## Repository Change Checklist

- [x] Add a reproducible SQL migration to ensure mandatory HR / IT OPEX COAs exist
- [x] Normalize approved business labels for mandatory HR / IT OPEX COAs in the migration
- [x] Add policy documentation for yearly budget control and carry-on handling
- [x] Link the new budget-control documents from onboarding references
- [x] Scope `Budget Overview` to HR / IT CAPEX and OPEX only

## Database Execution Checklist

- [x] Apply the mandatory COA migration to the target database
- [x] Re-query the 10 mandatory COA codes after execution
- [x] Confirm all 10 codes now exist in `ChartOfAccounts`
- [x] Confirm the updated names are stored for normalized records

## Follow-Up Implementation Checklist

- [x] Lock historical audit and archive policy before any destructive cleanup is considered
- [x] Add a `Mandatory HR / IT OPEX` section or filter in COA Management
- [x] Show current fiscal-year budget coverage status per mandatory COA
- [x] Show `Need Attention` in Budget Overview for active mandatory COAs without a current-year budget
- [x] Keep zero-allocation visibility for mandatory COAs when the new year begins and budget is not yet entered
- [x] Design and implement an explicit carry-forward data model
- [x] Decide whether zero-budget placeholders are persisted in DB or derived virtually in UI
- [x] Prevent accidental deactivation or delete for protected mandatory baseline COAs

## Verification Evidence

- Date of baseline verification: `2026-07-22`
- Verification method:
  - direct SQL query to `ChartOfAccounts`
  - repository migration added under `backend/database/migrations/`
  - documentation review and update under `docs/`

## Related Documents

- `docs/budget-control-policy.md`
- `docs/historical-budget-governance.md`
- `docs/implementation-roadmap.md`
- `docs/open-questions-and-challenges.md`
- `docs/project-onboarding.md`
- `docs/phase5-uat-checklist.md`
