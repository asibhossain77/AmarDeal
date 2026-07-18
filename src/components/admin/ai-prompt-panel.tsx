'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Bot, Sparkles } from 'lucide-react';

export function AiPromptPanel() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/site-settings?key=ai_support_prompt')
      .then((r) => r.json())
      .then((data) => {
        setPrompt(data.value || '');
      })
      .catch(() => {
        toast.error('AI প্রম্পট লোড করতে সমস্যা');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!prompt.trim()) {
      toast.error('প্রম্পট খালি হতে পারে না');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_support_prompt', value: prompt }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('AI প্রম্পট সফলভাবে সংরক্ষিত হয়েছে');
      } else {
        toast.error(data.error || 'সংরক্ষণ করতে সমস্যা');
      }
    } catch {
      toast.error('সংরক্ষণ করতে সমস্যা');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-lg">
        <CardHeader className="p-6 pb-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-bold">AI সাপোর্ট প্রম্পট</CardTitle>
          </div>
          <CardDescription className="mt-1.5">
            AI সাপোর্ট অ্যাসিস্ট্যান্ট এর তথ্য ও নিয়ম এখানে দিন। ইউজারদের প্রশ্নের উত্তর এই তথ্য অনুযায়ী দেবে।
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-prompt" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              সিস্টেম প্রম্পট
            </Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="AI অ্যাসিস্ট্যান্ট এর জন্য প্রম্পট লিখুন..."
              rows={12}
              className="rounded-xl border-border/60 bg-background font-mono text-sm resize-y min-h-[240px]"
            />
            <p className="text-xs text-muted-foreground text-right">
              {prompt.length} অক্ষর
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl px-6"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              সেভ করুন
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}