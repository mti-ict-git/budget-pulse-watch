# Database schema specification

`backend/database/schema.sql` remains the schema baseline. Phase 14 adds `AppSettings.UploadExtractionMethod NVARCHAR(10) NOT NULL`, constrained to `llm` or `local` with default `llm`. Migration 026 adds the column idempotently without changing provider, enabled state, API keys or model.

The preview receipt is bounded in-memory state (15 minutes), not a new SQL entity. Reviewed upload creation writes PRF header and PRFItems in the same transaction. Existing rescan audit schema and rescan statements remain unchanged.

ItemCode retains the part number (64 characters). ItemName is a 200-character display label; the full reviewed description is stored separately in Description (up to 1000). Quantities follow the existing INT schema; money follows existing decimal precision. PRF notes retain a bounded review summary and literal document notes.
