'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CartItemData {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    originalPrice: number;
    salePrice: number | null;
    stockQuantity: number;
    isActive: boolean;
  };
}

interface CartClientProps {
  initialItems: CartItemData[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CartClient({ initialItems }: CartClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.salePrice || item.product.originalPrice;
    return sum + price * item.quantity;
  }, 0);

  const shipping = subtotal > 0 ? 30000 : 0;
  const total = subtotal + shipping;

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    // Optimistic update — instant UI feedback
    const prevItems = items;
    setItems(items.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i));

    // Fire API in background, rollback on failure
    try {
      const res = await fetch(`/api/portal/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      if (!res.ok) {
        const data = await res.json();
        setItems(prevItems); // rollback
        alert(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      setItems(prevItems); // rollback
      alert('Không thể kết nối đến máy chủ');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    // Optimistic remove — instant UI feedback
    const prevItems = items;
    setItems(items.filter(i => i.id !== itemId));

    // Fire API in background, rollback on failure
    try {
      const res = await fetch(`/api/portal/cart/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setItems(prevItems); // rollback
        alert(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      setItems(prevItems); // rollback
      alert('Không thể kết nối đến máy chủ');
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Giỏ hàng trống</h3>
        <p className="text-gray-600 mb-6">Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm</p>
        <Link
          href="/portal/products"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) => {
          const price = item.product.salePrice || item.product.originalPrice;
          const itemTotal = price * item.quantity;
          const isOutOfStock = item.product.stockQuantity === 0 || !item.product.isActive;
          const isUpdating = updatingId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl shadow-sm p-4 transition-opacity ${
                isOutOfStock || isUpdating ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="flex gap-4">
                <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1 leading-tight">{item.product.name}</h3>
                  <div className="text-lg font-bold text-blue-600 mb-2">{formatCurrency(price)}</div>

                  {isOutOfStock && (
                    <div className="text-xs text-red-600 font-medium mb-2 bg-red-50 p-1.5 rounded-md inline-block">
                      ⚠️ Sản phẩm đã hết hàng
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center disabled:opacity-50"
                        disabled={isOutOfStock || item.quantity <= 1 || isUpdating}
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center disabled:opacity-50"
                        disabled={isOutOfStock || item.quantity >= item.product.stockQuantity || isUpdating}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      disabled={isUpdating}
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="text-right flex flex-col justify-end">
                  <div className="font-bold text-gray-800">{formatCurrency(itemTotal)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Tóm tắt đơn hàng</h3>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-gray-600 text-sm">
              <span>Tạm tính</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 text-sm">
              <span>Phí vận chuyển</span>
              <span className="font-medium">{formatCurrency(shipping)}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 mt-2 flex justify-between items-center text-lg font-bold text-gray-900">
              <span>Tổng cộng</span>
              <span className="text-blue-600 text-xl">{formatCurrency(total)}</span>
            </div>
          </div>

          <button className="w-full py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-md shadow-blue-200 active:scale-95 mb-3">
            Thanh toán
          </button>

          <Link href="/portal/products" className="block text-center text-sm text-gray-600 hover:text-gray-800 font-medium">
            ← Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}
