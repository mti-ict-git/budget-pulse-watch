# Development Backlog — Dashboard & Pronto Integration

Recorded: 11 November 2026
Status: **improvement input**. Not scheduled, no technical design yet.

This note collects five proposed improvements to POMON. All of them use Pronto data that is richer than what is synced today. The current sync (see [pronto-sync.md](pronto-sync.md)) only **reads** from Pronto: PO header fields (status, approver, supplier, dates, amount) and item fields (Original/Split PO, quantity).

| # | Proposal | Area | Pronto data needed | Direction |
|---|----------|------|--------------------|-----------|
| 1 | List of PRFs that need follow-up | Dashboard | Latest status (already synced) | Read |
| 2 | Need Action: acknowledge returned PRFs | Dashboard | "Returned" state, acknowledge action | **Write to Pronto** (new) |
| 3 | Pronto as source of truth for items when OCR fails | PRF upload | PO item details | Read |
| 4 | Next Action By | PRF detail / Dashboard | Approval flow | Read |
| 5 | Allocated Buyer | PRF detail / Dashboard | Buyer responsible for the PO | Read |

---

## 1. Dashboard: PRFs that need follow-up

**Requirement**
Right after login, the dashboard shows the list of PRFs that need follow-up, together with each PRF's latest status.

**To clarify**
- What counts as "needs follow-up": specific statuses, PRFs that have not moved for a while, PRFs past their Required Date, or a combination?
- Does the list show all PRFs, or only those belonging to the logged-in user (by Submit By or department)?
- Sort order: longest stuck, nearest due date, or largest amount?
- The latest status comes from the Pronto sync, so the last sync time should be shown to make data freshness clear.

---

## 2. Dashboard: Need Action — acknowledge returned PRFs

**Requirement**
Add a **Need Action** section to the dashboard. It lists PRFs that were returned to us and need to be acknowledged. An admin clicks **Ack**, and POMON automatically passes the acknowledgment on to Pronto.

**Important notes**
- This is a **new direction**: POMON writing to Pronto. Until now the sync only reads, through Playwright UI automation. The risk is higher, so it needs:
  - Confirmation before sending, an audit log (who, when, which PRF), and a visible result state (succeeded, failed, in progress).
  - Failure handling: retry, and the PRF stays in Need Action until Pronto has actually changed.
  - Testing against a non-production Pronto environment first, if one is available.
- Access control: who is allowed to click Ack (admins only, or specific roles).

**To clarify**
- How is "returned" marked in Pronto (status, column, or which menu)?
- What exactly is the acknowledge step in Pronto (menu and button)?
- Does an Ack need a note or reason?

---

## 3. PRF upload: Pronto as source of truth for items

**Problem**
Uploads to POMON still often misread data. PO items extracted by OCR/AI are sometimes inaccurate.

**Opportunity**
Item details in Pronto turn out to be fairly complete. When AI OCR fails during upload, Pronto's item data can serve as the source of truth.

**Mechanism: pending input from the product owner.** Options to consider later:
- Fallback: when OCR returns many review flags or low confidence, offer "take items from Pronto".
- Comparison: show the differences between OCR output and Pronto data on the preview screen, and let the user pick which to keep.
- Pronto as the primary source, with OCR only used for the supporting document.

**Related**
- The existing preview → review → save flow ([prf-local-upload.md](prf-local-upload.md)).
- The existing item sync ("Requisition and P/O Enquiry" in [pronto-sync.md](pronto-sync.md)). Check which fields are available: description, part code, qty, UOM, price, GL.

**To clarify**
- When does PO data become available in Pronto, relative to the time of upload to POMON?

---

## 4. Next Action By

**Requirement**
The PO approval flow is visible in Pronto. From it, POMON can show who has to approve next after the latest approval.

**Notes**
- Today only `ApprovedByName` (the latest approver) is synced.
- Needed: the full approval sequence, or at least the next approver, shown as **Next Action By** in PRF detail and on the dashboard (see item 1).

**To clarify**
- Which Pronto menu shows the approval flow?
- Is the full approval history (who and when) needed, or only the next approver?

---

## 5. Allocated Buyer

**Requirement**
Show the buyer responsible for the PO, taken from Pronto.

**Notes**
- A new PRF field, for example `AllocatedBuyer`. It is synced from Pronto, shown in PRF detail, and can be used as a filter or column on the dashboard.

**To clarify**
- Which Pronto menu and column show the buyer?
- Can the buyer change mid-process, and should that history be kept?

---

## Proposed order

1. **Items 4 and 5**: read-only, adding fields from Pronto. Low risk, and they enrich the dashboard data.
2. **Item 1**: the follow-up dashboard, which can use Next Action By and Allocated Buyer straight away.
3. **Item 3**: once the mechanism is decided.
4. **Item 2**: last, because it needs the ability to write to Pronto and extra guardrails.
