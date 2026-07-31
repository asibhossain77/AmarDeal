'use client';
import { useT } from '@/lib/i18n';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save, User, Phone, Mail, MessageCircle, MapPin, Facebook, Users, ImageIcon, Send } from 'lucide-react';
import { invalidateSiteSettingsCache } from '@/lib/use-site-settings';

interface ContactData {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  telegram: string | null;
  telegramGroup: string | null;
  facebook: string | null;
  facebookPage: string | null;
  facebookGroup: string | null;
  address: string | null;
}

interface ProfileData {
  adminName: string;
  adminImageUrl: string;
}

export function ContactInfoPanel() {
  const t = useT();
  const [data, setData] = useState<ContactData>({
    phone: '', email: '', whatsapp: '', telegram: '',
    facebook: '', facebookPage: '', facebookGroup: '', telegramGroup: '', address: '',
  });
  const [profile, setProfile] = useState<ProfileData>({ adminName: '', adminImageUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/contact-info').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]).then(([contact, settings]) => {
      setData({
        phone: contact.phone || '',
        email: contact.email || '',
        whatsapp: contact.whatsapp || '',
        telegram: contact.telegram || '',
        facebook: contact.facebook || '',
        facebookPage: contact.facebookPage || '',
        facebookGroup: contact.facebookGroup || '',
        telegramGroup: contact.telegramGroup || '',
        address: contact.address || '',
      });
      setProfile({
        adminName: settings.platform_name ? '' : (settings.admin_display_name || ''),
        adminImageUrl: settings.admin_image_url || '',
      });
    }).catch(() => {
      toast.error(t('admin.contact.loadError'));
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch('/api/admin/contact-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admin_display_name: profile.adminName,
            admin_image_url: profile.adminImageUrl,
          }),
        }),
      ]);
      invalidateSiteSettingsCache();
      toast.success(t('admin.contact.saveSuccess'));
    } catch {
      toast.error(t('admin.contact.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof ContactData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Picture + Name */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t('admin.contact.profile')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.contact.profileDesc')}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border/40 bg-muted/30 flex items-center justify-center">
            {profile.adminImageUrl ? (
              <img src={profile.adminImageUrl} alt="Profile" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <User className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          <div className="w-full space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adminName" className="text-sm font-medium text-foreground">{t('admin.contact.adminName')}</Label>
              <Input
                id="adminName"
                value={profile.adminName}
                onChange={e => setProfile(p => ({ ...p, adminName: e.target.value }))}
                placeholder={t('admin.contact.namePlaceholder')}
                className="rounded-xl border-border/60 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminImage" className="text-sm font-medium text-foreground flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.profileImage')}</Label>
              <Input
                id="adminImage"
                value={profile.adminImageUrl}
                onChange={e => setProfile(p => ({ ...p, adminImageUrl: e.target.value }))}
                placeholder="https://example.com/photo.jpg"
                className="rounded-xl border-border/60 bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Fields */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Phone className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t('admin.contact.contactInfo')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.contact.contactDesc')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.phoneNumber')}</Label>
            <Input type="tel" placeholder="01XXXXXXXXX" value={data.phone || ''} onChange={e => updateField('phone', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.whatsappLink')}</Label>
            <Input type="url" placeholder="https://wa.me/..." value={data.whatsapp || ''} onChange={e => updateField('whatsapp', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.emailAddress')}</Label>
            <Input type="email" placeholder="example@email.com" value={data.email || ''} onChange={e => updateField('email', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.address')}</Label>
            <Input placeholder={t('admin.contact.addressPlaceholder')} value={data.address || ''} onChange={e => updateField('address', e.target.value)} className="rounded-xl border-border/60" />
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Facebook className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t('admin.contact.socialMedia')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.contact.socialDesc')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.fbProfile')}</Label>
            <Input placeholder="https://facebook.com/..." value={data.facebook || ''} onChange={e => updateField('facebook', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.fbPage')}</Label>
            <Input placeholder="https://facebook.com/midmanpage" value={data.facebookPage || ''} onChange={e => updateField('facebookPage', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.fbGroup')}</Label>
            <Input placeholder="https://facebook.com/groups/..." value={data.facebookGroup || ''} onChange={e => updateField('facebookGroup', e.target.value)} className="rounded-xl border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Send className="h-3.5 w-3.5 text-muted-foreground" /> {t('admin.contact.tgGroup')}</Label>
            <Input placeholder="https://t.me/..." value={data.telegramGroup || ''} onChange={e => updateField('telegramGroup', e.target.value)} className="rounded-xl border-border/60" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl h-11 font-medium shadow-md shadow-primary/20 px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}