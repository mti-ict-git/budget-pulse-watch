
# PRF Monitoring (Mobile)

## Goal

Enable warehouse/operations teams to quickly locate a PRF, see what items were requested/approved, and record goods checking (received/verified) from a mobile device.

## Primary Users & Roles

- **Goods Checker (warehouse / operations):** read-only PRFs + can record checking activity
- **Content Manager (doccon/admin):** full PRF visibility + can correct item details if needed
- **Viewer (requestor/department):** read-only PRFs (optional for mobile)

## High-Level UX Flow

1. **Sign in** → show user name/role + last sync timestamp.
2. **PRF List** (search-first) → scan/search PRF No, filter by status/department/year.
3. **PRF Details** → summary header + tabs/sections:
   - Items
   - Documents (view/download)
   - Activity (optional)
4. **Goods Check** (per PRF or per item)
   - Mark item received quantity and condition
   - Attach photo(s) (optional)
   - Capture checker name + timestamp
   - Submit (online) or queue (offline)
5. **Confirmation** → show “Saved” + sync status.

## Wireframe (Screen Inventory)

### 1) Login

- App bar: “Budget Pulse Watch”
- Card: Username + Password
- Primary button: Sign in
- Secondary: “Use SSO” (optional, if LDAP/AD mobile auth is supported)

### 2) PRF List

- App bar: PRF Monitoring
- Top: Search input (PRF No / description / submit by / required for)
- Filters row (chip-style): Status, Department, Year, Priority
- List items (each row):
  - PRF No (bold)
  - Status badge
  - Department + required date
  - Requested amount / approved amount (optional)
- Bottom actions:
  - Pull-to-refresh
  - “Offline queue” indicator (if enabled)

### 3) PRF Details

- Header card:
  - PRF No, Status, Priority
  - Department, RequiredFor, SubmitBy, DateSubmit
  - Total requested/approved
- Items section:
  - Item row: name + qty + status + cost code
  - Tap item → Item details + “Check Goods”
- Documents section:
  - Document list + open/download

### 4) Check Goods (Item)

- Item card: ItemName, PRF No, cost code, requested qty
- Inputs:
  - Received quantity (numeric)
  - Condition (select): Good / Damaged / Partial / Returned
  - Notes (multiline)
  - Photos (optional)
- Submit:
  - Primary: “Save Check”
  - Secondary: “Save Offline” (if offline mode)

### 5) Offline Queue (Optional)

- List queued check events
- Retry all / retry one
- Clear successful

## Component Tree (React Native)

Design System: **React Native Paper** (recommended for first mobile build). Tamagui can be adopted later if you want cross-platform styling parity.

- AppRoot
  - PaperProvider (theme)
  - NavigationContainer
    - AuthStack
      - LoginScreen
    - AppTabs
      - PRFStack
        - PRFListScreen
        - PRFDetailScreen
        - PRFItemCheckScreen
      - SettingsScreen
      - OfflineQueueScreen (optional)

## Responsive & Layout Guidelines

- **Phones:** single-column list/details
- **Tablets (>= 768dp width):** details can show a two-pane layout (list left, detail right)
- **Spacing:** 8pt grid; use Paper’s default spacing tokens where possible
- **Typography:** default Paper typography; keep PRF No as title, status as badge

Example (tablet two-pane):

```tsx
import React from 'react';
import { View, useWindowDimensions } from 'react-native';

export function TwoPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  if (!isTablet) return <View style={{ flex: 1 }}>{left}</View>;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: 360 }}>{left}</View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}
```

## Accessibility (WCAG 2.1)

- Ensure touch targets are at least 44x44dp
- Provide clear focus order for keyboard/assistive navigation
- Use semantic labels (accessibilityLabel) for icon-only buttons
- Keep contrast for status chips/badges (especially “Approved/Rejected”)
- Avoid color-only state; include text/icon

## Data & Offline Strategy

- Cache last PRF list + last opened PRFs for quick access.
- If offline goods-check is required:
  - Store “check events” locally (SQLite/MMKV) until online
  - Include PRFItemID + receivedQty + condition + notes + localPhotoRefs
  - Retry with exponential backoff

## Backend API Requirements

### Existing endpoints to reuse

- Auth
  - `POST /api/auth/login`
- PRF browsing
  - `GET /api/prfs` (pagination + filters)
  - `GET /api/prfs/:id`
  - `GET /api/prfs/:id/items`
- Documents
  - `GET /api/prf-documents/:prfId`
  - `GET /api/prf-documents/download/:prfId/:fileName`

### Recommended endpoint for mobile search

- `GET /api/prfs/search?q=...&limit=...`
  - Returns lightweight PRF summaries for instant search UX.

### New endpoints needed for goods checking

These are not implemented yet; define before building the mobile workflow.

- `POST /api/prf-items/:itemId/goods-check`
  - Body: receivedQuantity, condition, notes, photos (optional)
  - Response: updated item + created check event
- `GET /api/prf-items/:itemId/goods-checks`
  - Returns check history

## Sample Mobile Code (React Native Paper)

### Theme setup

```tsx
import * as React from 'react';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1E40AF'
  }
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}
```

### PRF search call (TypeScript)

```ts
export type PRFSummary = {
  PRFID: number;
  PRFNo: string | null;
  Title: string | null;
  Department: string | null;
  Status: string | null;
  Priority: string | null;
  RequestDate: string | null;
};

export async function searchPrfs(baseUrl: string, q: string, limit: number): Promise<PRFSummary[]> {
  const url = new URL('/api/prfs/search', baseUrl);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const json: unknown = await res.json();

  if (
    typeof json === 'object' &&
    json !== null &&
    'success' in json &&
    'data' in json &&
    (json as { success: unknown }).success === true &&
    Array.isArray((json as { data: unknown }).data)
  ) {
    return (json as { data: PRFSummary[] }).data;
  }

  return [];
}
```

## Confirmed Decisions

- Support **both** per-item goods updates and a PRF-level “checked complete” action.
- Mobile is for **monitoring + receiving/verification**, not for submitting new PRFs.
- **Offline mode is not required** for the first version.
- **Barcode/QR scanning is not required** for now.
- Update **per item** when goods are received so you can confirm which goods belong to which PO.

## PO Number Rule

- **PO Number is derived from PRF No**: it uses the same base number and differs only by suffix.
- Example (current): `PRF41356` → `PO41356`
- Display PO Number in PRF Details header and in the Goods Check screen.

## Open Questions

- Confirm the PO mapping rule for numeric-only PRF numbers (example: `41536` → `PO41536` or `41536-PO`).
