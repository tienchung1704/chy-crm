'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  originalPrice: number;
  salePrice: number | null;
  stockQuantity: number;
  variants: Array<{
    id: string;
    sizeId: string | null;
    colorId: string | null;
    price: number | null;
    stock: number;
    size?: { name: string } | null;
    color?: { name: string } | null;
  }>;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
}

interface CreateOrderModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateOrderModal({ onClose, onSuccess }: CreateOrderModalProps) {
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Order items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Shipping info
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingStreet, setShippingStreet] = useState('');
  const [shippingWard, setShippingWard] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Search customers
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }

    setSearchingCustomers(true);
    try {
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Search products
  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) {
      setProducts([]);
      return;
    }

    setSearchingProducts(true);
    try {
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setSearchingProducts(false);
    }
  };

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Auto-fill shipping info when customer selected
  useEffect(() => {
    if (selectedCustomer) {
      setShippingName(selectedCustomer.name);
      setShippingPhone(selectedCustomer.phone || '');
    }
  }, [selectedCustomer]);

  const addProduct = (product: Product) => {
    const price = product.salePrice || product.originalPrice;
    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      price: price,
      size: null,
      color: null,
    };
    setOrderItems([...orderItems, newItem]);
    setProductSearch('');
    setProducts([]);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, quantity);
    setOrderItems(updated);
  };

  const updateItemSize = (index: number, size: string | null) => {
    const updated = [...orderItems];
    updated[index].size = size;
    setOrderItems(updated);
  };

  const updateItemColor = (index: number, color: string | null) => {
    const updated = [...orderItems];
    updated[index].color = color;
    setOrderItems(updated);
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + shippingFee - discountAmount;
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      setError('Vui lòng chọn khách hàng');
      return;
    }

    if (orderItems.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    if (!shippingName || !shippingPhone) {
      setError('Vui lòng nhập thông tin giao hàng');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedCustomer.id,
          items: orderItems,
          shippingName,
          shippingPhone,
          shippingStreet,
          shippingWard,
          shippingProvince,
          customerNote,
          adminNote,
          shippingFee,
          discountAmount,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      setError('Không thể kết nối đến server');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get unique sizes and colors from products
  const getAvailableSizes = (product: Product) => {
    const sizes = product.variants
      .filter((v) => v.size)
      .map((v) => v.size!.name);
    return [...new Set(sizes)];
  };

  const getAvailableColors = (product: Product) => {
    const colors = product.variants
      .filter((v) => v.color)
      .map((v) => v.color!.name);
    return [...new Set(colors)];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Tạo đơn hàng mới</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - All in one page */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Customer & Products */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">1. Khách hàng</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Tìm theo tên, số điện thoại, email..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>

                  {selectedCustomer ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{selectedCustomer.name}</div>
                          <div className="text-xs text-gray-600">
                            {selectedCustomer.phone} • {selectedCustomer.email}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedCustomer(null)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {searchingCustomers && (
                        <div className="text-center py-3 text-gray-500 text-sm">Đang tìm kiếm...</div>
                      )}
                      {customers.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {customers.map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => setSelectedCustomer(customer)}
                              className="w-full p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 transition-colors text-left"
                            >
                              <div className="font-semibold text-gray-900 text-sm">{customer.name}</div>
                              <div className="text-xs text-gray-600">
                                {customer.phone} • {customer.email}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Products Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">2. Sản phẩm</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Tìm sản phẩm..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>

                  {searchingProducts && (
                    <div className="text-center py-3 text-gray-500 text-sm">Đang tìm kiếm...</div>
                  )}

                  {products.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="w-full p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 transition-colors text-left flex items-center gap-3"
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-lg">
                              📦
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{product.name}</div>
                            <div className="text-xs text-gray-600">
                              {formatCurrency(product.salePrice || product.originalPrice)} • Tồn: {product.stockQuantity}
                            </div>
                          </div>
                          <Plus className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {orderItems.length > 0 && (
                    <div className="space-y-2 border-t border-gray-200 pt-3 mt-3">
                      <h4 className="font-semibold text-gray-900 text-sm">Đã chọn ({orderItems.length})</h4>
                      {orderItems.map((item, index) => {
                        const product = products.find((p) => p.id === item.productId);
                        const availableSizes = product ? getAvailableSizes(product) : [];
                        const availableColors = product ? getAvailableColors(product) : [];

                        return (
                          <div key={index} className="p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="font-medium text-gray-900 text-sm">{item.productName}</div>
                                
                                {/* Size & Color Selection */}
                                <div className="grid grid-cols-2 gap-2">
                                  {availableSizes.length > 0 && (
                                    <div>
                                      <label className="text-xs text-gray-600 block mb-1">Size</label>
                                      <select
                                        value={item.size || ''}
                                        onChange={(e) => updateItemSize(index, e.target.value || null)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                      >
                                        <option value="">Chọn size</option>
                                        {availableSizes.map((size) => (
                                          <option key={size} value={size}>
                                            {size}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {availableColors.length > 0 && (
                                    <div>
                                      <label className="text-xs text-gray-600 block mb-1">Màu</label>
                                      <select
                                        value={item.color || ''}
                                        onChange={(e) => updateItemColor(index, e.target.value || null)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                      >
                                        <option value="">Chọn màu</option>
                                        {availableColors.map((color) => (
                                          <option key={color} value={color}>
                                            {color}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                {/* Quantity & Price */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-600">SL:</label>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                      className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                      min="1"
                                    />
                                  </div>
                                  <span className="text-xs text-gray-600">×</span>
                                  <span className="text-xs text-gray-600">{formatCurrency(item.price)}</span>
                                  <span className="text-xs text-gray-600">=</span>
                                  <span className="text-xs font-semibold text-indigo-600">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => removeItem(index)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              </div>
            </div>

            {/* Right Column - Shipping & Summary */}
            <div className="space-y-6">
              {/* Shipping Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">3. Giao hàng</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tên người nhận <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Địa chỉ</label>
                    <input
                      type="text"
                      value={shippingStreet}
                      onChange={(e) => setShippingStreet(e.target.value)}
                      placeholder="Số nhà, tên đường..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phường/Xã</label>
                    <input
                      type="text"
                      value={shippingWard}
                      onChange={(e) => setShippingWard(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tỉnh/TP</label>
                    <input
                      type="text"
                      value={shippingProvince}
                      onChange={(e) => setShippingProvince(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú KH</label>
                    <textarea
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú nội bộ</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Phí ship</label>
                      <input
                        type="number"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Giảm giá</label>
                      <input
                        type="number"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Tổng đơn hàng</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Tạm tính:</span>
                    <span className="font-semibold">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Phí ship:</span>
                    <span className="font-semibold">{formatCurrency(shippingFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Giảm giá:</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-indigo-200">
                    <span className="font-bold text-gray-900">Tổng cộng:</span>
                    <span className="text-xl font-bold text-indigo-600">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedCustomer || orderItems.length === 0}
                  className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
