'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heart, ShoppingCart, Eye, Star, Search, Share2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CategoryFilter from './CategoryFilter';
import tinhData from '@/data/tinh_tp.json';

const provinces = Object.values(tinhData as Record<string, { code: string; name: string; type: string }>).map(p => ({
  id: p.code,
  name: p.name,
  isMajor: ['01', '79', '48', '31', '92'].includes(p.code)
})).sort((a, b) => {
  if (a.isMajor && !b.isMajor) return -1;
  if (!a.isMajor && b.isMajor) return 1;
  return a.name.localeCompare(b.name, 'vi');
});

const ITEMS_PER_PAGE = 24;

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  originalPrice: number;
  salePrice: number | null;
  stockQuantity: number;
  soldCount: number;
  isComboSet: boolean;
  categories: { name: string }[];
  variants?: { price: number | null }[];
  store?: { name: string; slug: string; logoUrl: string | null; addressProvince?: string | null } | null;
}

interface ProductsClientProps {
  products: Product[];
  categories: Category[];
  initialWishlistIds: string[];
  userReferralCode: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductsClient({ products, categories, initialWishlistIds, userReferralCode }: ProductsClientProps) {
  const router = useRouter();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Get min and max prices dynamically
  const prices = products.flatMap(p => {
    const finalPrices = [p.salePrice || p.originalPrice];
    if (p.variants?.length) {
      p.variants.forEach(v => {
        if (v.price) finalPrices.push(v.price);
      });
    }
    return finalPrices;
  });

  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices, 10000000) : 10000000;

  // Initialize priceRange using actual max price from products
  const [priceRange, setPriceRange] = useState<[number, number]>([0, Math.max(10000000, maxPrice)]);

  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set(initialWishlistIds));
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCategoryIds, priceRange, selectedProvinceId]);

  // Filter products by selected category (including all child categories)
  const getChildCategoryIds = (categoryId: string): string[] => {
    const children = categories.filter(c => c.parentId === categoryId);
    const childIds = children.map(c => c.id);
    const grandChildIds = children.flatMap(c => getChildCategoryIds(c.id));
    return [categoryId, ...childIds, ...grandChildIds];
  };

  const filteredProducts = products.filter(p => {
    // Search query
    if (debouncedSearchQuery) {
      if (!p.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) {
        return false;
      }
    }

    // Filter by categories
    if (selectedCategoryIds.length > 0) {
      const allowedCategoryIds = selectedCategoryIds.flatMap(id => getChildCategoryIds(id));
      const hasCategory = p.categories.some(cat => {
        const category = categories.find(c => c.name === cat.name);
        return category && allowedCategoryIds.includes(category.id);
      });
      if (!hasCategory) return false;
    }

    // Filter by price
    const finalPrices = [p.salePrice || p.originalPrice];
    if (p.variants?.length) {
      p.variants.forEach(v => {
        if (v.price) finalPrices.push(v.price);
      });
    }
    const pMin = Math.min(...finalPrices);
    const pMax = Math.max(...finalPrices);

    // Show if product's price range overlaps with the selected price range
    if (pMax < priceRange[0] || pMin > priceRange[1]) return false;

    // Filter by location (province)
    if (selectedProvinceId) {
      const provinceObj = provinces.find(pr => pr.id === selectedProvinceId);
      if (provinceObj) {
        if (!p.store?.addressProvince || !p.store.addressProvince.includes(provinceObj.name)) {
          return false;
        }
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (togglingIds.has(productId)) return;

    setTogglingIds(prev => new Set(prev).add(productId));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();

      if (res.ok) {
        setWishlistIds(prev => {
          const next = new Set(prev);
          if (data.action === 'added') {
            next.add(productId);
          } else {
            next.delete(productId);
          }
          return next;
        });
        showToast(
          data.action === 'added' ? '💖 Đã thêm vào yêu thích!' : '💔 Đã bỏ yêu thích',
          'success',
        );
      }
    } catch {
      showToast('Có lỗi xảy ra', 'error');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleAddToCart = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (addingToCart.has(productId)) return;

    setAddingToCart(prev => new Set(prev).add(productId));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (res.ok) {
        showToast('🛒 Đã thêm vào giỏ hàng!', 'success');
      }
    } catch {
      showToast('Có lỗi xảy ra', 'error');
    } finally {
      setAddingToCart(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleShareProduct = async (productSlug: string, productId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Tạo URL với referral code nếu có
    let productUrl = `${window.location.origin}/portal/products/${productSlug}`;
    if (userReferralCode) {
      productUrl += `?ref=${userReferralCode}`;
    }

    try {
      await navigator.clipboard.writeText(productUrl);
      setCopiedProductId(productId);
      showToast('📋 Đã copy link giới thiệu!', 'success');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedProductId(null);
      }, 2000);
    } catch {
      showToast('Không thể copy link', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all duration-300 animate-slide-in ${toast.type === 'success'
            ? 'bg-white text-gray-800 border border-green-200'
            : 'bg-white text-red-600 border border-red-200'
            }`}
          style={{
            animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-in 2.2s forwards',
          }}
        >
          {toast.message}
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .heart-pop {
          animation: heartPop 0.3s ease-out;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-scale {
          animation: fadeScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4">
        {/* Page Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sản phẩm</h1>
              <p className="text-sm text-gray-500">Khám phá bộ sưu tập của chúng tôi</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[540px]">
            {/* Desktop Layout */}
            <div className="hidden sm:flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-800 outline-none transition focus:border-gray-900"
                />
              </div>

              <div className="inline-flex h-11 min-w-[150px] items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4">
                <span className="text-sm font-medium text-gray-500">Kết quả</span>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base font-semibold text-gray-900">{filteredProducts.length}</span>
                  <span className="text-sm text-gray-500">sản phẩm</span>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
              {totalPages > 1 && (
                <div className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-500 shadow-sm">
                  Trang <span className="ml-1 font-semibold text-gray-900">{currentPage}</span>
                  <span className="mx-1 text-gray-300">/</span>
                  <span>{totalPages}</span>
                </div>
              )}
              <div className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-sm font-medium text-rose-600">
                <Heart className="h-4 w-4 fill-rose-500" />
                {wishlistIds.size}
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="flex sm:hidden flex-col gap-3">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-800 outline-none transition focus:border-gray-900"
                />
              </div>

              {/* Mobile Category Buttons */}
              <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
                <div className={`grid gap-2 auto-cols-max grid-flow-col ${categories.length > 15 ? 'grid-rows-3' : categories.length > 10 ? 'grid-rows-2' : 'grid-rows-1'}`}>
                  {categories.filter(c => !c.parentId).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        if (selectedCategoryIds.includes(cat.id)) {
                          setSelectedCategoryIds(prev => prev.filter(id => id !== cat.id));
                        } else {
                          setSelectedCategoryIds(prev => [...prev, cat.id]);
                        }
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${selectedCategoryIds.includes(cat.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 h-11 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium active:scale-95 transition-transform"
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm text-gray-700 font-semibold">Lọc</span>
                </button>
                <div className="flex flex-col items-center justify-center h-11 bg-white border border-gray-200 rounded-xl px-2">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider leading-none mb-0.5">Kết quả</span>
                  <span className="text-sm font-bold text-gray-900 leading-none">{filteredProducts.length} SP</span>
                </div>
                <button
                  className="flex items-center justify-center gap-1.5 h-11 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-medium"
                >
                  <Heart className="w-4 h-4 fill-rose-500" />
                  <span className="text-sm font-bold">{wishlistIds.size}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar - Filters (Desktop Only) */}
          <div className="hidden md:block w-full md:w-64 flex-shrink-0 space-y-4">
            {/* Category Filter */}
            <CategoryFilter
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
              onFilterChange={setSelectedCategoryIds}
            />

            {/* Price Filter */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Khoảng giá</h3>

              {/* Price Range Display */}
              <div className="mb-4 text-sm text-gray-600">
                <div className="flex justify-between items-center">
                  <span>{formatCurrency(priceRange[0])}</span>
                  <span>-</span>
                  <span>{formatCurrency(priceRange[1])}</span>
                </div>
              </div>

              {/* Min Price Slider */}
              <div className="mb-4">
                <label className="block text-xs text-gray-600 mb-2">Giá tối thiểu</label>
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={100000}
                  value={priceRange[0]}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    if (newMin <= priceRange[1]) {
                      setPriceRange([newMin, priceRange[1]]);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Max Price Slider */}
              <div className="mb-4">
                <label className="block text-xs text-gray-600 mb-2">Giá tối đa</label>
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={100000}
                  value={priceRange[1]}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    if (newMax >= priceRange[0]) {
                      setPriceRange([priceRange[0], newMax]);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Quick Price Filters */}
              <div className="space-y-2">
                <button
                  onClick={() => setPriceRange([0, 500000])}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Dưới 500k
                </button>
                <button
                  onClick={() => setPriceRange([500000, 1000000])}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  500k - 1 triệu
                </button>
                <button
                  onClick={() => setPriceRange([1000000, 2000000])}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  1 - 2 triệu
                </button>
                <button
                  onClick={() => setPriceRange([2000000, maxPrice])}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Trên 2 triệu
                </button>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => setPriceRange([minPrice, maxPrice])}
                className="w-full mt-4 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Đặt lại
              </button>
            </div>

            {/* Location Filter (Desktop) */}
            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-[calc(1rem+650px)] mt-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Khu vực</h3>
              <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                <button
                  onClick={() => setSelectedProvinceId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedProvinceId ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  Tất cả khu vực
                </button>
                {provinces.map(prov => (
                  <button
                    key={prov.id}
                    onClick={() => setSelectedProvinceId(prov.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedProvinceId === prov.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {prov.name} {prov.isMajor && <span className="text-indigo-500 font-bold ml-1">*</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Filter Modal */}
          {isFilterModalOpen && (
            <div className="fixed inset-0 z-[100] flex md:hidden flex-col bg-white animate-fade-scale">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Lọc sản phẩm</h2>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 text-gray-500 bg-gray-50 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                {/* Price Filter */}
                <div className="pt-2">
                  <h3 className="font-bold text-gray-800 mb-3">Khoảng giá</h3>
                  <div className="mb-4 text-sm text-gray-600 font-medium bg-gray-50 p-3 rounded-lg text-center">
                    {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Từ</label>
                      <input
                        type="range"
                        min={minPrice} max={maxPrice} step={100000}
                        value={priceRange[0]}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value);
                          if (newMin <= priceRange[1]) setPriceRange([newMin, priceRange[1]]);
                        }}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Đến</label>
                      <input
                        type="range"
                        min={minPrice} max={maxPrice} step={100000}
                        value={priceRange[1]}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value);
                          if (newMax >= priceRange[0]) setPriceRange([priceRange[0], newMax]);
                        }}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none accent-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Location Filter */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="font-bold text-gray-800 mb-3">Khu vực</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedProvinceId(null)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${!selectedProvinceId ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                    >
                      Tất cả
                    </button>
                    {provinces.filter(p => p.isMajor).map(prov => (
                      <button
                        key={prov.id}
                        onClick={() => setSelectedProvinceId(prov.id)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${selectedProvinceId === prov.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                      >
                        {prov.name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <select
                      value={selectedProvinceId || ''}
                      onChange={(e) => setSelectedProvinceId(e.target.value || null)}
                      className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                      <option value="">Chọn tỉnh thành khác...</option>
                      {provinces.filter(p => !p.isMajor).map(prov => (
                        <option key={prov.id} value={prov.id}>{prov.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedCategoryIds([]);
                      setPriceRange([minPrice, maxPrice]);
                      setSelectedProvinceId(null);
                    }}
                    className="w-1/3 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold"
                  >
                    Đặt lại
                  </button>
                  <button
                    onClick={() => setIsFilterModalOpen(false)}
                    className="w-2/3 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-200"
                  >
                    Áp dụng ({filteredProducts.length} SP)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Right Content - Products */}
          <div className="flex-1">

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <Eye className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Không tìm thấy sản phẩm
                </h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Thử thay đổi bộ lọc hoặc danh mục để tìm sản phẩm phù hợp
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {currentProducts.map((product, index) => {
                    const finalPrices = [product.salePrice || product.originalPrice];
                    const originalPrices = [product.originalPrice];

                    if (product.variants?.length) {
                      product.variants.forEach(v => {
                        if (v.price) {
                          finalPrices.push(v.price);
                          // We assume variant price replaces both sale and original price since admin only inputs 1 price for variant
                          originalPrices.push(v.price);
                        }
                      });
                    }

                    const minPrice = Math.min(...finalPrices);
                    const maxPrice = Math.max(...finalPrices);
                    const minOriginalPrice = Math.min(...originalPrices);
                    const maxOriginalPrice = Math.max(...originalPrices);

                    const displayPriceString = formatCurrency(minPrice);

                    // Has discount if at least one price was discounted
                    const hasDiscount = minPrice < minOriginalPrice || maxPrice < maxOriginalPrice;

                    // For the discount tag, maybe just find max discount percent. Or keep it simple.
                    const maxDiscountPercent = hasDiscount
                      ? Math.round(((product.originalPrice - product.salePrice!) / product.originalPrice) * 100)
                      : 0;

                    const isWishlisted = wishlistIds.has(product.id);
                    const isToggling = togglingIds.has(product.id);
                    const outOfStock = product.stockQuantity === 0;

                    return (
                      <div
                        key={`${product.id}-${currentPage}-${debouncedSearchQuery}-${selectedCategoryIds.join(',')}-${priceRange[0]}-${priceRange[1]}`}
                        className="group animate-fade-scale bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative cursor-pointer"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => router.push(`/portal/products/${product.slug}`)}
                      >
                        {/* Product Image */}
                        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden" style={{ paddingBottom: 'calc(100% + 15px)' }}>
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                <ShoppingCart className="w-8 h-8 text-blue-300" />
                              </div>
                            </div>
                          )}

                          {/* Overlay gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                          {/* Action Buttons */}
                          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                            {/* Wishlist Button */}
                            <button
                              onClick={(e) => toggleWishlist(product.id, e)}
                              disabled={isToggling}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm ${isWishlisted
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                                : 'bg-white/80 text-gray-400 hover:bg-white hover:text-rose-500 shadow-sm'
                                } ${isToggling ? 'opacity-50 cursor-wait' : 'hover:scale-110 active:scale-95'}`}
                              title={isWishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                            >
                              <Heart
                                className={`w-4 h-4 ${isWishlisted ? 'fill-current heart-pop' : ''}`}
                              />
                            </button>

                            {/* Share Button */}
                            <button
                              onClick={(e) => handleShareProduct(product.slug, product.id, e)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm ${copiedProductId === product.id
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-white/80 text-gray-400 hover:bg-white hover:text-blue-500 shadow-sm hover:scale-110 active:scale-95'
                                }`}
                              title="Chia sẻ sản phẩm"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>



                          {/* Combo Badge */}
                          {product.isComboSet && (
                            <div className="absolute bottom-3 left-3 z-10">
                              <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg">
                                <Star className="w-3 h-3 fill-current" />
                                Combo
                              </div>
                            </div>
                          )}

                          {/* Out of Stock Overlay */}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center z-10">
                              <div className="bg-gray-900/80 text-white px-4 py-2 rounded-xl text-sm font-semibold backdrop-blur-sm">
                                Hết hàng
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-4 flex flex-col flex-1">
                          {/* Store Info - Only show if product belongs to a store (not admin/main store) */}
                          {product.store && !product.store.slug.startsWith('main-store') && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {product.store.logoUrl ? (
                                  <img src={product.store.logoUrl} alt={product.store.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-bold text-gray-500">{(product.store.name || 'S').charAt(0)}</span>
                                )}
                              </div>
                              <span className="text-[11px] font-medium text-gray-500 truncate" title={product.store.name}>
                                {product.store.name}
                              </span>
                            </div>
                          )}

                          {/* Discount Tag */}
                          {hasDiscount && (
                            <div className="flex flex-wrap gap-1.5 mb-2 justify-between items-center">
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-md text-[11px] font-bold tracking-wide">
                                Giảm {maxDiscountPercent}%
                              </span>
                              <span className="px-4 bg-green-50 border border-green-100 text-green-600 rounded-md text-[11px] font-bold tracking-wide">
                                -{formatCurrency(Math.floor((product.originalPrice - product.salePrice!) / 1000) * 1000)}
                              </span>
                            </div>
                          )}

                          {/* Product Name */}
                          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem] leading-snug group-hover:text-blue-600 transition-colors">
                            {product.name}
                          </h3>

                          {/* Price Section */}
                          <div className="mb-3 overflow-hidden">
                            <div className="flex items-baseline whitespace-nowrap overflow-hidden">
                              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate tracking-tighter">
                                {displayPriceString}
                              </span>
                            </div>
                            {hasDiscount && (
                              <div className="mt-0.5 whitespace-nowrap overflow-hidden flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 font-medium">Giá gốc:</span>
                                <span className="text-[11px] text-gray-400 line-through font-medium opacity-80 truncate tracking-tighter">
                                  {formatCurrency(maxOriginalPrice)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Stock & Sold Info */}
                          {!outOfStock && (
                            <div className="mb-3 flex items-center justify-between text-[11px] text-gray-500">
                              <span>Còn lại: <strong className="text-gray-700">{product.stockQuantity}</strong></span>
                              <span>Đã bán: <strong className="text-gray-700">{product.soldCount}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-gray-600">
                        Hiển thị {startIndex + 1} - {Math.min(endIndex, filteredProducts.length)} trong tổng số {filteredProducts.length} sản phẩm
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Trước
                        </button>

                        <div className="flex items-center gap-1">
                          {renderPageNumbers().map((page, index) => (
                            page === '...' ? (
                              <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                                ...
                              </span>
                            ) : (
                              <button
                                key={page}
                                onClick={() => goToPage(page as number)}
                                className={`px-3 py-2 rounded-lg font-medium transition-colors ${currentPage === page
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                              >
                                {page}
                              </button>
                            )
                          ))}
                        </div>

                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          Sau
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
