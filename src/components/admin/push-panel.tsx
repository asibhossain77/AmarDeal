'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { Bell, Send, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

export function PushPanel() {
  const t = useT();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['admin-push-stats'],
    queryFn: () => fetch('/api/admin/push/stats').then(r => r.json()),
    refetchInterval: 30_000,
  });

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast: true, title, message }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('admin.push.sentCount').replace('{count}', String(data.sent || 0)));
        setTitle('');
        setMessage('');
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Server error');
    }
    setSending(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('admin.push.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.push.desc')}</p>
      </div>

      {/* Stats Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('admin.push.subscribers')}</p>
            <p className="text-3xl font-bold text-foreground">{stats?.count ?? '...'}</p>
          </div>
        </div>
        {(stats?.count === 0) && (
          <p className="mt-3 text-xs text-muted-foreground">{t('admin.push.noSubscribers')}</p>
        )}
      </div>

      {/* Broadcast Form */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('admin.push.broadcast')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('admin.push.broadcastDesc')}</p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">{t('admin.push.titlePlaceholder')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('admin.push.titlePlaceholder')}
              className="mt-1.5 h-11 rounded-xl text-sm"
              disabled={sending}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">{t('admin.push.messagePlaceholder')}</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('admin.push.messagePlaceholder')}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              disabled={sending}
            />
          </div>
          <Button
            onClick={handleBroadcast}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full h-11 rounded-xl text-sm font-bold gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {t('admin.push.broadcast')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
