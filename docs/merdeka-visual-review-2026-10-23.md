# Merdeka visual review — 2026-10-23

## Scope and evidence

Read-only visual audit of nine routes using the ChatGPT in-app browser on the
local real-backend application (8098). Desktop 1440x900 and phone 390x844; phone
client width can be 380px when the document scrollbar reserves 10px. Compared
with the skill's DESIGN.md, dashboard README, Employee Master README and rendered
Employee Master source, plus captured login/form/modal patterns. Production was
not changed. No save, submit, upload, import, OCR, sync or business mutation ran.

Evidence directory on this workstation:
C:/Users/widji.santoso/.codex/visualizations/2026/10/22/01a16140-113e-7220-8e8e-4919b6709482/qa

visual-audit-20261023.json records measured route headings, controls and source
anchors. audit-*-desktop/mobile.png and dialog screenshots record inspected views.
These files contain local operational UI and are not added to Git. Screenshots
record individual states, not pixel identity or full workflow acceptance.

## Outcome by page

| Surface | Visual assessment | Remaining gap |
| --- | --- | --- |
| Login | Close to separate source login theme | MBM/MTI pair and credentials-only form are deliberate user/product adaptations; not identical SSO source |
| Shared shell/sidebar | Inter, colors and 240/80 shell align; watermark .06 and full-width bottom anchor | Source menu anchor 36px/4px radius vs application 40px/6px; dual header logos intentionally smaller than skill's single MBM 164x45 |
| Dashboard | Close: source palette, metric-card geometry and gray panel headers | Keep long currency values under review; content/chart composition is application-specific |
| PRF list/detail/items | Close, with approved compact toolbar and selected-item workspace | Detail vs edit dialogs do not yet share one complete visual family; item table deliberately denser |
| Create PRF (OCR/manual) | Not migrated to current Merdeka body styling | 30px/700 heading, 24px card titles, large padding, old tabs; narrow phone heading beside Back becomes cramped |
| Budget Overview | Close on primary cards/filter/table and create dialog | Long total amount breaks the final digit onto another line at 1440px; operational import/cutoff areas need density review |
| COA Management | Close on palette/cards/table/form | Governance/summary/filter sections push the first table row near the bottom of a 900px viewport; modal footer conventions vary |
| Reports/Audit Log | Close on panel and table | Reports parent and Audit Log child both receive solid blue selection, unlike source submenu emphasis; JSON changes remain visually dense |
| Alerts | Incomplete | Route is only Alerts coming soon; no composed Merdeka page/header/empty-state surface |
| Settings (all four tabs) | Not migrated to Merdeka page styling | 30px heading/24px card titles/40px controls vs migrated 22/14/34; mobile tablist is 510px wide and runs outside the visible content area |

## Prioritized findings

1. High — Settings mobile navigation: 510px tablist with overflow visible at 390px;
   User Management falls outside the initially visible area. Own tab overflow/reflow
   rather than relying on horizontal scrolling of the whole main content.
2. High — Create PRF phone heading: Back button and title share a horizontal row,
   reducing title/description to a narrow column. Stack heading/navigation on phones.
3. Medium — Budget metric value: long IDR total visibly wraps only its final digit.
   Adjust responsive value size/card minimums without truncating the amount.
4. Medium — Finish visual rollout for Create PRF and Settings, matching existing
   source-derived form/table density and header hierarchy. Preserve handlers/API.
5. Medium — PRF edit and item modification dialogs retain older spacious nested
   cards/gray fields; unify header/body/footer, typography, spacing and action rows.
   The item modification dialog also retains its old USD-style display while the
   item panel uses IDR. Treat that as a separate formatting/contract decision,
   not an automatic currency conversion during a visual fix.
6. Medium — Long dialogs such as Create Budget scroll the entire dialog; the action
   footer is not always visible initially. Bounds and scrolling work, but a stable
   body scroller/footer would better match the requested modal family.
7. Medium — COA vertical density: metrics/governance/filters occupy most of the
   first screen. Compact or disclose secondary sections while retaining fields.
8. Low — Refine Reports nested active state and normalize remaining shared spacing.

## Measured anchors and deliberate differences

- Application migrated page headings: 22px/600; Create PRF/Settings: 30px/700.
- Migrated card headers: 14px; old Create PRF/Settings titles: 24px.
- Migrated text/search controls: 34px; Settings controls: 40px.
- Rendered reference Employee Master: Inter 13px/400 navigation, 36px menu rows,
  4px menu radius; application Inter 13px/400, 40px rows, 6px menu radius.
- Rendered Employee Master heading: 20px/600; application's approved rollout uses
  22px/600. This is a small documented adapter difference, not an unreadable state.
- Skill MBM baseline is 164x45 for a single primary logo. User explicitly requested
  two inline corporate marks: current MBM 92x30 and MTI 84x30. Do not automatically
  move MTI or enlarge the sidebar to chase the single-logo anchor.
- Full-width low-opacity watermark, paired corporate logos, collapsed filters,
  removed redundant PRF tab, split panel/modal and Excel export are intentional
  approved changes. They are not fidelity defects.
- No document-level horizontal overflow in the sampled phone routes. This alone
  does not prove absence of clipped content: Settings has internal main-content
  horizontal overflow. Inspect the actual container, not only document.scrollWidth.

## Verification and limits

Opened source Employee Master and actual pages, Settings OCR/General/Pronto/Users,
Create PRF OCR/manual, Create Budget, Add COA, PRF detail/edit, items modal and item
modification. Opened mobile navigation and mobile Budget dialog; no mutations.
Dialog bounds fit the phone viewport (Budget x16, width358, height~760 at 390x844),
with internal scrolling required to reach the footer. Saved screenshots and measured
styles. Verified 48 canonical v2 and five login asset hashes unchanged.

Not a full accessibility audit, all-data/zoom matrix, screenshot pixel score or
production UAT. No source implementation edits were made during this review;
existing uncommitted implementation work remains intact. No commit/push/deploy.
Phase 13B remains In Progress. No backend or OpenAPI change.

## Follow-up implementation — Settings and Create PRF
The initially recorded drift above is retained as before-state evidence. On 2026-10-23, Settings and Create PRF were migrated to the shared Merdeka long-form variant. Mobile tabs/title issues were fixed and representative dialogs/popups/draft items checked. See docs/merdeka-ui-rollout.md for verification and remaining limits. Other findings in this audit remain outstanding.

## Follow-up implementation — Budget Overview and COA
Budget single-digit currency wrapping and COA vertical density were addressed on
2026-10-23. Finance dialog bodies now scroll independently of header/actions.
Original audit findings remain as before-state evidence; see merdeka-ui-rollout.md
for measured desktop/phone results and limits. Other audit findings remain open.
