import React from 'react';
import prisma from '@/lib/prisma';
import ProductsClient from '@/components/admin/ProductsClient';

import { getSession } from '@/lib/auth';

async function getProducts(role: string | null = null, storeId: string | null = null) {
  const whereClause: any = {};
  if (role === 'MODERATOR') {
    whereClause.storeId = storeId || 'no-access';
  }

  return prisma.product.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      categories: { select: { id: true, name: true } },
      variants: { include: { size: true, color: true } },
      store: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
  });
}

async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true },
  });
}

export default async function ProductsPage() {
  const session = await getSession();
  let storeId = null;
  if (session?.role === 'MODERATOR') {
    const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
    storeId = store?.id || null;
  }

  const [products, categories] = await Promise.all([
    getProducts(session?.role || null, storeId),
    getCategories(),
  ]);

  return (
    <ProductsClient 
      products={products as any} 
      categories={categories} 
      userRole={session?.role || null}
    />
  );
}
