# Open Questions And Challenges

## Purpose

This document records unresolved business and implementation questions that must not be skipped when changing budget-control behavior.

## Resolved Questions

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

### Scope Expansion

- Should mandatory COA coverage apply only to `HR / IT`, or become a reusable rule for other departments later?

## Current Recommendation

- Do not hard delete historical budget data in normal application workflow
- Prefer year-based visibility plus protected historical retention first
- Keep archive as a governance model on live tables until there is a justified need for physical archival

## Challenge Notes

- The repository already treats budget data as fiscal-year based, so basic historical lookup exists
- Phase 6 locks the governance baseline around retention, non-destructive history, and cutoff-based historical state
- Phase 7 locks the new-year readiness baseline around virtual placeholders, explicit carry-forward, and admin-only approval
- What remains open is scope expansion beyond `HR / IT`
- Any future backend change in this area requires explicit `docs/openapi.yaml` review
