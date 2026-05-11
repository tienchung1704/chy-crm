'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Trash2, X } from 'lucide-react';
import { apiClientClient } from '@/lib/apiClientClient';
import Select from '@/components/ui/Select';

interface ProductVariant {
  id: string;
  price: number | null;
  stock: number;
  size?: { name: string } | null;
  color?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  originalPrice: number;
  salePrice: number | null;
  stockQuantity: number;
  variants: ProductVariant[];
}

interface AddressOption {
  code: string;
  name: string;
}

interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  addressStreet?: string | null;
  addressWard?: string | null;
  addressProvince?: string | null;
}

interface OrderItem {
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product: Product;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getAvailableSizes(product: Product) {
  return Array.from(
    new Set(product.variants.map((variant) => variant.size?.name).filter(Boolean)),
  ) as string[];
}

function getAvailableColors(product: Product) {
  return Array.from(
    new Set(product.variants.map((variant) => variant.color?.name).filter(Boolean)),
  ) as string[];
}

function getUnitPrice(item: OrderItem) {
  const match = item.product.variants.find((variant) => {
    const sameSize = (variant.size?.name || null) === (item.size || null);
    const sameColor = (variant.color?.name || null) === (item.color || null);
    return sameSize && sameColor;
  });

  if (match?.price !== null && match?.price !== undefined) {
    return match.price;
  }

  return item.product.salePrice || item.product.originalPrice;
}

export default function CreateOrderClient() {
  const router = useRouter();

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingStreet, setShippingStreet] = useState('');
  const [shippingWard, setShippingWard] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Address dropdown states
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [wards, setWards] = useState<AddressOption[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Address helpers (same pattern as CheckoutClient)
  const normalizeName = useCallback((n: string) => {
    return n
      .toLowerCase()
      .trim()
      .replace(/^(tỉnh|thành phố|thành\s*phố|quận|huyện|phường|xã|thị trấn|thị\s*trấn)\s+/i, '')
      .replace(/\s+/g, ' ');
  }, []);

  const findAddressOption = useCallback((options: AddressOption[], value: string) => {
    const normalizedValue = normalizeName(value);
    return options.find(option => {
      const normalizedOption = normalizeName(option.name);
      return normalizedOption === normalizedValue || normalizedOption.includes(normalizedValue) || normalizedValue.includes(normalizedOption);
    });
  }, [normalizeName]);

  const loadProvinces = useCallback(async () => {
    const res = await fetch('/internal-api/address?type=provinces');
    if (!res.ok) throw new Error('Failed to load provinces');
    const data = await res.json();
    return data as AddressOption[];
  }, []);

  const loadWards = useCallback(async (provinceName: string, provinceOptions = provinces) => {
    if (!provinceName) return null;
    const p = findAddressOption(provinceOptions, provinceName);
    if (!p) return null;
    const res = await fetch(`/internal-api/address?type=wards&provinceCode=${p.code}`);
    if (!res.ok) throw new Error('Failed to load wards');
    const data = await res.json();
    return { province: p, wards: data as AddressOption[] };
  }, [findAddressOption, provinces]);

  // Load provinces on mount
  useEffect(() => {
    loadProvinces().then(setProvinces).catch(console.error);
  }, [loadProvinces]);

  // Auto-fill customer info when selected
  useEffect(() => {
    if (!selectedCustomer) return;

    setShippingName(selectedCustomer.name || '');
    setShippingPhone(selectedCustomer.phone || '');
    setShippingStreet(selectedCustomer.addressStreet || '');

    // Auto-fill province & ward dropdowns
    const fillAddress = async () => {
      const custProvince = selectedCustomer.addressProvince || '';
      const custWard = selectedCustomer.addressWard || '';

      if (!custProvince) {
        setShippingProvince('');
        setShippingWard('');
        setWards([]);
        return;
      }

      const provinceOptions = provinces.length ? provinces : await loadProvinces();
      if (!provinces.length) setProvinces(provinceOptions);
      const provinceOption = findAddressOption(provinceOptions, custProvince);
      setShippingProvince(provinceOption?.name || custProvince);

      if (provinceOption) {
        const result = await loadWards(provinceOption.name, provinceOptions);
        const wardOptions = result?.wards || [];
        setWards(wardOptions);
        const wardOption = custWard ? findAddressOption(wardOptions, custWard) : null;
        setShippingWard(wardOption?.name || custWard);
      } else {
        setWards([]);
        setShippingWard(custWard);
      }
    };

    fillAddress().catch(console.error);
  }, [selectedCustomer, provinces, loadProvinces, loadWards, findAddressOption]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!customerSearch || customerSearch.trim().length < 2) {
        setCustomers([]);
        return;
      }

      setSearchingCustomers(true);
      try {
        const data = await apiClientClient.get<any>('/admin/customers', {
          params: {
            search: customerSearch.trim(),
            limit: 8,
            includeAll: true,
          },
        });
        setCustomers(data.customers || []);
      } catch (err) {
        console.error('Customer search failed', err);
      } finally {
        setSearchingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!productSearch || productSearch.trim().length < 2) {
        setProducts([]);
        return;
      }

      setSearchingProducts(true);
      try {
        const data = await apiClientClient.get<any>('/products/admin', {
          params: {
            search: productSearch.trim(),
            limit: 8,
          },
        });
        setProducts(data.data || []);
      } catch (err) {
        console.error('Product search failed', err);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const addProduct = (product: Product) => {
    setOrderItems((current) => [
      ...current,
      {
        productId: product.id,
        quantity: 1,
        size: null,
        color: null,
        product,
      },
    ]);
    setProductSearch('');
    setProducts([]);
  };

  const updateOrderItem = (
    index: number,
    next: Partial<Pick<OrderItem, 'quantity' | 'size' | 'color'>>,
  ) => {
    setOrderItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...next }
          : item,
      ),
    );
  };

  const removeOrderItem = (index: number) => {
    setOrderItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const subtotal = orderItems.reduce(
    (sum: number, item) => sum + getUnitPrice(item) * item.quantity,
    0,
  );
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  const handleSubmit = async () => {
    // Only validate shipping info - customer selection is now optional
    if (!shippingName || !shippingPhone) {
      setError('Vui lòng nhập tên và số điện thoại người nhận');
      return;
    }

    if (orderItems.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiClientClient.post('/orders/admin', {
        userId: selectedCustomer?.id, // undefined for guest orders
        items: orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size || undefined,
          color: item.color || undefined,
        })),
        shippingName,
        shippingPhone,
        shippingStreet,
        shippingWard,
        shippingProvince,
        customerNote,
        adminNote,
        shippingFee,
        discountAmount,
      });

      router.push('/admin/orders');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-2">
      {/* Header - same style as ProductForm */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/orders" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Tạo Đơn hàng mới</h1>
        </div>
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/orders"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium transition-colors shadow-sm"
          >
            Hủy bỏ
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || orderItems.length === 0 || !shippingName || !shippingPhone}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}
          </button>
        </div>
      </div>

      {/* Two-column layout - same style as ProductForm */}
      <div className="flex items-stretch gap-6">
        {/* Right column - Shipping & Summary */}
        <div className="flex-1 space-y-6">
          {/* Shipping Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Giao Hàng</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên Người Nhận</label>
              <input
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Số Điện Thoại</label>
              <input
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tỉnh / Thành phố</label>
                <Select
                  value={shippingProvince}
                  onChange={async (nextProvince) => {
                    setShippingProvince(nextProvince);
                    setShippingWard('');
                    setWards([]);
                    try {
                      const result = await loadWards(nextProvince);
                      if (result) setWards(result.wards);
                    } catch { }
                  }}
                  placeholder="Chọn Tỉnh/Thành"
                  options={[
                    { value: '', label: 'Chọn Tỉnh/Thành' },
                    ...provinces.map(p => ({ value: p.name, label: p.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phường / Xã</label>
                <Select
                  value={shippingWard}
                  onChange={setShippingWard}
                  disabled={!shippingProvince}
                  placeholder="Chọn Phường/Xã"
                  options={[
                    { value: '', label: 'Chọn Phường/Xã' },
                    ...wards.map(w => ({ value: w.name, label: w.name })),
                  ]}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Địa Chỉ chi tiết</label>
              <input
                value={shippingStreet}
                onChange={(e) => setShippingStreet(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú khách hàng</label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú nội bộ</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phí ship</label>
                <input
                  type="number"
                  min="0"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Giảm giá</label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right column - Customer & Products & Summary */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Customer Section */}
            <div className="p-6 space-y-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Khách Hàng</h3>
                <span className={`text-xs font-medium px-2 py-1 rounded ${selectedCustomer ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                  {selectedCustomer ? '✓ Có tài khoản' : 'Khách vãng lai'}
                </span>
              </div>

              {/* Info box for guest orders */}
              {!selectedCustomer && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                  💡 Không chọn khách hàng = Đơn hàng khách vãng lai (không chiếm số điện thoại, khách có thể đăng ký sau)
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Tìm theo tên, số điện thoại, email"
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {selectedCustomer && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCustomer.name || selectedCustomer.phone || 'Khách Hàng'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {selectedCustomer.phone || 'Chưa có số điện thoại'}
                      {selectedCustomer.email ? ` • ${selectedCustomer.email}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!selectedCustomer && searchingCustomers && (
                <div className="text-sm text-gray-500">Đang tìm khách hàng...</div>
              )}

              {!selectedCustomer && customers.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomer(customer)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {customer.name || customer.phone || 'Khách Hàng'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {customer.phone || 'Chưa có số điện thoại'}
                        {customer.email ? ` • ${customer.email}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products Section */}
            <div className="p-6 space-y-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Sản Phẩm</h3>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm sản phẩm"
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {searchingProducts && (
                <div className="text-sm text-gray-500">Đang tìm sản phẩm...</div>
              )}

              {products.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center gap-3"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatCurrency(product.salePrice || product.originalPrice)} • Tồn {product.stockQuantity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {orderItems.length > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  {orderItems.map((item, index) => {
                    const sizes = getAvailableSizes(item.product);
                    const colors = getAvailableColors(item.product);
                    const unitPrice = getUnitPrice(item);

                    return (
                      <div key={`${item.productId}-${index}`} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Đơn giá {formatCurrency(unitPrice)}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Số lượng</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateOrderItem(index, {
                                      quantity: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {sizes.length > 0 && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
                                  <Select
                                    value={item.size || ''}
                                    onChange={(val) =>
                                      updateOrderItem(index, {
                                        size: val || null,
                                      })
                                    }
                                    className="w-full"
                                    options={[
                                      { value: '', label: 'Chọn size' },
                                      ...sizes.map((size) => ({ value: size, label: size }))
                                    ]}
                                  />
                                </div>
                              )}

                              {colors.length > 0 && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Màu</label>
                                  <Select
                                    value={item.color || ''}
                                    onChange={(val) =>
                                      updateOrderItem(index, {
                                        color: val || null,
                                      })
                                    }
                                    className="w-full"
                                    options={[
                                      { value: '', label: 'Chọn màu' },
                                      ...colors.map((color) => ({ value: color, label: color }))
                                    ]}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="text-sm font-medium text-gray-900">
                              Thành tiền {formatCurrency(unitPrice * item.quantity)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeOrderItem(index)}
                            className="w-9 h-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Tổng đơn hàng</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tạm Tính</span>
                  <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Phí ship</span>
                  <span className="font-medium text-gray-900">{formatCurrency(shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Giảm giá</span>
                  <span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Tổng cộng</span>
                  <span className="text-xl font-semibold text-gray-900">{formatCurrency(total)}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
