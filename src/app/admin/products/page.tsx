import React from 'react';
import prisma from '@/lib/prisma';
import ProductActions from '@/components/admin/ProductActions';
import ProductRowActions from '@/components/admin/ProductRowActions';

async function getProducts() {
  return prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      categories: { select: { id: true, name: true } },
      variants: { include: { size: true, color: true } },
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  const activeProducts = products.filter(p => p.isActive);
  const totalStock = products.reduce((sum, p) => sum + p.stockQuantity, 0);
  const lowStock = products.filter(p => p.stockQuantity < 10 && p.isActive);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Sản phẩm</h1>
          <p className="text-gray-600 text-sm">
            Quản lý sản phẩm và kho hàng
          </p>
        </div>
        <ProductActions categories={categories} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng sản phẩm</div>
          <div className="text-3xl font-bold text-gray-800">{products.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Đang hoạt động</div>
          <div className="text-3xl font-bold text-green-600">{activeProducts.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng tồn kho</div>
          <div className="text-3xl font-bold text-gray-800">{totalStock}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Sắp hết hàng</div>
          <div className="text-3xl font-bold text-orange-600">{lowStock.length}</div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-800">Tất cả sản phẩm</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sản phẩm</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Danh mục</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Giá gốc</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Giá sale</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tồn kho</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã bán</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="text-center py-12">
                      <div className="text-6xl mb-3">📦</div>
                      <div className="text-xl font-semibold text-gray-800 mb-2">Chưa có sản phẩm nào</div>
                      <div className="text-gray-600">Tạo sản phẩm đầu tiên để bắt đầu bán hàng</div>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                            📦
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-800">{product.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{product.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.sku ? (
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {product.sku}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.categories.map(cat => (
                            <span
                              key={cat.id}
                              className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {formatCurrency(product.originalPrice)}
                    </td>
                    <td className="px-6 py-4">
                      {product.salePrice ? (
                        <span className="font-semibold text-green-600">
                          {formatCurrency(product.salePrice)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          product.stockQuantity === 0
                            ? 'bg-red-100 text-red-700'
                            : product.stockQuantity < 10
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {product._count.orderItems}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          product.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {product.isActive ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ProductRowActions 
                        product={{
                          ...product,
                          categories: product.categories.map(c => ({ id: c.id, name: c.name })),
                          variants: product.variants,
                        }}
                        allCategories={categories}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
