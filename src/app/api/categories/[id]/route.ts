import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug, description, parentId, sortOrder, isActive } = body;

    // Check if slug is taken by another category
    const existingSlug = await prisma.category.findFirst({
      where: { slug, NOT: { id } },
    });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 400 });
    }

    // Prevent circular parent relationship
    if (parentId) {
      let currentParentId = parentId;
      const visited = new Set([id]);
      
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          return NextResponse.json(
            { error: 'Không thể tạo vòng lặp danh mục cha-con' },
            { status: 400 }
          );
        }
        visited.add(currentParentId);
        
        const parent = await prisma.category.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        
        currentParentId = parent?.parentId || null;
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Lỗi cập nhật danh mục' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Get all descendant categories recursively
    const getAllDescendants = async (categoryId: string): Promise<string[]> => {
      const children = await prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });

      const childIds = children.map(c => c.id);
      const allDescendants = [...childIds];

      // Recursively get descendants of each child
      for (const childId of childIds) {
        const descendants = await getAllDescendants(childId);
        allDescendants.push(...descendants);
      }

      return allDescendants;
    };

    const descendantIds = await getAllDescendants(id);
    const allCategoryIds = [id, ...descendantIds];

    // Check if any category (parent or children) has products
    const productsCount = await prisma.product.count({
      where: {
        categories: {
          some: {
            id: { in: allCategoryIds },
          },
        },
      },
    });

    if (productsCount > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa danh mục có sản phẩm (bao gồm cả danh mục con)' },
        { status: 400 }
      );
    }

    // Delete all categories (children first, then parent)
    // Prisma will handle the order automatically with cascade
    await prisma.category.deleteMany({
      where: {
        id: { in: allCategoryIds },
      },
    });

    return NextResponse.json({ 
      success: true, 
      deletedCount: allCategoryIds.length 
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: 'Lỗi xóa danh mục' },
      { status: 500 }
    );
  }
}
