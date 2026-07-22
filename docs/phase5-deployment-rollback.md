# Phase 5 Deployment and Rollback Plan

## Deployment Checklist

1. Confirm branch and release tag are correct.
2. Run local validation:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `cd backend && npx tsc --noEmit`
   - `npm --prefix backend run build`
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
   - authenticated `GET /api/budgets/cutoff/2026`
   - authenticated `GET /api/budgets/readiness/2026`
   - authenticated `GET /api/prfs/picking-pic-users`
   - review `Budget Overview` for HR / IT-only scope, readiness, and carry-forward visibility
   - review `COA Management` for protected baseline badge, coverage status, and deactivation guard

## Production Verification

- Confirm FY2026 close/reopen works with role restrictions.
- Confirm budget write operations are blocked when FY2026 is closed.
- Confirm PRF item `Picked Up` requires PIC and date.
- Confirm non-authorized users cannot modify PIC fields.
- Confirm OPEX import returns inserted/updated/rejected summary.
- Confirm mandatory HR / IT OPEX baseline remains active and protected in `COA Management`.
- Confirm carry-forward remains explicit and separate from annual allocation.

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
- Protected mandatory COA can be deactivated or mutated outside governance rules.
- Critical API error rate increase after deployment.

## Owner Matrix

- Release Owner:
- Backend Owner:
- Frontend Owner:
- DB Owner:
- QA Owner:

## Engineering Verification Snapshot

- Date: `2026-07-22`
- `npm run lint`: completed with `0` errors
- `npx tsc --noEmit`: pass
- `cd backend && npx tsc --noEmit`: pass
- `npm --prefix backend run build`: pass
- `npm run db:migrate`: pass
- `npm --prefix backend run phase5:readiness`: `ready`
- `GET /health`: `200 OK`
