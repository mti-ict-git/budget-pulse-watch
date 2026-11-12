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
