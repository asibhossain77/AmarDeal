'use client';

import { useState, useSyncExternalStore, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
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
  KeyRound,
  ArrowRight,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

/* ─── Forgot Password Form (3-step) ─── */
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const inputClass =
    'h-11 rounded-xl bg-white border-border dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left';

  // Step 1: Send OTP
  const handleSendOtp = useCallback(async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('সঠিক ইমেইল দিন');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'সমস্যা হয়েছে');
        return;
      }
      toast.success('ভেরিফিকেশন কোড ইমেইলে পাঠানো হয়েছে');
      setStep(2);
      setResendTimer(60);
    } catch {
      setError('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [email]);

  // Step 2: Verify OTP (server-side)
  const handleVerifyOtp = useCallback(async () => {
    setError('');
    if (otp.length !== 6) {
      setError('৬ সংখ্যার কোড দিন');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'সমস্যা হয়েছে');
        // If blocked, go back to step 1
        if (data.blocked) {
          setTimeout(() => {
            setStep(1);
            setOtp('');
            setResendTimer(0);
            setError('');
          }, 2000);
        }
        return;
      }
      setStep(3);
      setError('');
    } catch {
      setError('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [email, otp]);

  // Step 2: Resend OTP
  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      toast.success('নতুন কোড পাঠানো হয়েছে');
      setResendTimer(60);
    } catch {
      setError('সমস্যা হয়েছে, আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  }, [email, resendTimer]);

  // Step 3: Reset password
  const handleReset = useCallback(async () => {
    setError('');
    if (otp.length !== 6) {
      setError('৬ সংখ্যার কোড দিন');
      return;
    }
    if (newPassword.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('দুইটি পাসওয়ার্ড মিলছে না');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'সমস্যা হয়েছে');
        return;
      }
      toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!');
      onBack();
    } catch {
      setError('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [email, otp, newPassword, confirmPassword, onBack]);

  const stepLabels = ['ইমেইল', 'ভেরিফিকেশন', 'নতুন পাসওয়ার্ড'];

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
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : isDone
                      ? 'text-primary'
                      : 'opacity-50'
                }`}
              >
                {isDone ? <ShieldCheck className="h-3 w-3" /> : <span className="text-[10px] font-bold">{s}</span>}
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Email */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">আপনার ইমেইল দিন</Label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className={`${inputClass} pl-10`}
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">রেজিস্ট্রেশনের সময় ব্যবহৃত ইমেইল দিন</p>
            </div>
          </motion.div>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">ভেরিফিকেশন কোড</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="৬ সংখ্যার কোড"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
                className={`${inputClass} text-center text-lg tracking-[0.3em] font-bold`}
              />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{email}</span> এ কোড পাঠানো হয়েছে
              </p>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
                className="text-sm text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendTimer > 0 ? `আবার পাঠান (${resendTimer}s)` : 'আবার কোড পাঠান'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">নতুন পাসওয়ার্ড</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-center">
              <Label className="text-foreground text-sm">পাসওয়ার্ড নিশ্চিত করুন</Label>
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="পুনরায় পাসওয়ার্ড দিন"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                className={inputClass}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={step === 1 ? onBack : () => { setStep((s) => (s - 1) as 1 | 2); setError(''); }}
          className="h-12 rounded-xl text-sm font-medium gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? 'ফিরুন' : 'পেছনে'}
        </Button>
        <Button
          onClick={step === 1 || step === 2 ? (step === 1 ? handleSendOtp : handleVerifyOtp) : handleReset}
          disabled={loading || (step === 2 && otp.length !== 6)}
          className="flex-1 h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : step === 3 ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
          {step === 1 ? 'কোড পাঠান' : step === 2 ? 'যাচাই করুন' : 'পাসওয়ার্ড পরিবর্তন করুন'}
        </Button>
      </div>
    </div>
  );
}

/* ─── Login Form ─── */
function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAppStore((s) => s.setUser);

  const handleLogin = useCallback(async () => {
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError('সকল ফিল্ড পূরণ করুন');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'লগইন ব্যর্থ হয়েছে');
        return;
      }
      toast.success('সফলভাবে লগইন হয়েছে!');
      setUser(data);
    } catch {
      setError('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [identifier, password, setUser]);

  return (
    <div className="space-y-5">
      {/* Identifier Field */}
      <div className="space-y-2 text-center">
        <Label htmlFor="login-id" className="text-foreground text-sm">
          ইমেইল বা মোবাইল নাম্বার
        </Label>
        <Input
          id="login-id"
          type="text"
          placeholder="example@mail.com বা ০১XXXXXXXXX"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="h-11 rounded-xl bg-white border-border dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left"
        />
      </div>

      {/* Password Field */}
      <div className="space-y-2 text-center">
        <Label htmlFor="login-pass" className="text-foreground text-sm">
          পাসওয়ার্ড
        </Label>
        <div className="relative">
          <Input
            id="login-pass"
            type={showPass ? 'text' : 'password'}
            placeholder="আপনার পাসওয়ার্ড দিন"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="h-11 rounded-xl bg-white border-border dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder:text-zinc-500 pr-11 text-center md:text-left"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Forgot Password Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-primary hover:underline font-medium"
        >
          পাসওয়ার্ড ভুলে গেছেন?
        </button>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Login Button */}
      <Button
        onClick={handleLogin}
        disabled={loading}
        className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LogIn className="h-5 w-5" />
        )}
        লগইন করুন
      </Button>
    </div>
  );
}

/* ─── Registration Form ─── */
function RegisterForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAppStore((s) => s.setUser);

  const handleRegister = useCallback(async () => {
    setError('');
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !confirmPass.trim()) {
      setError('সকল ফিল্ড পূরণ করুন');
      return;
    }
    if (password !== confirmPass) {
      setError('দুইটি পাসওয়ার্ড মিলছে না');
      return;
    }
    if (password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'নিবন্ধন ব্যর্থ হয়েছে');
        return;
      }
      toast.success('অ্যাকাউন্ট তৈরি হয়েছে!');
      setUser(data);
    } catch {
      setError('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [name, phone, email, password, confirmPass, setUser]);

  const fields = [
    { label: 'পূর্ণ নাম', id: 'reg-name', type: 'text', placeholder: 'আপনার পূর্ণ নাম', value: name, setter: setName },
    { label: 'মোবাইল নাম্বার', id: 'reg-phone', type: 'tel', placeholder: '০১XXXXXXXXX', value: phone, setter: setPhone },
    { label: 'ইমেইল', id: 'reg-email', type: 'email', placeholder: 'example@mail.com', value: email, setter: setEmail },
  ];

  const inputClass =
    'h-11 rounded-xl bg-white border-border dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left';

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.id} className="space-y-2 text-center">
          <Label htmlFor={f.id} className="text-foreground text-sm">
            {f.label}
          </Label>
          <Input
            id={f.id}
            type={f.type}
            placeholder={f.placeholder}
            value={f.value}
            onChange={(e) => f.setter(e.target.value)}
            className={inputClass}
          />
        </div>
      ))}

      {/* Password */}
      <div className="space-y-2 text-center">
        <Label htmlFor="reg-pass" className="text-foreground text-sm">
          পাসওয়ার্ড
        </Label>
        <div className="relative">
          <Input
            id="reg-pass"
            type={showPass ? 'text' : 'password'}
            placeholder="কমপক্ষে ৬ অক্ষর"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2 text-center">
        <Label htmlFor="reg-confirm" className="text-foreground text-sm">
          পাসওয়ার্ড নিশ্চিত করুন
        </Label>
        <Input
          id="reg-confirm"
          type={showPass ? 'text' : 'password'}
          placeholder="পুনরায় পাসওয়ার্ড দিন"
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Register Button */}
      <Button
        onClick={handleRegister}
        disabled={loading}
        className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <UserPlus className="h-5 w-5" />
        )}
        নতুন অ্যাকাউন্ট তৈরি করুন
      </Button>
    </div>
  );
}

/* ─── Auth View (exported) ─── */
export function AuthView() {
  const setView = useAppStore((s) => s.setView);
  const { siteName, siteLogo } = useSiteSettings();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [mode, setMode] = useState<'auth' | 'forgot'>('auth');

  if (!mounted) return null;

  const handleBackFromForgot = () => setMode('auth');

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {/* Background aura */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[100px] dark:bg-primary/[0.05]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Back Button */}
        <button
          onClick={() => mode === 'forgot' ? setMode('auth') : setView('landing')}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground mx-auto w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {mode === 'forgot' ? 'লগইনে ফিরুন' : 'হোমপেজে ফিরুন'}
        </button>

        {/* Auth Card */}
        <div className="relative">
          <div className="relative rounded-3xl border border-border/40 bg-white p-6 shadow-2xl shadow-gray-300/50 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-none sm:p-8">
            {/* Brand Header */}
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <img
                src={siteLogo}
                alt={siteName}
                className="h-11 w-11 rounded-xl object-contain shadow-lg"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {mode === 'forgot' ? 'পাসওয়ার্ড রিসেট' : siteName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === 'forgot'
                    ? 'ইমেইল ভেরিফিকেশনের মাধ্যমে পাসওয়ার্ড পরিবর্তন করুন'
                    : 'নিরাপদ অনলাইন লেনদেন শুরু করুন'}
                </p>
              </div>
            </div>

            {mode === 'forgot' ? (
              <ForgotPasswordForm onBack={handleBackFromForgot} />
            ) : (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="mx-auto grid w-full grid-cols-2 bg-muted/60 dark:bg-zinc-800/60 !h-11 rounded-xl p-1">
                  <TabsTrigger
                    value="login"
                    className="rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground transition-all"
                  >
                    লগইন
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground transition-all"
                  >
                    নিবন্ধন
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <LoginForm onForgotPassword={() => setMode('forgot')} />
                </TabsContent>
                <TabsContent value="register" className="mt-6">
                  <RegisterForm />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}