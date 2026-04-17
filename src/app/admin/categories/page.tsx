import React from 'react';
import prisma from '@/lib/prisma';
import CategoryActions from '@/components/admin/CategoryActions';
import CategoryTree from '@/components/admin/CategoryTree';

async function getCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  // Organize categories by hierarchy
  const rootCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Danh mục sản phẩm</h1>
          <p className="text-gray-600 text-sm">
            Quản lý danh mục và phân loại sản phẩm
          </p>
        </div>
        <CategoryActions categories={categories.map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng danh mục</div>
          <div className="text-3xl font-bold text-gray-800">{categories.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Danh mục gốc</div>
          <div className="text-3xl font-bold text-gray-800">{rootCategories.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Danh mục con</div>
          <div className="text-3xl font-bold text-gray-800">{childCategories.length}</div>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-800">Tất cả danh mục</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên danh mục</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Danh mục cha</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sản phẩm</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thứ tự</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <CategoryTree categories={categories} />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
