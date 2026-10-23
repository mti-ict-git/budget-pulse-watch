# Native-text PDF OCR release — 2026-10-23

Application commit: `995d6071b0670ae46c01ee262dcae690f1144530`, verified on origin/main and deployed backend-only.
Backend image: `sha256:871e3159c3c8759410b648485e9629dab6fd0930556b3ddde33966a3eeecb72c`, exact commit revision label, healthy.

## Change and verification
- PDF extraction now pairs spatially ordered embedded text with high-detail page images to resolve ambiguous numbers/identifiers. A crossed-out part number alone is distinguished from cancellation of a full item row. Image-only PDFs still use the image. Reconciliation guards stay enabled.
- Backend TypeScript, offline native-text prompt tests, extraction validation and isolated route regressions passed. The final Docker image passed offline compiled validation and native-text prompt tests with network disabled; no external AI calls during candidate or deployment checks.
- The separately authorized read-only OpenAI retest of original PDF PRF 54123 matched all 19 row numbers, part/cost codes, quantities, unit prices, line totals and active statuses. Total IDR 54,904,429, UPS IDR 6,600,000; before/after PRF hashes identical. This is one document verification, not a guarantee for every PDF.
- Scoped activation used the candidate without rebuilding. Backend/frontend health, same-origin API authentication rejection, public HTTPS and protected CIFS document mount/root passed.
- Frontend image/container remains at 821eca3; Pronto worker unchanged. Compose/env checksums and mount identities preserved.
- Read-only production response hashes before/after deployment match for PRF 54123 (28 stored items) and 52726 (10 stored items). No scan apply, sync, PRF cleanup, schema migration or data repair was performed.
- OpenAPI reviewed: no endpoint/payload/schema change, so no OpenAPI update needed.

## Evidence and recovery
Private audit directory: `/root/budget-pulse-watch/artifacts/releases/995d6071b0670ae46c01ee262dcae690f1144530` (build READY, activation VERIFIED, verification.json, prf-before.json, prf-after.json, protected runtime checkpoint).
Rollback reference: `budget-pulse-watch-backend:rollback-995d6071b0670ae46c01ee262dcae690f1144530`, previous image `sha256:510f02a2ff12203467700642db68d35b364f1693b975dd31fdf2930931fc7e52`. Retained, not exercised. Documentation-only follow-up commits do not change running image revisions.
