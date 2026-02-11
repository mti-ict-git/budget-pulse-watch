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
