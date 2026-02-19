-- Before: Using empty cost code columns
COALESCE(pi.PurchaseCostCode, p.PurchaseCostCode) as CostCode

-- After: Extracting from JSON specifications
COALESCE(
  JSON_VALUE(pi.Specifications, '$.PurchaseCostCode'),
  JSON_VALUE(pi.Specifications, '$.purchaseCostCode'),
  pi.PurchaseCostCode, 
  p.PurchaseCostCode
) as CostCode

2026-01-30 10:56:46 +08:00
- Added AppSettings table to schema and auto-creation on startup
- Refactored settings to use database storage with encryption
- Added dev:migrateschema script to run consolidated schema updates
- Verified migration execution and TypeScript typecheck

18→2026-01-30 11:08:30 +08:00
19→- Tested dev:migrateschema runner; benign duplicates skipped
20→- Verified AppSettings exists (Cnt=1) and latest row: Provider=openai, Enabled=1, Model=gpt-4o-mini
21→
22→2026-01-30 22:19:03 +0800
23→- Updated dev API URL to http://localhost:3000 for frontend
24→- Synced Vite proxy default API target to port 3000
25→
26→2026-01-30 22:58:22 +0800
27→- Updated Excel parsing to select PRF Detail and Budget Detail sheets
28→- Mapped legacy "PR/PO No" header to required "PRF No" field
29→- Verified PRF validation now recognizes 835 valid records from sample Excel

2026-02-05 15:45:10
- Hardened frontend authService to gracefully handle non-JSON error bodies
- Updated Vite dev proxy to point to backend 3001 and disabled overlay
- Ran dev servers: frontend on 8081, backend health OK on 3001
- Investigated production 502 on /api/auth; proposed Nginx upstream fixes
2026-02-11T13:42:14+08:00
- Implemented PRF item dedup: in-memory Excel row dedup and DB upsert
- Updated import pipeline to prevent duplicate items on reupload
- Verified backend TypeScript typecheck and ESLint on importRoutes.ts
2026-02-11T13:50:50+08:00
- Added backend script to clean existing duplicate PRF items in DB
- Script: backend/src/scripts/dedupePRFItems.ts with dry-run and --fix mode
- Added npm script: npm --prefix backend run dedupe:items
2026-02-11T13:58:40+08:00
- Hardened dedupe to trim whitespace in natural key comparisons
- Updated import upsert and production cleanup script normalization
2026-02-11T13:32:17+08:00
- Updated Nginx proxy to backend:3001 to fix Docker 502
- Validated compose mapping 5004:3001; advised container reload and health checks
2026-02-11T14:52:17.2028625+08:00
- Added Settings > General button to remove duplicate PRF items
- Implemented backend route POST /api/settings/maintenance/dedupe-prf-items (admin-only)
- Integrated Excel sheet selection UI in import dialog and validated ESLint/typecheck
2026-02-11T15:24:37+08:00
- Created OpenAPI spec at docs/openapi.yaml covering core endpoints
- Served API docs via Redoc at /api/docs and static YAML at /api/docs/openapi.yaml
- Ran backend TypeScript no-emit typecheck successfully
2026-02-11 15:45:13 +08:00
- Added OneDrive Graph Excel sync service and backend route
- New endpoint POST /api/cloud-sync/prf/{prfNo} with JWT protection
- Wired Sync to Cloud PRF button in PRF Monitoring page
- Updated OpenAPI spec to document cloud sync endpoint
- Verified typecheck (npx tsc --noEmit) and ESLint
2026-02-11 16:05:40 +08:00
- Implemented MSAL device code fallback for OneDrive Graph auth
- Added @azure/msal-node dependency and token cache support
- Updated backend .env with tenant/client IDs and SharePoint link
- Verified backend build and project typecheck
2026-02-11 16:22:10 +08:00
- Moved per-row Sync button next to PRF No for visibility
- Added top-bar "Sync Selected PRFs" beside Bulk Sync Folders
- Kept Actions column for detail/edit/delete without duplicate sync
- Verified typecheck across project
2026-02-11 17:22:50 +08:00
- Added scan mode to OneDrive sync: searches all sheets with prefix
- New env ONEDRIVE_WORKSHEET_PREFIX to define sheet name prefix
- Backend route accepts mode=scan and optional year query params
- Frontend passes mode=scan and selected year filter in sync requests
- Verified backend build and project typecheck
2026-02-11 19:53:38 +08:00
- Added sharedWithMe fallback: locate file by name without share link
- New env ONEDRIVE_SHARED_FILE_NAME for file discovery
- Device code callback opens verification URL on Windows
- Verified backend build and project typecheck
Wednesday, February 11, 2026 4:02:33 PM
- Enhanced Settings > General with PRF No and Budget Year filters for dedupe
- Added preview step to show duplicate count and sample before deletion
- Wired frontend to backend POST /api/settings/maintenance/dedupe-prf-items with filters
- Ran ESLint and TypeScript no-emit checks successfully

Wednesday, February 11, 2026 9:28:48 PM
- Improved OneDrive workbook resolution for app-only auth via SharePoint site drive search
- Extended OneDrive access test to read a worksheet header row (read-only verification)
- Verified TypeScript no-emit typecheck (npx tsc --noEmit)

Wednesday, February 11, 2026 9:39:47 PM
- Added PRF Monitoring UI "Test OneDrive" button to call GET /api/cloud-sync/test
- Updated OneDrive access test to fallback to delegated device-code when app-only gets 401/403
- Verified TypeScript no-emit typecheck and ESLint

Wednesday, February 11, 2026 9:44:53 PM
- Improved device-code output formatting in backend logs (URL + CODE)

Wednesday, February 11, 2026 9:49:31 PM
- Reduced delegated OneDrive test permission to Files.Read (read-only) to avoid admin consent when possible

Wednesday, February 11, 2026 10:31:21 PM
- Improved OneDrive sync: detect header row and match column aliases (e.g. PR/PO No)
- Improved sync error propagation to frontend toast for faster debugging

Wednesday, February 11, 2026 10:35:12 PM
- Fixed header row detection to recognize PR/PO No and other common header variants

Wednesday, February 11, 2026 10:38:13 PM
- Fixed TypeScript readonly tuple mismatch in PRF header alias mapping

Wednesday, February 11, 2026 10:24:59 PM
- Improved worksheet matching to use contains("PRF Detail") and detect the real header row before syncing
- Hardened Excel range writing for non-A1 usedRange and columns beyond Z
- Verified TypeScript no-emit typecheck and ESLint

Wednesday, February 11, 2026 10:43:48 PM
- Fixed OneDrive sync to fallback from app-only token to delegated Files.ReadWrite on 401/403

Wednesday, February 11, 2026 11:04:44 PM
- Fixed PRF Monitoring sync icons after renaming CloudUpload to CloudDownload

Wednesday, February 11, 2026 11:18:05 PM
- Fixed cloud pull-sync status handling to store raw Excel status text (e.g., "On Order")
- Updated PRF item cascade mapping to be case-insensitive for legacy statuses
- PRF Monitoring now refreshes list after successful pull sync

Wednesday, February 11, 2026 11:26:15 PM
- Restricted OneDrive access test endpoint to admin-only
- Hid "Test OneDrive" button for non-admin users in PRF Monitoring

Thursday, February 12, 2026 12:03:23 AM
- Ignored backend/token_cache.json to prevent committing OneDrive/MSAL tokens

2026-02-12 09:17:56 +08:00
- Fixed /api/docs Redoc blocked by CSP by allowing cdn.redoc.ly
- Made docs static directory resolution robust for openapi.yaml

2026-02-12 09:28:23 +08:00
- Switched API docs UI from Redoc to Swagger UI at /api/docs
- Served spec at /api/docs/openapi.yaml and scoped CSP to allow Swagger inline script
- Updated README API Documentation section

2026-02-12 09:35:56 +08:00
- Fixed Swagger UI "Failed to fetch" by removing CSP upgrade-insecure-requests on /api/docs

2026-02-12 09:48:49 +08:00
- Removed CSP from /api/docs entirely to avoid blocking Swagger UI fetch/connect
- Changed OpenAPI servers to single same-origin base URL to prevent mixed-content/CORS issues

Thursday, February 12, 2026 10:17:19 AM
- Expanded OpenAPI spec coverage to include all mounted backend routes
- Documented reports, PRF documents, PRF files, OCR upload, and sync endpoints

Thursday, February 12, 2026 10:39:31 AM
- Grouped Swagger UI operations using OpenAPI tags per API category
- Verified /api/docs and /api/docs/openapi.yaml return HTTP 200

2026-02-12 10:31:47 +08:00
- Improved PRF additional document uploads to stream to disk instead of memory
- Returned clearer API errors when shared folder path is missing or inaccessible
- Updated frontend batch upload to display backend error message on non-2xx responses

2026-02-12 10:38:43 +08:00
- Allowed PRF file upload routes to use SHARED_FOLDER_PATH from environment as fallback

Thursday, February 12, 2026 10:51:42 AM
- Expanded Swagger UI to auto-expand tag groups by default (docExpansion=list)

Thursday, February 12, 2026 10:55:04 AM
- Persisted MSAL token cache in Docker by storing it under /app/data and mounting a volume
- Ensured token cache directory is created before writing (prevents write failures in new environments)

Thursday, February 12, 2026 11:14:03 AM
- Fixed Docker EACCES on /app/data/token_cache.json by chowning mounted /app/data before switching users

Thursday, February 12, 2026 12:16:15 PM
- Added lightweight PRF search endpoint GET /api/prfs/search
- Documented /api/prfs/search in docs/openapi.yaml
- Drafted mobile PRF monitoring spec for goods checking workflow

Thursday, February 12, 2026 12:20:33 PM
- Updated mobile PRF monitoring spec with confirmed scope (monitoring-first)
- Captured decision to support PRF-level and item-level goods verification
- Tracked PO linkage requirement as an open data-model question

Thursday, February 12, 2026 12:21:52 PM
- Confirmed PO No derives from PRF No using the same base number with different suffix

Thursday, February 19, 2026 11:33:09 AM
- Fixed OCR PRF create-from-document to honor SHARED_FOLDER_PATH env fallback
- Persisted OCR source document metadata in PRFFiles even when shared copy fails

Thursday, February 19, 2026 11:57:43 AM
- Clarified mobile spec PO derivation example (PRF41356 → PO41356)
194→
195→2026-02-12 20:43:14 +0800
196→196→- Added mobile/ directory to .gitignore to keep local mobile client untracked

Thu Feb 12 22:23:57 WITA 2026
- Integrated mobile login with backend JWT auth (/api/auth/login)
- Added session restore via /api/auth/me using stored token

Thu Feb 12 23:27:20 WITA 2026
- Mobile PRF list now loads from backend API with search and pagination
- Mobile PRF details now fetches PRF by id when opened directly
- Stabilized mobile context callbacks and fixed TypeScript Record access
- Added VITE_API_BASE_URL support for mobile backend URL configuration
- Expanded backend CORS allowlist for localhost:3000 and capacitor://localhost
- Verified TypeScript no-emit checks for mobile and backend

Thu Feb 12 22:26:58 WITA 2026
- Updated mobile API base URL to prefer pomonbackend.justanapi.my.id
- Added runtime fallback to VITE_API_BASE_URL when primary returns 404/5xx
- Persisted the successful base URL alongside token for session restore

Thu Feb 12 22:38:24 WITA 2026
- Expanded backend CORS allowlist to include pomon.merdekabattery.com:9007 and localhost dev
- Verified backend TypeScript no-emit check

Thu Feb 12 23:04:30 WITA 2026
- Updated mobile Home dashboard to mirror web dashboard sections (metrics, budgets, recent PRFs, alerts)
- Verified mobile TypeScript no-emit check

Thu Feb 12 22:12:50 WITA 2026
- Installed Capacitor in mobile/budget-pulse-watch with Android and iOS platforms
- Generated capacitor.config.ts and synced web build (dist) to native projects

Thu Feb 12 23:18:24 WITA 2026
- Removed the fake iOS status bar row from the mobile Home screen
- Fixed mobile PRF/Item types and restored updateItem in app context
- Verified mobile TypeScript no-emit check

Thu Feb 12 23:29:10 WITA 2026
- Fixed mobile auth restore race so Dashboard isn't blocked during startup
- Redirected /login to Dashboard when already authenticated
- Verified mobile TypeScript no-emit check

Thu Feb 12 23:40:48 WITA 2026
- Made Home show Dashboard and moved PRF Monitoring to PRFs tab
- Added /prf route for PRF Monitoring list and kept /prf/:id details
- Hardened PRF Details Documents/Activity parsing and error messages
- Fixed mobile TypeScript no-emit check

Thu Feb 12 23:39:10 WITA 2026
- Implemented mobile PRF Details tabs: Documents and Activity
- Documents tab now loads PRF files from backend and provides View/Download links
- Added backend endpoint GET /api/prfs/:id/activity (audit + document uploads timeline)
- Ran npm run lint and npx tsc --noEmit

Fri Feb 13 00:24:04 WITA 2026
- Fixed Docker deployments missing Swagger OpenAPI spec by mounting /docs into backend container

Fri Feb 13 00:08:56 WITA 2026
- Fixed mobile PRF Details Documents tab stuck loading (effect cancellation loop)
- Switched Documents/Activity data loads to AbortController-based requests
- Ran npm run lint and npx tsc --noEmit

Fri Feb 13 00:20:46 WITA 2026
- Fixed mobile Documents tab filtering out valid PRF documents due to strict parsing
- Made documents parsing tolerant to string/nullable fields from /api/prf-documents/documents/{prfId}
- Ran npm run lint and npx tsc --noEmit
