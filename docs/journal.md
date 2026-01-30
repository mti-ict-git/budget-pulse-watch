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

2026-01-30 11:08:30 +08:00
- Tested dev:migrateschema runner; benign duplicates skipped
- Verified AppSettings exists (Cnt=1) and latest row: Provider=openai, Enabled=1, Model=gpt-4o-mini
