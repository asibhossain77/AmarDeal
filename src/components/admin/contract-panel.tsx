'use client';
import { useT } from '@/lib/i18n';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  FileText,
  User,
  ImageIcon,
  Save,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

const emptySubscribe = () => () => {};

interface ContractData {
  content: string;
  adminName: string;
  adminImageUrl: string;
}

export function ContractPanel
  const t = useT();() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'content' | 'admin' | null>(null);

  const [content, setContent] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminImageUrl, setAdminImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch('/api/admin/contract')
      .then((r) => r.json())
      .then((d: ContractData) => {
        setContent(d.content || '');
        setAdminName(d.adminName || '');
        setAdminImageUrl(d.adminImageUrl || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveContent = async () => {
    setSaving('content');
    try {
      const res = await fetch('/api/admin/contract', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_content', content }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'ব্যর্থ');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAdminInfo = async () => {
    if (!adminName.trim()) {
      toast.error('নাম দিন');
      return;
    }
    setSaving('admin');
    try {
      const res = await fetch('/api/admin/contract', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_admin_info', adminName, adminImageUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'ব্যর্থ');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setSaving(null);
    }
  };

  const handlePreviewImage = () => {
    if (adminImageUrl.trim()) {
      setPreviewUrl(adminImageUrl.trim());
      setShowPreview(true);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          চুক্তি ও শর্তাবলী
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          পাবলিক চুক্তি পেজের কন্টেন্ট ও অ্যাডমিন তথ্য পরিবর্তন করুন
        </p>
      </div>

      {/* Admin Info Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            পাবলিক পেজে অ্যাডমিন তথ্য
          </h3>
        </div>

        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          পাবলিক চুক্তি পেজে আপনার নাম ও ছবি দেখাবে। ছবি লিংক দিয়ে আপডেট করুন।
        </p>

        <div className="space-y-3">
          {/* Admin Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              অ্যাডমিন নাম
            </label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="প্রদর্শন নাম লিখুন"
              className="h-11 text-sm rounded-xl"
              disabled={saving === 'admin'}
            />
          </div>

          {/* Admin Image URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              ছবি লিংক (URL)
            </label>
            <div className="flex gap-2">
              <Input
                value={adminImageUrl}
                onChange={(e) => setAdminImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="h-11 text-sm rounded-xl flex-1 font-mono text-xs"
                disabled={saving === 'admin'}
              />
              {adminImageUrl.trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePreviewImage}
                  className="h-11 gap-1.5 rounded-xl text-xs shrink-0 px-3"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Image Preview */}
          {showPreview && previewUrl && (
            <div className="rounded-xl border border-border/50 p-3 flex items-center gap-3">
              <img
                src={previewUrl}
                alt="প্রিভিউ"
                className="h-12 w-12 rounded-full object-cover"
                loading="lazy" decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">ছবি প্রিভিউ</p>
                <p className="text-[10px] text-muted-foreground truncate">{previewUrl}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
          )}

          <Button
            className="w-full h-11 rounded-xl text-sm font-bold gap-2"
            disabled={saving === 'admin' || !adminName.trim()}
            onClick={handleSaveAdminInfo}
          >
            {saving === 'admin' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            অ্যাডমিন তথ্য সেভ করুন
          </Button>
        </div>
      </div>

      {/* Contract Content Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            চুক্তির কন্টেন্ট
          </h3>
        </div>

        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          প্রতিটি লাইন নতুন প্যারাগ্রাফ হিসেবে দেখাবে। হেডিং এর শেষে কোলন (:) দিন। বুলেট পয়েন্টের জন্য লাইনের শুরুতে ড্যাশ (-) দিন।
        </p>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`এসক্রো পরিষেবার শর্তাবলী:\n\nএই প্ল্যাটফর্মটি ব্যবহার করে আপনি নিম্নলিখিত শর্তাবলীতে সম্মত হচ্ছেন:\n\nলেনদেনের শর্ত:\n- সকল লেনদেন এসক্রো পদ্ধতিতে সম্পন্ন হবে\n- পেমেন্ট ভেরিফিকেশনের পর টাকা রিলিজ হবে\n- কোনো পক্ষ শর্ত ভঙ্গ করলে টাকা ফেরত দেওয়া হবে`}
          className="min-h-[300px] text-sm rounded-xl resize-y leading-relaxed"
          disabled={saving === 'content'}
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {content.length} অক্ষর
          </p>
          <Button
            className="h-11 rounded-xl text-sm font-bold gap-2 px-5"
            disabled={saving === 'content' || !content.trim()}
            onClick={handleSaveContent}
          >
            {saving === 'content' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            কন্টেন্ট সেভ করুন
          </Button>
        </div>
      </div>
    </div>
  );
}