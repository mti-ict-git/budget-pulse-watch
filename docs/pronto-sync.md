## Pronto → POMON Sync (Review)

Dokumen ini menjelaskan apa saja yang disinkronkan dari Pronto ke POMON (Budget Pulse Watch), bagaimana alurnya, dan batasan/guardrail yang berlaku.

Referensi implementasi:
- Runner sync: [prf_pronto_sync.py](file:///Users/widjis/Documents/Projects/budget-pulse-watch/backend/scripts/prf_pronto_sync.py)
- Automasi UI Pronto (Playwright): [pronto_access.py](file:///Users/widjis/Documents/Projects/budget-pulse-watch/backend/scripts/pronto_access.py)
- Worker scheduler (Docker): [pronto_sync_worker.py](file:///Users/widjis/Documents/Projects/budget-pulse-watch/backend/pronto-sync/pronto_sync_worker.py)
- Guardrail backend status PRF: [prfRoutes.ts](file:///Users/widjis/Documents/Projects/budget-pulse-watch/backend/src/routes/prfRoutes.ts)

### Tujuan
- Menyamakan data PRF di POMON dengan kondisi terbaru di Pronto, tanpa mengganggu layanan utama (backend).
- Mengisi/memperbarui field PRF header (vendor, currency, status, tanggal, amount) dan PRF items (Original PO / Split PO / Quantity) berdasarkan data di Pronto.

---

## Mode Sinkronisasi

### 1) Sync PRF Header Fields (Purchase Orders grid)
Mode ini membaca data “Purchase Orders” (grid) di Pronto berdasarkan `Order Number` (dipetakan dari PRFNo yang numerik), lalu mengupdate PRF header di POMON.

Endpoint POMON yang dipakai:
- GET daftar PRF: `GET /api/prfs/with-items?page=...&limit=...`
- GET detail PRF: `GET /api/prfs/{id}`
- PUT update PRF: `PUT /api/prfs/prfno/{prfNo}`

Sumber data Pronto:
- Orders grid (row per PO/PRF).

Field yang bisa disinkronkan (toggle via flags/env):
- Status → `Status`
- Approver → `ApprovedByName`
- Supplier Name / Supplier → `VendorName`
- Supplier Trading Name and Address / Supplier → `VendorContact`
- Currency (IDR/USD) → `CurrencyCode`
- Ordered (tanggal) → `DateSubmit`
- Due (tanggal) → `RequiredDate`
- Req. Approval Date (tanggal) → `ApprovalDate`
- Received (tanggal) → `CompletionDate`
- Amount:
  - `Received Total` / `Order Total` → `ActualAmount` (sumber bisa dipilih)

Catatan:
- Script melakukan diff sebelum update. Pada dry-run, hanya menulis report perubahan tanpa melakukan PUT update.

### 2) Sync PRF Items (Requisition and P/O Enquiry)
Mode ini membaca detail item dari menu “Requisition and P/O Enquiry” di Pronto (per PO), lalu memetakan ke item PRF di POMON berdasarkan `part code` (Item code).

Endpoint POMON yang dipakai:
- GET detail PRF: `GET /api/prfs/{id}` (dipakai untuk check status terminal sebelum proses item)
- GET items PRF: `GET /api/prfs/{id}/items`
- PUT update item: `PUT /api/prfs/items/{itemId}`

Sumber data Pronto:
- Grid “Requisition and P/O Enquiry” (rows) + detail dialog.

Field PRF item yang disinkronkan:
- `OriginalPONumber`
- `SplitPONumber`
- `Quantity` (hanya jika integer)
- `ItemName` (opsional, jika diaktifkan lewat flag `--sync-item-description`)
- `ItemCode` (jika kolom tersedia; dipakai untuk matching yang stabil)

### Replace Mode (Single Source of Truth)
Mode ini tersedia untuk testing/repair data ketika item di POMON sudah “berantakan”.

Flag:
- `--replace-item` / `--no-replace-item`

Perilaku:
- Setelah data Pronto untuk 1 PO selesai di-scan, script akan:
  - (apply) menghapus semua PRF items POMON untuk PRF tersebut
  - (apply) membuat ulang item dari hasil Pronto
  - (dry-run) hanya menulis rencana replace

Catatan:
- Mode ini butuh `UnitPrice` untuk setiap item yang akan dibuat. Script akan mencoba mengambil `UnitPrice` dari item lama (berdasarkan `ItemCode`), lalu fallback ke `Estimated price` dari Pronto.
- Jika `PurchaseCostCode` PRF/items kosong, gunakan override `--default-purchase-cost-code MTIRMR...` agar item bisa dibuat.

Logika Split PO (ringkas):
- `OriginalPONumber` diambil dari `requisition_no` (hasil detail)
- `SplitPONumber` diisi jika `Order Number` (di row grid) berbeda dengan `requisition_no`
- Jika sama, `SplitPONumber` dikosongkan (anggap tidak split)

---

## Guardrail & Proteksi

### Skip PRF Completed (hemat waktu)
Untuk menghindari buang waktu membuka Pronto dan mengupdate sesuatu yang sudah final:
- Jika status PRF di POMON sudah `Completed`, sync akan menghasilkan status `skipped_completed` dan tidak melakukan sinkronisasi PRF tersebut.
- Berlaku untuk sync header dan sync items.

### Guardrail status di backend (safety net)
Backend menerapkan proteksi untuk request dari Pronto sync (terdeteksi via header `x-sync-source: pronto` atau API key):
- Jika status existing sudah `Completed`, perubahan status dari sync diblok.
- Jika status baru “mundur” dibanding status saat ini (berdasarkan ranking), perubahan status diblok.

Ranking status sementara:
- Draft (0)
- Req. Approval Reqd (10)
- Req. Approved (20)
- Updated* (30) — semua status yang diawali/berisi “Updated”
- On Order (40)
- Completed (50)

Catatan:
- Proteksi ini fokus pada `Status`. Field lain masih bisa ikut tersimpan bila ada perubahan.

---

## Cara Menjalankan

### A) Manual (Script)
- Header sync (contoh dry-run):
  - `python3 backend/scripts/prf_pronto_sync.py --budget-year 2026 --dry-run`
- Items sync (contoh dry-run):
  - `python3 backend/scripts/prf_pronto_sync.py --sync-prf-items --budget-year 2026 --dry-run`
- Jika ingin reuse browser session yang lebih kuat via persistent profile:
  - `python3 backend/scripts/prf_pronto_sync.py --budget-year 2026 --dry-run --no-pronto-headless --pronto-profile-dir artifacts/pronto-profile`

### B) Worker (Docker, recommended)
Worker akan:
- membaca konfigurasi non-secret dari DB melalui `GET /api/settings/pronto-sync`
- menjalankan step header dan/atau items sesuai setting
- mendukung tombol “Run Sync Now” via request run-now dan completion report

---

## Konfigurasi

### Credential (env/secrets)
Simpan di environment (bukan di DB):
- `TARGET_URL`
- `PRONTO_USERNAME`
- `PRONTO_PASSWORD`
- `POMON_API_KEY`
- `POMON_BASE_URL` (penting: di Docker gunakan `http://backend:3001`)
- Optional untuk session reuse:
  - `PRONTO_STORAGE_STATE_PATH`
  - `PRONTO_PROFILE_DIR`

### Non-secret (configurable via Settings UI / DB)
- Enable/disable sync, interval, budget year
- Apply vs dry-run
- Max PRFs, limit, log frequency
- Headless/screenshot/per-PO JSON
- Time zone display (untuk UI)

---

## Artifacts / Output

Output report ditulis ke `ARTIFACTS_DIR`:
- Header sync: `prf_pronto_sync_<YEAR>.json`
- Items sync:
  - `prf_item_sync_dryrun_<YEAR>.json` (batch)
  - `prf_item_sync_dryrun_<PRFNO>.json` (single)
- Pronto items batch (jika mode gather): `prf_items_batch.json` dan opsional per-PO JSON.

---

## Limitasi & Risiko
- Mapping item Pronto ↔ POMON bergantung pada `part code` dan fallback match berdasarkan `Description`. Jika deskripsi duplikat atau berubah, ada risiko mapping salah.
- Data Pronto bisa terlambat update atau snapshot tidak konsisten; guardrail status mencegah regression, tetapi field non-status masih bisa berubah bila datanya berubah di source.
- Sync items melakukan update per item; performa dipengaruhi jumlah PRF kandidat dan jumlah item per PRF.


### OCR rescan validation correction — 2026-10-23
- Rescan must identify the selected PRF number and at least one existing item when items already exist. Entirely different item sets are blocked rather than proposed as additions.
- Quantities must be positive integers; prices/totals must be finite nonnegative numbers. Each line must reconcile within one currency unit. Printed total must match all rows or active rows (for visible cancellations). Missing values are not silently guessed. Ambiguous existing item-code matches block rescan.
- Cancellation requires both an explicit visual mark and evidence reason. Confidence is not a substitute for validation.
- Preview and apply both enforce these checks (HTTP 422). Signed previews bind source SHA-256 and the existing item snapshot; changed sources/items require refresh (409), including old tokens without provenance.
- Stored source bytes must match recorded file size and PDF signature. PDF page extraction rejects mixed PRF identifiers; exceeding render limits falls back to whole-document OCR instead of silently omitting pages. Prompts explicitly forbid invented item codes/products and non-item notes.
- No existing FIFO item is removed by this correction. Its original creation path remains unproven. Validation cannot guarantee every AI transcription is accurate; source review remains necessary.

---

## PO E001 lines and approval history (added 2026-11-11)

*This section is in English per the AGENTS.md documentation rule.*

### Why

INV E071 (Requisition Number enquiry) does not list every requisition line. For requisition 51727 it returned 4 lines, but the split PO 53851 also holds the PowerEdge R670 and the ME5224 storage, both with `Req'n No 51727` in the PO line detail. The item sync only knew INV E071, so those two items stayed unmatched in POMON.

### What the worker now does

After the INV E071 pass, `pronto_access.py` builds the set of related POs for each PRF: the PRF number itself plus every `Order Number` / `Purchase Order No.` seen in INV E071. For each PO it opens **PO E001** (Purchase Order Number enquiry, read-only) and:

1. Selects the **Standard** tab (the default tab can filter on the originator), uses **Find**, and requires the selected row to equal the PO exactly (Find positions on the nearest number otherwise).
2. Opens **Lines**, raises the visible row count, and reads every line: Seq, Item Code, Ordered, Unit, Item Price, Line Total, **GL Account**, descriptions. For each item line it reads the Line Detail panel to get **Req'n No** and the full item description.
3. Opens **Approval Status** and reads Approval User, Date Time, Status and Comment.

The results are stored as `po_details` in `prf_items_batch.json`.

`prf_pronto_sync.py` then:

- Adds items that appear only in PO E001 lines whose `Req'n No` equals the PRF (`source: po_lines`, issue `item_from_po_lines`), with `OriginalPONumber` = PRF and `SplitPONumber` = the split PO.
- Fills gaps on items already found in INV E071 (split PO, unit price, quantity, GL account) without overwriting INV E071 values.
- Sends each PO's approval history to `PUT /api/prfs/{id}/pronto-approvals` (skipped on dry runs).

Lines without a captured `Req'n No` are only trusted on the PO that carries the PRF's own number.

### Switches

| Env / flag | Default | Effect |
|---|---|---|
| `PRONTO_PO_DETAILS` | `1` | Read PO E001 lines and approvals after INV E071. `0` restores the previous behaviour. |
| `PRONTO_PO_APPROVALS` | `1` | Also read Approval Status in PO E001. |
| `SYNC_PRONTO_APPROVALS` / `--sync-pronto-approvals` | on | Store approval history in POMON. |

### Safety

Only Find, Lines, Approval Status, row selection and the card close button are used. Toolbar actions that change data (for example **Buyer** = "Enter Buyer Modified") are never clicked. PO 0001 (PRAS Purchase Orders) is not used because its toolbar holds Cancel, Split Order, Synch-PO and Reject PO.

### Selectors (verified 2026-11-11 at 1280x800)

`#module-function-input` (function code box), `.hamburger-menu`, `.card-header-toolbar-module-function` (active function code), `button.page-close`, `tr.dg-row.selected`, `.row-count-input`, and `label.card-field[name="x:<col>,y:<row>"]` for detail panels.

## Failure handling (Phase 27)

- Each step (`header`, `items`) is stopped after `PRONTO_SYNC_STEP_TIMEOUT_SECONDS` (default 5400). The step and its browser are killed and the run is reported with exit code 124.
- A failed scheduled cycle is retried after `PRONTO_SYNC_RETRY_MINUTES` (default 30), at most `PRONTO_SYNC_MAX_RETRIES` (default 3) times in a row.
- The items step never reuses an old `prf_items_batch.json`: it is deleted before the gather, and a gather that writes no batch (for example after a failed login) fails the step without applying anything.
- Every run, scheduled or run-now, is shown in Settings → Pronto sync with its result and error message. A login failure usually means the Pronto password expired: update `PRONTO_PASSWORD` in `backend/.env.production` and recreate the `pronto_sync` container.

## Immediate Action queue (Phase 29, added 2026-11-26)

### What it is

Every hour the worker reads Pronto **Supply Chain > Requisitions > Approve/Review Requisitions** (PO M094) in its default mode, "Immediate Action Req'd": the requisitions that need action from the logged-in account's hierarchy (MTI IT, `itmt`). POMON shows them on the **Immediate Action** page, limited to its own PRFs and their split POs.

### How it runs

- Script: `backend/scripts/pronto_action_queue.py` (parsers in `pronto_queue_parse.py`). It logs in, opens PO M094, waits for "Scanning Requisitions" to finish, reads the list, and for each row reads **Next Action By** (all pages) and **Approval Status**. It posts one snapshot to `POST /api/pronto-queue/snapshot`. `--dry-run` prints the snapshot instead.
- Worker step `queue`: runs while Pronto sync is enabled in Settings, at the start of each sync cycle (before the long header and items steps) and between cycles. Settings (env of the pronto_sync container): `PRONTO_QUEUE_ENABLED` (default true), `PRONTO_QUEUE_INTERVAL_MINUTES` (default 60), `PRONTO_QUEUE_RETRY_MINUTES` (default 10; a failed read is tried again after this), `PRONTO_QUEUE_TIMEOUT_SECONDS` (default 900). The worker runs one Pronto task at a time, so a read that falls due during a sync cycle (15 to 40 minutes) waits for it.
- Login waits up to 90 seconds for the Pronto menu and tries once more after a pause; the error names what the screen showed. On 2026-11-26 21:13 the first read after a sync cycle missed the 30-second wait of the first version, while a login a few minutes later took about 15 seconds.
- A failed read is recorded with its error and the last good list stays visible; the page shows the error and when the list was last read successfully.

### Read-only rules for PO M094

PO M094 has data-changing actions (Approve, Correct, Cancel, Buyer). The script:

- never clicks a list row, because clicking a cell opens supplier editing; it moves the row cursor with the navigation buttons `#pro-nav-first` and `#pro-nav-down` (Pronto disables First on the first row and Down on the last);
- clicks only the toolbar labels Next Action By and Approval Status (exact match), the navigation buttons `#pro-nav-first`, `#pro-nav-down` and `#pro-nav-page-down` (to page through long Next Action By lists), and the card close button;
- checks each card against the expected order number (the Requisition field on Next Action By, the "Purchase Requisition - <no>" title on Approval Status). The cursor can lag a click; on a mismatch the row is selected again slowly and read once more, and a second mismatch is recorded as an error for that row;
- uses a 2400 px wide browser window so the whole toolbar, including Approval Status, is visible without scrolling;
- signs out at the end (the `/logout?exit=1` URL), so hourly reads do not leave Pronto sessions open. The PRAS user shown on the screen (`itmt`) is stored with the snapshot.

### Classification (in POMON)

- **Rejected**: the latest dated Approval Status entry is a rejection (for example "Rejected" or "Rejected PO"). Checked first, because a rejected requisition can still list MTI IT in Next Action By while the real follow-up is a revision, documents or a new PR.
- **Needs IT review and approve / acknowledge**: Next Action By lists the account that read the queue (`itmt`).
- **Waiting for others**: anything else.

### Matching to POMON

A queue row belongs to POMON when its order number is a PRF number, or a split PO number recorded on a PRF item (`PRFItems.SplitPONumber`). The rest of the queue is listed separately on the page, so a split PO that POMON has not recorded yet can be found and added to its PRF.

## Acknowledge from POMON (Phase 30, added 2026-11-26)

The product owner asked for an Acknowledge button on requisitions that need IT action. Decisions (2026-11-26): only "Acknowledge for approval" (no approve, convert or reject); admin and doccon may ask; company policy allows the worker to do it as itmt when a POMON user asks.

### Flow

1. On the Immediate Action page, an admin or doccon presses **Acknowledge** on a row in "Needs IT review" and confirms. `POST /api/pronto-queue/{orderNo}/acknowledge` stores a pending request (refused if the stored queue does not show the row as needing IT, or a request is already open).
2. The worker checks for requests every poll (15 seconds) between sync cycles and at the start of a cycle, claims one (`POST /api/pronto-queue/actions/claim`) and runs `pronto_action_queue.py --acknowledge <order> --request-id <id>`. While a sync cycle runs, requests wait for it.
3. The script logs in, opens PO M094, finds the row, and reads Next Action By and Approval Status again. It stops with `skipped` unless Next Action By lists the logged-in account, the latest action is not a rejection, and that account has not acknowledged in the current stage (after the latest "New Order" or "Re-Approved").
4. It proves the cursor is on the row (Next Action By card check), opens the toolbar **Approve** menu (the `li.nav_item.pop-host` button, never a menu item named "Approve"), and clicks exactly **Acknowledge for approval**. If that item is not offered, it closes the menu and reports `failed` with the items it saw. A question dialog after the click is cancelled and reported; an OK-only message is read and closed.
5. It reads PO E001 > Approval Status and reports `done` only when a new Acknowledge entry by the account is there; otherwise `unverified`. It then reads the whole queue again and posts the snapshot, so the page shows the result.

### What was seen on 2026-11-26

The Approve menu on 42300 (rejected) offered: Approve, Approve for convert, Reject for approval, Remove from approval, Single convert, Bulk convert, Approve and Convert, Hold Requisition, Release from Hold; no "Acknowledge for approval". The skill notes saw that item on 53956 and 54512 in October, at the acknowledge stage. The menu therefore depends on the stage, and the script only acts when the exact item is offered. Escape closes the menu with nothing selected.

`--check-only` runs steps 3 and the guards and clicks nothing. On 2026-11-26 it skipped 53956 ("Next Action By does not list itmt") and 99999 ("not in the Immediate Action queue").

