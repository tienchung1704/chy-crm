'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heart, ShoppingCart, Sparkles, Eye, Star, Search, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CategoryFilter from './CategoryFilter';

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set(initialWishlistIds));
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Get min and max prices from products
  const prices = products.flatMap(p => {
    const finalPrices = [p.salePrice || p.originalPrice];
    if (p.variants?.length) {
      p.variants.forEach(v => {
        if (v.price) finalPrices.push(v.price);
      });
    }
    return finalPrices;
  });
  const minPrice = Math.min(...prices, 0);
  const maxPrice = Math.max(...prices, 10000000);

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

    // Filter by category
    if (selectedCategoryId) {
      const categoryIds = getChildCategoryIds(selectedCategoryId);
      const hasCategory = p.categories.some(cat => {
        const category = categories.find(c => c.name === cat.name);
        return category && categoryIds.includes(category.id);
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

    return true;
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (togglingIds.has(productId)) return;

    setTogglingIds(prev => new Set(prev).add(productId));

    try {
      const res = await fetch('/api/portal/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/portal/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      `}</style>

      <div className="max-w-7xl mx-auto px-4">
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">  
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sản phẩm</h1>
              <p className="text-sm text-gray-500">Khám phá bộ sưu tập của chúng tôi</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Tìm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 text-sm text-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all w-full sm:w-64 md:w-80 shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-4 border-l border-gray-200 pl-4 h-10">
              <div className="text-sm text-gray-500 whitespace-nowrap">
                Tìm thấy <span className="font-bold text-indigo-600">{filteredProducts.length}</span> sản phẩm
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full whitespace-nowrap">
                <Heart className="w-4 h-4 fill-rose-500" />
                {wishlistIds.size}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* Category Filter */}
            <CategoryFilter
              categories={categories}
              onFilterChange={setSelectedCategoryId}
            />

            {/* Price Filter */}
            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-[calc(1rem+400px)]">
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
          </div>

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredProducts.map(product => {
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

                  const displayPriceRangeString = minPrice === maxPrice 
                    ? formatCurrency(minPrice) 
                    : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
                    
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
                      key={product.id}
                      className="group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative cursor-pointer"
                      onClick={() => router.push(`/portal/products/${product.slug}`)}
                    >
                      {/* Product Image */}
                      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
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
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm ${
                              copiedProductId === product.id
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
                      <div className="p-4">
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
                        <div className="mb-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                              {displayPriceRangeString}
                            </span>
                          </div>
                          {hasDiscount && (
                            <div className="mt-0.5">
                              <span className="text-xs text-gray-400 line-through font-medium">
                                {minOriginalPrice === maxOriginalPrice
                                  ? formatCurrency(minOriginalPrice)
                                  : `${formatCurrency(minOriginalPrice)} - ${formatCurrency(maxOriginalPrice)}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Stock & Sold Info */}
                        {!outOfStock && (
                          <div className="mb-3 flex items-center justify-between text-[11px] text-gray-500 bg-gray-50/50 px-2.5 py-1.5 rounded-lg">
                            <span>Còn lại: <strong className="text-gray-700">{product.stockQuantity}</strong></span>
                            <span>Đã bán: <strong className="text-gray-700">{product.soldCount}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
