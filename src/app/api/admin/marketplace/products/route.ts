import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

// GET - admin only, returns all products with seller name
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // build where clause based on optional status filter
    const where: Record<string, unknown> = {};
    if (status && status.trim()) {
      where.status = status.trim();
    }

    const products = await db.digitalProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        category: true,
        image: true,
        status: true,
        createdAt: true,
        seller: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(products);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH - admin only, update product status
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'পণ্যের আইডি প্রয়োজন' }, { status: 400 });
    }
    if (!status || !status.trim()) {
      return NextResponse.json({ error: 'স্ট্যাটাস প্রয়োজন' }, { status: 400 });
    }

    // validate allowed status values
    const allowed = ['active', 'inactive', 'rejected'];
    if (!allowed.includes(status.trim())) {
      return NextResponse.json(
        { error: 'স্ট্যাটাস অবৈধ, অনুমোদিত: active, inactive, rejected' },
        { status: 400 }
      );
    }

    // check if product exists
    const existing = await db.digitalProduct.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি' }, { status: 404 });
    }

    await db.digitalProduct.update({
      where: { id },
      data: { status: status.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE - admin only, delete a product
export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'পণ্যের আইডি প্রয়োজন' }, { status: 400 });
    }

    // check if product exists
    const existing = await db.digitalProduct.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি' }, { status: 404 });
    }

    await db.digitalProduct.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
