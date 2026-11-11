# Functional specification: reviewed PRF upload

Phase 14 offers an upload-only Settings selector: existing LLM providers or optional local PDF parser v2. Existing provider credentials remain configured and rescan still uses LLM. No silent fallback from local to cloud is allowed.

Choose document → Preview extraction → compare source and edit fields/items → acknowledge source review → Save reviewed PRF. New file selection resets the preview. Save never extracts the file again and does not generate a missing PR number from filename. Header/item validation runs server-side. Changed quantities/prices must reconcile to the explicitly reviewed total. The original extracted total stays visible. Removing a cancelled proposal requires explicit review and total reconciliation.

Source PDF/image, native text, OCR text and review flags remain available before saving. Inferred row numbers are separate from blank printed row numbers. Local parsing does not certify visual cancellation status or every image note. Failed extraction/save preserves the selected document/edits. Concurrent or repeated saves cannot create a second PRF from the same receipt. Attachment copy failures are surfaced after a successful PRF creation.

Scope excludes local rescan integration, automatic taxonomy decisions, new permission roles and automatic production enablement.
