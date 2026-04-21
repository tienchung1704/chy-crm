import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !['ADMIN', 'STAFF', 'MODERATOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, description, parentId, sortOrder, isActive } = body;

    // Check if slug already exists
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { error: 'Lỗi tạo danh mục' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { error: 'Lỗi lấy danh sách danh mục' },
      { status: 500 }
    );
  }
}
