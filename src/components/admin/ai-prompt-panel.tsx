'use client';
import { useT } from '@/lib/i18n';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Save, Bot, Sparkles, RotateCcw, Send, MessageSquare, Info, CheckCircle, AlertCircle } from 'lucide-react';

const DEFAULT_PROMPT = `তুমি "আমারডিল" (AmarDeal) এর AI সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার কাজ ইউজারদের প্রশ্নের সঠিক উত্তর দেওয়া।

গুরুত্বপূর্ণ নিয়ম:
- ইউজার যে ভাষায় কথা বলবে সেই ভাষায় উত্তর দাও (বাংলা, English, হিন্দি যাই হোক)
- সংক্ষেপে ও পরিষ্কারভাবে উত্তর দাও
- আমারডিল সম্পর্কে না জানলে সৎভাবে বলো
- কোনো সংবেদনশীল তথ্য (পাসওয়ার্ড, ব্যাংক ডিটেইলস) কখনো জিজ্ঞাস করো না
- ইউজার যেভাবেই কথা বলুক (আঞ্চলিক, আধুনিক, মিশ্র ভাষা) সেভাবেই বুঝে উত্তর দাও

আমারডিল সম্পর্কে তথ্য:
• আমারডিল বাংলাদেশের একটি এসক্রো (Escrow) প্ল্যাটফর্ম।
• এটি অনলাইনে নিরাপদ লেনদেন নিশ্চিত করে — ক্রেতা টাকা প্ল্যাটফর্মে জমা দেয়, পণ্য/সেবা পেলে বিক্রেতাকে টাকা দেওয়া হয়।
• ক্রেতা ও বিক্রেতা উভয়েই সুরক্ষিত।

কিভাবে কাজ করে:
1. ডিল তৈরি করুন (ক্রেতা বা বিক্রেতা যে কেউ করতে পারে)
2. ক্রেতা পেমেন্ট জমা দেয় আমারডিল প্ল্যাটফর্মে
3. বিক্রেতা পণ্য/সেবা সরবরাহ করে
4. ক্রেতা কনফার্ম করলে বিক্রেতাকে টাকা দেওয়া হয়
5. কোনো সমস্যা হলে অ্যাডমিন মধ্যস্থতা করে

ফি কাঠামো (প্ল্যাটফর্ম ফি):
• ৩০-১৯৯ টাকা → ১০ টাকা ফি
• ২০০-৫৯৯ টাকা → ২০ টাকা ফি
• ৫০০-৯৯৯ টাকা → ৩০ টাকা ফি
• ১,০০০-১,৯৯৯ টাকা → ৪০ টাকা ফি
• ২,০০০-৩,৯৯৯ টাকা → ৫০ টাকা ফি
• ৪,০০০-৯,৯৯৯ টাকা → ২০ টাকা ফি
• ১০,০০০-১৯,৯৯৯ টাকা → ১৫০ টাকা ফি
• ২০,০০০-৪৯,৯৯৯ টাকা → ২৫০ টাকা ফি
• ৫০,০০০+ টাকা → ১,০০০ টাকা ফি

পেমেন্ট মেথড:
• বিকাশ, নগদ, রকেট, ক্যাশ অন ডেলিভারী
• ব্যাংক ট্রান্সফার

নিরাপত্তা:
• টাকা সরাসরি বিক্রেতার কাছে যায় না — এসক্রোতে থাকে
• বিতর্ক হলে অ্যাডমিন মধ্যস্থতা করে
• প্রতারণা হলে টাকা ফেরত দেওয়া হয়

অ্যাকাউন্ট:
• ফোন নম্বর বা ইমেইল দিয়ে রেজিস্ট্রেশন
• ইমেইল ভেরিফিকেশন প্রয়োজন
• বিক্রেতা হিসেবে কাজ করতে আলাদা অনুমতি লাগে

সাধারণ প্রশ্নের উত্তর:
• "ফি কত?" → ডিলের পরিমাণ অনুযায়ী ফি ভিন্ন। ৩০-১৯৯ টাকার ডিলে ১০ টাকা, ২০০-৫৯৯ টাকায় ২০ টাকা। বিস্তারিত ফি কাঠামো ওয়েবসাইটে দেখুন।
• "কিভাবে ডিল করবো?" → লগইন করুন → নতুন ডিল তৈরি করুন → ক্রেতা পেমেন্ট জমা দেবে → বিক্রেতা পণ্য দেবে → কনফার্ম করলে টাকা যাবে।
• "টাকা ফেরত পাবো?" → বিক্রেতা পণ্য না দিলে বা কোনো সমস্যা হলে অ্যাডমিন যাচাই করে টাকা ফেরত দেয়।
• "পেমেন্ট কিভাবে?" → বিকাশ, নগদ, রকেট, ব্যাংক ট্রান্সফার, ক্যাশ অন ডেলিভারী — যেকোনো মাধ্যমে পেমেন্ট করতে পারবেন।
`;

export function AiPromptPanel() {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // Test AI chat state
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const testEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/site-settings?key=ai_support_prompt')
      .then((r) => r.json())
      .then((data) => {
        const val = data.value || '';
        setPrompt(val);
        setOriginalPrompt(val);
        setIsCustom(val.length > 0 && val !== DEFAULT_PROMPT);
      })
      .catch(() => {
        toast.error(t('admin.aiPrompt.loadError'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages]);

  const handleSave = async () => {
    if (!prompt.trim()) {
      toast.error(t('admin.aiPrompt.emptyError'));
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
        setOriginalPrompt(prompt);
        setIsCustom(prompt !== DEFAULT_PROMPT);
        toast.success(t('admin.aiPrompt.saveSuccess'));
      } else {
        toast.error(data.error || t('admin.aiPrompt.saveError'));
      }
    } catch {
      toast.error(t('admin.aiPrompt.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    setIsCustom(false);
    toast.success(t('admin.aiPrompt.resetSuccess'));
  };

  const handleTestSend = async () => {
    if (!testInput.trim() || testLoading) return;

    const userMsg = testInput.trim();
    setTestInput('');
    setTestMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setTestLoading(true);

    try {
      const res = await fetch('/api/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          sessionId: 'admin-test-' + Date.now(),
        }),
      });
      const data = await res.json();
      if (data.response) {
        setTestMessages((prev) => [...prev, { role: 'ai', text: data.response }]);
      } else {
        setTestMessages((prev) => [
          ...prev,
          { role: 'ai', text: data.error || t('admin.aiPrompt.serverError') },
        ]);
      }
    } catch {
      setTestMessages((prev) => [
        ...prev,
        { role: 'ai', text: t('admin.aiPrompt.connectionError') },
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  const hasUnsavedChanges = prompt !== originalPrompt;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Prompt Editor */}
      <Card className="rounded-2xl shadow-lg">
        <CardHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{t('admin.aiPrompt.title')}</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {t('admin.aiPrompt.desc')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isCustom && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-0">
                  {t('admin.aiPrompt.custom')}
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
                  {t('admin.aiPrompt.unsaved')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-prompt" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              {t('admin.aiPrompt.systemPrompt')}
            </Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('admin.aiPrompt.promptPlaceholder')}
              rows={14}
              className="rounded-xl border-border/60 bg-background font-mono text-sm resize-y min-h-[280px] leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('admin.aiPrompt.chars', { count: prompt.length })}
              </p>
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('admin.aiPrompt.unsavedWarning')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="rounded-xl gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              {t('admin.aiPrompt.resetToDefault')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="rounded-xl px-6 gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('admin.aiPrompt.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="rounded-2xl shadow-lg bg-muted/30">
        <CardContent className="p-5">
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-lg bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t('admin.aiPrompt.tips')}</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {t('admin.aiPrompt.tip1')}
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {t('admin.aiPrompt.tip2')}
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {t('admin.aiPrompt.tip3')}
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {t('admin.aiPrompt.tip4')}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test AI Section */}
      <Card className="rounded-2xl shadow-lg">
        <CardHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{t('admin.aiPrompt.testTitle')}</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {t('admin.aiPrompt.testDesc')}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowTest(!showTest);
                if (!showTest) setTestMessages([]);
              }}
              className="text-xs text-muted-foreground"
            >
              {showTest ? t('admin.aiPrompt.hide') : t('admin.aiPrompt.open')}
            </Button>
          </div>
        </CardHeader>
        {showTest && (
          <CardContent className="p-6">
            {testMessages.length > 0 && (
              <div className="mb-4 max-h-72 overflow-y-auto space-y-3 rounded-xl bg-muted/30 p-4">
                {testMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-white dark:bg-zinc-800 border border-border/50 rounded-bl-md'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {testLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-zinc-800 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={testEndRef} />
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTestSend()}
                placeholder={t('admin.aiPrompt.testPlaceholder')}
                disabled={testLoading}
                className="rounded-xl border-border/60 flex-1"
              />
              <Button
                onClick={handleTestSend}
                disabled={testLoading || !testInput.trim()}
                className="rounded-xl px-4 gap-2"
              >
                {testLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {hasUnsavedChanges && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('admin.aiPrompt.unsavedTestWarning')}
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
