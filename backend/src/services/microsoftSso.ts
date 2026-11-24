import crypto from 'crypto';

/**
 * Microsoft 365 (Entra ID) single sign-on: OpenID Connect authorization code flow with PKCE.
 * The backend is the confidential client; POMON access still comes from LDAPUserAccess.
 * See docs/m365-sso.md.
 */
export interface MicrosoftSsoConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Must be registered in Entra ID and served over HTTPS (or http://localhost). */
  redirectUri: string;
  /** Frontend login page that receives the result in the URL fragment. */
  postLoginUrl: string;
}

const GUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns null when SSO is disabled or incomplete; the login page then hides the Microsoft button. */
export const loadMicrosoftSsoConfig = (env: NodeJS.ProcessEnv = process.env): MicrosoftSsoConfig | null => {
  if ((env.M365_SSO_ENABLED || '').toLowerCase() !== 'true') return null;
  const config = {
    tenantId: (env.M365_TENANT_ID || '').trim(),
    clientId: (env.M365_CLIENT_ID || '').trim(),
    clientSecret: env.M365_CLIENT_SECRET || '',
    redirectUri: (env.M365_REDIRECT_URI || '').trim(),
    postLoginUrl: (env.M365_POST_LOGIN_URL || '').trim(),
  };
  const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0 || !GUID_RX.test(config.tenantId)) {
    console.warn(`[M365 SSO] Disabled: incomplete configuration (${missing.join(', ') || 'M365_TENANT_ID must be the tenant GUID'})`);
    return null;
  }
  return config;
};

export const randomToken = (): string => crypto.randomBytes(32).toString('base64url');

export const createPkce = (): { verifier: string; challenge: string } => {
  const verifier = randomToken();
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

/** Single-use values with a time limit (pending sign-ins, login handoff codes). In memory: one backend instance. */
export class ExpiringStore<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number, private readonly maxItems = 1000) {}

  put(value: T, now = Date.now()): string {
    for (const [key, item] of this.items) if (item.expiresAt <= now) this.items.delete(key);
    if (this.items.size >= this.maxItems) throw new Error('Too many pending sign-ins');
    const key = randomToken();
    this.items.set(key, { value, expiresAt: now + this.ttlMs });
    return key;
  }

  /** Returns the value once; a second call, or a call after expiry, returns null. */
  take(key: string, now = Date.now()): T | null {
    const item = this.items.get(key);
    this.items.delete(key);
    if (!item || item.expiresAt <= now) return null;
    return item.value;
  }
}

const authority = (config: MicrosoftSsoConfig) => `https://login.microsoftonline.com/${config.tenantId}`;

export const buildAuthorizeUrl = (config: MicrosoftSsoConfig, state: string, nonce: string, challenge: string): string => {
  const url = new URL(`${authority(config)}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
};

export interface IdTokenClaims {
  aud?: string;
  iss?: string;
  tid?: string;
  nonce?: string;
  exp?: number;
  oid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
}

/**
 * The ID token comes straight from the token endpoint over TLS, so its signature is not re-checked
 * (OpenID Connect Core 3.1.3.7); the claims are still checked below.
 */
export const decodeIdToken = (idToken: string): IdTokenClaims => {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as IdTokenClaims;
};

export type ClaimCheck =
  | { ok: true; emails: string[]; name: string | null; oid: string | null }
  | { ok: false; reason: 'audience_mismatch' | 'tenant_mismatch' | 'issuer_mismatch' | 'nonce_mismatch' | 'expired' | 'no_email' };

const EMAIL_RX = /^[^\s@]+@[^\s@]+$/;

/**
 * Checks the ID token belongs to this app, this tenant and this sign-in, and returns the addresses to
 * match against LDAPUserAccess.Email: the `email` claim first, then the sign-in name (UPN), which can differ.
 */
export const checkIdTokenClaims = (
  claims: IdTokenClaims,
  config: MicrosoftSsoConfig,
  expectedNonce: string,
  nowSec = Math.floor(Date.now() / 1000)
): ClaimCheck => {
  if (claims.aud !== config.clientId) return { ok: false, reason: 'audience_mismatch' };
  if ((claims.tid || '').toLowerCase() !== config.tenantId.toLowerCase()) return { ok: false, reason: 'tenant_mismatch' };
  if ((claims.iss || '').toLowerCase() !== `${authority(config)}/v2.0`.toLowerCase()) return { ok: false, reason: 'issuer_mismatch' };
  if (!claims.nonce || claims.nonce !== expectedNonce) return { ok: false, reason: 'nonce_mismatch' };
  if (!claims.exp || claims.exp < nowSec - 300) return { ok: false, reason: 'expired' };
  const emails = [...new Set([claims.email, claims.preferred_username, claims.upn]
    .map((v) => (v || '').trim().toLowerCase())
    .filter((v) => EMAIL_RX.test(v)))];
  if (emails.length === 0) return { ok: false, reason: 'no_email' };
  return { ok: true, emails, name: claims.name ?? null, oid: claims.oid ?? null };
};

/** Redeems the authorization code; returns the ID token. Errors never include the client secret. */
export const redeemCode = async (config: MicrosoftSsoConfig, code: string, verifier: string): Promise<string> => {
  const response = await fetch(`${authority(config)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
      scope: 'openid profile email',
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!response.ok || !body.id_token) throw new Error(`Token endpoint returned ${response.status} ${body.error || ''}`.trim());
  return body.id_token;
};

/** Sends the browser back to the POMON login page; values go in the fragment so they never reach server logs. */
export const loginRedirect = (config: MicrosoftSsoConfig, params: Record<string, string>): string =>
  `${config.postLoginUrl}#${new URLSearchParams(params).toString()}`;
