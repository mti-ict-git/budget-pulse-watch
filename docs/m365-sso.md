# Microsoft 365 Sign-in (Entra ID SSO)

Status: implemented, **disabled by default**. It is switched on per environment with the `M365_*` variables below after the Entra ID app registration exists. Roadmap: Phase 20.

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
  |<----------------------------------------------- 302 --| to M365_REDIRECT_URI?code&state
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

| Variable | Example | Notes |
|---|---|---|
| `M365_SSO_ENABLED` | `true` | Anything else disables the feature (button hidden, endpoints return 404). |
| `M365_TENANT_ID` | `xxxxxxxx-xxxx-...` | Tenant **GUID** (Directory ID), not the domain name. |
| `M365_CLIENT_ID` | `xxxxxxxx-xxxx-...` | Application (client) ID of the POMON app registration. |
| `M365_CLIENT_SECRET` | *(secret)* | Client secret value. Keep it only in the server `.env`; note its expiry date. |
| `M365_REDIRECT_URI` | `https://<pomon-https-host>/api/auth/microsoft/callback` | Must match the app registration exactly. |
| `M365_POST_LOGIN_URL` | `http://10.60.10.59:9007/login` | The POMON login page users normally open. |

If the variables are incomplete, the backend logs `[M365 SSO] Disabled: incomplete configuration (...)` (names only, never values) and the button stays hidden.

These are separate from `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`, which belong to the OneDrive sync app. A separate app registration keeps sign-in permissions apart from file access.

## HTTPS requirement (open question)

Entra ID only accepts `https://` redirect URIs, apart from `http://localhost`. Users currently open POMON at `http://10.60.10.59:9007`, so that address cannot be the redirect URI. Two options:

1. **Use the existing public backend host**: `https://pomonbackend.justanapi.my.id/api/auth/microsoft/callback`. It already reaches the same backend container, so it works without new infrastructure. The browser must be able to open that host during sign-in.
2. **Give POMON its own HTTPS hostname** (for example on a company domain, with a certificate on a reverse proxy) and use it for both the app and the redirect URI. This is cleaner, and also stops sending passwords over plain HTTP on the login form. It needs DNS and a certificate.

The backend works with either option: only `M365_REDIRECT_URI` and `M365_POST_LOGIN_URL` change. The choice is recorded in `docs/open-questions-and-challenges.md`.

## Entra ID setup (done by a tenant administrator)

1. Microsoft Entra admin center → **App registrations** → **New registration**.
   - Name: `POMON - MTI ICT PO Monitoring`.
   - Supported account types: **Accounts in this organizational directory only** (single tenant).
   - Redirect URI: platform **Web**, value = `M365_REDIRECT_URI`.
2. **Overview** page: copy **Application (client) ID** → `M365_CLIENT_ID`, and **Directory (tenant) ID** → `M365_TENANT_ID`.
3. **Certificates & secrets** → **New client secret** → copy the **Value** once → `M365_CLIENT_SECRET`. Put a calendar reminder before it expires.
4. **Token configuration** → **Add optional claim** → token type **ID** → `email`. Accept the prompt to add the Microsoft Graph `email` permission.
5. **API permissions**: `openid`, `profile`, `email` (Microsoft Graph, delegated). Click **Grant admin consent** so users are not asked to consent.
6. Optional, to limit who can even reach POMON: **Enterprise applications** → POMON → **Properties** → **Assignment required? = Yes**, then assign the allowed users or groups. The POMON access list still applies on top.

## Rollout

1. Deploy the code (feature stays off).
2. Create the app registration and fill the `M365_*` variables in `/root/budget-pulse-watch/backend/.env` on docker59; recreate the backend container.
3. Check `GET /api/auth/microsoft/config` returns `enabled: true`, sign in with an account that is on the access list, then with one that is not (expect the "no access" message).
4. Announce it; keep username/password login available.

Rollback: set `M365_SSO_ENABLED=false` and recreate the backend container.
