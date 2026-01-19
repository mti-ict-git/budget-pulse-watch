-- Before: Using empty cost code columns
COALESCE(pi.PurchaseCostCode, p.PurchaseCostCode) as CostCode

-- After: Extracting from JSON specifications
COALESCE(
  JSON_VALUE(pi.Specifications, '$.PurchaseCostCode'),
  JSON_VALUE(pi.Specifications, '$.purchaseCostCode'),
  pi.PurchaseCostCode, 
  p.PurchaseCostCode
) as CostCode