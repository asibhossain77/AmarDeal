'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Eye, Image, Link, Type, Palette, Bold, Italic, Minus, Plus } from 'lucide-react';

interface PopupConfig {
  enabled: boolean;
  content: string;
  image: string;
  link: string;
  buttonTitle: string;
}

const DEFAULT_CONFIG: PopupConfig = {
  enabled: false,
  content: '',
  image: '',
  link: '',
  buttonTitle: '',
};

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

/** Apply font-size via span wrap — gradual +/- 2px steps */
function applyFontSize(editor: HTMLElement, delta: number) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  // Find existing sized span around selection
  let node: Node | null = sel.anchorNode;
  let sizedSpan: HTMLSpanElement | null = null;
  while (node && node !== editor) {
    if (node instanceof HTMLSpanElement && node.style.fontSize) { sizedSpan = node; break; }
    node = node.parentNode;
  }
  const current = sizedSpan ? (parseFloat(sizedSpan.style.fontSize) || 14) : 14;
  const newSize = Math.max(10, Math.min(28, current + delta));
  if (sizedSpan && range.startContainer && range.endContainer &&
      editor.contains(range.startContainer) && editor.contains(range.endContainer) &&
      sizedSpan.contains(range.startContainer) && sizedSpan.contains(range.endContainer)) {
    sizedSpan.style.fontSize = `${newSize}px`;
    return;
  }
  const span = document.createElement('span');
  span.style.fontSize = `${newSize}px`;
  try {
    range.surroundContents(span);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  } catch {
    execCmd('fontSize', '4');
  }
}

/** Wrap selected text in a span with color:var(--primary) */
function applyThemeColor() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.color = 'var(--primary)';
  range.surroundContents(span);
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
}

export function PopupPanel() {
  const [config, setConfig] = useState<PopupConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load config
  useEffect(() => {
    fetch('/api/admin/popup')
      .then((r) => (r.ok ? r.json() : DEFAULT_CONFIG))
      .catch(() => DEFAULT_CONFIG)
      .then((data) => {
        setConfig({ ...DEFAULT_CONFIG, ...data });
        setLoading(false);
      });
  }, []);

  // Sync editor HTML back to config
  const syncEditor = useCallback(() => {
    if (editorRef.current) {
      setConfig((prev) => ({ ...prev, content: editorRef.current!.innerHTML }));
    }
  }, []);

  // Set editor content when config loads
  useEffect(() => {
    if (editorRef.current && !loading) {
      if (editorRef.current.innerHTML !== config.content) {
        editorRef.current.innerHTML = config.content;
      }
    }
  }, [config.content, loading]);

  const save = useCallback(async (override?: PopupConfig) => {
    syncEditor();
    const payload = override || config;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/popup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'সেভ করতে সমস্যা');
      }
      toast.success('পপআপ সেভ হয়েছে');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  }, [config, syncEditor]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    syncEditor();
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      save();
    }, 1500);
  }, [save, syncEditor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground text-sm">লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">পপআপ নোটিফিকেশন</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            ইউজারদের ওয়েবসাইটে প্রবেশে পপআপ দেখান অ্যাডমিন প্যানেল থেকে নিয়ন্ত্রণ করুন
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => {
                const updated = { ...config, enabled: v };
                setConfig(updated);
                save(updated);
              }}
            />
            <Label className="text-sm font-medium">
              {config.enabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </Label>
          </div>
        </div>
      </div>

      {/* Editor Card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
        {/* Content Editor */}
        <div className="space-y-2.5">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Type className="h-4 w-4" />
            পপআপ কন্টেন্ট
          </Label>
          <p className="text-xs text-muted-foreground">
            টেক্সট সিলেক্ট করে বোল্ড, সাইজ বা থিম কালার প্রয়োগ করুন
          </p>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-muted/50 border border-border">
            <ToolbarBtn
              title="বোল্ড"
              onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); triggerAutoSave(); }}
            >
              <Bold className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              title="ইটালিক"
              onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); triggerAutoSave(); }}
            >
              <Italic className="h-4 w-4" />
            </ToolbarBtn>
            <div className="w-px h-5 bg-border mx-0.5" />
            <ToolbarBtn
              title="ছোট টেক্সট"
              onMouseDown={(e) => { e.preventDefault(); if (editorRef.current) applyFontSize(editorRef.current, -2); triggerAutoSave(); }}
            >
              <Minus className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              title="সাধারণ টেক্সট"
              onMouseDown={(e) => { e.preventDefault(); execCmd('removeFormat'); triggerAutoSave(); }}
            >
              <Type className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              title="বড় টেক্সট"
              onMouseDown={(e) => { e.preventDefault(); if (editorRef.current) applyFontSize(editorRef.current, 2); triggerAutoSave(); }}
            >
              <Plus className="h-4 w-4" />
            </ToolbarBtn>
            <div className="w-px h-5 bg-border mx-0.5" />
            <ToolbarBtn
              title="থিম কালার"
              onMouseDown={(e) => { e.preventDefault(); applyThemeColor(); triggerAutoSave(); }}
            >
              <Palette className="h-4 w-4" />
            </ToolbarBtn>
          </div>

          {/* Content Editable Area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={triggerAutoSave}
            className="min-h-[120px] max-h-[240px] overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-shadow"
            style={{ lineHeight: '1.7' }}
            data-placeholder="এখানে আপনার পপআপ মেসেজ লিখুন..."
          />
        </div>

        {/* Image URL */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Image className="h-4 w-4" />
            ছবির লিংক (ঐচ্ছিক)
          </Label>
          <Input
            placeholder="https://example.com/image.png"
            value={config.image}
            onChange={(e) => setConfig((p) => ({ ...p, image: e.target.value }))}
            onBlur={triggerAutoSave}
          />
          {config.image && (
            <div className="mt-2 rounded-xl overflow-hidden border border-border max-w-[200px]">
              <img src={config.image} alt="পপআপ ছবি" className="w-full h-auto object-contain" />
            </div>
          )}
        </div>

        {/* Link URL */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Link className="h-4 w-4" />
            বাটন লিংক (ঐচ্ছিক)
          </Label>
          <Input
            placeholder="https://example.com/page"
            value={config.link}
            onChange={(e) => setConfig((p) => ({ ...p, link: e.target.value }))}
            onBlur={triggerAutoSave}
          />
          <p className="text-xs text-muted-foreground">লিংক দিলে পপআপ এর নিচে বাটন দেখাবে</p>
        </div>

        {/* Button Title */}
        {config.link && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">বাটন টাইটেল</Label>
            <Input
              placeholder="বিস্তারিত দেখুন"
              value={config.buttonTitle}
              onChange={(e) => setConfig((p) => ({ ...p, buttonTitle: e.target.value }))}
              onBlur={triggerAutoSave}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
        </Button>
        <Button variant="outline" onClick={() => setShowPreview(true)} className="gap-2">
          <Eye className="h-4 w-4" />
          প্রিভিউ
        </Button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-[90vw] max-w-[400px] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="bg-primary px-5 py-3.5 flex items-center justify-between">
              <span className="text-white font-semibold text-sm">পপআপ প্রিভিউ</span>
              <button
                onClick={() => setShowPreview(false)}
                className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
            {/* Preview Body */}
            <div className="p-5 space-y-3">
              {config.image && (
                <img src={config.image} alt="পপআপ প্রিভিউ" className="w-full rounded-xl object-contain max-h-[160px]" />
              )}
              {config.content ? (
                <div
                  className="text-sm text-foreground"
                  style={{ lineHeight: '1.7' }}
                  dangerouslySetInnerHTML={{ __html: config.content }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">কন্টেন্ট নেই</p>
              )}
              {config.link && (
                <a
                  href={config.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {config.buttonTitle || 'বিস্তারিত দেখুন'}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  title,
  children,
  onMouseDown,
}: {
  title: string;
  children: React.ReactNode;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </button>
  );
}
