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

## User Experience

A floating `PRF Assistant` button is available inside the protected application layout. Responses can contain:

- clickable PRF references that open PRF Monitoring with the PRF number selected
- attachment cards with authenticated Preview and Download actions
- a concise statement of filters, limits, or missing data
- GitHub-Flavored Markdown including headings, emphasis, lists, task lists, links, code blocks, and responsive tables
- a maximize/minimize control that switches the chat between drawer and full-window layouts

Assistant Markdown is rendered with raw HTML disabled. Tables scroll horizontally on narrow screens, external links use `noopener noreferrer`, and trusted PRF/attachment actions remain application-rendered cards rather than model-generated URLs.

The UI explicitly communicates that the assistant is read-only, sees all PRFs, does not read attachments, and keeps conversation history for the browser session only.

## Operational Configuration

- Configure an OpenAI API key in Settings or set `OPENAI_API_KEY` on the backend.
- In Settings, only an authenticated administrator can reveal the decrypted key with the eye control; reveal responses are marked `no-store` and hiding the key removes plaintext from UI state.
- Optionally set `CHATBOT_OPENAI_MODEL` to an OpenAI Responses API model that supports function calling.
- The backend must be able to resolve the stored `PRFFiles.FilePath` or `SharedPath` for preview/download.
- Monitor OpenAI latency, rate-limit failures, and token cost before expanding access or result limits.

## Deferred Scope

- reading or indexing PDF/document contents
- embeddings or vector search
- persistent chat history
- streaming responses
- PRF write actions
- user-specific PRF visibility restrictions
