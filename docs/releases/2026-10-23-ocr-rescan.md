# OCR rescan production release — 2026-10-23

Application commit: `5b0e6ba00f5ca52217413cda9e69d4ba9672f37a`, pushed and verified on `origin/main`.
Only backend was activated. Frontend remains at image revision `869fe2af883dbad9928a51fe88108e6354dab5a0`; Pronto worker was retained. Local uncommitted UI work was deliberately excluded.

## Verification
- Backend TypeScript, pure extraction validation regression and isolated HTTP route-handler regressions passed. Mocked route checks prove rejection before a database transaction, not live database/AI execution.
- Frontend typecheck and lint passed (8 existing Fast Refresh warnings, no errors); local UI is not this release's payload.
- Exact-commit Docker build passed. Candidate compiled-module regressions passed in a read-only network-isolated container. Initial harness incorrectly referenced a test file excluded by production tsconfig; corrected stdin harness tested the compiled production module successfully without changing the image.
- Running backend image: `sha256:510f02a2ff12203467700642db68d35b364f1693b975dd31fdf2930931fc7e52`, carrying the application commit revision label; healthy.
- Backend health, frontend health, same-origin API proxy and public HTTPS passed. Unauthenticated OCR apply returns 401.
- Runtime Compose/env checksums, backend mount identities and actual CIFS document mount/root passed. Frontend and worker container/image identities match baseline.
- In-app browser rendered production login; no authenticated production workflow or live AI extraction/apply was exercised.
- No database migration or business-record mutation performed. Existing FIFO data was not repaired. Real PDF 52726 OCR accuracy/root cause remains a user acceptance task.

## Recovery and evidence
Private server audit: `/root/budget-pulse-watch/artifacts/releases/5b0e6ba00f5ca52217413cda9e69d4ba9672f37a` (`build.status READY`, `activation.status VERIFIED`, `candidate-test.txt`, `verification.json`, private config checkpoint).
Rollback image: `budget-pulse-watch-backend:rollback-5b0e6ba00f5ca52217413cda9e69d4ba9672f37a` (previous backend image `sha256:88817888627e489b5f4fa5b2734a93361bcaae9da5b45284ca0695303f2e2c86`). Retained, not exercised. No image rebuild from documentation-only follow-up commits is required.
