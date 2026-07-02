import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormData {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(formData.username, formData.password);

      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Background image (blurred) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/bgscm1.jpeg')] bg-cover bg-center blur-lg scale-110 transform-gpu"
      />
      {/* Vignette + glass tint */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,rgba(2,6,23,0.32)_0%,rgba(2,6,23,0.44)_100%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 lg:px-8">
        {/* Solid container (no glass) */}
        <div className="grid w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_28px_90px_-36px_rgba(2,6,23,0.55)] md:grid-cols-[1.1fr_0.9fr]">
          <section className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-[linear-gradient(155deg,rgba(59,130,246,0.56)_0%,rgba(37,99,235,0.46)_42%,rgba(15,23,42,0.92)_100%)] p-10 text-primary-foreground md:flex lg:p-12">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.58)_100%)]"
            />
            <div className="relative space-y-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-[0.14em] text-white/90 uppercase">
                <ShieldCheck className="h-3.5 w-3.5" />
                Internal System
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20 backdrop-blur">
                    <img
                      src="/MTI-removebg-preview.png"
                      alt="MTI Logo"
                      className="h-10 w-auto"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/70">
                      PT Merdeka Tsingshan Indonesia
                    </p>
                    <p className="text-sm text-white/80">Procurement governance workspace</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
                    Procurement monitoring with better visibility and tighter control.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-white/78">
                    Track PRFs, budget utilization, approval progress, and procurement documents in one consistent internal workspace for operations and document control.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Visibility</p>
                  <p className="mt-3 text-2xl font-semibold">PRF</p>
                  <p className="mt-2 text-sm text-white/72">Track status, document flow, and activity audit.</p>
                </div>
                <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Control</p>
                  <p className="mt-3 text-2xl font-semibold">Budget</p>
                  <p className="mt-2 text-sm text-white/72">Utilization, fiscal-year cutoff, and OPEX alignment.</p>
                </div>
                <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Assurance</p>
                  <p className="mt-3 text-2xl font-semibold">Audit</p>
                  <p className="mt-2 text-sm text-white/72">Role-based access, notifications, and change trace.</p>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-between rounded-2xl border border-white/14 bg-white/10 px-5 py-4 text-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-400/20 p-2">
                  <LockKeyhole className="h-4 w-4 text-emerald-200" />
                </div>
                <div>
                  <p className="font-medium text-white">Authorized corporate access only</p>
                  <p className="text-white/70">Use an account with LDAP or local access enabled.</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/70" />
            </div>
          </section>

          <section className="flex min-h-[720px] items-center bg-card px-4 py-8 sm:px-8 lg:px-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 md:hidden">
                <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                  <img
                    src="/MTI-removebg-preview.png"
                    alt="MTI Logo"
                    className="h-9 w-auto"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">MTI ICT PO Monitoring</p>
                  <p className="text-xs text-muted-foreground">Internal procurement workspace</p>
                </div>
              </div>

              <div className="mb-8 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Corporate Access
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                    Sign in to the monitoring workspace
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Use your corporate username or email to access procurement and budget monitoring.
                  </p>
                </div>
              </div>

              <Card className="border-border bg-card shadow-[0_16px_44px_-26px_rgba(2,6,23,0.25)]">
                <CardHeader className="space-y-1 pb-5">
                  <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
                  <CardDescription>
                    Make sure your credentials belong to an account authorized to access this system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 text-destructive">
                        <CircleAlert className="h-4 w-4" />
                        <AlertTitle>Sign-in failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="username">Username or email</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="username"
                          type="text"
                          placeholder="e.g. john.doe or john.doe@merdekabattery.com"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          required
                          disabled={isSubmitting}
                          autoComplete="username"
                          className="h-11 rounded-xl border-border/80 bg-background pl-10 shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <span className="text-xs text-muted-foreground">Authorized users only</span>
                      </div>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          required
                          disabled={isSubmitting}
                          autoComplete="current-password"
                          className="h-11 rounded-xl border-border/80 bg-background pl-10 pr-11 shadow-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={togglePasswordVisibility}
                          disabled={isSubmitting}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl text-sm font-medium shadow-sm"
                      disabled={isSubmitting || !formData.username || !formData.password}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying access...
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="rounded-2xl border border-border/80 bg-muted/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Access guidance</p>
                        <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
                          <li>Use your internal username or registered corporate email.</li>
                          <li>Access can be granted via LDAP or a local account, depending on your user setup.</li>
                          <li>If access is denied, contact the administrator or document controller.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>© 2025 MTI ICT PO Monitoring</p>
                <p>Secure internal access for authorized personnel</p>
              </div>
            </div>
          </section>
          </div>
        </div>
    </div>
  );
};

export default Login;
