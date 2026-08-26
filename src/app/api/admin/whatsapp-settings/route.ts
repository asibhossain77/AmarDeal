import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

const ALL_KEYS = [
  'wa_phone_number_id',
  'wa_access_token',
  'wa_template_namespace',
] as const;

const WA_DEFAULTS: Record<string, string> = {
  wa_phone_number_id: '',
  wa_access_token: '',
  wa_template_namespace: '',
};

const WA_TEMPLATE_TYPES = [
  'deal_created',
  'payment_submitted',
  'payment_verified',
  'delivery_started',
  'deal_completed',
  'deal_cancelled',
  'dispute_raised',
  'dispute_resolved',
  'payout_requested',
  'payout_completed',
];

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const rows = await db.platformSetting.findMany({
      where: { key: { in: [...ALL_KEYS, ...WA_TEMPLATE_TYPES.map(t => `wa_off_${t}`)] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const result: Record<string, string> = {};
    for (const k of ALL_KEYS) result[k] = map[k] || WA_DEFAULTS[k] || '';

    // Mask access token for display
    if (result.wa_access_token && result.wa_access_token.length > 8) {
      result.wa_access_token = result.wa_access_token.slice(0, 8) + '••••••••';
    }

    // Return disabled templates as a single object
    const disabled: Record<string, boolean> = {};
    for (const t of WA_TEMPLATE_TYPES) {
      disabled[t] = map[`wa_off_${t}`] === '1';
    }
    result._disabledTemplates = JSON.stringify(disabled);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'WhatsApp সেটিংস লোড করতে সমস্যা' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const body = await req.json();

    for (const key of ALL_KEYS) {
      if (body[key] !== undefined && typeof body[key] === 'string') {
        await db.platformSetting.upsert({
          where: { key },
          create: { key, value: body[key] },
          update: { value: body[key] },
        });
      }
    }

    // Handle template toggle (wa_off_xxx = '1' or delete if enabled)
    if (body._disabledTemplates) {
      try {
        const disabledMap: Record<string, boolean> = JSON.parse(body._disabledTemplates);
        for (const [type, isOff] of Object.entries(disabledMap)) {
          const key = `wa_off_${type}`;
          if (isOff) {
            await db.platformSetting.upsert({
              where: { key },
              create: { key, value: '1' },
              update: { value: '1' },
            });
          } else {
            await db.platformSetting.deleteMany({ where: { key } }).catch(() => {});
          }
        }
      } catch {}
    }

    // Clear in-memory cache
    const { clearWaSettingsCache, clearWaDisabledTemplatesCache } = await import('@/lib/whatsapp');
    clearWaSettingsCache();
    clearWaDisabledTemplatesCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WA SETTINGS SAVE ERROR]', err);
    return NextResponse.json(
      { error: 'WhatsApp সেটিংস সেভ করতে সমস্যা' },
      { status: 500 },
    );
  }
}
