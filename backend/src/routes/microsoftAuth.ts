import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { LDAPUserAccessModel, LDAPUserAccess } from '../models/LDAPUserAccess';
import { issueLdapSession, LdapSession } from '../services/authSession';
import {
  ExpiringStore,
  buildAuthorizeUrl,
  checkIdTokenClaims,
  createPkce,
  decodeIdToken,
  loadMicrosoftSsoConfig,
  loginRedirect,
  randomToken,
  redeemCode,
} from '../services/microsoftSso';

/** Microsoft 365 sign-in (docs/m365-sso.md). Mounted at /api/auth/microsoft. */
const router = express.Router();

const pendingSignIns = new ExpiringStore<{ verifier: string; nonce: string }>(10 * 60 * 1000);
const handoffs = new ExpiringStore<LdapSession>(2 * 60 * 1000);

const notEnabled = (res: express.Response) =>
  res.status(404).json({ success: false, message: 'Microsoft 365 sign-in is not enabled' });

/** @route GET /api/auth/microsoft/config - whether the login page shows the Microsoft button. */
router.get('/config', (_req, res) => {
  res.json({ success: true, data: { enabled: loadMicrosoftSsoConfig() !== null } });
});

/** @route GET /api/auth/microsoft/login - redirects the browser to the Microsoft sign-in page. */
router.get('/login', (_req, res) => {
  const config = loadMicrosoftSsoConfig();
  if (!config) return notEnabled(res);
  const { verifier, challenge } = createPkce();
  const nonce = randomToken();
  let state: string;
  try {
    state = pendingSignIns.put({ verifier, nonce });
  } catch {
    return res.status(503).json({ success: false, message: 'Too many sign-ins in progress. Please try again shortly.' });
  }
  return res.redirect(302, buildAuthorizeUrl(config, state, nonce, challenge));
});

/** @route GET /api/auth/microsoft/callback - Entra ID redirect URI. Ends on the POMON login page. */
router.get('/callback', asyncHandler(async (req, res) => {
  const config = loadMicrosoftSsoConfig();
  if (!config) return notEnabled(res);
  const fail = (code: string) => res.redirect(302, loginRedirect(config, { sso_error: code }));

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const flow = state ? pendingSignIns.take(state) : null;
  if (!flow) return fail('expired');
  if (typeof req.query.error === 'string') {
    console.warn(`[M365 SSO] Microsoft returned ${req.query.error}`);
    return fail(req.query.error === 'access_denied' ? 'cancelled' : 'microsoft_error');
  }
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code) return fail('microsoft_error');

  let check;
  try {
    check = checkIdTokenClaims(decodeIdToken(await redeemCode(config, code, flow.verifier)), config, flow.nonce);
  } catch (error) {
    console.error('[M365 SSO] Code redemption failed:', error instanceof Error ? error.message : error);
    return fail('microsoft_error');
  }
  if (!check.ok) {
    console.warn(`[M365 SSO] ID token rejected: ${check.reason}`);
    return fail('invalid_token');
  }

  let access: LDAPUserAccess | null = null;
  for (const email of check.emails) {
    access = await LDAPUserAccessModel.hasAccessByEmail(email);
    if (access) break;
  }
  if (!access) {
    console.warn(`[M365 SSO] No POMON access for ${check.emails.join(' / ')}`);
    return fail('no_access');
  }

  await LDAPUserAccessModel.updateLastLogin(access.Username);
  console.log(`[M365 SSO] ${access.Username} signed in with Microsoft 365`);
  return res.redirect(302, loginRedirect(config, { sso: handoffs.put(issueLdapSession(access)) }));
}));

/** @route POST /api/auth/microsoft/exchange - trades the one-time handoff code for the POMON session. */
router.post('/exchange', (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const session = code ? handoffs.take(code) : null;
  if (!session) {
    return res.status(400).json({ success: false, message: 'This sign-in link has expired. Please sign in again.' });
  }
  return res.json({ success: true, ...session });
});

export default router;
