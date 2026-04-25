'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrderReviewForm from '@/components/customer/OrderReviewForm';

function fmt(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount || 0)} đ`;
}

function fmtDate(d: string | Date) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

const statusMap: Record<string, { label: string; cls: string; step: number }> = {
  PENDING: { label: 'Chờ xác nhận', cls: 'bg-orange-100 text-orange-700', step: 0 },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-cyan-100 text-cyan-700', step: 1 },
  WAITING_FOR_GOODS: { label: 'Chờ hàng', cls: 'bg-yellow-100 text-yellow-700', step: 1 },
  PACKAGING: { label: 'Đang đóng gói', cls: 'bg-purple-100 text-purple-700', step: 2 },
  WAITING_FOR_SHIPPING: {
    label: 'Chờ vận chuyển',
    cls: 'bg-indigo-100 text-indigo-700',
    step: 2,
  },
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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);

  const isPancake = order.source === 'PANCAKE';
  const m = order.metadata || {};
  const partner = m.partner || {};
  const payment = m.payment || {};
  const shippingAddr = m.shippingAddress || {};

  const st = statusMap[order.status] || {
    label: order.status,
    cls: 'bg-gray-100 text-gray-700',
    step: 0,
  };
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);
  const canConfirmReceived = ['DELIVERED', 'PAYMENT_COLLECTED'].includes(order.status);
  const canReview = order.status === 'COMPLETED' && !order.hasReview;

  const displayItems =
    isPancake && m.items?.length > 0
      ? m.items
      : (order.items || []).map((item: any) => ({
        id: item.id,
        name: item.product?.name || 'Sản phẩm',
        image: item.product?.imageUrl,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        isGift: item.isGift,
        product: item.product,
      }));

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/orders/${order.id}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: cancelReason }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Không thể hủy đơn hàng');
        return;
      }

      setShowCancelModal(false);
      router.refresh();
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmReceived = async () => {
    setConfirmingReceived(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/orders/${order.id}/confirm-received`,
        {
          method: 'PATCH',
          credentials: 'include',
        },
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Không thể xác nhận đã nhận hàng');
        return;
      }

      router.refresh();
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setConfirmingReceived(false);
    }
  };

  const handleReviewSuccess = () => {
    setShowReviewModal(false);
    router.refresh();
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/portal/orders"
          className="mb-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Quay lại đơn hàng
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-800">Đơn hàng #{order.orderCode}</h1>
            <p className="text-sm text-gray-500">
              Đặt lúc {fmtDate(order.createdAt)}
              {isPancake && m.pancakeCreatedAt ? ` (Pancake: ${fmtDate(m.pancakeCreatedAt)})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-lg px-4 py-2 text-sm font-semibold ${st.cls}`}>{st.label}</span>
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                Hủy đơn
              </button>
            )}
          </div>
        </div>
      </div>

      {st.step >= 0 && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-4 z-0 h-0.5 bg-gray-200" />
            <div
              className="absolute left-0 top-4 z-0 h-0.5 bg-green-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (st.step / (progressSteps.length - 1)) * 100)}%` }}
            />
            {progressSteps.map((label, i) => (
              <div key={label} className="relative z-10 flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${i <= st.step
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                    }`}
                >
                  {i <= st.step ? '✓' : i + 1}
                </div>
                <span className={`mt-2 text-xs ${i <= st.step ? 'font-medium text-green-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-800">Sản phẩm ({displayItems.length})</h2>
            <div className="space-y-3">
              {displayItems.map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex gap-4 rounded-lg bg-gray-50 p-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
                    {item.image || item.product?.imageUrl ? (
                      <img
                        src={item.image || item.product?.imageUrl}
                        alt={item.name || item.product?.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-gray-400">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {item.name || item.product?.name || 'Sản phẩm'}
                    </p>
                    <div className="mt-0.5 flex gap-2 text-xs text-gray-500">
                      <span>SL: {item.quantity}</span>
                      {item.size && <span>Size: {item.size}</span>}
                      {item.color && <span>Màu: {item.color}</span>}
                    </div>
                    {(item.isGift || item.isBonusProduct) && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Quà tặng
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-800">{fmt(item.price)}</p>
                    <p className="text-xs text-gray-500">Tổng: {fmt(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-800">Tổng quan thanh toán</h2>
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
                <span className="font-semibold">
                  {order.shippingFee > 0 ? fmt(order.shippingFee) : 'Miễn phí'}
                </span>
              </div>

              {isPancake && payment.totalPaid > 0 && (
                <div className="mt-3 space-y-1.5">
                  {payment.cod > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tiền thu hộ (COD):</span>
                      <span className="font-medium">{fmt(payment.cod)}</span>
                    </div>
                  )}
                  {payment.cash > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tiền mặt:</span>
                      <span className="font-medium">{fmt(payment.cash)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Đã thanh toán:</span>
                    <span className="text-green-600">{fmt(payment.totalPaid)}</span>
                  </div>
                  {payment.moneyToCollect > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Còn cần thu:</span>
                      <span className="text-red-600">{fmt(order.totalAmount - payment.totalPaid)}</span>
                    </div>
                  )}
                  {payment.transferMoney > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Chuyển khoản:</span>
                      <span className="font-medium">{fmt(payment.transferMoney)}</span>
                    </div>
                  )}
                </div>

              )}
              <div className="flex justify-between pt-2 text-base font-bold text-gray-900">
                <span>Tổng cộng:</span>
                <span className="text-blue-600">{fmt(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {isPancake && partner.trackingCode && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-gray-800">Thông tin vận chuyển</h2>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-xs text-gray-500">Mã vận đơn</p>
                  <p className="font-mono text-lg font-bold text-gray-800">{partner.trackingCode}</p>
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

              {partner.courierUpdates?.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">Cập nhật vận chuyển</h3>
                  <div className="space-y-2">
                    {partner.courierUpdates.map((update: any, idx: number) => (
                      <div key={idx} className="flex gap-3 rounded-lg bg-gray-50 p-2.5 text-sm">
                        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">{update.status || update.key}</span>
                            {update.update_at && (
                              <span className="text-xs text-gray-500">{fmtDate(update.update_at)}</span>
                            )}
                          </div>
                          {update.note && <p className="mt-0.5 text-xs text-gray-500">{update.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-gray-800">Thông tin nhận hàng</h2>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-gray-500">Người nhận</p>
                <p className="font-medium text-gray-800">
                  {isPancake ? shippingAddr.fullName || order.shippingName : order.shippingName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Số điện thoại</p>
                <p className="font-medium text-gray-800">
                  {isPancake ? shippingAddr.phoneNumber || order.shippingPhone : order.shippingPhone}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Địa chỉ</p>
                <p className="font-medium text-gray-800">
                  {isPancake
                    ? shippingAddr.fullAddress || shippingAddr.address
                    : [order.shippingStreet, order.shippingWard, order.shippingProvince]
                      .filter(Boolean)
                      .join(', ')}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-gray-800">Thanh toán</h2>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-gray-500">Phương thức</p>
                <p className="font-medium text-gray-800">
                  {order.paymentMethod || (isPancake ? 'Thanh toán qua Pancake' : 'Chưa xác định')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Trạng thái</p>
                <p
                  className={`font-semibold ${order.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-600'
                    }`}
                >
                  {order.paymentStatus === 'PAID'
                    ? 'Đã thanh toán'
                    : order.paymentStatus === 'UNPAID'
                      ? 'Chưa thanh toán'
                      : order.paymentStatus}
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

          {order.customerNote && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-800">Ghi chú</h2>
              <div className="rounded-r-lg border-l-4 border-gray-200 bg-gray-50 p-3">
                <p className="text-sm italic text-gray-700">{order.customerNote}</p>
              </div>
            </div>
          )}

          {isPancake && m.trackingLink && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-800">Theo dõi đơn hàng</h2>
              <a
                href={m.trackingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
              >
                Xem trên trang vận chuyển →
              </a>
            </div>
          )}

          {(canConfirmReceived || canReview || order.hasReview) && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-800">Sau khi giao hàng</h2>
              <div className="space-y-3">
                {canConfirmReceived && (
                  <button
                    onClick={handleConfirmReceived}
                    disabled={confirmingReceived}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {confirmingReceived ? 'Đang xác nhận...' : 'Tôi đã nhận được hàng'}
                  </button>
                )}

                {canReview && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    Đánh giá kèm mô tả để nhận 1 lượt quay thưởng
                  </button>
                )}

                {order.hasReview && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    Bạn đã đánh giá đơn hàng này
                    {order.reviewRewardGranted ? ' và đã nhận thưởng lượt quay.' : '.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <OrderReviewForm
              order={order}
              onSuccess={handleReviewSuccess}
              onCancel={() => setShowReviewModal(false)}
            />
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-lg font-bold text-gray-800">Hủy đơn hàng</h3>
            <p className="mb-4 text-sm text-gray-600">
              Bạn có chắc muốn hủy đơn hàng <strong>#{order.orderCode}</strong>?
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Lý do hủy (không bắt buộc)..."
              className="mb-4 h-24 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Quay lại
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
