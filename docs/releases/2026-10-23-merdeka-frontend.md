# Merdeka frontend release — 2026-10-23

Published and deployed frontend commit: `821eca390d542770c6b2ae6161648ddc63407118` (completed UI changes in `2f990bcc8c1f5901e3c2ecc35d51e6b458f2a47a`, clean-install lockfile correction in final commit).

Pomon Work and the release chat share the same checkout and main branch. No cross-branch merge was needed. The preceding OCR-only release retained the old frontend; this release corrects that omission and includes all completed frontend changes: Merdeka login and MBM/MTI logos, sidebar, PRF panel animation and styled Excel export, Settings/Create PRF and Budget/COA refinements.

## Verification and scope
- Frontend TypeScript, lint (8 existing Fast Refresh warnings, 0 errors), and local Vite build passed. Pomon Work recorded desktop/mobile and read-only real-backend workflow verification in merdeka-ui-rollout.md.
- Docker clean install initially rejected two inconsistent lock entries; es-object-atoms 1.1.2 and hasown 2.0.4 were corrected using official npm integrity metadata. Final npm ci and Vite Docker build passed.
- Canonical vendor/login asset hashes, Nginx config and candidate login/MTI assets passed before activation.
- Frontend image `sha256:9488910fbf4d2d77312cf33795efb787afe41ce2b0e202f4e2858b004c298188` carries final release commit; activated without rebuild and verified healthy.
- Backend OCR remains at `5b0e6ba00f5ca52217413cda9e69d4ba9672f37a`. Backend and Pronto worker container/image IDs were retained. Runtime Compose/env and mounts were preserved.
- Public HTTPS, frontend/API health, same-origin auth rejection, referenced JS/CSS/font and MBM/MTI/login image assets returned expected results. IAB reload of production /login visibly rendered the Merdeka photo layout with both company logos. No authenticated production business mutation performed.
- No backend/API contract change in this frontend release; OpenAPI unchanged. No database migration.

Private server audit: `/root/budget-pulse-watch/artifacts/releases/821eca390d542770c6b2ae6161648ddc63407118` (READY/VERIFIED, verification.json, runtime checkpoint and build/activation logs).
Rollback frontend tag: `budget-pulse-watch-frontend:rollback-821eca390d542770c6b2ae6161648ddc63407118`; retained, not exercised. Subsequent documentation-only commits do not change image revisions.
