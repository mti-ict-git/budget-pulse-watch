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

## Feasibility check — 2026-11-11

A desk proof of concept, without logging in to Pronto. Sources: the production sync worker's latest artifacts on docker59 (`/app/artifacts/prf_pronto_sync_2026.json` with 33 PO rows, and `prf_items_batch.json`, both from 2026-11-11), the scraper code (`backend/scripts/pronto_access.py`, `prf_pronto_sync.py`), and the Pronto UI steps verified on 2026-10-27 in the `pronto` skill. A live UI check was attempted but the Pronto session kept logging out.

| # | Verdict | Evidence | Gap |
|---|---------|----------|-----|
| 5 Allocated Buyer | **Ready.** Data is already scraped | The Purchase Orders grid row has a `Buyer allocation` column, filled on 11 of 33 rows (3 distinct buyers). It is filled on every Req. Approval Reqd / Req. Approved row and on some On order rows. `Officer` is filled on 33/33 and, per the PO 51727 check below, is the buyer who converted the requisition into the PO. | Not mapped into POMON. Needs a PRF field plus mapping in `prf_pronto_sync.py`: use `Buyer allocation`, falling back to `Officer` when it is empty. Confirm with the product owner that Officer is the responsible buyer. |
| 1 Follow-up dashboard | **Ready.** | `Status` 33/33 (On order, Cancelled, Req. Approved, Req. Approval Reqd, Updated:NNNNN), plus `Required Date`, `Req. Approval Date`, `Priority` (20/33), and `Action` (a date, 33/33). | Define the follow-up criteria. Note that `Action` holds a date, not the next actor. |
| 4 Next Action By | **Feasible, needs a new scraper path** | Not in the Purchase Orders grid. Verified in the UI on 2026-10-27: PO M094 > select PRF > Next Action By gives Name / User / Hierarchy. Full history (verified 2026-11-11): Supply Chain > Purchasing > PRAS > Purchase Orders (`PO 0001`) > Find PO > Approval Status lists every step in time order (Approval User, Date Time, Status, Comment). | New Playwright flow for PO M094. Visibility depends on the account's PRAS group (My Group / All Reqs). |
| 3 Pronto items as source of truth | **Partially ready** | The item sync already reads Requisition Enquiry: item code, description, qty required/issued, units, estimated price, needed by, PO no., status, suggested supplier. Verified in the UI on 2026-10-27: PO E001 Lines also shows the GL per item, UOM and price. | GL and currency are not scraped yet, so PO E001 Lines need to be added. The mechanism is still to be decided by the product owner. |
| 2 Need Action / Ack | **Feasible, highest risk** | The candidate list can come from status `Req. Approval Reqd`. Acknowledge was verified manually on 2026-10-27 (53956, 54512): PO M094 > Approval Status check > Approve menu > Acknowledge for approval > re-read Approval Status. | First write-path to Pronto. Must check Approval Status before acting to avoid a duplicate ack, and must verify the new entry afterwards. Shares the PO M094 scraper with item 4. |

**Operational risk found during the check:** the worker logs in to Pronto with the same account a person uses (the shared IT account). It runs every 12 hours (`interval_seconds=43200`; last login 2026-11-11 12:13 WITA). The worker was not the cause of the logouts observed during this check, but sharing one account between a person and automation invites session conflicts. Request a dedicated service account, and ask the Pronto admin about the concurrent-session and idle-timeout settings.

**Conclusion:** the direction is sound. Items 1 and 5 can be built from data the worker already collects. Items 4 and 2 share one new building block (a PO M094 scraper), with item 2 adding a guarded write action on top.

### Case study: PO 51727 and its split 53851 (live check, 2026-11-11)

Read-only check in Pronto (PO E001 Header/Lines, PO 0001 Approval Status), compared with POMON PRF 51727 (6 items).

- **51727** is On order with one item left: seq 2, the 42U rack (IDR 8.4M, GL `AMITCM16.6250`). Seq 3–7 are missing.
- **53851** is the split. Its status is Req. Approved, the supplier is still the procurement dummy vendor, and the total is IDR 3,405,276,500. It holds seq 3–7 with their original sequence numbers: RPDU socket, PowerEdge R670, ME5224 storage, VMware vSphere ×72, and fiber hub. The opening and closing note lines are copied to both POs.
- **POMON vs Pronto:** the split was detected correctly for 3 items (socket, VMware, hub; `SplitPONumber = 53851`). It was **missed for the PowerEdge R670 and the ME5224**. In POMON these two have no PO number. Root cause (confirmed in Pronto the same day): the item sync reads only INV E071 (Requisition Number enquiry), and INV E071 lists just 4 lines for requisition 51727. The R670 and ME5224 lines are on 53851 with `Req'n No 51727` in the PO E001 line detail (codes `7021-03-330869` and `7025-03-309184`), but never appear in INV E071, so the sync never saw them.
- **Approval history of 51727:** IT requester (new order, acknowledge, price changes) → HR cost centre acknowledge → department head acknowledge → three approvers → procurement convert → PO approval, from 10-SEP to 20-OCT-2026. The convert step is done by the same person shown as `Officer` on the PO header.

Implications:
- Item 3: INV E071 alone is not a complete source of requisition lines. Read the PO E001 Lines of the original and every split PO and keep the lines whose `Req'n No` equals the PRF.
- Item 3: PO E001 Lines carries the item code, qty, unit, price, line total and **GL account** per line, so it is a usable source of truth.
- Item 1/4: a PRF can sit in two Pronto documents with different stages (51727 On order, 53851 still Req. Approved). The follow-up dashboard must track every split PO, not only the original number.

**Follow-up (2026-11-11):** items 3 and 4 are being implemented in roadmap Phase 15 (split-PO lines from PO E001 and Pronto approval history). See `docs/pronto-sync.md`.

## Proposed order

1. **Items 4 and 5**: read-only, adding fields from Pronto. Low risk, and they enrich the dashboard data.
2. **Item 1**: the follow-up dashboard, which can use Next Action By and Allocated Buyer straight away.
3. **Item 3**: once the mechanism is decided.
4. **Item 2**: last, because it needs the ability to write to Pronto and extra guardrails.
