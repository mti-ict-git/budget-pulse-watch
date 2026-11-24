# Microsoft 365 Sign-in (Entra ID SSO)

Status: implemented. It is **on only when the server has a complete configuration** (variables below) and can be forced off with `M365_SSO_ENABLED=false`. Roadmap: Phase 20.

## What the user sees

The login page shows **Sign in with Microsoft 365** under the username/password form. It is shown only when the server has a complete configuration (`GET /api/auth/microsoft/config`). After choosing the account at Microsoft, the user lands back on POMON already signed in.

Username/password login (LDAP and local accounts) keeps working unchanged. It is the fallback if Microsoft sign-in is down or not configured.

## Who may sign in

Microsoft 365 proves who the user is. **POMON access is still decided by the existing access list** (`LDAPUserAccess`, managed under Settings by admins):

- The ID token's `email` claim is matched against `LDAPUserAccess.Email` first. If that has no match, the sign-in name (`preferred_username`, the UPN) is tried, because the UPN and the mail address can differ.
- Only active entries (`IsActive = 1`) match. The role comes from the access list.
- A Microsoft 365 user who is not on the list gets the message "Your Microsoft 365 account does not have POMON access yet" and nothing is created.
- Only accounts from the configured tenant are accepted (`tid` and issuer checked); guest or other-tenant accounts are rejected.

The session is the same 24-hour POMON JWT as an LDAP password login (`authType: "ldap"`), so the auth middleware re-checks the access list on every request: revoking access takes effect at once.

## Flow

```
Browser            POMON backend                         Microsoft Entra ID
  | GET /api/auth/microsoft/login
  |----------------->| state, nonce, PKCE verifier kept in memory (10 min, single use)
  |<---- 302 --------| to login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize
  |------------------------------------------------------>| user signs in (MFA, Conditional Access apply)
  |<----------------------------------------------- 302 --| to the redirect URI ?code&state
  | (APP_URL/auth/microsoft/callback is a frontend page that forwards ?code&state unchanged)
  | GET /api/auth/microsoft/callback
  |----------------->| code + verifier + client secret -> token endpoint (server to server)
  |                  | check aud / tid / iss / nonce / exp, match email to LDAPUserAccess
  |<---- 302 --------| to M365_POST_LOGIN_URL#sso=<one-time code, 2 min>
  | POST /api/auth/microsoft/exchange {code}
  |----------------->| returns { token, user } once
```

- The one-time code travels in the URL **fragment**, so it never appears in proxy or server access logs, and the login page removes it from the address bar immediately.
- Pending sign-ins and handoff codes are kept in memory: a backend restart in the middle of a sign-in shows "took too long, try again". This assumes **one backend instance**, which is the production setup today.
- No Microsoft access token is stored, and Microsoft Graph is not called. Scopes: `openid profile email`.

## Configuration

Set in `backend/.env` on the server, then recreate the backend container. Two naming schemes are accepted; for each value the `M365_*` name wins if both are set.

| Value | `M365_*` name | Alternative name | Notes |
|---|---|---|---|
| On/off | `M365_SSO_ENABLED` | | Optional. `false` turns sign-in off; otherwise it is on when every value below is set. |
| Tenant | `M365_TENANT_ID` | `MS_GRAPH_TENANT_ID` | Tenant **GUID** (Directory ID), not the domain name. |
| Client | `M365_CLIENT_ID` | `MS_GRAPH_CLIENT_ID` | Application (client) ID. |
| Secret | `M365_CLIENT_SECRET` | `MS_GRAPH_CLIENT_SECRET` | Client secret **value**. Only in the server `.env`, never in the repository or chat; note its expiry date. |
| Redirect URI | `M365_REDIRECT_URI` | `MS_SSO_REDIRECT_URI` | Must match the app registration exactly. |
| Post-login page | `M365_POST_LOGIN_URL` | `APP_URL` | With `APP_URL`, the page is `APP_URL/login`. |

Production values (2026-11-24): redirect URI `https://pomon.merdekabattery.com/auth/microsoft/callback`, `APP_URL=https://pomon.merdekabattery.com`.

Two redirect URI paths work:

- `https://<host>/auth/microsoft/callback`: a frontend page (`src/pages/MicrosoftCallback.tsx`) that immediately forwards Microsoft's `code` and `state` to `/api/auth/microsoft/callback`. No nginx change is needed.
- `https://<host>/api/auth/microsoft/callback`: the backend directly.

Client certificates (`MS_GRAPH_CERTIFICATE_PATH`) are not used: sign-in authenticates with the client secret.

If some but not all values are set, the backend logs `[M365 SSO] Disabled: incomplete configuration (...)` (names only, never values) and the button stays hidden.

`AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` belong to the OneDrive sync and are not read by sign-in.

## HTTPS redirect host (decided 2026-11-24)

Entra ID only accepts `https://` redirect URIs, apart from `http://localhost`, so `http://10.60.10.59:9007` cannot be used.

**Decision (product owner, 2026-11-24): use `https://pomon.merdekabattery.com`.** It already serves the POMON frontend and proxies `/api` to the backend (checked 2026-11-24: `/api/auth/verify` returns 401 without a token), with the company wildcard certificate `*.merdekabattery.com` (DigiCert, valid until 2027-05-28).

- Redirect URI: `https://pomon.merdekabattery.com/auth/microsoft/callback` (registered by the tenant administrator, 2026-11-24)
- Post-login page: `https://pomon.merdekabattery.com/login` (from `APP_URL`)

Users should open POMON at this address. Microsoft sign-in can still be started from `http://10.60.10.59:9007`, but the user ends up on the HTTPS address afterwards, where the session is stored (browser storage is per address). Username/password logins on this address are also encrypted.

`https://pomonbackend.justanapi.my.id` (the public API for the POMON mobile app, through Cloudflare) was considered and not chosen: it is outside the company domain.

## Entra ID setup (done by a tenant administrator)

1. Microsoft Entra admin center → **App registrations** → **New registration**.
   - Name: `POMON - MTI ICT PO Monitoring`.
   - Supported account types: **Accounts in this organizational directory only** (single tenant).
   - Redirect URI: platform **Web**, value = the redirect URI above (for example `https://pomon.merdekabattery.com/auth/microsoft/callback`).
2. **Overview** page: copy **Application (client) ID** → `MS_GRAPH_CLIENT_ID` (or `M365_CLIENT_ID`), and **Directory (tenant) ID** → `MS_GRAPH_TENANT_ID` (or `M365_TENANT_ID`).
3. **Certificates & secrets** → **New client secret** → copy the **Value** once → `MS_GRAPH_CLIENT_SECRET` (or `M365_CLIENT_SECRET`). Put a calendar reminder before it expires.
4. **Token configuration** → **Add optional claim** → token type **ID** → `email`. Accept the prompt to add the Microsoft Graph `email` permission.
5. **API permissions**: `openid`, `profile`, `email` (Microsoft Graph, delegated). Click **Grant admin consent** so users are not asked to consent.
6. Optional, to limit who can even reach POMON: **Enterprise applications** → POMON → **Properties** → **Assignment required? = Yes**, then assign the allowed users or groups. The POMON access list still applies on top.

## Rollout

1. Deploy the code (feature stays off).
2. Create the app registration and fill the `M365_*` variables in `/root/budget-pulse-watch/backend/.env` on docker59; recreate the backend container.
3. Check `GET /api/auth/microsoft/config` returns `enabled: true`, sign in with an account that is on the access list, then with one that is not (expect the "no access" message).
4. Announce it; keep username/password login available.

Rollback: set `M365_SSO_ENABLED=false` and recreate the backend container.
