# PRF AI Chatbot Enhancement Roadmap

## Purpose

This document turns the sixteen proposed PRF Assistant enhancements into an implementation backlog grounded in the repository's current capabilities. It distinguishes work that can be delivered now from work that needs a small platform foundation or a separate governance decision.

This roadmap does not expand the current chatbot authorization boundary. Until a later phase is explicitly approved, the assistant remains read-only, attachment contents remain excluded, and conversation history remains session-only.

## Current Resource Baseline

The following capabilities already exist and may be reused:

- React, TypeScript, Tailwind, shadcn-ui, TanStack Query, and Recharts
- Express, TypeScript, SQL Server, JWT/API-key authentication, and role metadata
- OpenAI Responses API with fixed function tools and `store: false`
- parameterized PRF, item, budget, report, attachment-metadata, and notification data access
- authenticated PRF/file navigation actions
- GFM Markdown, responsive tables, full-window chat, and session-scoped context
- Excel tooling through `xlsx`

No vector database, document index, durable chat store, workflow engine, or general-purpose model-generated SQL is currently available or required for the immediate backlog.

## Feasibility Classification

| Class | Meaning |
|---|---|
| Now | Can be implemented with the existing frontend, backend, SQL, and OpenAI tool-calling architecture |
| Foundation | Feasible after a small schema, scheduler, or subscription foundation is added |
| Deferred | Requires a separate security/governance design or materially new infrastructure |

## Enhancement Backlog

### 1. Evidence-Backed Answers

- Feasibility: `Now`
- Priority: `P0`
- Goal: Every aggregate answer states its time range, filters, business definition, result limit, data timestamp, and any material data-quality caveat.
- Implementation: Return a structured `evidence` block from each backend tool and render a collapsible `How this was calculated` section.
- Acceptance: A number shown by the assistant can be independently reproduced from the displayed definition and cited PRFs.

### 2. Follow-Up Action Chips

- Feasibility: `Now`
- Priority: `P0`
- Goal: Offer relevant actions such as `Compare with last month`, `Show missing PO`, `View attachments`, or `Export CSV`.
- Implementation: Backend returns allow-listed structured actions with validated parameters; the UI never executes arbitrary model-generated URLs or commands.
- Acceptance: Clicking a chip submits or executes the exact displayed read-only action and preserves the active context.

### 3. Advanced Analytics Tools

- Feasibility: `Now`
- Priority: `P0`
- Goal: Support period comparison, trend, aging, top items, cost-code/vendor/requestor/PIC grouping, budget-versus-commitment, and forecast questions.
- Implementation: Add one bounded parameterized tool per analytics domain rather than a generic SQL tool.
- Acceptance: Each metric has a documented date basis, cancellation rule, currency normalization, grouping rule, and maximum result size.

### 4. Workflow Intelligence

- Feasibility: `Now`
- Priority: `P0`
- Goal: Detect stale PRFs, missing PO, missing attachment, header/item mismatch, missing cost code, status inconsistency, and budget risk.
- Implementation: Create deterministic rule evaluators and return severity, reason, affected records, and recommended read-only next step.
- Acceptance: Every warning maps to a named rule and clickable source records; the model does not invent severity.

### 5. Daily Briefing

- Feasibility: `Now` for on-demand briefing; `Foundation` for scheduled delivery
- Priority: `P1`
- Goal: Present new PRFs, status movement, PO/attachment activity, aging items, and budget attention when the assistant opens or the user asks.
- Implementation: Start with an on-demand `get_daily_briefing` tool. Scheduled delivery requires a job and notification preference.
- Acceptance: Briefing uses an explicit Asia/Jakarta reporting window and links every count to its record set.

### 6. Saved Questions And Dashboard Pins

- Feasibility: `Now` with browser storage; `Foundation` for cross-device persistence
- Priority: `P1`
- Goal: Save reusable questions or structured queries without retaining the whole chat.
- Implementation: Phase one uses per-user browser storage. Cross-device pins require a `SavedAssistantQuery` table and authenticated CRUD API.
- Acceptance: Only the query/action definition is stored; secret data and assistant reasoning are never persisted.

### 7. Structured Visualizations

- Feasibility: `Now`
- Priority: `P1`
- Goal: Render bar, line, donut, timeline, and heatmap views for suitable aggregate results.
- Implementation: Backend returns an allow-listed chart schema; Recharts renders the data. The model may select a chart type but cannot alter metric values.
- Acceptance: Every chart has the same evidence/filter disclosure as its corresponding table and an accessible tabular fallback.

### 8. Conversation Export

- Feasibility: `Now` for CSV/Excel/copy/print; `Foundation` for governed PDF reports or shareable server links
- Priority: `P1`
- Goal: Export a result set without making the chatbot a write-capable PRF agent.
- Implementation: Generate CSV/Excel from structured tool output, not parsed prose. Print can use the browser. Governed PDF/share links require an explicit retention policy.
- Acceptance: Exported rows and filters exactly match the answer and include generation time/time zone.

### 9. Attachment Intelligence Without Content Reading

- Feasibility: `Now`
- Priority: `P0`
- Goal: Report latest/missing/duplicate-looking/unsupported/oversized attachments and attachment activity after PRF changes.
- Implementation: Extend metadata tools and optionally add controlled attachment categories during upload.
- Acceptance: The assistant clearly states that conclusions use metadata only and never claims to have read file contents.

### 10. Document Understanding With Page Citations

- Feasibility: `Deferred`
- Priority: `P3`
- Goal: Answer questions from PDF/image contents with file and page citations.
- Required foundation: document extraction lifecycle, page/chunk schema, re-indexing, access control, retention, evaluation set, and either SQL-based full-text retrieval or a vector index.
- Gate: Must not begin until document privacy, storage, deletion, source precedence, and citation-quality rules are approved.
- Acceptance: Every document-derived statement cites the exact file and page; unsupported answers are refused rather than inferred.

### 11. Entity-Aware Session Context

- Feasibility: `Now`
- Priority: `P0`
- Goal: Track active PRF, period, department, and business definition as visible removable chips.
- Implementation: Store structured context in `sessionStorage`; send it separately from prose history and require explicit references before carrying a specific PRF into a broad question.
- Acceptance: Users can inspect/remove context, and unrelated aggregate questions do not inherit a previous PRF.

### 12. Ambiguity Resolver

- Feasibility: `Now`
- Priority: `P0`
- Goal: Resolve terms such as `bought`, `completed`, `pending`, `this week`, `PRF value`, and `spending` before querying.
- Implementation: Backend provides allow-listed interpretations and the UI renders choice chips. The selected definition becomes visible session context.
- Acceptance: The assistant never silently chooses a materially different business definition when more than one valid interpretation exists.

### 13. Role-Aware Answer Depth

- Feasibility: `Now`
- Priority: `P2`
- Goal: Tailor presentation for admin, DocCon, standard user, or management while preserving the agreed all-PRF read scope.
- Implementation: Pass authenticated role and use role-specific presentation policy; tool authorization remains enforced by backend middleware.
- Acceptance: Role changes affect emphasis and available UI actions, not factual results or hidden authorization bypasses.

### 14. Voice Input

- Feasibility: `Now` as progressive enhancement
- Priority: `P2`
- Goal: Allow supported browsers to dictate a question.
- Implementation: Use the browser Web Speech API initially; keep typed input as the required fallback and do not store audio.
- Acceptance: Permission is requested only after a user action, recording state is visible, and unsupported browsers degrade cleanly.

### 15. Notification Subscriptions

- Feasibility: `Foundation`
- Priority: `P2`
- Goal: Let users subscribe to PO, status, attachment, pickup, or budget-threshold events from a chatbot result.
- Required foundation: subscription table, deduplication, delivery preference, event/job processing, unsubscribe flow, and audit trail. Existing notification infrastructure may be reused.
- Gate: Subscription creation is the only allowed write; it must not modify a PRF.
- Acceptance: Users can inspect, pause, and delete subscriptions, and repeated sync events do not create duplicate notifications.

### 16. Safe Action Drafts

- Feasibility: `Deferred`
- Priority: `P3`
- Goal: Let the assistant prepare—but never silently execute—PRF changes.
- Required foundation: action-specific permissions, immutable proposal/diff, business validation, explicit confirmation, idempotency, transaction handling, and audit/rollback policy.
- Gate: Requires a separate product/security approval because it changes the chatbot from read-only to write-capable.
- Acceptance: No mutation occurs from model text or tool choice alone; the user approves an exact validated diff immediately before execution.

## Recommended Delivery Sequence

### Phase 13A - Trust And Conversation Control

Deliver first:

1. Evidence-backed answers
2. Follow-up action chips
11. Entity-aware session context
12. Ambiguity resolver

Why first: these reduce incorrect interpretation and make every later capability easier to understand and audit.

### Phase 13B - Operational Intelligence

Deliver next:

3. Advanced analytics tools
4. Workflow intelligence
9. Attachment metadata intelligence
5. On-demand daily briefing

Why next: these provide the highest operational value without expanding the read-only boundary.

Implementation begins with Budget Intelligence: CAPEX/OPEX summary, COA utilization/risk, remaining budget, and contributing PRFs. Workflow intelligence, attachment metadata intelligence, and on-demand briefing follow after this slice passes UAT.

Workflow Intelligence is the second implementation slice and reports stale PRFs, missing PO, missing attachment metadata, missing/unknown cost code, and header/item amount mismatch as bounded read-only review signals.

### Phase 13C - Presentation And Reuse

Deliver after analytics stabilize:

7. Structured visualizations
8. CSV/Excel/copy/print export
6. Browser-local saved questions
13. Role-aware answer depth
14. Voice-input progressive enhancement

### Phase 13D - Small Platform Foundations

Deliver only after schema and operational decisions are approved:

5. Scheduled briefing
6. Cross-device saved questions and pins
8. Governed PDF/share links
15. Notification subscriptions

### Future Governed Expansion

Keep outside the immediate roadmap:

10. Document understanding with page citations
16. Safe action drafts

## Recommended Immediate Scope

The best next implementation package is Phase 13A. It uses current resources, adds no durable chat history, keeps the assistant read-only, and directly addresses the largest observed quality risks: ambiguous business terms, accidental context carry-over, unsupported follow-up suggestions, and answers whose calculation cannot be audited.

## Verification Standard

Every delivered enhancement must include:

- backend and frontend typecheck/build
- targeted lint
- OpenAPI review for contract changes
- live SQL/OpenAI tests using representative Indonesian questions
- negative tests for irrelevant context carry-over and empty results
- exact comparison between tool output, rendered answer, references, chart, and export
- updated phase checklist and explicit verification evidence
