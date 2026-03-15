# Upgrade Plan: FY2026 Budget Cut-Off + Picking Item PIC

## Objective
- Implement management request in 2 streams:
  - Modification Budget Cut Off for FY2026, including OPEX amount handling.
  - Add Picking Item PIC information, controlled by Document Controller (DocCon).

## Scope Summary
- In scope:
  - Budget cut-off policy for selected fiscal year (starting FY2026).
  - Budget write-protection once cut-off is closed.
  - OPEX FY2026 data import/update workflow.
  - Picking PIC selection workflow for PRF Items with `Picked Up` status.
  - Role-based control (DocCon/Admin).
  - API + Web UI + SQL migration + documentation updates.
- Out of scope:
  - Major redesign of PRF lifecycle.
  - Historical data rewrite beyond required backfill.
  - Mobile app parity unless explicitly requested.

## Delivery Phases

### Phase 0 — Functional Specification Lock
#### Tasks
- Finalize business rules for budget cut-off:
  - Who can close/reopen.
  - Effective behavior after close.
  - Allowed exceptions.
- Finalize Picking PIC rules:
  - Candidate source (local users, LDAP, or static list).
  - Mandatory fields when status is `Picked Up`.
  - Edit permissions and audit visibility.
- Define FY2026 OPEX source format and mapping rules.
- Define acceptance criteria and UAT checklist.

#### Deliverables
- Signed functional rules matrix.
- Final API contract notes.
- UAT scenarios list.

---

### Phase 1 — Database Foundation
#### Tasks
- Add new SQL objects for cut-off policy:
  - `BudgetCutoff` table (fiscal year, status, closed/reopened metadata).
  - Optional audit table if needed.
- Add Picking PIC structural improvement:
  - Keep `PickedUpBy` compatibility.
  - Optionally add normalized `PickedUpByUserID` for traceability.
- Add indexes/constraints for performance and integrity.
- Update:
  - `backend/database/schema.sql`
  - new migration SQL scripts under `backend/database/migrations/`

#### Deliverables
- Reproducible schema definition.
- Forward migration scripts.
- Rollback scripts where applicable.

---

### Phase 2 — Backend API and Business Rules
#### Tasks
- Budget cut-off endpoints:
  - `GET /api/budgets/cutoff/:fiscalYear`
  - `POST /api/budgets/cutoff/:fiscalYear/close`
  - `POST /api/budgets/cutoff/:fiscalYear/reopen` (optional by policy)
- Enforce cut-off in budget write operations:
  - block create/update/delete for closed FY.
  - return conflict response with clear message.
- OPEX FY2026 ingestion:
  - create/extend import endpoint for OPEX batch input.
  - validate fiscal year, COA/cost code, department, expense type.
- Picking PIC enforcement:
  - for PRF item update, if status = `Picked Up`, PIC is required.
  - only DocCon/Admin can modify PIC-related fields.
  - preserve existing `UpdatedBy/UpdatedAt` tracking.
- Update OpenAPI spec.

#### Deliverables
- New and updated API endpoints.
- Server-side validation and permission guards.
- Updated API documentation (`docs/openapi.yaml`).

---

### Phase 3 — Web UI/UX (Shadcn + Tailwind)
#### Tasks
- Budget page:
  - Add FY cut-off status indicator.
  - Add close/reopen actions for authorized roles.
  - Show write-locked state clearly when closed.
- OPEX workflow UI:
  - Add OPEX FY2026 import/maintenance entry point.
  - Display import validation result and summary.
- PRF Item modification modal:
  - Replace free-text PIC with controlled selector for DocCon flow.
  - Require PIC when selecting `Picked Up`.
  - Keep read-only visibility for non-authorized users.
- Responsive behavior:
  - Use `grid grid-cols-12 gap-4` with mobile-first layout.

#### Deliverables
- Updated Budget and PRF item management UI.
- Form validation and role-based rendering.
- Responsive behavior verified on desktop/mobile breakpoints.

---

### Phase 4 — Data Backfill and Integrity
#### Tasks
- Detect existing PRF items with `Picked Up` and missing PIC.
- Prepare backfill strategy:
  - infer from audit/user metadata when possible.
  - fallback policy for unknown PIC values.
- Validate FY2026 OPEX imported rows against existing COA mapping.
- Produce reconciliation summary (inserted/updated/rejected rows).

#### Deliverables
- Backfill script and runbook.
- Data quality report for FY2026 OPEX and PIC completeness.

---

### Phase 5 — QA, Hardening, and Release
#### Tasks
- Unit/integration checks for:
  - cut-off enforcement.
  - role permissions.
  - PIC mandatory logic.
- Run mandatory checks:
  - `npm run lint`
  - `npx tsc --noEmit`
- UAT with business stakeholders.
- Prepare deployment checklist and rollback plan.
- Update `README.md` with new feature behavior and admin flow.

#### Deliverables
- Verified build quality.
- UAT sign-off.
- Production-ready deployment notes.

## Role and Permission Model (Proposed)
- Admin:
  - Full control including close/reopen cut-off and override operations.
- DocCon:
  - Can set Picking PIC and update pickup statuses.
  - Can manage operational budget input if approved by policy.
- User:
  - Read-only visibility for cut-off status and PIC info.

## Validation Rules (Proposed)
- Budget Cut-Off:
  - If FY is closed, reject all budget write operations with explicit reason.
- Picking PIC:
  - `Status = Picked Up` requires:
    - `PickedUpBy` (or `PickedUpByUserID`)
    - `PickedUpDate`
  - If status changes away from `Picked Up`, retain history but allow nullable behavior per policy.

## Risks and Mitigation
- Risk: FY closed too early.
  - Mitigation: controlled reopen flow with audit trail.
- Risk: Legacy picked-up items missing PIC.
  - Mitigation: backfill script + temporary exception report.
- Risk: OPEX data quality mismatch.
  - Mitigation: strict pre-import validation and rejection report.

## Acceptance Criteria
- FY2026 can be marked closed and reflected in UI.
- Closed FY blocks budget create/update/delete via API and UI.
- OPEX FY2026 import works with validation and summary.
- Picking PIC is selectable by DocCon and mandatory for `Picked Up`.
- Non-authorized users cannot edit PIC fields.
- Lint and typecheck pass successfully.

## Execution Order Recommendation
1. Phase 0 (lock rules)
2. Phase 1 (schema + migrations)
3. Phase 2 (backend enforcement + APIs)
4. Phase 3 (UI rollout)
5. Phase 4 (backfill)
6. Phase 5 (QA and release)

## Pending Business Clarifications
- Exact owner roles for cut-off close/reopen.
- Whether DocCon can reopen or Admin-only.
- Source of Picking PIC options (LDAP/local list).
- OPEX upload file format and mandatory columns.
- Reopen policy and required approval notes.
