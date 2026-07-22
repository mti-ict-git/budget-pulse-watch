# Phase 5 UAT Checklist

## Scope

- Budget cut-off enforcement
- Budget control baseline data integrity
- Role and permission behavior
- Picking PIC mandatory logic
- Build quality checks

## Preconditions

- Database migration up to current version applied
- Admin and DocCon test accounts active
- FY2026 budget and PRF sample data available
- Mandatory HR / IT OPEX COA list reviewed in `docs/budget-control-checklist.md`

## Test Cases

1. Close FY2026 as Content Manager
   - Call `POST /api/budgets/cutoff/2026/close`
   - Expected: success response, cutoff status `IsClosed = true`

2. Verify write-block after close
   - Try budget create/update/delete in FY2026
   - Expected: blocked with explicit cutoff reason

3. Reopen FY2026 as non-admin
   - Call `POST /api/budgets/cutoff/2026/reopen` as non-admin
   - Expected: rejected with admin requirement

4. Reopen FY2026 as admin
   - Call `POST /api/budgets/cutoff/2026/reopen` as admin
   - Expected: success response, cutoff status `IsClosed = false`

5. OPEX import validation
   - Call `POST /api/budgets/opex/import` with mixed valid/invalid rows
   - Expected: summary includes inserted/updated/rejected with reasons

6. Picking PIC mandatory rule
   - Update item status to `Picked Up` without `PickedUpBy` and `PickedUpByUserID`
   - Expected: rejected with Picking PIC mandatory message

7. Picking PIC date mandatory rule
   - Update item status to `Picked Up` without `PickedUpDate`
   - Expected: rejected with PickedUpDate mandatory message

8. Picking PIC role restriction
   - Set `PickedUpByUserID` to non DocCon/Admin active user
   - Expected: rejected

9. Non-authorized user behavior in UI
   - Login as non DocCon/Admin and open PRF item modification
   - Expected: PIC fields read-only

10. Mandatory HR / IT OPEX COA coverage
    - Query `ChartOfAccounts` for the 10 mandatory HR / IT OPEX COA codes
    - Expected: all 10 codes exist, are active, and use the approved business labels

11. Budget Overview scope restriction
    - Open `Budget Overview` and review cards, charts, detail table, and create/edit dialogs
    - Expected: only `HR / IT` records with `CAPEX` or `OPEX` are visible/selectable in this screen

12. New fiscal year readiness coverage
    - Review `Budget Overview` readiness state for mandatory HR / IT OPEX COAs
    - Expected: current-year coverage status is visible, zero-allocation placeholders are virtual, and missing current-year setup appears as `Need Attention`

13. Carry-forward workflow
    - Review carry-forward behavior for a fiscal year where prior-year remaining balance exists
    - Expected: carry-forward remains explicit, separately visible from annual allocation, and requires admin approval

14. COA governance protection
    - Open `COA Management` and review mandatory HR / IT OPEX baseline entries
    - Expected: protected baseline badge visible, fiscal-year coverage visible, label mismatch visible when applicable, and deactivation/protected field changes blocked

15. Build quality checks
    - Run `npm run lint`
    - Run `npx tsc --noEmit`
    - Run `cd backend && npx tsc --noEmit`
    - Expected: lint has no errors, typecheck pass

## Engineering Verification Evidence

- Verification date: `2026-07-22`
- `npm run lint`: pass with `0` errors and existing warnings only
- `npx tsc --noEmit`: pass
- `cd backend && npx tsc --noEmit`: pass
- `npm --prefix backend run build`: pass
- `npm run db:migrate`: pass after normalizing `001_update_roles.sql` batch variable handling
- `npm --prefix backend run phase5:readiness`: pass
  - report: `docs/reports/phase5-readiness-2026-07-22T07-38-56-345Z.json`
- `GET /health`: `200 OK`
- SQL verification:
  - mandatory HR / IT OPEX COA baseline present and active
  - `SchemaMigrations` includes `001_update_roles.sql`, `022_ensure_hr_it_budget_control_coa.sql`, and `023_add_budget_carry_forward.sql`

## UAT Sign-off

- Business Owner:
- IT Manager:
- QA Lead:
- Sign-off Date:
- Notes: Engineering verification completed on `2026-07-22`; business/manual sign-off fields remain pending owner confirmation
