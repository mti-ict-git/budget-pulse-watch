# Optional local PRF upload parser

## Scope and decisions

The user authorized upload integration first. Settings offers `llm` (existing provider/key/model settings) or `local` (PDF parser v2 plus local OCR). The default remains `llm`. Gemini configuration remains supported for existing installations; OpenAI remains selectable. No external service is used or silently selected when local processing fails.

Rescan preview/apply continues calling the existing OCR service and ignores the upload-only selector. Rescan integration is deferred.

## Preview and save

Upload does not create a PRF. A preview is bound to the authenticated user, source hash, extracted method and review issues, with bounded lifetime. Save requires that preview, the same document, reviewed field values, and acknowledgment of review warnings. Required fields and financial checks run again on the server. Inferred row numbers remain distinct from blank printed row numbers. Shared GL continuation, possible visual cancellations, image notes, and native/OCR conflicts require review.

Local extraction does not certify cancellation detection or image-only/handwriting accuracy. Notes and source pages are shown for human checking. A missing PR number must be filled explicitly; no filename-derived number is used.

## Runtime and rollout

Apply migration 026 before deploying this source version. Install the packaged Python dependencies, Poppler and Tesseract eng/ind. The local worker is bounded by time, pages and output size, runs without a shell, and removes temporary files. LLM configuration is retained when switching methods.

Migration 026 and production deployment completed on server59 on 2026-10-25; production upload-preview was verified without a PRF write. See `docs/releases/2026-10-25-prf-local-upload.md`.

## Local validation

The packaged adapter preserves established results across 55 unique PDFs (73 pages, 255 items), including shared GL and annotation recovery. This verifies the existing corpus, not universal extraction accuracy. Eight backend tests cover review enforcement, transaction propagation/rollback, preview reuse and local-provider isolation. Rescan route handlers are byte-identical to the pre-integration version.

Build and targeted lint pass. Browser tests use synthetic API fixtures; they do not write to live SQL or contact OpenAI. Existing frontend typecheck failures in BudgetOverview and Dashboard remain outside this change. Linux runtime images and production-proxied preview were verified. Saving a real PRF remains business acceptance.

Preview receipts live in bounded process memory for 15 minutes. Restarting the backend or routing save to another instance requires a new preview; multi-instance rollout needs sticky routing or a shared receipt store. Local processing accepts native-text PDFs up to 20 pages, not scan-only PDFs. Output notes are bounded and full extracted page text remains available for review.

## Production operation

Choose **Settings → OCR Document Processing → New PRF upload method → Local PDF parser v2 (optional)**, then Save Settings. The installed runtime supports Python/pdfplumber 0.11.9, Poppler and Tesseract eng/ind. The runtime check allows 30 seconds on a cold shared host; PDF extraction retains its 120-second bound. LLM remains the deployment default, and existing rescan continues using the configured LLM provider.

The deployment reused the prior backend/frontend runtimes and applied the compiled application changes, OCR packages and static asset permissions. Fresh source builds remain supported by the Dockerfiles. No global service restart, volume cleanup or database restore was performed.
