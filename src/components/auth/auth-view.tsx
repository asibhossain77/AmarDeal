'use client';

import { useState, useSyncExternalStore, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  UserPlus,
  ArrowRight,
  Mail,
  ShieldCheck,
  CheckCircle2,
  MailCheck,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

const inputClass =
  'h-11 rounded-xl bg-white border-border dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left';

/** Shared helper to get t() without prop-drilling */
function useT() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return t;
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
      <div className="space-y-2 text-center">
        <Label className="text-foreground text-sm">{t('auth.verificationCode')}</Label>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder={t('auth.codePlaceholder')}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && onVerify()}
          className={`${inputClass} text-center text-lg tracking-[0.3em] font-bold`}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{email}</span> {t('auth.codeSentTo')}
        </p>
      </div>
      {error && (
        <p className="text-center text-sm text-destructive animate-in fade-in slide-in-from-top-1">{error}</p>
      )}
      <div className="text-center">
        <button
          type="button"
          onClick={onResend}
          disabled={resendTimer > 0 || loading}
          className="text-sm text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendTimer > 0 ? t('auth.resendWithTimer', { timer: String(resendTimer) }) : t('auth.resend')}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Forgot Password Form (3-step)
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
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
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
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as 1 | 2 | 3;
          const isActive = s === step;
          const isDone = s < step;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 opacity-40" />}
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : isDone ? 'text-primary' : 'opacity-50'}`}>
                {isDone ? <ShieldCheck className="h-3 w-3" /> : <span className="text-[10px] font-bold">{s}</span>}
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="fp-s1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">{t('auth.giveEmail')}</Label>
              <div className="relative">
                <Input type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()} className={`${inputClass} pl-10 pr-10`} />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {emailStatus === 'checking' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                {emailStatus === 'found' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                {emailStatus === 'not-found' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />}
                {emailStatus === 'unverified' && <MailCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />}
              </div>
              {/* Live email status hint */}
              {emailStatus === 'found' && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('auth.accountFound')}
                </p>
              )}
              {emailStatus === 'not-found' && (
                <p className="text-xs text-red-500 flex items-center justify-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {t('auth.noAccount')}
                </p>
              )}
              {emailStatus === 'unverified' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                  <MailCheck className="h-3 w-3" />
                  {t('auth.unverifiedAccount')}
                </p>
              )}
              {emailStatus === 'idle' && (
                <p className="text-xs text-muted-foreground">{t('auth.registrationEmailHint')}</p>
              )}
            </div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="fp-s2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <OtpStep email={email} otp={otp} setOtp={setOtp} onVerify={handleVerifyOtp} onResend={handleResend} resendTimer={resendTimer} loading={loading} error={error} />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="fp-s3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">{t('auth.newPassword')}</Label>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} placeholder={t('auth.min6Placeholder')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inputClass} pr-11`} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">{t('auth.confirmPassword')}</Label>
              <Input type={showPass ? 'text' : 'password'} placeholder={t('auth.confirmPasswordPlaceholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleReset()} className={inputClass} />
            </div>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        <Button variant="outline" onClick={step === 1 ? onBack : () => { setStep((s) => (s - 1) as 1 | 2); setError(''); }} className="h-12 rounded-xl text-sm font-medium gap-2">
          <ArrowLeft className="h-4 w-4" />{step === 1 ? t('auth.back') : t('auth.previous')}
        </Button>
        <Button onClick={step === 1 || step === 2 ? (step === 1 ? handleSendOtp : handleVerifyOtp) : handleReset} disabled={loading || (step === 2 && otp.length !== 6) || (step === 1 && (emailStatus === 'not-found' || emailStatus === 'unverified'))} className="flex-1 h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : step === 3 ? <ShieldCheck className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
          {step === 1 ? t('auth.sendCode') : step === 2 ? t('auth.verifyCode') : t('auth.resetPassword')}
        </Button>
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
  onBack,
}: {
  userId: string;
  email: string;
  userName: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center py-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}>
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        </motion.div>
        <h3 className="text-lg font-bold text-foreground">{t('auth.verificationSuccess')}</h3>
        <p className="text-sm text-muted-foreground">{t('auth.verificationSuccessDesc')}</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-3">
          <MailCheck className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{userName}</span>, {t('auth.verifyEmailFor')}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key="ev-otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <OtpStep email={email} otp={otp} setOtp={setOtp} onVerify={handleVerify} onResend={handleResend} resendTimer={resendTimer} loading={loading} error={error} />
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 rounded-xl text-sm font-medium gap-2">
          <ArrowLeft className="h-4 w-4" />{t('auth.back')}
        </Button>
        <Button onClick={handleVerify} disabled={loading || otp.length !== 6} className="flex-1 h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          {t('auth.verifyCode')}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Login Form
   ═══════════════════════════════════════════════════════════════ */
function LoginForm({
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
      setUser(data);
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
      setUser(data);
      setPending2FA(null);
      setTotpCode('');
    } catch {
      setTotpError(t('auth.serverProblem'));
    } finally {
      setTotpLoading(false);
    }
  }, [pending2FA, totpCode, setUser, t]);

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <Label htmlFor="login-id" className="text-foreground text-sm">{t('auth.emailOrPhone')}</Label>
        <Input id="login-id" type="text" placeholder={t('auth.emailOrPhonePlaceholder')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-2 text-center">
        <Label htmlFor="login-pass" className="text-foreground text-sm">{t('auth.password')}</Label>
        <div className="relative">
          <Input id="login-pass" type={showPass ? 'text' : 'password'} placeholder={t('auth.enterPassword')} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className={`${inputClass} pr-11`} />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="text-center">
        <button type="button" onClick={onForgotPassword} className="text-sm text-primary hover:underline font-medium">{t('auth.forgotPassword')}</button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-center text-sm text-destructive">{error}</motion.p>
        )}
      </AnimatePresence>

      {/* 2FA Verification Step */}
      {pending2FA ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground">
              {t('auth.twoFactor')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {pending2FA.name} ({pending2FA.email})
            </p>
            <p className="text-xs text-muted-foreground">
              {t('auth.twoFactorDesc')}
            </p>
          </div>

          <Input
            type="text"
            inputMode="numeric"
            placeholder="0 0 0 0 0 0"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handle2FAVerify()}
            className="text-center font-mono text-2xl tracking-[0.5em] h-14"
            maxLength={6}
            autoFocus
          />

          <AnimatePresence>
            {totpError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-sm text-destructive">
                {totpError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { setPending2FA(null); setTotpCode(''); setTotpError(''); }}
              className="flex-1 h-11"
            >
              {t('auth.goBack')}
            </Button>
            <Button
              onClick={handle2FAVerify}
              disabled={totpCode.length !== 6 || totpLoading}
              className="flex-1 h-11 gap-2"
            >
              {totpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t('auth.verifyCode')}
            </Button>
          </div>
        </motion.div>
      ) : (
        <Button onClick={handleLogin} disabled={loading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          {t('auth.loginButton')}
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Registration Form (2-step: fill form → verify email)
   ═══════════════════════════════════════════════════════════════ */
function RegisterForm({ onNeedsVerification }: { onNeedsVerification: (userId: string, email: string, userName: string) => void }) {
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
    { label: t('auth.fullName'), id: 'reg-name', type: 'text', placeholder: t('auth.fullNamePlaceholder'), value: name, setter: setName },
    { label: t('auth.phone'), id: 'reg-phone', type: 'tel', placeholder: t('auth.phonePlaceholder'), value: phone, setter: setPhone },
    { label: t('auth.email'), id: 'reg-email', type: 'email', placeholder: t('auth.emailPlaceholder'), value: email, setter: setEmail },
  ];

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.id} className="space-y-2 text-center">
          <Label htmlFor={f.id} className="text-foreground text-sm">{f.label}</Label>
          <Input id={f.id} type={f.type} placeholder={f.placeholder} value={f.value} onChange={(e) => f.setter(e.target.value)} className={inputClass} />
        </div>
      ))}
      <div className="space-y-2 text-center">
        <Label htmlFor="reg-pass" className="text-foreground text-sm">{t('auth.password')}</Label>
        <div className="relative">
          <Input id="reg-pass" type={showPass ? 'text' : 'password'} placeholder={t('auth.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-11`} />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2 text-center">
        <Label htmlFor="reg-confirm" className="text-foreground text-sm">{t('auth.confirmPassword')}</Label>
        <Input id="reg-confirm" type={showPass ? 'text' : 'password'} placeholder={t('auth.confirmPasswordPlaceholder')} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputClass} />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-center text-sm text-destructive">{error}</motion.p>
        )}
      </AnimatePresence>
      <Button onClick={handleRegister} disabled={loading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
        {t('auth.createAccount')}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Auth View (exported)
   ═══════════════════════════════════════════════════════════════ */
type AuthMode = 'auth' | 'forgot' | 'verify';

export function AuthView() {
  const setView = useAppStore((s) => s.setView);
  const { siteName, siteLogo } = useSiteSettings();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();
  const [mode, setMode] = useState<AuthMode>('auth');
  const [verifyInfo, setVerifyInfo] = useState({ userId: '', email: '', userName: '' });

  if (!mounted) return null;

  const goVerify = (userId: string, email: string, userName: string) => {
    setVerifyInfo({ userId, email, userName });
    setMode('verify');
  };

  const getHeaderTitle = () => {
    if (mode === 'forgot') return t('auth.passwordResetTitle');
    if (mode === 'verify') return t('auth.emailVerificationTitle');
    return siteName;
  };

  const getHeaderDesc = () => {
    if (mode === 'forgot') return t('auth.passwordResetDesc');
    if (mode === 'verify') return t('auth.verifyYourEmail');
    return t('auth.startSafeTransaction');
  };

  const getBackLabel = () => {
    if (mode === 'forgot') return t('auth.backToLogin');
    if (mode === 'verify') return t('auth.back');
    return t('auth.backToHomepage');
  };

  const handleBack = () => {
    if (mode === 'verify') setMode('auth');
    else if (mode === 'forgot') setMode('auth');
    else setView('landing');
  };

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[100px] dark:bg-primary/[0.05]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <button onClick={handleBack} className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground mx-auto w-fit">
          <ArrowLeft className="h-4 w-4" />{getBackLabel()}
        </button>

        <div className="relative">
          <div className="relative rounded-3xl border border-border/40 bg-white p-6 shadow-2xl shadow-gray-300/50 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-none sm:p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              {siteLogo ? (
                <img src={siteLogo} alt={siteName} className="h-11 w-11 rounded-xl object-contain shadow-lg" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shadow-lg">
                  <span className="text-base font-bold text-primary">{siteName?.charAt(0) || 'M'}</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{getHeaderTitle()}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{getHeaderDesc()}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'forgot' ? (
                <motion.div key="forgot" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <ForgotPasswordForm onBack={() => setMode('auth')} />
                </motion.div>
              ) : mode === 'verify' ? (
                <motion.div key="verify" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <EmailVerifyForm
                    userId={verifyInfo.userId}
                    email={verifyInfo.email}
                    userName={verifyInfo.userName}
                    onVerified={() => setMode('auth')}
                    onBack={() => setMode('auth')}
                  />
                </motion.div>
              ) : (
                <motion.div key="auth" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Tabs defaultValue="login" className="w-full">
                    <TabsList className="mx-auto grid w-full grid-cols-2 bg-muted/60 dark:bg-zinc-800/60 !h-11 rounded-xl p-1">
                      <TabsTrigger value="login" className="rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">{t('auth.login')}</TabsTrigger>
                      <TabsTrigger value="register" className="rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">{t('auth.register')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="login" className="mt-6">
                      <LoginForm onForgotPassword={() => setMode('forgot')} onNeedsVerification={goVerify} />
                    </TabsContent>
                    <TabsContent value="register" className="mt-6">
                      <RegisterForm onNeedsVerification={goVerify} />
                    </TabsContent>
                  </Tabs>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}