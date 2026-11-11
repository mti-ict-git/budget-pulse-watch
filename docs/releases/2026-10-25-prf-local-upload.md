# PRF local upload deployment — 2026-10-25

Pomon upload parser v2 was deployed to Docker server `10.60.10.59`, project `/root/budget-pulse-watch`. Only frontend/backend containers were replaced; Pronto Sync retained its container ID. Existing data, environment files and shared-storage configuration were preserved.

## Delivered behavior

Settings offers LLM or optional Local PDF parser v2 for new uploads. LLM remains the default. Preview exposes editable fields, original PDF, native/OCR text and review flags. Saving requires a bound preview and explicit review acknowledgment. Rescan continues using the unchanged LLM implementation.

Migration 026 committed transactionally: `AppSettings.UploadExtractionMethod` defaults to `llm`, accepts only `llm/local`, and existing settings were verified unchanged. Python/pdfplumber 0.11.9, Poppler and Tesseract eng/ind are installed in the backend image. A cold readiness check may wait 30 seconds; the PDF extraction bound remains 120 seconds.

## Verification

- Backend TypeScript build and eight backend tests passed against the deployed-source baseline.
- Existing adapter corpus: 55 PDFs, 73 pages, 255 items retain established parser-v2 results and review limitations.
- Linux runtime reports ready. Candidate real-PDF HTTP previews recovered 31947 (2 items, 1 page) and 41682 (17 items, 2 pages), with GL coverage and review flags. No PRF writes or cloud provider calls.
- Production frontend → backend upload-preview: PRF 41682 returned 17 items, 2 pages, 11 review flags, GL on every item and a preview receipt, in 15.7 seconds in the final check. PRF/item counts were unchanged. The local selector was temporary and restored to `llm`; provider/key/model configuration fingerprints were unchanged.
- Candidate-image browser fixtures passed desktop/mobile upload, editable preview, acknowledgment gating, failure/retry, cancellation, Settings selection/persistence and source-document access. These browser API fixtures are distinct from the production real-PDF smoke test.
- Both production containers healthy; frontend API authentication guard and static assets verified.
- Compiled rescan route suffix SHA256 before/after: `246edfc74606af2b20c727b0b61638be1a1bd9c395a1a42ab1bc8ba09117ead4`. Compiled OCR service, rescan validation and auth dependencies also match the prior image.
- Real PRF creation/save was not exercised in production; no synthetic business records were created.

## Build and rollback

The release reused the prior backend/frontend runtime images, applying verified compiled code, Linux OCR wheels and readable static asset permissions. This avoids unrelated runtime replacement. Source Dockerfiles include OCR installation and static-asset permission handling for future normal builds.

Backend release tag: `pomon-backend:parser-v2-20261025-r2`. Frontend release tag: `pomon-frontend:parser-v2-20261025`.

Rollback directory: `/root/pomon-deploy-backups/parser-v2-20261025` (restricted to root), containing old source, image tags, build inputs/logs and verification evidence. Old image tags: `pomon-backend:before-parser-v2-20261025` and `pomon-frontend:before-parser-v2-20261025`.

To roll back the application, retag those old images to `budget-pulse-watch-backend` and `budget-pulse-watch-frontend`, then run `docker compose -f docker-compose.production.yml up -d --no-deps --no-build backend frontend` in the project directory and verify health/proxy. Do not stop the whole compose project, remove volumes or restart Pronto Sync. The additive migration column may remain during application rollback; no data restore is required for this feature.

OpenAPI was merged with the server's newer rescan contract and updated for upload method/preview/save. Rescan application integration remains deferred. This release did not apply rescan proposals, repair existing PRFs, or change business approval policy.
