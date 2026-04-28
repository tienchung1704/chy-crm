import React from 'react';
import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function formatVnDate(date: string | Date | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date(date));
}

// Ensure star icon component is available, or use emojis
const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex text-yellow-400 text-sm">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star}>{star <= rating ? '★' : '☆'}</span>
      ))}
    </div>
  );
};

export default async function StoreProfilePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { categoryId?: string; tab?: string; page?: string };
}) {
  const { slug } = params;
  const currentTab = searchParams.tab || 'products';
  const currentCategory = searchParams.categoryId || null;
  const pageParam = parseInt(searchParams.page || '1', 10);

  let store: any = null;
  let productsData: any = { data: [], meta: {} };
  let categories: any[] = [];
  let reviews: any[] = [];

  try {
    // 1. Fetch store info
    store = await apiClient.get(`/stores/public/${slug}`);
  } catch (error: any) {
    console.error('Error fetching store:', error?.message, 'status:', error?.status || error?.response?.status);
    if (error?.status === 404 || error?.response?.status === 404) {
      notFound();
    }
    // store remains null → will show "Cửa hàng không tồn tại"
  }

  if (store) {
    try {
      // 2. Fetch store categories (public endpoint with storeId filter)
      const allCategories = await apiClient.get<any[]>(`/categories?storeId=${store.id}`);
      categories = allCategories.filter(c => c.storeId === store.id);
      
      // 3. Fetch products based on tab
      if (currentTab === 'products') {
        const qs = new URLSearchParams();
        qs.append('storeSlug', slug);
        qs.append('limit', '1000');
        if (currentCategory) qs.append('categoryId', currentCategory);
        productsData = await apiClient.get(`/products?${qs.toString()}`);
      } else if (currentTab === 'reviews') {
        // 4. Fetch store reviews
        reviews = await apiClient.get(`/stores/public/${slug}/reviews`);
      }
    } catch (error: any) {
      console.error('Error fetching store data:', error?.message);
    }
  }

  const pageSize = 24;
  let paginatedProducts: any[] = [];
  let totalPages = 1;
  let totalProducts = 0;

  if (currentTab === 'products' && productsData.data) {
    totalProducts = productsData.data.length;
    totalPages = Math.ceil(totalProducts / pageSize);
    paginatedProducts = productsData.data.slice((pageParam - 1) * pageSize, pageParam * pageSize);
  }

  if (!store) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">🏪</div>
        <h2 className="text-2xl font-bold mb-2">Cửa hàng không tồn tại</h2>
        <p>Cửa hàng bạn tìm kiếm không tồn tại hoặc đã bị khóa.</p>
        <Link href="/portal/products" className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Quay lại trang sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Store Banner */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
          {/* We can put a cover image here in the future if store has one */}
          <div className="absolute inset-0 bg-black/10"></div>
        </div>
        <div className="px-8 pb-8 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 sm:-mt-12 gap-6 mb-6">
            <div className="w-32 h-32 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">🏪</span>
              )}
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{store.name}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  📦 {store._count?.products || 0} Sản phẩm
                </span>
                <span className="flex items-center gap-1">
                  📅 Tham gia {formatVnDate(store.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  👤 Chủ shop: {store.owner?.name || 'Khách hàng'}
                </span>
              </div>
            </div>
          </div>

          {store.description && (
            <div className="bg-gray-50 p-4 rounded-xl text-gray-700 text-sm mb-6">
              {store.description}
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-200">
            <Link 
              href={`/portal/store/${slug}?tab=products`}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                currentTab === 'products' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Sản phẩm
            </Link>
            <Link 
              href={`/portal/store/${slug}?tab=categories`}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                currentTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Danh mục
            </Link>
            <Link 
              href={`/portal/store/${slug}?tab=reviews`}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                currentTab === 'reviews' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Đánh giá
            </Link>
            <Link 
              href={`/portal/store/${slug}?tab=about`}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                currentTab === 'about' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Thông tin cửa hàng
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* PRODUCTS TAB */}
        {currentTab === 'products' && (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Categories Filter */}
            {categories.length > 0 && (
              <div className="w-full md:w-64 shrink-0">
                <div className="bg-white rounded-xl shadow-sm p-4 sticky top-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-lg">📁</span> Danh mục Shop
                  </h3>
                  <div className="space-y-1">
                    <Link
                      href={`/portal/store/${slug}?tab=products`}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        !currentCategory ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Tất cả sản phẩm
                    </Link>
                    {categories.map((c: any) => (
                      <Link
                        key={c.id}
                        href={`/portal/store/${slug}?tab=products&categoryId=${c.id}`}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${
                          currentCategory === c.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate pr-2">{c.name}</span>
                        {c._count?.products > 0 && (
                          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                            {c._count.products}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {currentCategory ? categories.find(c => c.id === currentCategory)?.name : 'Tất cả sản phẩm'}
                </h2>
                <span className="text-gray-500 text-sm">{productsData.meta.total || 0} sản phẩm</span>
              </div>

              {productsData.data && productsData.data.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {paginatedProducts.map((product: any) => (
                    <Link 
                      key={product.id} 
                      href={`/portal/products/${product.slug}`}
                      className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all group block"
                    >
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            No Image
                          </div>
                        )}
                        {product.salePrice && product.originalPrice && product.salePrice < product.originalPrice && (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                            -{Math.round((1 - product.salePrice / product.originalPrice) * 100)}%
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium text-gray-800 text-sm line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
                          {product.name}
                        </h3>
                        <div className="flex items-end gap-2">
                          <span className="font-bold text-indigo-600">
                            {fmt(product.salePrice || product.originalPrice)}
                          </span>
                          {product.salePrice && product.originalPrice && product.salePrice < product.originalPrice && (
                            <span className="text-xs text-gray-400 line-through mb-0.5">
                              {fmt(product.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Link
                      href={`/portal/store/${slug}?tab=products${currentCategory ? `&categoryId=${currentCategory}` : ''}&page=${Math.max(1, pageParam - 1)}`}
                      className={`px-4 py-2 rounded-lg border ${pageParam === 1 ? 'border-gray-200 text-gray-400 pointer-events-none' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      Trước
                    </Link>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <Link
                          key={p}
                          href={`/portal/store/${slug}?tab=products${currentCategory ? `&categoryId=${currentCategory}` : ''}&page=${p}`}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-colors ${pageParam === p ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {p}
                        </Link>
                      ))}
                    </div>
                    <Link
                      href={`/portal/store/${slug}?tab=products${currentCategory ? `&categoryId=${currentCategory}` : ''}&page=${Math.min(totalPages, pageParam + 1)}`}
                      className={`px-4 py-2 rounded-lg border ${pageParam === totalPages ? 'border-gray-200 text-gray-400 pointer-events-none' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      Sau
                    </Link>
                  </div>
                )}
                </>
              ) : (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-gray-100">
                  <div className="text-5xl mb-4 opacity-50">🛍️</div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Không có sản phẩm nào</h3>
                  <p className="text-gray-500 text-sm">Cửa hàng hiện chưa có sản phẩm trong danh mục này.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {currentTab === 'categories' && (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Danh mục của {store.name}</h2>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/portal/store/${slug}?tab=products&categoryId=${c.id}`}
                    className="bg-gray-50 border border-gray-100 p-6 rounded-xl text-center hover:bg-indigo-50 hover:border-indigo-100 transition-colors group"
                  >
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📁</div>
                    <h3 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors mb-1">{c.name}</h3>
                    <p className="text-xs text-gray-500">{c._count?.products || 0} sản phẩm</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Cửa hàng chưa tạo danh mục nào.</p>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {currentTab === 'reviews' && (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Đánh giá từ khách hàng</h2>
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                          {r.user?.avatarUrl ? (
                            <img src={r.user.avatarUrl} alt={r.user.name} className="w-full h-full object-cover" />
                          ) : (
                            r.user?.name?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{r.user?.name || 'Khách hàng'}</div>
                          <div className="text-xs text-gray-500">{formatVnDate(r.createdAt)}</div>
                        </div>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-gray-700 text-sm mb-3 mt-3">{r.comment}</p>
                    )}
                    <Link href={`/portal/products/${r.product.slug}`} className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded inline-flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                      <span className="opacity-70">Sản phẩm:</span> <span className="font-medium">{r.product.name}</span>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 opacity-50">⭐</div>
                <p className="text-gray-500">Cửa hàng chưa có đánh giá nào.</p>
              </div>
            )}
          </div>
        )}

        {/* ABOUT TAB */}
        {currentTab === 'about' && (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Về {store.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Thông tin liên hệ</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-xl">📧</span>
                    <div>
                      <span className="block text-gray-500 mb-0.5">Email</span>
                      <span className="font-medium text-gray-800">{store.email || 'Chưa cập nhật'}</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-xl">📞</span>
                    <div>
                      <span className="block text-gray-500 mb-0.5">Số điện thoại</span>
                      <span className="font-medium text-gray-800">{store.phone || 'Chưa cập nhật'}</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-xl">📍</span>
                    <div>
                      <span className="block text-gray-500 mb-0.5">Địa chỉ</span>
                      <span className="font-medium text-gray-800">
                        {store.addressStreet ? `${store.addressStreet}, ${store.addressWard}, ${store.addressDistrict}, ${store.addressProvince}` : 'Chưa cập nhật'}
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Chính sách cửa hàng</h3>
                <ul className="space-y-3 text-sm text-gray-600 list-disc pl-5">
                  <li>Hỗ trợ thanh toán khi nhận hàng (COD): <span className="font-semibold text-green-600">{store.allowCOD ? 'Có' : 'Không'}</span></li>
                  <li>Cam kết sản phẩm chất lượng, đóng gói cẩn thận.</li>
                  <li>Theo dõi cửa hàng để nhận thêm voucher ưu đãi.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
