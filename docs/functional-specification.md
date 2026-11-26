# Functional specification: reviewed PRF upload

Phase 14 offers an upload-only Settings selector: existing LLM providers or optional local PDF parser v2. Existing provider credentials remain configured and rescan still uses LLM. No silent fallback from local to cloud is allowed.

Choose document → Preview extraction → compare source and edit fields/items → acknowledge source review → Save reviewed PRF. New file selection resets the preview. Save never extracts the file again and does not generate a missing PR number from filename. Header/item validation runs server-side. Changed quantities/prices must reconcile to the explicitly reviewed total. The original extracted total stays visible. Removing a cancelled proposal requires explicit review and total reconciliation.

Source PDF/image, native text, OCR text and review flags remain available before saving. Inferred row numbers are separate from blank printed row numbers. Local parsing does not certify visual cancellation status or every image note. Failed extraction/save preserves the selected document/edits. Concurrent or repeated saves cannot create a second PRF from the same receipt. Attachment copy failures are surfaced after a successful PRF creation.

Scope excludes local rescan integration, automatic taxonomy decisions, new permission roles and automatic production enablement.

# Functional specification: Immediate Action (Phase 29)

The sidebar menu **Immediate Action** (under PRF Monitoring) lists the requisitions in the Pronto Immediate Action queue (PO M094, "Approve/Review Requisitions (Immediate Action Req'd)") that belong to POMON: the order number is a PRF number or a split PO number recorded on a PRF item. The menu shows a count badge, red when at least one is rejected. Every signed-in user who can open PRF Monitoring can open the page.

Requisitions are grouped as **Rejected** (the latest Approval Status entry is a rejection; its user, date and comment are shown), **Needs IT review and approve / acknowledge** (Next Action By is MTI IT), and **Waiting for others**. Each row shows the order number, the PRF it belongs to (split POs say "Split of PRF n", linking to PRF Monitoring), supplier, total, due date, the latest Pronto action, Next Action By, and a details popover with the full Approval Status and Next Action By lists. Requisitions in the queue that match no POMON PRF are listed behind a toggle.

The list is read from Pronto every hour. The page shows when it was last read and the error of a failed read. There are no notifications.

## Acknowledge from the Immediate Action page (Phase 30)

Rows in **Needs IT review and approve / acknowledge** have an **Acknowledge** button for admin and doccon users. It asks for confirmation (order, supplier, total, PRF, and that Pronto records the action under the worker's account), then queues the request. The row shows the request status (waiting for the worker, acknowledging, acknowledged, not acknowledged with the reason, failed with nothing changed, or clicked but not confirmed) and the page refreshes itself every 15 seconds while a request is open. A **Recent acknowledge requests** list shows the last 14 days with who asked and the result. Only "Acknowledge for approval" is offered; approving, converting and rejecting stay in Pronto.

