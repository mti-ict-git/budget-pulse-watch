# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/2161adca-98cc-4f2f-ac94-84a8dd852b12

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2161adca-98cc-4f2f-ac94-84a8dd852b12) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Database migration

- Run latest pending SQL migration:
  - `npm run db:migrate`
- Run all pending SQL migrations:
  - `DB_MIGRATE_MODE=all npm run db:migrate`

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Mobile app

- PRF Details now includes Items, Documents, and Activity tabs.
- Documents loads backend PRF files and supports View/Download.
- Activity shows a backend-driven PRF timeline.

## API Documentation

The backend exposes OpenAPI documentation served via Swagger UI.

- View docs in browser: http://localhost:3001/api/docs
- Raw OpenAPI spec (YAML): http://localhost:3001/api/docs/openapi.yaml

Protected endpoints require a Bearer JWT in the Authorization header.

## Data Maintenance: Remove Duplicate PRF Items

- UI: Settings > General > Data Maintenance provides filters and actions
- Filters: Optional PRF No and Budget Year to target specific scope
- Preview: Shows duplicate count and a sample before deletion
- Action: Delete duplicates based on normalized key (name, description, unit price, budget year, cost code)
- Backend endpoint: POST /api/settings/maintenance/dedupe-prf-items (admin only)
- Request body: { fix: boolean, prfNo?: string, budgetYear?: number }
- Response preview: { success, fix: false, totalDuplicates, sampleCount }
- Response deletion: { success, fix: true, deleted }

## Shared Folder Path: Mount Check

- UI: Settings > General > Shared Folder Path > Test
- Effective shared folder path uses `SHARED_FOLDER_PATH` from environment when set (recommended for production); the saved GUI setting is a fallback
- Test shows resolved path and, in Docker/Linux, whether `/app/shared-documents` is mounted as CIFS
- General tab also shows df-like filesystem usage for `/app/shared-documents` (share) and `/` (root/overlay)

## Cloud Sync to OneDrive Excel

- Adds a Sync to Cloud PRF button on the PRF Monitoring page to update the shared Excel.
- Backend endpoint: POST /api/cloud-sync/prf/{prfNo}
- Configure environment variables in backend/.env:
  - AZURE_TENANT_ID
  - AZURE_CLIENT_ID
  - AZURE_CLIENT_SECRET
  - ONEDRIVE_SHARED_EXCEL_LINK
  - ONEDRIVE_WORKSHEET_NAME (default: "PRF Detail")

This uses Microsoft Graph to update or append a row by matching PRF No.

## Budget Cut-Off and OPEX Import

- New cutoff APIs:
  - GET `/api/budgets/cutoff/{fiscalYear}`
  - POST `/api/budgets/cutoff/{fiscalYear}/close`
  - POST `/api/budgets/cutoff/{fiscalYear}/reopen` (admin only)
- When fiscal year cutoff is closed, budget write operations are blocked for:
  - POST `/api/budgets`
  - PUT `/api/budgets/{id}`
  - DELETE `/api/budgets/{id}`
- New OPEX bulk ingestion API:
  - POST `/api/budgets/opex/import`
  - Validates fiscal year, COA mapping, and OPEX expense type.
- Currency support:
  - Budget and PRF now support `IDR` and `USD` with `ExchangeRateToIDR`.
  - Budget calculations in cost-code views normalize to IDR automatically.
  - Budget report aggregations (`/api/reports/dashboard`, `/api/reports/utilization`, `/api/reports/budget-summary`, `/api/reports/budget-utilization`, export) normalize allocated budget to IDR before utilization math.
  - OPEX import accepts optional `currencyCode` and `exchangeRateToIDR` per row.
  - Added endpoint `GET /api/budgets/exchange-rate/usd-idr/today` for today's USD→IDR rate.
  - For USD budget create/update/import, backend auto-fills today's rate when rate is missing.
  - Environment override: set `FX_USD_TO_IDR` to force a fixed rate.

## Picking PIC Enforcement

- PRF item updates enforce pickup rules:
  - if item status is `Picked Up`, Picking PIC is required (`PickedUpBy` or `PickedUpByUserID`)
  - `PickedUpDate` is required for `Picked Up`
  - `PickedUpByUserID` must refer to an active DocCon or Admin user
- PRF item modal uses free-text input for `Picking PIC`
- Quick action `Mark as Picked Up` prompts for picker name before status update
- Non-DocCon/Admin users see PIC fields as read-only in item modification modal

## Phase 3 UI Notes

- Budget Overview now includes:
  - fiscal year cut-off status card and close/reopen actions
  - OPEX FY import payload area and import summary panel
  - locked-state behavior that disables budget write actions when FY is closed
  - synchronized fiscal-year source for table, summary cards, and utilization chart to avoid cross-year mismatch
  - aligned "Spent" semantics between OPEX utilization chart and budget details table to use approved/completed PRF spending
  - de-duplicated report spend aggregation to avoid multiplying PRF spent when multiple budget rows exist for one COA
  - report spend now resolves PRFs missing `COAID` via `PurchaseCostCode` mapping to COA
  - report spend mapping now prioritizes normalized `PurchaseCostCode -> COACode` match before PRF `COAID` to avoid stale COA links
  - improved edit budget defaults to preserve currency and active/inactive status from latest COA-year budget row
- PRF Monitoring year filter now auto-adapts:
  - default selection uses current year
  - year options are generated from available submit-date years and include current year
  - new endpoint: `GET /api/prfs/filters/years`
- Dashboard cards now use live backend data:
  - metric cards use `GET /api/reports/dashboard`
  - budget utilization card uses `GET /api/reports/budget-summary` (category breakdown), with `expenseBreakdown` fallback
  - recent PRFs card uses `GET /api/prfs?page=1&limit=5`
  - budget alerts card uses `GET /api/reports/alerts` (high utilization, over-budget PRFs, pending approvals)
- Responsive layout uses `grid grid-cols-12 gap-4` with mobile-first col-span rules

## Phase 4 Data Backfill and Integrity

- Added backend scripts:
  - `npm --prefix backend run phase4:pic:dry`
  - `npm --prefix backend run phase4:pic:apply`
  - `npm --prefix backend run phase4:opex:reconcile`
- Added runbook:
  - `docs/phase4-runbook.md`
- Added report outputs:
  - `docs/reports/phase4-pic-backfill-*.json|csv`
  - `docs/reports/phase4-opex-reconciliation-*.json|csv`
  - `docs/reports/phase4-data-quality-report-2026-03-15.md`
- Backfill strategy resolves missing PIC using:
  - `UpdatedBy` metadata when eligible
  - Excel `PIC pickup` mapped to active DocCon/Admin user
  - optional fallback unknown policy
- OPEX reconciliation validates FY2026 Budget Detail rows against COA existence, active status, and OPEX expense type, then classifies row decision as inserted/updated/rejected.

## Phase 5 QA, Hardening, and Release

- Added readiness validation script:
  - `npm --prefix backend run phase5:readiness`
- Readiness report output:
  - `docs/reports/phase5-readiness-*.json`
- Added UAT checklist:
  - `docs/phase5-uat-checklist.md`
- Added deployment and rollback guide:
  - `docs/phase5-deployment-rollback.md`
- Admin release flow:
  - run readiness report
  - confirm UAT checklist completion
  - execute deployment checklist
  - use rollback plan if release trigger fails

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2161adca-98cc-4f2f-ac94-84a8dd852b12) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
