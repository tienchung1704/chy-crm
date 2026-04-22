'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
}

function fmtDate(d: string | Date) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

const statusMap: Record<string, { label: string; cls: string; step: number }> = {
  PENDING: { label: 'Chờ xác nhận', cls: 'bg-orange-100 text-orange-700', step: 0 },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-cyan-100 text-cyan-700', step: 1 },
  WAITING_FOR_GOODS: { label: 'Chờ hàng', cls: 'bg-yellow-100 text-yellow-700', step: 1 },
  PACKAGING: { label: 'Đang đóng gói', cls: 'bg-purple-100 text-purple-700', step: 2 },
  WAITING_FOR_SHIPPING: { label: 'Chờ vận chuyển', cls: 'bg-indigo-100 text-indigo-700', step: 2 },
  SHIPPED: { label: 'Đang giao hàng', cls: 'bg-blue-100 text-blue-700', step: 3 },
  DELIVERED: { label: 'Đã nhận hàng', cls: 'bg-teal-100 text-teal-700', step: 4 },
  PAYMENT_COLLECTED: { label: 'Đã thu tiền', cls: 'bg-emerald-100 text-emerald-700', step: 4 },
  COMPLETED: { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700', step: 5 },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-red-100 text-red-700', step: -1 },
  REFUNDED: { label: 'Hoàn trả', cls: 'bg-red-100 text-red-700', step: -1 },
  RETURNING: { label: 'Đang hoàn', cls: 'bg-amber-100 text-amber-700', step: -1 },
  EXCHANGING: { label: 'Đang đổi', cls: 'bg-amber-100 text-amber-700', step: -1 },
};

const progressSteps = ['Đặt hàng', 'Xác nhận', 'Đóng gói', 'Vận chuyển', 'Nhận hàng', 'Hoàn thành'];

export default function PortalOrderDetailClient({ order }: { order: any }) {
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const isPancake = order.source === 'PANCAKE';
  const m = order.metadata || {};
  const partner = m.partner || {};
  const payment = m.payment || {};
  const shippingAddr = m.shippingAddress || {};

  const st = statusMap[order.status] || { label: order.status, cls: 'bg-gray-100 text-gray-700', step: 0 };
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);
  const isCancelled = ['CANCELLED', 'REFUNDED', 'RETURNING'].includes(order.status);

  // Items to display
  const displayItems = isPancake && m.items?.length > 0
    ? m.items
    : (order.items || []).map((item: any) => ({
      name: item.product?.name || 'Sản phẩm',
      image: item.product?.imageUrl,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      color: item.color,
      isGift: item.isGift,
    }));

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const token = document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/orders/${order.id}/cancel`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: cancelReason }),
        }
      );
      if (res.ok) {
        setShowCancelModal(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Không thể hủy đơn hàng');
      }
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      {/* Back + Title */}
      <div className="mb-6">
        <Link
          href="/portal/orders"
          className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-3 inline-block"
        >
          ← Quay lại đơn hàng
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              Đơn hàng #{order.orderCode}
            </h1>
            <p className="text-sm text-gray-500">
              Đặt lúc {fmtDate(order.createdAt)}
              {isPancake && m.pancakeCreatedAt && ` (Pancake: ${fmtDate(m.pancakeCreatedAt)})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${st.cls}`}>
              {st.label}
            </span>
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Hủy đơn
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {st.step >= 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{ width: `${Math.min(100, (st.step / (progressSteps.length - 1)) * 100)}%` }}
            />
            {progressSteps.map((label, i) => (
              <div key={label} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    i <= st.step
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {i <= st.step ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-2 ${i <= st.step ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Sản phẩm ({displayItems.length})
            </h2>
            <div className="space-y-3">
              {displayItems.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image || item.product?.imageUrl ? (
                      <img
                        src={item.image || item.product?.imageUrl}
                        alt={item.name || item.product?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {item.name || item.product?.name || 'Sản phẩm'}
                    </p>
                    <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                      <span>SL: {item.quantity}</span>
                      {item.size && <span>Size: {item.size}</span>}
                      {item.color && <span>Màu: {item.color}</span>}
                    </div>
                    {(item.isGift || item.isBonusProduct) && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                        Quà tặng
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800 text-sm">{fmt(item.price)}</p>
                    <p className="text-xs text-gray-500">Tổng: {fmt(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Tổng quan thanh toán</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Tạm tính:</span>
                <span className="font-semibold">{fmt(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá:</span>
                  <span className="font-semibold">-{fmt(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold">{order.shippingFee > 0 ? fmt(order.shippingFee) : 'Miễn phí'}</span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-between text-base font-bold text-gray-900">
                <span>Tổng cộng:</span>
                <span className="text-blue-600">{fmt(order.totalAmount)}</span>
              </div>

              {/* Pancake payment breakdown */}
              {isPancake && payment.totalPaid > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {payment.cod > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tiền thu hộ (COD):</span>
                      <span className="font-medium">{fmt(payment.cod)}</span>
                    </div>
                  )}
                  {payment.transferMoney > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Chuyển khoản:</span>
                      <span className="font-medium">{fmt(payment.transferMoney)}</span>
                    </div>
                  )}
                  {payment.cash > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tiền mặt:</span>
                      <span className="font-medium">{fmt(payment.cash)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-gray-100">
                    <span>Đã thanh toán:</span>
                    <span className="text-green-600">{fmt(payment.totalPaid)}</span>
                  </div>
                  {payment.moneyToCollect > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Còn cần thu:</span>
                      <span className="text-red-600">{fmt(payment.moneyToCollect)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Shipping / Tracking */}
          {isPancake && partner.trackingCode && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Thông tin vận chuyển</h2>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg mb-4">
                <div>
                  <p className="text-xs text-gray-500">Mã vận đơn</p>
                  <p className="font-mono font-bold text-gray-800 text-lg">{partner.trackingCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Phí vận chuyển</p>
                  <p className="font-semibold text-gray-800">{fmt(partner.totalFee)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {partner.deliveryName && (
                  <div>
                    <p className="text-xs text-gray-500">Tên shipper</p>
                    <p className="font-medium text-gray-800">{partner.deliveryName}</p>
                  </div>
                )}
                {partner.deliveryPhone && (
                  <div>
                    <p className="text-xs text-gray-500">SĐT shipper</p>
                    <p className="font-medium text-gray-800">{partner.deliveryPhone}</p>
                  </div>
                )}
              </div>

              {/* Courier Updates */}
              {partner.courierUpdates?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-700 text-sm mb-3">Cập nhật vận chuyển</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {partner.courierUpdates.map((update: any, idx: number) => (
                      <div key={idx} className="flex gap-3 p-2.5 bg-gray-50 rounded-lg text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">{update.status || update.key}</span>
                            {update.update_at && (
                              <span className="text-xs text-gray-500">{fmtDate(update.update_at)}</span>
                            )}
                          </div>
                          {update.note && <p className="text-gray-500 text-xs mt-0.5">{update.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Thông tin nhận hàng</h2>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-gray-500">Người nhận</p>
                <p className="font-medium text-gray-800">
                  {isPancake ? (shippingAddr.fullName || order.shippingName) : order.shippingName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Số điện thoại</p>
                <p className="font-medium text-gray-800">
                  {isPancake ? (shippingAddr.phoneNumber || order.shippingPhone) : order.shippingPhone}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Địa chỉ</p>
                <p className="font-medium text-gray-800">
                  {isPancake
                    ? (shippingAddr.fullAddress || shippingAddr.address)
                    : [order.shippingStreet, order.shippingWard, order.shippingProvince].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Thanh toán</h2>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-gray-500">Phương thức</p>
                <p className="font-medium text-gray-800">
                  {order.paymentMethod || (isPancake ? 'Thanh toán qua Pancake' : 'Chưa xác định')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Trạng thái</p>
                <p className={`font-semibold ${order.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                  {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : order.paymentStatus === 'UNPAID' ? 'Chưa thanh toán' : order.paymentStatus}
                </p>
              </div>
              {order.paidAt && (
                <div>
                  <p className="text-xs text-gray-500">Thanh toán lúc</p>
                  <p className="font-medium text-gray-800">{fmtDate(order.paidAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Note */}
          {order.customerNote && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Ghi chú</h2>
              <div className="border-l-4 border-gray-200 bg-gray-50 rounded-r-lg p-3">
                <p className="text-sm text-gray-700 italic">{order.customerNote}</p>
              </div>
            </div>
          )}

          {/* Tracking Link */}
          {isPancake && m.trackingLink && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Theo dõi đơn hàng</h2>
              <a
                href={m.trackingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors w-full justify-center"
              >
                Xem trên trang vận chuyển →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hủy đơn hàng</h3>
            <p className="text-sm text-gray-600 mb-4">
              Bạn có chắc muốn hủy đơn hàng <strong>#{order.orderCode}</strong>?
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Lý do hủy (không bắt buộc)..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-24 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
