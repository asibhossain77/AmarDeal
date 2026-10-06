'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { MidmanLogo } from '@/components/shared/midman-logo'
import { useState, useSyncExternalStore, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Mail,
  ShieldCheck,
  CheckCircle2,
  MailCheck,
  XCircle,
  ShieldAlert,
  AlertCircle,
  UserCheck,
  LifeBuoy,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeNextParam } from '@/lib/bridge-origins';

const emptySubscribe = () => () => {};

/**
 * Design tokens — Midman auth surface.
 * Minimal, premium fintech: white/card surfaces, soft borders, Midman green
 * accent, 48px touch targets, left-aligned fields, no decorative effects.
 */
const inputClass =
  'h-11 rounded-xl text-left text-[15px] shadow-none placeholder:text-muted-foreground/70';

const primaryCtaClass =
  'w-full h-12 rounded-xl text-[15px] font-semibold shadow-sm gap-2';

/** Subtle mode transition (fade + 8px slide, 200ms) — nothing flashier. */
const modeTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

/** Accessible inline error message */
function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      role="alert"
      className="flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </motion.p>
  );
}

/** Password visibility toggle — accessible icon button */
function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
      aria-pressed={show}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/** Field label row — label left, optional trailing action (e.g. forgot link) */
function FieldLabel({ htmlFor, children, trailing }: { htmlFor: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{children}</Label>
      {trailing}
    </div>
  );
}

/** Shared helper to get t() without prop-drilling */
function useT() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return t;
}

/**
 * Validated post-login redirect target from ?next= (used by the SSO bridge
 * for verify.midman.bd). Only allowlisted bridge origins or same-origin
 * relative paths survive sanitisation (open-redirect guard) — normal logins
 * without ?next= behave exactly as before.
 */
function getLoginNextTarget(): string | null {
  if (typeof window === 'undefined') return null;
  return sanitizeNextParam(new URLSearchParams(window.location.search).get('next'));
}

/* ═══════════════════════════════════════════════════════════════
   OTP Input Component (shared)
   ═══════════════════════════════════════════════════════════════ */
function OtpStep({
  email,
  otp,
  setOtp,
  onVerify,
  onResend,
  resendTimer,
  loading,
  error,
}: {
  email: string;
  otp: string;
  setOtp: (v: string) => void;
  onVerify: () => void;
  onResend: () => void;
  resendTimer: number;
  loading: boolean;
  error: string;
}) {
  const t = useT();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="otp-code" className="text-sm font-medium text-foreground">{t('auth.verificationCode')}</Label>
        <Input
          id="otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder={t('auth.codePlaceholder')}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && onVerify()}
          className={`${inputClass} text-center text-lg font-bold tracking-[0.35em]`}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {t('auth.codeSentTo')} <span className="font-semibold text-foreground">{email}</span>
        </p>
      </div>
      <FormError message={error} />
      <div className="text-center">
        <button
          type="button"
          onClick={onResend}
          disabled={resendTimer > 0 || loading}
          className="text-sm font-medium text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resendTimer > 0 ? t('auth.resendWithTimer', { timer: String(resendTimer) }) : t('auth.resend')}
        </button>
      </div>
      <Button
        type="button"
        onClick={onVerify}
        disabled={loading || otp.length !== 6}
        className={primaryCtaClass}
      >
        {loading ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
        {t('auth.verifyCode')}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Forgot Password Form (3-step: email → OTP → new password)
   ═══════════════════════════════════════════════════════════════ */
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  /* ── Live email check state ── */
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'found' | 'not-found' | 'unverified' | 'error'>('idle');

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  /* Debounced live email check */
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (step !== 1) return;
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (data.exists && !data.emailVerified) {
          setEmailStatus('unverified');
        } else if (data.exists) {
          setEmailStatus('found');
        } else {
          setEmailStatus('not-found');
        }
      } catch {
        setEmailStatus('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email, step]);

  const handleSendOtp = useCallback(async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) { setError(t('auth.validEmail')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.problem')); return; }
      toast.success(t('auth.codeSentEmail'));
      setStep(2); setResendTimer(60);
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [email, t]);

  const handleVerifyOtp = useCallback(async () => {
    setError('');
    if (otp.length !== 6) { setError(t('auth.give6DigitCode')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.problem'));
        if (data.blocked) setTimeout(() => { setStep(1); setOtp(''); setResendTimer(0); setError(''); }, 2000);
        return;
      }
      setStep(3); setError('');
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [email, otp, t]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      toast.success(t('auth.newCodeSent'));
      setResendTimer(60);
    } catch { setError(t('auth.tryAgain')); }
    finally { setLoading(false); }
  }, [email, resendTimer, t]);

  const handleReset = useCallback(async () => {
    setError('');
    if (otp.length !== 6) { setError(t('auth.give6DigitCode')); return; }
    if (newPassword.length < 6) { setError(t('auth.passwordMin6')); return; }
    if (newPassword !== confirmPassword) { setError(t('auth.passwordMismatch')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.problem')); return; }
      toast.success(t('auth.passwordChanged'));
      onBack();
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [email, otp, newPassword, confirmPassword, onBack, t]);

  const stepLabels = [t('auth.step.email'), t('auth.step.verification'), t('auth.step.newPassword')];

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <ol className="flex items-center justify-center gap-1.5" aria-label={t('auth.passwordResetTitle')}>
        {stepLabels.map((label, i) => {
          const s = (i + 1) as 1 | 2 | 3;
          const isActive = s === step;
          const isDone = s < step;
          return (
            <li key={label} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-5 bg-border" aria-hidden />}
              <span
                aria-current={isActive ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-semibold text-primary'
                    : isDone
                      ? 'font-medium text-primary'
                      : 'text-muted-foreground/70'
                }`}
              >
                <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isDone ? <ShieldCheck className="h-3 w-3" aria-hidden /> : s}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="fp-s1" {...modeTransition} className="space-y-4">
            <FieldLabel htmlFor="fp-email">{t('auth.giveEmail')}</FieldLabel>
            <div className="relative">
              <Input
                id="fp-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                className={`${inputClass} pr-10`}
              />
              {emailStatus === 'checking' && <LoadingAnimation size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
              {emailStatus === 'found' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />}
              {emailStatus === 'not-found' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-hidden />}
              {emailStatus === 'unverified' && <MailCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" aria-hidden />}
            </div>
            {/* Live email status hint */}
            {emailStatus === 'found' && (
              <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" role="status">
                <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                {t('auth.accountFound')}
              </p>
            )}
            {emailStatus === 'not-found' && (
              <p className="flex items-center gap-1 text-xs text-destructive" role="status">
                <XCircle className="h-3 w-3 shrink-0" aria-hidden />
                {t('auth.noAccount')}
              </p>
            )}
            {emailStatus === 'unverified' && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" role="status">
                <MailCheck className="h-3 w-3 shrink-0" aria-hidden />
                {t('auth.unverifiedAccount')}
              </p>
            )}
            {emailStatus === 'idle' && (
              <p className="text-xs text-muted-foreground" role="status">{t('auth.registrationEmailHint')}</p>
            )}
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="fp-s2" {...modeTransition}>
            <OtpStep email={email} otp={otp} setOtp={setOtp} onVerify={handleVerifyOtp} onResend={handleResend} resendTimer={resendTimer} loading={loading} error={error} />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="fp-s3" {...modeTransition} className="space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="fp-newpass">{t('auth.newPassword')}</FieldLabel>
              <div className="relative">
                <Input
                  id="fp-newpass"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('auth.min6Placeholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
                <PasswordToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="fp-confirm">{t('auth.confirmPassword')}</FieldLabel>
              <Input
                id="fp-confirm"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('auth.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                className={inputClass}
              />
            </div>
            <FormError message={error} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step navigation — Previous (steps 2-3 only) + primary action */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { setStep((s) => (s - 1) as 1 | 2); setError(''); }}
            className="h-12 rounded-xl gap-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />{t('auth.previous')}
          </Button>
        )}
        {step === 1 && (
          <Button type="button" onClick={handleSendOtp} disabled={loading || emailStatus === 'not-found' || emailStatus === 'unverified'} className={`flex-1 ${primaryCtaClass}`}>
            {loading ? <LoadingAnimation size="sm" /> : <Mail className="h-5 w-5" aria-hidden />}
            {t('auth.sendCode')}
          </Button>
        )}
        {step === 3 && (
          <Button type="button" onClick={handleReset} disabled={loading} className={`flex-1 ${primaryCtaClass}`}>
            {loading ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
            {t('auth.resetPassword')}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Email Verification Form (after registration or login block)
   ═══════════════════════════════════════════════════════════════ */
function EmailVerifyForm({
  userId,
  email,
  userName,
  onVerified,
}: {
  userId: string;
  email: string;
  userName: string;
  onVerified: () => void;
}) {
  const t = useT();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleVerify = useCallback(async () => {
    setError('');
    if (otp.length !== 6) { setError(t('auth.give6DigitCode')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.problem'));
        if (data.blocked) setTimeout(() => { setOtp(''); setResendTimer(0); setError(''); }, 2000);
        return;
      }
      setVerified(true);
      toast.success(t('auth.emailVerified'));
      setTimeout(onVerified, 1500);
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [userId, otp, onVerified, t]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.alreadyVerified) { onVerified(); return; }
      if (!res.ok) { setError(data.error || t('auth.problem')); return; }
      toast.success(t('auth.newCodeSent'));
      setResendTimer(60); setError('');
    } catch { setError(t('auth.problem')); }
    finally { setLoading(false); }
  }, [userId, resendTimer, onVerified, t]);

  if (verified) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" aria-hidden />
        </div>
        <h3 className="text-lg font-bold text-foreground">{t('auth.verificationSuccess')}</h3>
        <p className="text-sm text-muted-foreground">{t('auth.verificationSuccessDesc')}</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{userName}</span>, {t('auth.verifyEmailFor')}
        </p>
      </div>

      <OtpStep email={email} otp={otp} setOtp={setOtp} onVerify={handleVerify} onResend={handleResend} resendTimer={resendTimer} loading={loading} error={error} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Manual Login Form (email/phone + password + 2FA)
   ═══════════════════════════════════════════════════════════════ */
function ManualLoginForm({
  onForgotPassword,
  onNeedsVerification,
}: {
  onForgotPassword: () => void;
  onNeedsVerification: (userId: string, email: string, userName: string) => void;
}) {
  const t = useT();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAppStore((s) => s.setUser);

  // 2FA state
  const [pending2FA, setPending2FA] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState('');

  const handleLogin = useCallback(async () => {
    setError('');
    if (!identifier.trim() || !password.trim()) { setError(t('auth.fillAllFields')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) {
          onNeedsVerification(data.userId, data.email, identifier.trim());
          return;
        }
        setError(data.error || t('auth.loginFailed'));
        return;
      }
      // Check if 2FA required
      if (data.requires2FA) {
        setPending2FA({ userId: data.userId, name: data.name, email: data.email });
        return;
      }
      toast.success(t('auth.loginSuccess'));
      setUser(data, { isLogin: true });
      const nextTarget = getLoginNextTarget();
      if (nextTarget) { window.location.href = nextTarget; return; } // SSO bridge return
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [identifier, password, setUser, onNeedsVerification, t]);

  // 2FA verification handler
  const handle2FAVerify = useCallback(async () => {
    if (!pending2FA || totpCode.length !== 6) {
      setTotpError(t('auth.give6DigitCode'));
      return;
    }
    setTotpLoading(true);
    setTotpError('');
    try {
      const res = await fetch('/api/admin/2fa/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pending2FA.userId, code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || t('auth.wrongCode'));
        setTotpLoading(false);
        return;
      }
      toast.success(t('auth.loginSuccess'));
      setUser(data, { isLogin: true });
      const nextTarget2FA = getLoginNextTarget();
      if (nextTarget2FA) { window.location.href = nextTarget2FA; return; } // SSO bridge return
      setPending2FA(null);
      setTotpCode('');
    } catch {
      setTotpError(t('auth.serverProblem'));
    } finally {
      setTotpLoading(false);
    }
  }, [pending2FA, totpCode, setUser, t]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FieldLabel htmlFor="login-id">{t('auth.emailOrPhone')}</FieldLabel>
        <Input
          id="login-id"
          type="text"
          autoComplete="username"
          placeholder={t('auth.emailOrPhonePlaceholder')}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel
          htmlFor="login-pass"
          trailing={
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-medium text-primary transition-colors hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          }
        >
          {t('auth.password')}
        </FieldLabel>
        <div className="relative">
          <Input
            id="login-pass"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('auth.enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className={`${inputClass} pr-11`}
          />
          <PasswordToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
        </div>
      </div>
      <FormError message={error} />

      {pending2FA ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="space-y-2 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ShieldAlert className="h-6 w-6 text-primary" aria-hidden />
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground">{t('auth.twoFactor')}</h3>
            <p className="text-xs text-muted-foreground">{pending2FA.name} ({pending2FA.email})</p>
            <p className="text-xs text-muted-foreground">{t('auth.twoFactorDesc')}</p>
          </div>

          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={t('auth.twoFactor')}
            placeholder="0 0 0 0 0 0"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handle2FAVerify()}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            maxLength={6}
            autoFocus
          />

          <FormError message={totpError} />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPending2FA(null); setTotpCode(''); setTotpError(''); }}
              className="h-11 flex-1"
            >
              {t('auth.goBack')}
            </Button>
            <Button type="button" onClick={handle2FAVerify} disabled={totpCode.length !== 6 || totpLoading} className="h-11 flex-1 gap-2">
              {totpLoading ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
              {t('auth.verifyCode')}
            </Button>
          </div>
        </motion.div>
      ) : (
        <Button type="button" onClick={handleLogin} disabled={loading} className={primaryCtaClass}>
          {loading ? <LoadingAnimation size="sm" /> : <LogIn className="h-5 w-5" aria-hidden />}
          {t('auth.loginButton')}
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Manual Registration Form
   ═══════════════════════════════════════════════════════════════ */
function ManualRegisterForm({ onNeedsVerification }: { onNeedsVerification: (userId: string, email: string, userName: string) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = useCallback(async () => {
    setError('');
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !confirmPass.trim()) { setError(t('auth.fillAllFields')); return; }
    if (password !== confirmPass) { setError(t('auth.passwordMismatch')); return; }
    if (password.length < 6) { setError(t('auth.passwordMin6')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.registerFailed')); return; }
      if (data.needsVerification) {
        toast.success(t('auth.accountCreatedVerify'));
        onNeedsVerification(data.id, data.email, data.name);
        return;
      }
      toast.success(t('auth.accountCreated'));
    } catch { setError(t('auth.serverProblem')); }
    finally { setLoading(false); }
  }, [name, phone, email, password, confirmPass, onNeedsVerification, t]);

  const fields = [
    { label: t('auth.fullName'), id: 'reg-name', type: 'text', autoComplete: 'name', placeholder: t('auth.fullNamePlaceholder'), value: name, setter: setName },
    { label: t('auth.phone'), id: 'reg-phone', type: 'tel', autoComplete: 'tel', placeholder: t('auth.phonePlaceholder'), value: phone, setter: setPhone },
    { label: t('auth.email'), id: 'reg-email', type: 'email', autoComplete: 'email', placeholder: t('auth.emailPlaceholder'), value: email, setter: setEmail },
  ];

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.id} className="space-y-2">
          <FieldLabel htmlFor={f.id}>{f.label}</FieldLabel>
          <Input
            id={f.id}
            type={f.type}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            value={f.value}
            onChange={(e) => f.setter(e.target.value)}
            className={inputClass}
          />
        </div>
      ))}
      <div className="space-y-2">
        <FieldLabel htmlFor="reg-pass">{t('auth.password')}</FieldLabel>
        <div className="relative">
          <Input
            id="reg-pass"
            type={showPass ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-11`}
          />
          <PasswordToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="reg-confirm">{t('auth.confirmPassword')}</FieldLabel>
        <Input
          id="reg-confirm"
          type={showPass ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder={t('auth.confirmPasswordPlaceholder')}
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
          className={inputClass}
        />
      </div>
      <FormError message={error} />
      <Button type="button" onClick={handleRegister} disabled={loading} className={primaryCtaClass}>
        {loading ? <LoadingAnimation size="sm" /> : <UserPlus className="h-5 w-5" aria-hidden />}
        {t('auth.createAccount')}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Email Magic Link Step
   ═══════════════════════════════════════════════════════════════ */
function EmailMagicLinkStep({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = useCallback(async () => {
    setError('');
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError(t('auth.validEmail'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.serverProblem'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('auth.serverProblem'));
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
          <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{t('auth.loginLinkSent')}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('auth.loginLinkSentDesc')}</p>
          <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">{email}</span></p>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="h-11 rounded-xl gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />{t('auth.back')}
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h3 className="text-base font-bold text-foreground">{t('auth.emailLoginTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('auth.emailLoginDesc')}</p>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="magic-email">{t('auth.email')}</FieldLabel>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className={inputClass}
          autoFocus
        />
      </div>
      <FormError message={error} />
      <Button type="button" onClick={handleSend} disabled={loading || !email.trim()} className={primaryCtaClass}>
        {loading ? <LoadingAnimation size="sm" /> : <Mail className="h-5 w-5" aria-hidden />}
        {t('auth.sendLoginLink')}
      </Button>
      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('auth.backToLogin')}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Complete Profile Form (after magic link for new users)
   ═══════════════════════════════════════════════════════════════ */
function CompleteProfileForm({ userId, onSuccess }: { userId: string; onSuccess: (user: any) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (phone.trim().length < 11) {
      setError('সঠিক ফোন নম্বর দিন (কমপক্ষে ১১ ডিজিট)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.serverProblem'));
        return;
      }
      toast.success(t('auth.loginSuccess'));
      onSuccess(data.user);
    } catch {
      setError(t('auth.serverProblem'));
    } finally {
      setLoading(false);
    }
  }, [userId, name, phone, onSuccess, t]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <User className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h3 className="text-base font-bold text-foreground">{t('auth.completeProfile')}</h3>
        <p className="text-xs text-muted-foreground">{t('auth.completeProfileDesc')}</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <FieldLabel htmlFor="cp-name">{t('auth.fullName')}</FieldLabel>
          <Input
            id="cp-name"
            type="text"
            autoComplete="name"
            placeholder={t('auth.fullNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="cp-phone">{t('auth.phone')}</FieldLabel>
          <Input
            id="cp-phone"
            type="tel"
            autoComplete="tel"
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={inputClass}
          />
        </div>
      </div>
      <FormError message={error} />
      <Button type="button" onClick={handleSubmit} disabled={loading || !name.trim() || !phone.trim()} className={primaryCtaClass}>
        {loading ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
        {t('auth.completeAndLogin')}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Auth View (exported) — Midman authentication surface
   ═══════════════════════════════════════════════════════════════ */
type AuthMode = 'login' | 'register' | 'forgot' | 'verify' | 'email-login' | 'complete-profile';

/** Official Google "G" mark */
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z' fill='#4285F4'/>
      <path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853'/>
      <path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' fill='#FBBC05'/>
      <path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335'/>
    </svg>
  );
}

/** Divider with centered label */
function OrDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

export function AuthView() {
  const setView = useAppStore((s) => s.setView);
  const setUser = useAppStore((s) => s.setUser);
  const { siteName } = useSiteSettings();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();
  const [mode, setMode] = useState<AuthMode>('login');
  const [verifyInfo, setVerifyInfo] = useState({ userId: '', email: '', userName: '' });
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [magicUserId, setMagicUserId] = useState<string | null>(null);

  // Check Google OAuth status
  useEffect(() => {
    fetch('/api/auth/google-status')
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  // Handle magic link callback from sessionStorage (set by app-shell)
  useEffect(() => {
    const magicUid = sessionStorage.getItem('magic_uid');
    if (magicUid) {
      sessionStorage.removeItem('magic_uid');
      setTimeout(() => {
        setMagicUserId(magicUid);
        setMode('complete-profile');
      }, 0);
    }
  }, []);

  if (!mounted) return null;

  const goVerify = (userId: string, email: string, userName: string) => {
    setVerifyInfo({ userId, email, userName });
    setMode('verify');
  };

  const getBackLabel = () => {
    if (mode === 'forgot') return t('auth.backToLogin');
    if (mode === 'verify' || mode === 'email-login') return t('auth.back');
    if (mode === 'complete-profile') return t('auth.backToHomepage');
    return t('auth.backToHomepage');
  };

  const handleBack = () => {
    if (mode === 'forgot' || mode === 'verify' || mode === 'email-login') setMode('login');
    else setView('landing');
  };

  const handleCompleteProfile = (user: any) => {
    setUser(user, { isLogin: true });
  };

  /* Left brand panel — trust messaging (desktop only) */
  const trustPoints = [
    { icon: ShieldCheck, title: t('auth.trust.secure'), desc: t('auth.trust.secureDesc') },
    { icon: UserCheck, title: t('auth.trust.protection'), desc: t('auth.trust.protectionDesc') },
    { icon: LifeBuoy, title: t('auth.trust.support'), desc: t('auth.trust.supportDesc') },
  ];

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl">
        {/* Back link */}
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {getBackLabel()}
        </button>

        {/* Card shell — single column on mobile, brand panel + form on desktop */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl shadow-black/[0.04] dark:border-zinc-800/60 dark:shadow-none lg:grid lg:grid-cols-[1fr_1.1fr]">
          {/* ── Brand / trust panel (desktop) ── */}
          <aside
            aria-hidden={false}
            className="hidden flex-col justify-between border-r border-border/40 bg-secondary/40 p-10 dark:bg-secondary/10 lg:flex xl:p-12"
          >
            <MidmanLogo className="h-9 rounded-lg" alt={siteName} />

            <div className="my-10 space-y-8">
              <div>
                <h2 className="whitespace-pre-line text-2xl font-bold leading-snug tracking-tight text-foreground xl:text-[1.75rem]">
                  {t('auth.trust.headline')}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t('auth.trust.desc')}
                </p>
              </div>

              <ul className="space-y-5">
                {trustPoints.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs font-medium tracking-wide text-muted-foreground">midman.bd</p>
          </aside>

          {/* ── Form column ── */}
          <main className="p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-sm">
              {/* Mobile logo */}
              <div className="mb-8 flex justify-center lg:hidden">
                <MidmanLogo className="h-9 rounded-lg" alt={siteName} priority />
              </div>

              <AnimatePresence mode="wait">
                {/* ── LOGIN ── */}
                {mode === 'login' && (
                  <motion.div key="login" {...modeTransition} className="space-y-5">
                    <header className="space-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('auth.welcomeBack')}</h1>
                      <p className="text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
                    </header>

                    {googleEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() => { window.location.href = '/api/auth/google'; }}
                          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <GoogleIcon />
                          {t('auth.continueWithGoogle')}
                        </button>
                        <OrDivider label={t('auth.or')} />
                      </>
                    )}

                    <ManualLoginForm onForgotPassword={() => setMode('forgot')} onNeedsVerification={goVerify} />

                    <p className="text-center text-sm text-muted-foreground">
                      {t('auth.dontHaveAccount')}{' '}
                      <button
                        type="button"
                        onClick={() => setMode('register')}
                        className="font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {t('auth.createAccount')}
                      </button>
                    </p>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setMode('email-login')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        {t('auth.loginWithEmail')}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── REGISTER ── */}
                {mode === 'register' && (
                  <motion.div key="register" {...modeTransition} className="space-y-5">
                    <header className="space-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('auth.registerTitle')}</h1>
                      <p className="text-sm text-muted-foreground">{t('auth.registerSubtitle')}</p>
                    </header>

                    {googleEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() => { window.location.href = '/api/auth/google'; }}
                          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <GoogleIcon />
                          {t('auth.continueWithGoogle')}
                        </button>
                        <OrDivider label={t('auth.or')} />
                      </>
                    )}

                    <ManualRegisterForm onNeedsVerification={goVerify} />

                    <p className="text-center text-sm text-muted-foreground">
                      {t('auth.alreadyHaveAccount')}{' '}
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {t('auth.login')}
                      </button>
                    </p>
                  </motion.div>
                )}

                {/* ── FORGOT PASSWORD ── */}
                {mode === 'forgot' && (
                  <motion.div key="forgot" {...modeTransition} className="space-y-5">
                    <header className="space-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('auth.forgotPassword')}</h1>
                      <p className="text-sm text-muted-foreground">{t('auth.passwordResetDesc')}</p>
                    </header>
                    <ForgotPasswordForm onBack={() => setMode('login')} />
                  </motion.div>
                )}

                {/* ── EMAIL VERIFICATION ── */}
                {mode === 'verify' && (
                  <motion.div key="verify" {...modeTransition} className="space-y-5">
                    <header className="space-y-3 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <MailCheck className="h-6 w-6 text-primary" aria-hidden />
                      </div>
                      <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('auth.emailVerificationTitle')}</h1>
                        <p className="text-sm text-muted-foreground">{t('auth.verifyEmailDesc')}</p>
                      </div>
                    </header>
                    <EmailVerifyForm
                      userId={verifyInfo.userId}
                      email={verifyInfo.email}
                      userName={verifyInfo.userName}
                      onVerified={() => setMode('login')}
                    />
                  </motion.div>
                )}

                {/* ── EMAIL MAGIC LINK ── */}
                {mode === 'email-login' && (
                  <motion.div key="email-login" {...modeTransition}>
                    <EmailMagicLinkStep onBack={() => setMode('login')} />
                  </motion.div>
                )}

                {/* ── COMPLETE PROFILE (after magic link) ── */}
                {mode === 'complete-profile' && magicUserId && (
                  <motion.div key="complete-profile" {...modeTransition}>
                    <CompleteProfileForm userId={magicUserId} onSuccess={handleCompleteProfile} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
