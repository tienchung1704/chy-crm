'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heart, ShoppingBag, Truck, ShieldCheck, Undo2, Sparkles, Share2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { persistReferralCode } from '@/lib/referral-client';
import ProductReviews from './ProductReviews';

interface Size {
  id: string;
  name: string;
}

interface Color {
  id: string;
  name: string;
  hexCode?: string | null;
}

interface ProductSize {
  id: string;
  sizeId: string;
  stock: number;
  size: Size;
}

interface ProductColor {
  id: string;
  colorId: string;
  stock: number;
  color: Color;
}

interface ProductVariant {
  id: string;
  sizeId: string | null;
  colorId: string | null;
  price: number | null;
  stock: number;
  size?: Size | null;
  color?: Color | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  originalPrice: number;
  salePrice: number | null;
  stockQuantity: number;
  imageUrl: string | null;
  isComboSet: boolean;
  categories: { name: string }[];
  variants: ProductVariant[];
}

interface ProductDetailClientProps {
  product: Product;
  relatedProducts?: Product[];
  initialWishlistIds: string[];
  userReferralCode: string;
  userCompletedOrders: Array<{
    orderId: string;
    size: string | null;
    color: string | null;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetailClient({ product, relatedProducts = [], initialWishlistIds, userReferralCode, userCompletedOrders }: ProductDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isWishlist, setIsWishlist] = useState(initialWishlistIds.includes(product.id));
  const [loadingCart, setLoadingCart] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  // Save referral code from URL for signup flows.
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      persistReferralCode(refCode);
    }
  }, [searchParams]);

  // Derived states
  const availableSizes = Array.from(
    new Map(
      product.variants.filter(v => v.sizeId && v.size).map(v => [v.size!.id, v.size!])
    ).values()
  );

  const availableColors = Array.from(
    new Map(
      product.variants
        .filter(v => v.colorId && v.color && (!selectedSizeId || v.sizeId === selectedSizeId))
        .map(v => [v.color!.id, v.color!])
    ).values()
  );

  // Calculate current price and stock
  let currentPrice = product.salePrice || product.originalPrice;
  
  const matchingVariants = product.variants.filter(v => 
    (!selectedSizeId || v.sizeId === selectedSizeId) &&
    (!selectedColorId || v.colorId === selectedColorId)
  );
  
  let currentStock = product.variants.length > 0
    ? matchingVariants.reduce((sum, v) => sum + v.stock, 0)
    : product.stockQuantity;

  // Use variant price if size is selected and it has an override
  let currentVariant = null;
  if (selectedSizeId) {
     currentVariant = product.variants.find(v => v.sizeId === selectedSizeId);
  } else if (selectedColorId) {
     currentVariant = product.variants.find(v => v.colorId === selectedColorId);
  }
  
  if (currentVariant && currentVariant.price) {
     currentPrice = currentVariant.price;
  }

  // Effect to clear invalid color when size changes
  useEffect(() => {
    if (selectedSizeId && selectedColorId) {
      const isValid = product.variants.some(v => v.sizeId === selectedSizeId && v.colorId === selectedColorId && v.stock > 0);
      if (!isValid) {
        setSelectedColorId(null);
      }
    }
  }, [selectedSizeId]);

  const hasDiscount = currentPrice < product.originalPrice;
  const discountPercent = hasDiscount
    ? Math.round((1 - (currentPrice / product.originalPrice)) * 100)
    : 0;

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const toggleWishlist = async () => {
    try {
      const res = await fetch('/api/portal/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsWishlist(data.action === 'added');
        showToast(
          data.action === 'added' ? '💖 Đã thêm vào yêu thích!' : '💔 Đã bỏ yêu thích',
          'success'
        );
      }
    } catch {
      showToast('Có lỗi xảy ra', 'error');
    }
  };

  const handleShareProduct = async () => {
    // Tạo URL với referral code nếu có
    let productUrl = `${window.location.origin}/portal/products/${product.slug}`;
    if (userReferralCode) {
      productUrl += `?ref=${userReferralCode}`;
    }
    
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      showToast('📋 Đã copy link giới thiệu!', 'success');
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      showToast('Không thể copy link', 'error');
    }
  };

  const validateStock = () => {
    if (availableSizes.length > 0 && !selectedSizeId) {
      showToast('Vui lòng chọn Kích thước', 'error');
      return false;
    }
    if (availableColors.length > 0 && !selectedColorId) {
      showToast('Vui lòng chọn Màu sắc', 'error');
      return false;
    }

    if (currentStock < quantity) {
      showToast(currentStock === 0 ? 'Sản phẩm đã hết hàng' : 'Không đủ số lượng trong kho', 'error');
      return false;
    }

    return true;
  };

  const handleAddToCart = async () => {
    if (!validateStock()) return;

    setLoadingCart(true);

    try {
      const res = await fetch('/api/portal/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          size: availableSizes.find(s => s.id === selectedSizeId)?.name || null,
          color: availableColors.find(c => c.id === selectedColorId)?.name || null,
          variantId: matchingVariants[0]?.id || null, // Optional, can pass to cart
        }),
      });

      if (res.ok) {
        showToast('🛒 Đã thêm vào giỏ hàng!', 'success');
      } else {
        const d = await res.json();
        showToast(d.error || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showToast('Không thể kết nối', 'error');
    } finally {
      setLoadingCart(false);
    }
  };

  const handleBuyNow = () => {
    if (!validateStock()) return;

    const params = new URLSearchParams({
      productId: product.id,
      quantity: quantity.toString(),
    });
    
    const sizeName = availableSizes.find(s => s.id === selectedSizeId)?.name;
    const colorName = availableColors.find(c => c.id === selectedColorId)?.name;
    
    if (sizeName) params.set('size', sizeName);
    if (colorName) params.set('color', colorName);

    router.push(`/portal/checkout?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-500 max-w-sm border-l-4 ${toast.type === 'success' ? 'bg-white border-green-500' : 'bg-white border-red-500'} animate-fade-in-down`}>
          <div className="font-medium text-gray-800">{toast.message}</div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-gray-500 flex gap-2">
          <button onClick={() => router.push('/portal/products')} className="hover:text-indigo-600 transition-colors">Sản phẩm</button>
          <span>/</span>
          {product.categories.length > 0 && (
            <>
              <span className="text-gray-700">{product.categories[0].name}</span>
              <span>/</span>
            </>
          )}
          <span className="text-indigo-900 font-medium truncate max-w-xs">{product.name}</span>
        </div>

        <div className="overflow-hidden mb-12">
          <div className="flex flex-col md:flex-row items-start gap-14">
            {/* Left: Image Box */}
            <div className="flex-shrink-0 relative pt-8 pl-4 lg:pl-10">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full max-w-[280px] aspect-[3/4] object-cover rounded-2xl shadow-xl"
                />
              ) : (
                <div className="w-full max-w-[280px] aspect-[3/4] bg-gray-200 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-6xl">📦</span>
                </div>
              )}

              {hasDiscount && (
                <div className="absolute top-6 left-6 bg-red-500 text-white font-bold px-4 py-2 rounded-full shadow-lg">
                  -{discountPercent}%
                </div>
              )}
            </div>

            {/* Right: Info Box */}
            <div className="flex-1 lg:pt-8 p-4 md:pl-0">
              <div className="flex justify-between items-start mb-3">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {product.name}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShareProduct}
                    className={`p-2 rounded-full transition-all duration-300 ${
                      copied
                        ? 'bg-green-50 text-green-500'
                        : 'hover:bg-blue-50 text-gray-400 hover:text-blue-500'
                    }`}
                    title="Chia sẻ sản phẩm"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={toggleWishlist}
                    className="p-2 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <Heart
                      className={`w-6 h-6 transition-colors ${isWishlist ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                    />
                  </button>
                </div>
              </div>

              {product.sku && (
                <p className="text-xs text-gray-500 font-mono mb-3">SKU: {product.sku}</p>
              )}

              {/* Price */}
              <div className="mb-5 flex items-end gap-3">
                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  {formatCurrency(currentPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-gray-400 line-through mb-1">
                    {formatCurrency(product.originalPrice)}
                  </span>
                )}
              </div>

              {/* Sizes */}
              {availableSizes.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900 text-sm">Kích thước</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map(size => {
                      const variantsForSize = product.variants.filter(v => v.sizeId === size.id);
                      const stockForSize = variantsForSize.reduce((acc, v) => acc + v.stock, 0);
                      
                      return (
                        <button
                          key={size.id}
                          onClick={() => stockForSize > 0 && setSelectedSizeId(size.id)}
                          disabled={stockForSize === 0}
                          className={`min-w-[3.5rem] px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${selectedSizeId === size.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border-indigo-600'
                            : stockForSize === 0
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                              : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-600 hover:text-indigo-600'
                            }`}
                        >
                          {size.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colors */}
              {availableColors.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900 text-sm">Màu sắc</span>
                    {selectedSizeId && (
                       <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                         Còn {currentStock} sản phẩm
                       </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map(color => {
                      const variantsForColor = product.variants.filter(v => v.colorId === color.id && (!selectedSizeId || v.sizeId === selectedSizeId));
                      const stockForColor = variantsForColor.reduce((acc, v) => acc + v.stock, 0);
                      
                      return (
                        <button
                          key={color.id}
                          onClick={() => stockForColor > 0 && setSelectedColorId(color.id)}
                          disabled={stockForColor === 0}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 border ${selectedColorId === color.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                            : stockForColor === 0
                              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                              : 'border-gray-200 hover:border-indigo-600 text-gray-700'
                            }`}
                        >
                          {color.hexCode && (
                            <span
                              className={`w-3.5 h-3.5 rounded-full border shadow-sm ${stockForColor === 0 ? 'border-gray-200 opacity-50' : 'border-gray-300'}`}
                              style={{ backgroundColor: color.hexCode }}
                            />
                          )}
                          {color.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity & Add to Cart */}
              <div className="flex gap-3 mb-6">
                <div className="flex items-center w-28 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 w-full text-center bg-transparent border-none focus:outline-none font-medium h-9 select-none pointer-events-none text-gray-800 text-sm"
                    value={quantity}
                    readOnly
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={loadingCart || currentStock < 1}
                  className="flex-1 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold py-2.5 px-2 sm:px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">THÊM VÀO GIỎ</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={loadingCart || currentStock < 1}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-2.5 px-3 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  MUA NGAY
                </button>
              </div>

              {/* Meta Features */}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  <span>Miễn phí giao hàng</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>Bảo hành chính hãng</span>
                </div>
                <div className="flex items-center gap-2">
                  <Undo2 className="w-4 h-4 text-purple-500" />
                  <span>Đổi trả trong 7 ngày</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>Sản phẩm chất lượng</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Description Section */}
        {product.description && (
          <div className="p-2 mb-12">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Mô tả sản phẩm</h3>
            <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {product.description}
            </div>
          </div>
        )}

        {/* Product Reviews Section */}
        <ProductReviews
          productId={product.id}
          productName={product.name}
          userCompletedOrders={userCompletedOrders}
        />

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-16 mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 border-b pb-4">
              Sản phẩm liên quan
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {relatedProducts.map(rp => (
                <div key={rp.id} className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col cursor-pointer" onClick={() => router.push(`/portal/products/${rp.slug}`)}>
                  <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden">
                    {rp.imageUrl ? (
                      <img src={rp.imageUrl} alt={rp.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-800 text-sm line-clamp-2 mb-2 flex-grow">{rp.name}</h4>
                  <div className="text-indigo-600 font-bold tracking-tight text-sm">
                    {formatCurrency(rp.salePrice || rp.originalPrice)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
