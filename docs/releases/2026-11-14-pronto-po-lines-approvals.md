# Pronto split-PO lines and approval history deployment — 2026-11-14

PR #2 (merge `4320d4d`) was deployed to Docker server `10.60.10.59`, project `/root/budget-pulse-watch`. Backend, frontend and the `pronto_sync` worker were rebuilt and replaced. Data, environment files and volumes were preserved. Roadmap: Phase 15.

## Delivered behavior

- The item sync also reads PO E001 Lines (with Req'n No from Line Detail) for the PRF's original PO and every split PO, and adds lines that belong to the PRF as `source: po_lines`. Existing INV E071 values are not overwritten.
- The item sync reads PO E001 Approval Status for the same POs and stores it with `PUT /api/prfs/{id}/pronto-approvals` (skipped in dry-run mode). Only read-only Pronto screens are used.
- The PRF detail dialog shows a "Pronto Approval History" card, one block per PO, with a "Split PO" badge and the latest step.
- Migration 027 (`PRFProntoApprovalHistory`) was applied to production on 2026-11-12, before this deployment.

## Deployment method

The server source is not a clean git checkout, so only the files changed by PR #2 were copied. Before copying, the server's copies of every changed code file were checked against the pre-PR version (`53d78bb`) and matched. `docs/pronto-sync.md` and `docs/backlog-dashboard-pronto-2026-11.md` were not copied because they are not readable without root and are not used at runtime.

Steps, run as root: back up the changed files and tag the current images, extract the release files, `docker compose -f docker-compose.production.yml build backend frontend pronto_sync`, then `up -d --no-deps --no-build backend frontend pronto_sync`.

Release tags: `pomon-backend:pronto-po-lines-20261112`, `pomon-frontend:pronto-po-lines-20261112`, `pomon-pronto-sync:pronto-po-lines-20261112`.

## Verification

- Backend and frontend containers healthy; `/health` 200; frontend 200.
- `GET` and `PUT /api/prfs/{id}/pronto-approvals` return 401 without auth.
- The frontend bundle contains the "Pronto Approval History" card.
- The worker imports `pronto_po_parse`, `pronto_access` and `prf_pronto_sync`, and loads its settings from the backend (`enabled`, `apply`).
- Production dry run inside the deployed worker for PRF 51727 (`--sync-prf-items --prfno 51727 --max-prfs 1 --dry-run --add-missing-item`):
  - PO details found 2/2; 6/6 items matched, 0 unmatched.
  - 2 changes, both from `po_lines`: items `7021-03-330869` (PowerEdge R670) and `7025-03-309184` (ME5224) get `OriginalPONumber 51727`, `SplitPONumber 53851` and `ItemCode`.
  - Approval history: 14 entries (51727) and 9 entries (53851), not written.

## Operational notes

- On restart the worker started before the backend was ready, so its first cycle saw sync as disabled and slept for one hour. The next cycle runs with the saved settings (apply on). This is the first apply cycle with the new code for all 2026 PRFs.
- The items step now opens each PO in PO E001, so it is expected to take longer than before (about 12 minutes). Not yet measured.

## Rollback

Backup directory (root only): `/root/pomon-deploy-backups/pronto-po-lines-20261112`, with the old files, image IDs, container list and build log. Old image tags: `pomon-backend:before-pronto-po-lines-20261112`, `pomon-frontend:before-pronto-po-lines-20261112`, `pomon-pronto-sync:before-pronto-po-lines-20261112`.

To roll back the application, retag those images to `budget-pulse-watch-backend`, `budget-pulse-watch-frontend` and `budget-pulse-watch-pronto_sync`, restore the files from the backup's `files/` folder, then run `docker compose -f docker-compose.production.yml up -d --no-deps --no-build backend frontend pronto_sync` in the project directory. Do not stop the whole compose project or remove volumes. Migration 027 is additive and may stay; the old code does not use its table.
