# Phase 5 Deployment and Rollback Plan

## Deployment Checklist

1. Confirm branch and release tag are correct.
2. Run local validation:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `cd backend && npx tsc --noEmit`
3. Run readiness report:
   - `npm --prefix backend run phase5:readiness`
4. Verify Phase 4 data reports:
   - `docs/reports/phase4-pic-backfill-*.json`
   - `docs/reports/phase4-opex-reconciliation-*.json`
5. Apply required database migration:
   - `npm run db:migrate`
6. Deploy application using existing deployment path.
7. Post-deploy smoke checks:
   - `GET /health`
   - `GET /api/budgets/cutoff/2026`
   - `GET /api/prfs/picking-pic-users`

## Production Verification

- Confirm FY2026 close/reopen works with role restrictions.
- Confirm budget write operations are blocked when FY2026 is closed.
- Confirm PRF item `Picked Up` requires PIC and date.
- Confirm non-authorized users cannot modify PIC fields.
- Confirm OPEX import returns inserted/updated/rejected summary.

## Rollback Plan

1. Stop rollout and switch traffic to previous stable version.
2. Redeploy previous application image/tag.
3. Re-run smoke checks on previous version.
4. If issue is data-related:
   - Restore database from latest pre-deploy backup.
   - Re-run verification checks.
5. Record incident timeline, root cause, and corrective action.

## Rollback Decision Triggers

- Authentication or role guard failure.
- Budget write lock not enforced for closed FY.
- PRF item updates bypass PIC mandatory rule.
- Critical API error rate increase after deployment.

## Owner Matrix

- Release Owner:
- Backend Owner:
- Frontend Owner:
- DB Owner:
- QA Owner:
