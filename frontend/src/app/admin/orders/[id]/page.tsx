import Link from 'next/link';
import OrderStatusManager from '@/components/admin/OrderStatusManager';
import OrderReadStatusManager from '@/components/admin/OrderReadStatusManager';
import { apiClient } from '@/lib/apiClient';

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
}

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'bg-orange-100 text-orange-700', label: 'Chờ duyệt' },
  PACKAGING: { cls: 'bg-purple-100 text-purple-700', label: 'Đang đóng hàng' },
  CONFIRMED: { cls: 'bg-cyan-100 text-cyan-700', label: 'Đang giao' },
  COMPLETED: { cls: 'bg-green-100 text-green-700', label: 'Hoàn thành' },
  CANCELLED: { cls: 'bg-red-100 text-red-700', label: 'Đã hủy' },
  REFUNDED: { cls: 'bg-red-100 text-red-700', label: 'Hoàn trả' },
};

const paymentStatusMap: Record<string, { cls: string; label: string }> = {
  UNPAID: { cls: 'bg-gray-100 text-gray-700', label: 'Chưa thanh toán' },
  PAID: { cls: 'bg-green-100 text-green-700', label: 'Đã thanh toán' },
  PARTIALLY_PAID: { cls: 'bg-yellow-100 text-yellow-700', label: 'Thanh toán 1 phần' },
  REFUNDED: { cls: 'bg-red-100 text-red-700', label: 'Đã hoàn tiền' },
};

export default async function OrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  
  let order: any = null;

  try {
    order = await apiClient.get<any>(`/orders/${params.id}`);
  } catch (error) {
    console.error('Error fetching order details:', error);
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập
        </h1>
        <Link
          href="/admin/orders"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const st = statusMap[order.status] || {
    cls: 'bg-gray-100 text-gray-700',
    label: order.status,
  };
  const pst = paymentStatusMap[order.paymentStatus] || {
    cls: 'bg-gray-100 text-gray-700',
    label: order.paymentStatus,
  };

  const fullAddress = [
    order.user?.addressStreet,
    order.user?.addressWard,
    order.user?.addressProvince,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <OrderReadStatusManager orderId={order.id} isRead={order.isRead} />
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block"
        >
          ← Quay lại danh sách
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              Đơn hàng #{order.orderCode}
            </h1>
            <p className="text-gray-600 text-sm">
              Tạo lúc {fmtDate(order.createdAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${st.cls}`}>
              {st.label}
            </span>
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${pst.cls}`}>
              {pst.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Sản phẩm ({order.items?.length || 0})
            </h2>
            <div className="space-y-4">
              {order.items?.map((item: any) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {item.product?.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {item.product?.name || 'Sản phẩm'}
                    </h3>
                    {(item.size || item.color) && (
                      <p className="text-sm text-gray-600 mb-1">
                        {[item.size, item.color].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      Số lượng: {item.quantity}
                    </p>
                    {item.isGift && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                        🎁 Quà tặng
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{fmt(item.price)}</p>
                    <p className="text-sm text-gray-600">
                      Tổng: {fmt(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Tổng quan đơn hàng
            </h2>
            <div className="space-y-3">
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
                <span className="font-semibold">{fmt(order.shippingFee)}</span>
              </div>
              {order.shippingDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm phí ship:</span>
                  <span className="font-semibold">
                    -{fmt(order.shippingDiscount)}
                  </span>
                </div>
              )}
              <div className="pt-3 flex justify-between text-lg font-bold text-gray-900">
                <span>Tổng cộng:</span>
                <span className="text-blue-600">{fmt(order.totalAmount)}</span>
              </div>
            </div>

            {order.appliedVouchers?.length > 0 && (
              <div className="mt-4 pt-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Voucher đã áp dụng:
                </h3>
                <div className="space-y-2">
                  {order.appliedVouchers.map((ov: any) => (
                    <div
                      key={ov.id}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <span className="font-mono text-sm font-semibold">
                        {ov.userVoucher?.voucher?.code || 'Voucher'}
                      </span>
                      <span className="text-sm text-green-600 font-semibold">
                        -{fmt(ov.discountApplied)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.note && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Ghi chú nội bộ:</h3>
                <p className="text-gray-600 text-sm">{order.note}</p>
              </div>
            )}

            {order.customerNote && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span>💬</span>
                  Ghi chú từ khách hàng:
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-gray-700 text-sm italic">&ldquo;{order.customerNote}&rdquo;</p>
                </div>
              </div>
            )}
          </div>

          {/* Commissions */}
          {order.commissions?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Hoa hồng ({order.commissions.length})
              </h2>
              <div className="space-y-3">
                {order.commissions.map((comm: any) => (
                  <div
                    key={comm.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">
                        {comm.user?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Cấp {comm.level} • {comm.percentage}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{fmt(comm.amount)}</p>
                      <p className="text-xs text-gray-500">{comm.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status Manager */}
          <OrderStatusManager
            orderId={order.id}
            currentStatus={order.status}
            currentPaymentStatus={order.paymentStatus}
          />

          {/* Customer Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Thông tin khách hàng
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Tên:</p>
                <p className="font-semibold text-gray-800">{order.user?.name || 'Unknown'}</p>
              </div>
              {order.user?.email && (
                <div>
                  <p className="text-sm text-gray-600">Email:</p>
                  <p className="font-semibold text-gray-800">{order.user.email}</p>
                </div>
              )}
              {order.user?.phone && (
                <div>
                  <p className="text-sm text-gray-600">Số điện thoại:</p>
                  <p className="font-semibold text-gray-800">{order.user.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Hạng:</p>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  {order.user?.rank || 'MEMBER'}
                </span>
              </div>
              {fullAddress && (
                <div>
                  <p className="text-sm text-gray-600">Địa chỉ:</p>
                  <p className="font-semibold text-gray-800">{fullAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Thông tin thanh toán
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Phương thức:</p>
                <p className="font-semibold text-gray-800">
                  {order.paymentMethod || 'Chưa xác định'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trạng thái:</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${pst.cls}`}>
                  {pst.label}
                </span>
              </div>
              {order.paidAt && (
                <div>
                  <p className="text-sm text-gray-600">Thanh toán lúc:</p>
                  <p className="font-semibold text-gray-800">
                    {fmtDate(order.paidAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
