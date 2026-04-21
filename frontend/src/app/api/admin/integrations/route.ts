import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: List integrations for a store
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MODERATOR'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let storeId = req.nextUrl.searchParams.get('storeId');

    if (session.role === 'MODERATOR') {
      const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
      if (!store) return NextResponse.json({ integrations: [] });
      storeId = store.id;
    } else if (session.role === 'ADMIN' && !storeId) {
      // Find or create a default store for the Admin
      let store = await prisma.store.findUnique({ where: { ownerId: session.id } });
      if (!store) {
        store = await prisma.store.create({
          data: {
            name: 'Cửa hàng chính (Main Store)',
            slug: 'main-store',
            ownerId: session.id,
            isActive: true,
          }
        });
      }
      storeId = store.id;
    }

    if (!storeId) {
      return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    }

    const integrations = await prisma.storeIntegration.findMany({
      where: { storeId },
      orderBy: { platform: 'asc' },
    });

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json({ error: 'Lỗi lấy danh sách kết nối' }, { status: 500 });
  }
}

// POST: Upsert an integration
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MODERATOR'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { storeId, platform, apiKey, apiSecret, shopId, accessToken, isActive, metadata } = body;

    if (session.role === 'MODERATOR') {
      const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
      if (!store) return NextResponse.json({ error: 'Không tìm thấy cửa hàng' }, { status: 404 });
      storeId = store.id;
    } else if (session.role === 'ADMIN' && !storeId) {
      // Find or create a default store for the Admin
      let store = await prisma.store.findUnique({ where: { ownerId: session.id } });
      if (!store) {
        store = await prisma.store.create({
          data: {
            name: 'Cửa hàng chính (Main Store)',
            slug: 'main-store-' + Date.now().toString(36),
            ownerId: session.id,
            isActive: true,
          }
        });
      }
      storeId = store.id;
    }

    if (!storeId || !platform) {
      return NextResponse.json({ error: 'storeId và platform là bắt buộc' }, { status: 400 });
    }

    const integration = await prisma.storeIntegration.upsert({
      where: { storeId_platform: { storeId, platform } },
      create: {
        storeId,
        platform,
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
        shopId: shopId || null,
        accessToken: accessToken || null,
        isActive: !!isActive,
        metadata: metadata || null,
      },
      update: {
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
        shopId: shopId || null,
        accessToken: accessToken || null,
        isActive: isActive !== undefined ? !!isActive : undefined,
        metadata: metadata || undefined,
      },
    });

    return NextResponse.json({ success: true, integration });
  } catch (error) {
    console.error('Upsert integration error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật kết nối' }, { status: 500 });
  }
}
