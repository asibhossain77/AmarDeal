import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { id } = await params;
    const body = await req.json();

    const method = await db.affiliatePaymentMethod.findUnique({ where: { id } });
    if (!method) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: any = {};
    if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim();
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (typeof body.sortOrder === 'number') updateData.sortOrder = body.sortOrder;

    const updated = await db.affiliatePaymentMethod.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const method = await db.affiliatePaymentMethod.findUnique({ where: { id } });
    if (!method) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.affiliatePaymentMethod.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
