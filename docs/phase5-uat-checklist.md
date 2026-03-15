# Phase 5 UAT Checklist

## Scope

- Budget cut-off enforcement
- Role and permission behavior
- Picking PIC mandatory logic
- Build quality checks

## Preconditions

- Database migration up to current version applied
- Admin and DocCon test accounts active
- FY2026 budget and PRF sample data available

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

10. Build quality checks
    - Run `npm run lint`
    - Run `npx tsc --noEmit`
    - Run `cd backend && npx tsc --noEmit`
    - Expected: lint no errors, typecheck pass

## UAT Sign-off

- Business Owner:
- IT Manager:
- QA Lead:
- Sign-off Date:
- Notes:
