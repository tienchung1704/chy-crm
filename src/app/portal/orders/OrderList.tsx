'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';

type OrderItem = {
  id: string;
  product: { id: string; name: string; imageUrl: string | null };
  quantity: number;
  price: number;
  isGift: boolean;
  size: string | null;
  color: string | null;
};

type Order = {
  id: string;
  orderCode: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  items: OrderItem[];
};

export default function OrderList({ orders }: { orders: Order[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const router = useRouter();

  const toggleRow = (id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  const handleReorder = async (order: Order) => {
    setReordering(order.id);
    try {
      // Add all items from the order to cart
      for (const item of order.items) {
        if (!item.isGift) {
          await fetch('/api/portal/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.product.id,
              quantity: item.quantity,
            }),
          });
        }
      }
      alert('Đã thêm sản phẩm vào giỏ hàng!');
      router.push('/portal/cart');
    } catch (error) {
      alert('Có lỗi xảy ra khi thêm vào giỏ hàng');
    } finally {
      setReordering(null);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Đã hoàn thành</span>;
      case 'PENDING':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Đang xử lý</span>;
      case 'CANCELLED':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Đã hủy</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{status}</span>;
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có đơn hàng nào</h3>
        <p className="text-gray-600">Bạn chưa thực hiện đơn đặt đồ nào. Hãy khám phá sản phẩm của chúng tôi!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã đơn hàng</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ngày đặt</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tổng tiền</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Mua lại</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(order => (
              <React.Fragment key={order.id}>
                <tr
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${expandedRow === order.id ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleRow(order.id)}
                >
                  <td className="px-6 py-4 font-mono font-semibold text-gray-800">{order.orderCode}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Intl.DateTimeFormat('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(order.createdAt))}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-800">{fmt(order.totalAmount)}</td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(order);
                      }}
                      disabled={reordering === order.id}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-blue-600 text-gray-700 hover:text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:text-gray-700"
                      title="Mua lại đơn hàng này"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {reordering === order.id ? 'Đang xử lý...' : 'Mua lại'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={expandedRow === order.id ? 'Thu gọn' : 'Xem chi tiết'}
                    >
                      {expandedRow === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>
                {expandedRow === order.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="p-0">
                      <div className="p-6 border-b border-gray-200 animate-fadeIn">
                        <h4 className="text-sm font-semibold mb-3 text-gray-800">
                          Sản phẩm trong đơn
                        </h4>
                        <div className="flex flex-col gap-3">
                          {order.items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center overflow-hidden border border-gray-200">
                                  {item.product.imageUrl ? (
                                    <img
                                      src={item.product.imageUrl}
                                      alt={item.product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-gray-400">IMG</span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-gray-800">{item.product.name}</div>
                                  <div className="text-xs text-gray-600">
                                    Số lượng: {item.quantity}
                                    {(item.size || item.color) && (
                                      <span className="ml-2">
                                        {item.size && <span>• Size: {item.size}</span>}
                                        {item.color && <span>• Màu: {item.color}</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="font-bold text-sm">
                                {item.isGift ? (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Quà tặng</span>
                                ) : (
                                  fmt(item.price * item.quantity)
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
