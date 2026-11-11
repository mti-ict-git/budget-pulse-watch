# Phase 14 technical implementation

- `prfUploadExtraction` dispatches new uploads according to the persisted upload-only setting; rescan still calls `ocrService` directly.
- `localPRFParser` invokes a Python worker without a shell, with a temporary private input, bounded process group/time/output and cleanup. Two local parses can run simultaneously.
- `scripts/prf_parser` packages parser v2 and its frozen native baseline. The worker adds field mapping, annotation-aware header evidence, Poppler/Tesseract OCR and review flags. Native PDF text is required; unsupported scans/images return an explicit error instead of cloud fallback.
- `prfUploadReview` owns bounded preview receipts (user, SHA-256 source identity, method, issues and expiry), strict reviewed-value validation, single-save locking and successful-save replay.
- Header/items are committed together. Part numbers populate ItemCode; full descriptions are retained separately from the bounded display name.
- Existing authorizations, original-source attachments and shared path resolution remain in use. Upload method selection is not read by rescan handlers.

## Runtime

Apply migration 026 before this backend version. For local development, create a Python venv, install `requirements.txt`, then install `pdfplumber==0.11.9 --no-deps`. Set `PRF_PARSER_PYTHON` to that venv's Python. Install Poppler and Tesseract with eng/ind data. Optional `PRF_PDFTOPPM` and `PRF_TESSERACT` override trusted server executable paths. The Dockerfile packages these dependencies and a private venv; PDFium is not needed for rendering.

Default remains LLM. Enable local through Settings only after the runtime check succeeds. No real keys, PDFs or database credentials are included in automated UI fixtures. Local unit/HTTP tests mock SQL/provider/storage; browser tests use synthetic API responses. The 55-PDF adapter regression uses external local fixture paths and is separate from production acceptance.

## Release limits

No production migration/deployment is performed by these checks. Existing unrelated frontend type errors are documented in the verification report. Docker image acceptance requires a running Docker daemon and a deployment environment.
