import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Building2, CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import '@/styles/merdeka-login.css';

const photographs = ['LOGIN1.jpg', 'bgscm1.jpeg', 'LOGIN3.jpg'];

// Reasons the backend sends back in the URL fragment after Microsoft 365 sign-in.
const SSO_ERRORS: Record<string, string> = {
  no_access: 'Your Microsoft 365 account does not have POMON access yet. Ask your administrator to grant access.',
  cancelled: 'Microsoft sign-in was cancelled.',
  expired: 'Microsoft sign-in took too long. Please try again.',
};
// Microsoft's four-square mark, as used on "Sign in with Microsoft" buttons.
const MicrosoftMark = () => (
  <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const SSO_ERROR_DEFAULT = 'Microsoft sign-in failed. Please try again or use your username and password.';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photograph, setPhotograph] = useState(0);
  const submitting = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login, completeMicrosoftSso, isAuthenticated } = useAuth();
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);
  const showSso = ssoEnabled || ssoBusy;
  // With Microsoft 365 configured, Microsoft is the default; the AD form opens on request.
  const [useAccount, setUseAccount] = useState(false);
  const showChooser = showSso && !useAccount;

  useEffect(() => {
    if (useAccount) usernameRef.current?.focus();
  }, [useAccount]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Sign in | MTI ICT PO Monitoring';
    return () => { document.title = previous; };
  }, []);

  // Microsoft 365: show the button when configured, and finish a sign-in that came back in the fragment.
  useEffect(() => {
    let cancelled = false;
    void authService.isMicrosoftSsoEnabled().then((enabled) => { if (!cancelled) setSsoEnabled(enabled); });
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('sso');
    const ssoError = params.get('sso_error');
    if (code || ssoError) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (ssoError) setError(SSO_ERRORS[ssoError] || SSO_ERROR_DEFAULT);
    if (code) {
      setSsoBusy(true);
      void completeMicrosoftSso(code).then((result) => {
        if (cancelled) return;
        setSsoBusy(false);
        if (result.success) navigate('/');
        else setError(result.message || SSO_ERROR_DEFAULT);
      });
    }
    return () => { cancelled = true; };
  }, [completeMicrosoftSso, navigate]);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const handleInputChange = (field: 'username' | 'password', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const invalid = {
      username: formData.username ? '' : 'Enter your username or email.',
      password: formData.password ? '' : 'Enter your password.'
    };
    setFieldErrors(invalid);
    setError(null);
    if (invalid.username || invalid.password) {
      (invalid.username ? usernameRef : passwordRef).current?.focus();
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = await login(formData.username, formData.password);
      if (result.success) navigate('/');
      else setError(result.message || 'Invalid username or password. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="merdeka-login">
      <div className="merdeka-login-card">
        <section className="merdeka-login-photo" aria-label="Merdeka operations photographs">
          {photographs.map((file, index) => (
            <img key={file} src={`/merdeka/login/${file}`} alt="" className={index === photograph ? 'is-active' : ''} />
          ))}
          <div className="merdeka-login-thumbnails" aria-label="Choose photograph">
            {photographs.map((file, index) => (
              <button key={file} type="button" aria-label={`Show photograph ${index + 1}`} aria-pressed={index === photograph}
                onClick={() => setPhotograph(index)}>
                <img src={`/merdeka/login/${file}`} alt="" />
              </button>
            ))}
          </div>
        </section>
        <section className="merdeka-login-panel" aria-labelledby="login-title">
          <header className="merdeka-login-brand">
            <img src="/merdeka/branding/mbm-logo.svg" alt="Merdeka Battery Materials" width="200" height="55" />
            <img className="merdeka-login-mti-logo" src="/merdeka/branding/mti-corporate.svg" alt="Merdeka Tsingshan Indonesia" width="138" height="30" />
          </header>
          <div className="merdeka-login-form-body">
            <h1 id="login-title">MTI ICT PO Monitoring</h1>
            <p className="merdeka-login-subtitle">Purchase requests &amp; budget monitoring</p>
            <div className="merdeka-login-divider" />
            {showChooser ? (
              <>
                <h2>Sign in</h2>
                <p className="merdeka-login-intro">Choose how you want to sign in.</p>
                {error && (
                  <div className="merdeka-login-feedback merdeka-login-feedback-compact" aria-live="polite" aria-atomic="true">
                    <div role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{error}</span></div>
                  </div>
                )}
                <div className="merdeka-login-choices">
                  <button type="button" className="merdeka-login-sso-button" disabled={ssoBusy}
                    onClick={() => { setSsoBusy(true); setError(null); authService.startMicrosoftSso(); }}>
                    {ssoBusy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <MicrosoftMark />}
                    <span>{ssoBusy ? 'Signing in with Microsoft…' : 'Sign in with Microsoft'}</span>
                  </button>
                  <div className="merdeka-login-or" role="separator"><span>OR</span></div>
                  <button type="button" className="merdeka-login-account-button" disabled={ssoBusy}
                    onClick={() => { setError(null); setUseAccount(true); }}>
                    <Building2 size={18} aria-hidden="true" />
                    <span>Sign in with Corporate Account (AD)</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>{showSso ? 'Corporate Account (AD)' : 'Sign in'}</h2>
                <p className="merdeka-login-intro">Use your corporate username or registered email.</p>
              <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
                <div className="merdeka-login-field">
                  <Label htmlFor="username">Username or email</Label>
                  <Input ref={usernameRef} id="username" name="username" type="text" autoComplete="username"
                    autoCapitalize="none" spellCheck={false} placeholder="Username or email" required
                    value={formData.username} onChange={e => handleInputChange('username', e.target.value)}
                    disabled={isSubmitting} aria-invalid={!!fieldErrors.username}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined} />
                  <span id="username-error" className="merdeka-login-field-error">{fieldErrors.username}</span>
                </div>
                <div className="merdeka-login-field">
                  <Label htmlFor="password">Password</Label>
                  <div className="merdeka-login-password">
                    <Input ref={passwordRef} id="password" name="password" type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password" placeholder="Password" required value={formData.password}
                      onChange={e => handleInputChange('password', e.target.value)} disabled={isSubmitting}
                      aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined} />
                    <button type="button" onClick={() => setShowPassword(value => !value)} disabled={isSubmitting}
                      aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <span id="password-error" className="merdeka-login-field-error">{fieldErrors.password}</span>
                </div>
                <div className="merdeka-login-feedback" aria-live="polite" aria-atomic="true">
                  {error && <div role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{error}</span></div>}
                </div>
                <Button type="submit" className="merdeka-login-submit" disabled={isSubmitting || ssoBusy}>
                  {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
                {showSso && (
                  <button type="button" className="merdeka-login-back" disabled={isSubmitting}
                    onClick={() => { setError(null); setUseAccount(false); }}>
                    <ArrowLeft size={14} aria-hidden="true" /> Back to Microsoft sign-in
                  </button>
                )}
              </>
            )}
            <div className="merdeka-login-guide-link">
              <Dialog>
                <span>Need help signing in? </span>
                <DialogTrigger asChild><button type="button">Access login guide</button></DialogTrigger>
                <DialogContent className="merdeka-login-guide">
                  <DialogHeader>
                    <DialogTitle>Access login guide</DialogTitle>
                    <DialogDescription>MTI ICT PO Monitoring</DialogDescription>
                  </DialogHeader>
                  <div className="merdeka-login-guide-body">
                    <h3>Corporate Account (AD) or local account</h3>
                    <p>Use your internal username or registered corporate email and password. Your account must have LDAP or local access enabled.</p>
                    {ssoEnabled && (<>
                      <h3>Microsoft 365 (recommended)</h3>
                      <p>Choose Sign in with Microsoft to use your office Microsoft 365 account. Your corporate email must be on the POMON access list.</p>
                    </>)}
                    <h3>Unable to sign in?</h3>
                    <p>Check your credentials and try again. If access is still denied or you need a password reset, contact your administrator or document controller.</p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <footer>© {new Date().getFullYear()} PT Merdeka Tsingshan Indonesia</footer>
        </section>
      </div>
    </main>
  );
};

export default Login;
