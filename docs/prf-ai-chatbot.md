# PRF AI Chatbot

## Product Scope

The PRF AI Chatbot lets any authenticated user ask natural-language questions about all PRFs in Budget Pulse Watch.

The initial release is intentionally read-only:

- the assistant may search, inspect, and aggregate all PRF headers and items
- the assistant may inspect attachment metadata and identify the latest attachment
- the assistant may return authenticated preview and download actions
- the assistant does not read or summarize attachment contents
- the assistant cannot create, update, approve, cancel, or delete any record

## Conversation Retention

Conversation history is held only in browser `sessionStorage`:

- it survives a page refresh in the same tab
- it is isolated to that browser tab
- it is removed when the tab closes or the user logs out
- it is never persisted in SQL Server
- OpenAI requests use `store: false`

## AI Provider

The chatbot uses OpenAI only. It reads the OpenAI key from `OPENAI_API_KEY`, falling back to the OpenAI key already maintained in OCR Settings. The chatbot model can be overridden with `CHATBOT_OPENAI_MODEL`; its current default is `gpt-5.6-sol`.

The OCR provider selection does not control the chatbot provider. Selecting Gemini for OCR does not make the chatbot use Gemini.

## Architecture And Safety

The backend uses the OpenAI Responses API with fixed read-only function tools. The model never receives database credentials and cannot submit arbitrary SQL.

Available tool capabilities:

- search PRFs with bounded filters
- read one PRF and its items
- aggregate PRF count and requested amount
- aggregate line-item count, total quantity, and value for relative periods resolved in `Asia/Jakarta`, with an explicit PO-based purchase definition
- list attachment metadata

All database access is implemented by parameterized application queries. Search results are capped, tool rounds are bounded, message count and length are validated, and every request requires application authentication. A privacy-preserving safety identifier is derived from the authenticated username.

Relative periods such as `today`, `this week`, and `this month` are resolved deterministically by the backend rather than inferred by the model. Broad aggregate questions do not inherit a previously discussed PRF unless the user explicitly refers to it.

Attachment metadata is treated as untrusted data. File names and descriptions are not instructions to the model. File content is served through an authenticated endpoint and is not sent to OpenAI.

When an attachment answer contains a Markdown table, the frontend matches each exact file name to a trusted backend reference and inserts Preview/Download controls into that row. Only unmatched referenced files use separate fallback cards; file metadata not named in the answer is not rendered as an unrelated card.

## User Experience

A floating `PRF Assistant` button is available inside the protected application layout. Responses can contain:

- clickable PRF references that open PRF Monitoring with the PRF number selected
- inline authenticated Preview and Download actions in matching attachment-table rows, with cards as an unmatched-reference fallback
- a concise statement of filters, limits, or missing data
- GitHub-Flavored Markdown including headings, emphasis, lists, task lists, links, code blocks, and responsive tables
- a maximize/minimize control that switches the chat between drawer and full-window layouts

Assistant Markdown is rendered with raw HTML disabled. Tables scroll horizontally on narrow screens, external links use `noopener noreferrer`, and trusted PRF/attachment actions remain application-rendered controls rather than model-generated URLs.

The UI explicitly communicates that the assistant is read-only, sees all PRFs, does not read attachments, and keeps conversation history for the browser session only.

## Phase 13B Budget Intelligence

The assistant may query bounded, parameterized budget summaries and contributing PRFs. Budget utilization follows the governed dashboard definition:

- total available budget = annual allocation in IDR + approved carry-forward in IDR
- utilized/committed amount = non-cancelled PRF item `Quantity * UnitPrice`
- fiscal year is resolved from item budget year, then PRF budget year, then request-date year
- each item is allocated only through its normalized purchase cost code to an active COA
- CAPEX/OPEX comes from `ChartOfAccounts.ExpenseType`
- missing or unknown item cost codes are not silently assigned to a header COA

Budget tools are read-only, accept only fixed filters, cap returned rows, state their risk threshold, and return structured calculation evidence. The initial Phase 13B slice does not forecast, mutate budgets, or create alerts/subscriptions.

### Workflow Intelligence

The assistant may identify bounded operational/data-quality issues using structured PRF metadata:

- stale PRF: non-cancelled/non-completed PRF whose last update (falling back to submit/request date) is at least the explicit aging threshold
- missing PO: at least one non-cancelled item has neither Original nor Split PO
- missing attachment: the PRF has no `PRFFiles` record
- missing cost code: at least one non-cancelled item has a blank cost code or cannot match an active COA
- amount mismatch: absolute difference between header requested amount and item `Quantity * UnitPrice` total is greater than IDR 1 in the PRF transaction currency

Issue tools do not modify statuses, attachments, cost codes, PO data, or amounts. Results are capped and provide trusted PRF references for user review.

## Trust And Conversation Control

Phase 13A adds four structured controls:

- `How this was calculated` exposes the tool name, filters, date/time-zone basis, business definition, limits, and result counts supplied by backend tools.
- Follow-up chips are allow-listed backend actions containing a label and a safe prompt; arbitrary model-generated commands are not executable.
- Visible context chips track active PRF, period, department, and purchase definition in `sessionStorage`. Users can remove any context chip, and logout clears all context.
- The ambiguity resolver runs before OpenAI for materially different meanings of `bought/spending`, `completed`, `pending`, and `value`. The selected meaning is shown and can become session context.

Ambiguity choices never mutate data. A clarification response can be produced without an OpenAI call, and the actual query runs only after the user selects a definition.

## Operational Configuration

- Configure an OpenAI API key in Settings or set `OPENAI_API_KEY` on the backend.
- In Settings, only an authenticated administrator can reveal the decrypted key with the eye control; reveal responses are marked `no-store` and hiding the key removes plaintext from UI state.
- Optionally set `CHATBOT_OPENAI_MODEL` to an OpenAI Responses API model that supports function calling.
- The backend must be able to resolve the stored `PRFFiles.FilePath` or `SharedPath` for preview/download.
- Attachment preview/download and AI rescan use the same compatibility resolver as PRF folder scan/sync. Supported layouts include direct PRF folders, the legacy company-folder layout, Windows UNC paths, and forward-slash CIFS paths.
- Monitor OpenAI latency, rate-limit failures, and token cost before expanding access or result limits.

## Deferred Scope

- reading or indexing PDF/document contents
- embeddings or vector search
- persistent chat history
- streaming responses
- PRF write actions
- user-specific PRF visibility restrictions
