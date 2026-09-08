'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Store, XCircle, Loader2, Ban, Check, MessageCircle, ShieldCheck, KeyRound, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CountryCode {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

// Popular country codes for WhatsApp — Bangladesh first (default)
const COUNTRY_CODES: CountryCode[] = [
  { iso: 'BD', name: 'বাংলাদেশ', dial: '+880', flag: '🇧🇩' },
  { iso: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { iso: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { iso: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
  { iso: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { iso: 'AF', name: 'Afghanistan', dial: '+93', flag: '🇦🇫' },
  { iso: 'MM', name: 'Myanmar', dial: '+95', flag: '🇲🇲' },
  { iso: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { iso: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { iso: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { iso: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { iso: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
  { iso: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { iso: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { iso: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { iso: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { iso: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲' },
  { iso: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭' },
  { iso: 'US', name: 'USA', dial: '+1', flag: '🇺🇸' },
  { iso: 'GB', name: 'UK', dial: '+44', flag: '🇬🇧' },
  { iso: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { iso: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { iso: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { iso: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { iso: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { iso: 'TR', name: 'Türkiye', dial: '+90', flag: '🇹🇷' },
  { iso: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
];

interface Application {
  id: string;
  status: string;
  rejectionReason: string | null;
}

interface SellerApplyButtonProps {
  variant?: 'sidebar' | 'mobile';
  onClose?: () => void;
}

export function SellerApplyButton({ variant = 'sidebar', onClose }: SellerApplyButtonProps) {
  const t = useT();
  const user = useAppStore((s) => s.user);

  if (user?.isSeller) {
    return (
      <button
        onClick={() => { useAppStore.getState().setDashboardPanel('seller-orders'); onClose?.(); }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 bg-primary/10 border border-primary/20 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <Store className="h-[18px] w-[18px]" />
        <span>{t('seller.goToDashboard')}</span>
      </button>
    );
  }

  return <SellerApplyDialog variant={variant} onClose={onClose} />;
}

function SellerApplyDialog({ variant = 'sidebar', onClose }: SellerApplyButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  const [countryCode, setCountryCode] = useState('BD');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  // True right after a fresh submit: shows "request submitted, wait for the code"
  // instead of "enter the code you received". The code itself is NEVER shown to
  // the user — only the admin sees it and sends it to the user's WhatsApp.
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setJustSubmitted(false);
      setCodeInput('');
      setCodeError(null);
    }
  };

  useEffect(() => {
    fetch('/api/user/become-seller')
      .then((r) => r.json())
      .then((data) => {
        if (data.application) setApplication(data.application);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const localDigits = whatsappNumber.replace(/\D/g, '').replace(/^0+/, '');
  const selectedCountry = COUNTRY_CODES.find((c) => c.iso === countryCode) || COUNTRY_CODES[0];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!whatsappNumber.trim()) newErrors.whatsappNumber = t('seller.requiredField');
    else if (localDigits.length < 6 || localDigits.length > 14) newErrors.whatsappNumber = t('seller.whatsappInvalid');
    if (!termsAccepted) newErrors.terms = t('seller.acceptTerms');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/become-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNumber: `${selectedCountry.dial}${localDigits}` }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('dashboard.becomeSellerSuccess'));
        setJustSubmitted(true);
        setApplication({ id: '', status: 'pending', rejectionReason: null });
        // keep dialog open — the "wait for WhatsApp code + verify" view is shown inside
      } else {
        toast.error(data.error || t('dashboard.becomeSellerError'));
      }
    } catch {
      toast.error(t('dashboard.becomeSellerError'));
    } finally {
      setSubmitting(false);
    }
  };

  // Render helpers (NOT components!) — they must be called as functions inside
  // JSX. If they were used as <Component /> elements, every parent re-render
  // (e.g. each keystroke) would create a new component type, remount the whole
  // subtree, and the mobile keyboard would close after every digit typed.
  const renderTerms = () => (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setTermsAccepted(!termsAccepted); setErrors(prev => { const n = {...prev}; delete n.terms; return n; }); }}
        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
          termsAccepted ? 'border-primary/30 bg-primary/5' : errors.terms ? 'border-destructive/40 bg-destructive/5' : 'border-border hover:border-border/80'
        }`}
      >
        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          termsAccepted ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
        }`}>
          {termsAccepted && <Check className="h-3 w-3" />}
        </div>
        <span className="text-xs leading-relaxed text-muted-foreground">{t('seller.termsText')}</span>
      </button>
      {errors.terms && <p className="text-xs text-destructive pl-1">{errors.terms}</p>}
    </div>
  );

  const renderWhatsAppField = () => (
    <div className="space-y-2">
      <Label htmlFor="seller-wa-number" className="text-sm font-semibold">{t('seller.whatsappNumber')}</Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={(v) => setCountryCode(v)}>
          <SelectTrigger
            aria-label={t('seller.countryCode')}
            className="w-[118px] shrink-0 gap-1 rounded-xl border-border/60 bg-background px-3"
          >
            <SelectValue>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-base leading-none">{selectedCountry.flag}</span>
                <span>{selectedCountry.dial}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.iso} value={c.iso} className="gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.dial}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-0">
          <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#25D366]" />
          <Input
            id="seller-wa-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t('seller.whatsappNumberPh')}
            value={whatsappNumber}
            onChange={(e) => {
              setWhatsappNumber(e.target.value);
              if (errors.whatsappNumber) setErrors(prev => { const n = {...prev}; delete n.whatsappNumber; return n; });
            }}
            className="pl-10 rounded-xl"
          />
        </div>
      </div>
      {errors.whatsappNumber && <p className="text-xs text-destructive">{errors.whatsappNumber}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{t('seller.whatsappHelp')}</p>
    </div>
  );

  const renderSubmitButton = () => (
    <Button
      onClick={handleSubmit}
      disabled={submitting}
      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 shadow-md shadow-amber-500/20"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {submitting ? t('seller.submitting') : t('seller.submit')}
    </Button>
  );

  const normalizeTypedCode = (v: string) => {
    const bn = '০১২৩৪৫৬৭৮৯';
    return v.replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/[^0-9]/g, '').slice(0, 6);
  };

  const handleVerify = async () => {
    if (normalizeTypedCode(codeInput).length < 6) return;
    setVerifying(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/user/become-seller/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const curr = useAppStore.getState().user;
        if (curr) useAppStore.getState().setUser({ ...curr, isSeller: true });
        toast.success(t('seller.verifySuccess'));
        setApplication({ id: application?.id || '', status: 'approved', rejectionReason: null });
        handleOpenChange(false);
        onClose?.();
      } else {
        setCodeError(data.error || t('seller.verifyWrong'));
      }
    } catch {
      setCodeError(t('seller.verifyWrong'));
    } finally {
      setVerifying(false);
    }
  };

  // One view for both states:
  // - justSubmitted: "request received — the admin will send the code to your WhatsApp"
  // - otherwise: "enter the code the admin sent you"
  // In BOTH cases the actual code is never displayed to the user.
  const renderVerifyContent = (justSubmitted: boolean) => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {justSubmitted ? (
            <Sparkles className="h-5 w-5 text-amber-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-amber-500" />
          )}
          {t(justSubmitted ? 'seller.submittedTitle' : 'seller.verifyTitle')}
        </DialogTitle>
        <DialogDescription>
          {t(justSubmitted ? 'seller.submittedDesc' : 'seller.verifyDesc')}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div className="rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-500/5 px-4 py-4">
          <Input
            aria-label={t('seller.verifyTitle')}
            inputMode="numeric"
            placeholder="······"
            value={codeInput}
            onChange={(e) => { setCodeInput(normalizeTypedCode(e.target.value)); setCodeError(null); }}
            className="h-14 border-none bg-transparent text-center font-mono text-2xl font-bold tracking-[0.45em] shadow-none focus-visible:ring-0"
            dir="ltr"
          />
        </div>
        {codeError && <p className="text-xs text-destructive text-center">{codeError}</p>}
        <Button
          onClick={handleVerify}
          disabled={verifying || normalizeTypedCode(codeInput).length < 6}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white gap-2 shadow-md shadow-emerald-500/20"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {verifying ? t('seller.verifying') : t('seller.verifySubmit')}
        </Button>
        <p className="text-xs text-center text-muted-foreground">{t('seller.verifyNoCode')}</p>
      </div>
    </>
  );

  if (loading) return null;

  if (application?.status === 'pending') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 transition-colors hover:bg-amber-500/15 ${
              variant === 'mobile' ? 'px-4 py-3' : ''
            }`}
          >
            <KeyRound className="h-[18px] w-[18px] text-amber-500" />
            <span className="flex-1 text-left leading-tight">
              <span className="block text-[11px] font-medium opacity-80">{t('seller.pending')}</span>
              <span className="block text-sm font-bold">{t('seller.verifyTitle')}</span>
            </span>
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {renderVerifyContent(justSubmitted)}
        </DialogContent>
      </Dialog>
    );
  }

  if (application?.status === 'disabled') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 transition-colors hover:bg-orange-500/15 ${
              variant === 'mobile' ? 'px-4 py-3' : ''
            }`}
          >
            <Ban className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">{t('seller.accountDisabled')}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              {t('seller.accountDisabled')}
            </DialogTitle>
            <DialogDescription>
              {t('seller.accountDisabledDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {renderWhatsAppField()}
            {renderTerms()}
            {renderSubmitButton()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (application?.status === 'rejected') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20 transition-colors hover:bg-red-500/15 ${
              variant === 'mobile' ? 'px-4 py-3' : ''
            }`}
          >
            <XCircle className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">{t('seller.applyAgain')}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('seller.rejected')}
            </DialogTitle>
            <DialogDescription>
              {t('seller.rejectedDesc')} {application.rejectionReason || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {renderWhatsAppField()}
            {renderTerms()}
            {renderSubmitButton()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-600 ${
            variant === 'mobile' ? 'px-4 py-3' : ''
          }`}
        >
          <Sparkles className="h-[18px] w-[18px]" />
          <span>{t('nav.becomeSeller')}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t('seller.applyTitle')}
          </DialogTitle>
          <DialogDescription>{t('seller.applyDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {renderWhatsAppField()}
          {renderTerms()}
          {renderSubmitButton()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
