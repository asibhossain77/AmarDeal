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
import { Sparkles, Store, Clock, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

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
        onClick={() => { useAppStore.getState().setView('seller'); onClose?.(); }}
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

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/user/become-seller')
      .then((r) => r.json())
      .then((data) => {
        if (data.application) setApplication(data.application);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) newErrors.businessName = t('seller.requiredField');
    if (!email.trim()) newErrors.email = t('seller.requiredField');
    if (!phone.trim()) newErrors.phone = t('seller.requiredField');
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
        body: JSON.stringify({ businessName: businessName.trim(), email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('dashboard.becomeSellerSuccess'));
        setApplication({ id: '', status: 'pending', rejectionReason: null });
        setOpen(false);
        onClose?.();
      } else {
        toast.error(data.error || t('dashboard.becomeSellerError'));
      }
    } catch {
      toast.error(t('dashboard.becomeSellerError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (application?.status === 'pending') {
    return (
      <div className={`flex items-center gap-2.5 rounded-xl px-3 py-3 bg-amber-500/10 border border-amber-500/20`}>
        <Clock className="h-[18px] w-[18px] text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('seller.pending')}</span>
      </div>
    );
  }

  if (application?.status === 'rejected') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="mt-2 rounded-xl bg-red-500/5 border border-red-500/10 p-4">
            <p className="text-xs text-muted-foreground mb-3">{t('seller.applyDesc')}</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('seller.businessName')}</Label>
                <Input
                  placeholder={t('seller.businessNamePh')}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('seller.email')}</Label>
                <Input
                  type="email"
                  placeholder={t('seller.emailPh')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('seller.phone')}</Label>
                <Input
                  placeholder={t('seller.phonePh')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {submitting ? t('seller.submitting') : t('seller.submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('seller.businessName')}</Label>
            <Input
              placeholder={t('seller.businessNamePh')}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('seller.email')}</Label>
            <Input
              type="email"
              placeholder={t('seller.emailPh')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('seller.phone')}</Label>
            <Input
              placeholder={t('seller.phonePh')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {submitting ? t('seller.submitting') : t('seller.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
