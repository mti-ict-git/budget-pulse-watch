// Offline tests for Microsoft 365 sign-in helpers (no network, no database).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sso = require('../dist/services/microsoftSso');

const TENANT = '11111111-2222-3333-4444-555555555555';
const env = {
  M365_SSO_ENABLED: 'true',
  M365_TENANT_ID: TENANT,
  M365_CLIENT_ID: 'client-123',
  M365_CLIENT_SECRET: 'secret',
  M365_REDIRECT_URI: 'https://pomon.example.test/api/auth/microsoft/callback',
  M365_POST_LOGIN_URL: 'https://pomon.example.test/login'
};
const config = sso.loadMicrosoftSsoConfig(env);
const NOW = 1_800_000_000;
const claims = (over = {}) => ({
  aud: 'client-123',
  tid: TENANT,
  iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
  nonce: 'n-1',
  exp: NOW + 3600,
  email: 'Budi.Santoso@Example.com',
  preferred_username: 'budi@corp.example.com',
  ...over
});

test('config: disabled unless enabled and complete; tenant must be a GUID', () => {
  assert.ok(config);
  assert.equal(sso.loadMicrosoftSsoConfig({ ...env, M365_SSO_ENABLED: 'false' }), null);
  assert.equal(sso.loadMicrosoftSsoConfig({ ...env, M365_CLIENT_SECRET: '' }), null);
  assert.equal(sso.loadMicrosoftSsoConfig({ ...env, M365_TENANT_ID: 'example.com' }), null);
});

test('config: MS_GRAPH_* / MS_SSO_REDIRECT_URI / APP_URL names work and are on when complete', () => {
  const c = sso.loadMicrosoftSsoConfig({
    MS_GRAPH_TENANT_ID: TENANT,
    MS_GRAPH_CLIENT_ID: 'client-456',
    MS_GRAPH_CLIENT_SECRET: 'secret',
    MS_SSO_REDIRECT_URI: 'https://pomon.example.test/auth/microsoft/callback',
    APP_URL: 'https://pomon.example.test/'
  });
  assert.deepEqual(c, {
    tenantId: TENANT,
    clientId: 'client-456',
    clientSecret: 'secret',
    redirectUri: 'https://pomon.example.test/auth/microsoft/callback',
    postLoginUrl: 'https://pomon.example.test/login'
  });
  assert.equal(sso.loadMicrosoftSsoConfig({ MS_GRAPH_TENANT_ID: TENANT, M365_SSO_ENABLED: 'false', MS_GRAPH_CLIENT_ID: 'a', MS_GRAPH_CLIENT_SECRET: 'b', MS_SSO_REDIRECT_URI: 'https://x', APP_URL: 'https://x' }), null);
  assert.equal(sso.loadMicrosoftSsoConfig({}), null);
  // M365_* wins over MS_GRAPH_* when both are set.
  assert.equal(sso.loadMicrosoftSsoConfig({ ...env, MS_GRAPH_CLIENT_ID: 'other' }).clientId, 'client-123');
});

test('PKCE challenge is the S256 hash of the verifier', () => {
  const { verifier, challenge } = sso.createPkce();
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
});

test('authorize URL carries state, nonce, PKCE and the registered redirect URI', () => {
  const url = new URL(sso.buildAuthorizeUrl(config, 'st', 'nn', 'ch'));
  assert.equal(url.origin + url.pathname, `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  const p = url.searchParams;
  assert.equal(p.get('state'), 'st');
  assert.equal(p.get('nonce'), 'nn');
  assert.equal(p.get('code_challenge'), 'ch');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.equal(p.get('redirect_uri'), env.M365_REDIRECT_URI);
  assert.equal(p.get('response_type'), 'code');
});

test('valid claims give the email first, then the sign-in name, lower-cased', () => {
  const r = sso.checkIdTokenClaims(claims(), config, 'n-1', NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.emails, ['budi.santoso@example.com', 'budi@corp.example.com']);
});

test('claims from another app, tenant, issuer, sign-in or time are rejected', () => {
  const cases = [
    [{ aud: 'other' }, 'audience_mismatch'],
    [{ tid: '99999999-2222-3333-4444-555555555555' }, 'tenant_mismatch'],
    [{ iss: 'https://login.microsoftonline.com/common/v2.0' }, 'issuer_mismatch'],
    [{ nonce: 'n-2' }, 'nonce_mismatch'],
    [{ exp: NOW - 3600 }, 'expired'],
    [{ email: undefined, preferred_username: 'not-an-email' }, 'no_email']
  ];
  for (const [over, reason] of cases) {
    assert.deepEqual(sso.checkIdTokenClaims(claims(over), config, 'n-1', NOW), { ok: false, reason });
  }
});

test('decodeIdToken reads the payload and rejects malformed tokens', () => {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(sso.decodeIdToken(`${part({ alg: 'RS256' })}.${part({ tid: TENANT })}.sig`).tid, TENANT);
  assert.throws(() => sso.decodeIdToken('abc'));
});

test('ExpiringStore values are single-use and expire', () => {
  const store = new sso.ExpiringStore(1000, 2);
  const a = store.put('A', 0);
  assert.equal(store.take(a, 10), 'A');
  assert.equal(store.take(a, 10), null);
  const b = store.put('B', 0);
  assert.equal(store.take(b, 1000), null);
  store.put('C', 0);
  store.put('D', 0);
  assert.throws(() => store.put('E', 0));
  assert.doesNotThrow(() => store.put('F', 5000)); // expired entries are swept first
});

test('login redirect puts the result in the fragment', () => {
  assert.equal(sso.loginRedirect(config, { sso_error: 'no_access' }), 'https://pomon.example.test/login#sso_error=no_access');
});
