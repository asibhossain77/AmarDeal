import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { deleteFromR2 } from '@/lib/r2';

// PATCH - admin only, update a banner by ID
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;

    // check if banner exists
    const existing = await db.marketplaceBanner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'ব্যানার পাওয়া যায়নি' }, { status: 404 });
    }

    const body = await req.json();
    const { title, subtitle, image, link, isActive, sortOrder } = body;

    // build update payload with only provided fields
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (subtitle !== undefined) data.subtitle = subtitle.trim() || null;
    if (image !== undefined) {
      const newImage = image.trim();
      data.image = newImage;
      // If the image is being replaced/removed, delete the old file from R2
      if (existing.image && existing.image !== newImage) {
        await deleteFromR2(existing.image).catch(() => {});
      }
    }
    if (link !== undefined) data.link = link.trim() || null;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (sortOrder !== undefined) data.sortOrder = typeof sortOrder === 'number' ? sortOrder : 0;

    const updated = await db.marketplaceBanner.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE - admin only, delete a banner by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;

    // check if banner exists
    const existing = await db.marketplaceBanner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'ব্যানার পাওয়া যায়নি' }, { status: 404 });
    }

    // Remove the banner image from R2 as well
    if (existing.image) {
      await deleteFromR2(existing.image).catch(() => {});
    }

    await db.marketplaceBanner.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
