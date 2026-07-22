# FY2026 IDR Budget Update

Date: `2026-07-22`
Database: `PRFMonitoringDB`
Scope: `HR / IT` mandatory `OPEX` FY2026 annual budget rows

## Request Summary

Applied the approved FY2026 budget values in Rupiah for these GL / COA codes:

| COA Code | COA Name | Allocated Amount (IDR) |
| --- | --- | ---: |
| MTIRMRAD496137 | Software Maintenance | 1,401,388,205 |
| MTIRMRAD496232 | Repairs and maintenance | 743,492,135 |
| MTIRMRAD496769 | Tools | 1,122,357,030 |
| MTIRMRAD496250 | IT consumeables | 1,990,788,719 |
| MTIRMRAD496313 | Internet | 3,218,247,300 |
| MTIRMRAD496315 | Stationery and postage | 3,223,620 |
| MTIRMRAD496326 | Other permit & licenses | 22,386,250 |
| MTIRMRAD496328 | Subscriptions | 4,045,184,231 |
| MTIRMRAD496014 | Training and seminars | 143,272,000 |
| MTIRMRAD496314 | Telephone and mobile comms | 89,186,820 |

## Applied Operation

- Updated `4` existing FY2026 annual budget rows
- Inserted `6` missing FY2026 annual budget rows
- Stored all target rows as:
  - `CurrencyCode = IDR`
  - `ExchangeRateToIDR = 1`
  - `Quarter = NULL`
  - `Month = NULL`
- Added row note:
  - `Manual FY2026 IDR budget update from approved HR/IT list on 2026-07-22`

## Verification

- Verified all `10` target COA codes now have FY2026 annual budget rows
- Verified all `10` target rows use `IDR` and `ExchangeRateToIDR = 1`
- Verified total allocated amount:
  - `12,779,526,310 IDR`

## Notes

- No API contract change was required
- No `docs/openapi.yaml` update was needed
- This is an operational data update, not a schema change
