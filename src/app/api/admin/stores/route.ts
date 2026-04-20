import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, slug, ownerId } = await req.json();

    if (!name || !slug || !ownerId) {
      return NextResponse.json({ error: 'Vui lòng điền đủ thông tin' }, { status: 400 });
    }

    // Verify Owner User exists
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!user) {
      return NextResponse.json({ error: 'Không tìm thấy ID người dùng này' }, { status: 404 });
    }

    // Check slug
    const existingSlug = await prisma.store.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug đã được sử dụng' }, { status: 400 });
    }

    // Check if user already owns a store
    const existingOwner = await prisma.store.findUnique({ where: { ownerId } });
    if (existingOwner) {
      return NextResponse.json({ error: 'User này đã sở hữu một cửa hàng' }, { status: 400 });
    }

    // Create store and update role to MODERATOR
    const store = await prisma.$transaction(async (tx: any) => {
      const newStore = await tx.store.create({
        data: {
          name,
          slug,
          ownerId,
        }
      });

      await tx.user.update({
        where: { id: ownerId },
        data: { role: 'MODERATOR' }
      });

      return newStore;
    });

    return NextResponse.json({ success: true, store });

  } catch (error) {
    console.error('Create store error:', error);
    return NextResponse.json({ error: 'Lỗi tạo cửa hàng' }, { status: 500 });
  }
}
