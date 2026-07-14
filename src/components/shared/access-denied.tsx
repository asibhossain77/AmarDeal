'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft, Lock } from 'lucide-react';

/**
 * Branded "Access Denied" page shown when a user tries to access
 * a deal that doesn't belong to them.
 */
export function AccessDenied() {
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center max-w-sm"
      >
        {/* Icon */}
        <div className="relative mb-6">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg"
            style={{ backgroundColor: '#65A30D15' }}
          >
            <ShieldX
              className="h-10 w-10"
              style={{ color: '#65A30D' }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background border shadow-sm">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground mb-2">
          অ্যাক্সেস অস্বীকৃত
        </h2>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          আপনার এই ডিল দেখার অনুমতি নেই। আপনি শুধুমাত্র নিজের
          ডিলগুলো দেখতে পারবেন।
        </p>

        {/* CTA */}
        <Button
          onClick={() => setDashboardPanel('my-deals')}
          className="h-11 rounded-xl px-8 gap-2 font-semibold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: '#65A30D',
            color: '#ffffff',
            boxShadow: '0 6px 20px rgba(101,163,13,0.3)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          ড্যাশবোর্ডে ফিরুন
        </Button>

        {/* Subtle branding */}
        <p className="mt-8 text-[11px] text-muted-foreground/40">
          আমার ডিল — নিরাপদ অনলাইন লেনদেন
        </p>
      </motion.div>
    </div>
  );
}