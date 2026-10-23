# Budget Pulse Watch deployment profile

## Authorized release (2026-10-22)

Scope: Merdeka UI rollout including selected-item workspace (option C), and OCR
rescan reconciliation explicitly included by the user. Publish main and activate
frontend/backend Docker services. No business mutation or OCR apply is authorized
as a deployment smoke test. Exact image revisions and outcomes are recorded in
the release evidence after activation.

Repository: https://github.com/mti-ict-git/budget-pulse-watch, branch main.
Connection: existing pinned SSH configuration in the Hermes connection workspace;
secrets remain outside Git. Host mtimrwcnt01 (10.60.10.59), checkout
/root/budget-pulse-watch, Compose project budget-pulse-watch, only
docker-compose.production.yml. Compose 2.35.1. Runtime env: backend/.env.production.

Baseline checkout d09a42982f4b347fcddaa75a0aa4711d30f70eb3. Its only tracked local
change is executable mode on deploy-production.sh (100644 -> 100755); preserve it.
Untracked token cache, mount-script backup and shared-documents-overlay are runtime
material; preserve them. No automatic pull/deployment watcher was observed.

Affected services frontend (9007 -> 8080) and backend (5004 -> 3001). Retain
pronto_sync container/image and unrelated services. Build only from a pinned tracked
Git archive into unique candidate tags; exclude all .env* files from the isolated
build context. Keep running image tags intact until candidate verification passes.
Retain previous image IDs under unique rollback tags before activation. Use scoped
Compose up --no-build --pull never --no-deps --wait; never down -v.

## Protected configuration and storage

Keep Compose identity and runtime env bytes unchanged; checkpoint their checksums
in a private artifacts/releases/<revision> directory. Backend binds backend/data,
backend/temp and docs (read-only) to /app/data, /app/temp and /app/docs. Network
storage is an actual CIFS mount //10.60.10.44/pr_document at /app/shared-documents;
accepted application root is the nested PT Merdeka Tsingshan Indonesia directory.
Retain the existing mount startup scripts and verify share/type/root after restart.
Do not rewrite SHARED_FOLDER_PATH to the mount root. Runtime secrets and token
caches must not enter candidate contexts or public release evidence.

Baseline frontend serves HTTP 200 but Docker marks it unhealthy: wget resolves
localhost to ::1 while Nginx listens IPv4. The release changes only the frontend
healthcheck URL to 127.0.0.1, preserving the HTTP acceptance condition.

## Gates and recovery

Frontend/backend TypeScript, full frontend lint/build, backend build, OCR matching/
normalization/signed-token challenge, and exact final changed SQL UPDATE templates
executed with impossible IDs and zero affected rows inside a rolled-back transaction.
Existing audit table/ProjectArea schema must already be present; do not apply
unreviewed migrations during activation. OCR end-to-end AI extraction and business
apply remain user acceptance tests, not deployment smoke checks.

Verify exact running image IDs/revision labels, both healthchecks, frontend/API
proxy, public HTTPS and built JS/CSS/font/logo assets. Browser checks are read-only.
Health alone does not prove business mutation acceptance. Rollback, if required,
uses the retained frontend/backend image IDs with the same Compose/config/mounts;
no schema/data changes are planned. A retained rollback tag is not a tested restore.

Canonical vendor assets are marked -text in .gitattributes so Windows Git does not
normalize their bytes before Linux deployment. Captured vendor/generated whitespace
is retained intentionally; owned application files still receive whitespace checks.
Local validation confirmed both changed final OCR UPDATE templates execute against
the same configured production SQL host/database with zero affected rows and rollback.
Production metadata confirmed the audit table and ProjectArea already exist, so no
schema migration is part of this release. Full external AI OCR/apply is not exercised.

## Verified release outcome — 2026-10-22

Application revision: 869fe2af883dbad9928a51fe88108e6354dab5a0, published to main
and deployed through existing SSH to the production Docker Compose project.
Only frontend/backend were recreated, using verified candidates without rebuilding.

- Frontend image: sha256:cdf855e7a8d7e026eed4e4d668f0f0e606a42a4eab62d50ba61ee34380a8ff75.
- Backend image: sha256:88817888627e489b5f4fa5b2734a93361bcaae9da5b45284ca0695303f2e2c86.
- Both running images carry the application revision label and report healthy.
- Public HTTPS https://pomon.merdekabattery.com/, JS/CSS, logo and font returned 200
  with certificate verification; frontend/API health and proxy checks passed.
- Unauthenticated OCR apply was rejected with 401. No live OCR extraction/apply or
  business mutation was performed; these remain authenticated user acceptance tests.
- Runtime Compose/env checksums and backend mount destinations/sources are unchanged.
  Actual CIFS mount and configured nested document root were verified after restart.
- pronto_sync retains its original container and image; no schema migration ran.
- Production browser reload rendered the sign-in page successfully. No authenticated
  production session was available; protected workflows were checked locally against
  the configured real backend before release, not claimed as production browser UAT.

Private server evidence: /root/budget-pulse-watch/artifacts/releases/869fe2af883dbad9928a51fe88108e6354dab5a0
(build.status READY, activation.status VERIFIED, verification.json, build/activation
logs, baseline and protected configuration checkpoint). Keep private checkpoint files
out of Git. Rollback references are retained as budget-pulse-watch-frontend and
budget-pulse-watch-backend with tag rollback-869fe2af883dbad9928a51fe88108e6354dab5a0.
Rollback was not exercised. Subsequent documentation-only commits do not change the
running image revision and do not require a rebuild.


## Backend-only OCR release — 2026-10-23

Backend deployed at `5b0e6ba00f5ca52217413cda9e69d4ba9672f37a`; healthy with proxy, public TLS and protected storage verified. Frontend and worker retained. No schema or business-data changes. See [release evidence](releases/2026-10-23-ocr-rescan.md) for image IDs, tests and rollback references. Subsequent documentation commits do not change the running image.


## Complete Merdeka frontend release — 2026-10-23

Frontend now runs `821eca390d542770c6b2ae6161648ddc63407118`, healthy and publicly verified with the new Merdeka login/MBM+MTI logos. Completed Pomon Work UI changes are included. Backend remains `5b0e6ba00f5ca52217413cda9e69d4ba9672f37a`; worker retained. See [frontend release evidence](releases/2026-10-23-merdeka-frontend.md). No API/schema/data changes.


## Native-text PDF OCR release — 2026-10-23

Backend now runs `995d6071b0670ae46c01ee262dcae690f1144530`, healthy and verified. Frontend remains `821eca390d542770c6b2ae6161648ddc63407118`; worker retained. PRF 54123 and 52726 response hashes unchanged across deployment; no scan apply or data/schema changes. See [release evidence](releases/2026-10-23-native-pdf-ocr.md).
