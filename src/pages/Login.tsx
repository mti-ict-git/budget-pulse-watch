import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/merdeka-login.css';

const photographs = ['LOGIN1.jpg', 'bgscm1.jpeg', 'LOGIN3.jpg'];

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
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Sign in | MTI ICT PO Monitoring';
    return () => { document.title = previous; };
  }, []);

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
            <h2>Sign in</h2>
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
              <Button type="submit" className="merdeka-login-submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
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
                    <h3>Corporate or local account</h3>
                    <p>Use your internal username or registered corporate email and password. Your account must have LDAP or local access enabled.</p>
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
