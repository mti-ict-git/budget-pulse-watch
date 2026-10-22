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
