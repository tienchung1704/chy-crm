import Link from 'next/link';
import OrderStatusManager from '@/components/admin/OrderStatusManager';
import OrderReadStatusManager from '@/components/admin/OrderReadStatusManager';
import DeleteOrderButton from '@/components/admin/DeleteOrderButton';
import CreateOrderVoucherButton from '@/components/admin/CreateOrderVoucherButton';
import { apiClient } from '@/lib/apiClient';

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
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

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'bg-orange-100 text-orange-700', label: 'Chờ duyệt' },
  WAITING_FOR_GOODS: { cls: 'bg-yellow-100 text-yellow-700', label: 'Chờ hàng' },
  CONFIRMED: { cls: 'bg-cyan-100 text-cyan-700', label: 'Đã xác nhận' },
  PACKAGING: { cls: 'bg-purple-100 text-purple-700', label: 'Đang đóng hàng' },
  WAITING_FOR_SHIPPING: { cls: 'bg-indigo-100 text-indigo-700', label: 'Chờ chuyển hàng' },
  SHIPPED: { cls: 'bg-blue-100 text-blue-700', label: 'Đã gửi hàng' },
  DELIVERED: { cls: 'bg-teal-100 text-teal-700', label: 'Đã nhận hàng' },
  PAYMENT_COLLECTED: { cls: 'bg-emerald-100 text-emerald-700', label: 'Đã thu tiền' },
  RETURNING: { cls: 'bg-amber-100 text-amber-700', label: 'Đang hoàn' },
  EXCHANGING: { cls: 'bg-amber-100 text-amber-700', label: 'Đang đổi' },
  COMPLETED: { cls: 'bg-green-100 text-green-700', label: 'Hoàn thành' },
  CANCELLED: { cls: 'bg-red-100 text-red-700', label: 'Đã hủy' },
  REFUNDED: { cls: 'bg-red-100 text-red-700', label: 'Đã hoàn trả' },
};

const paymentStatusMap: Record<string, { cls: string; label: string }> = {
  UNPAID: { cls: 'bg-gray-100 text-gray-700', label: 'Chưa thanh toán' },
  PAID: { cls: 'bg-green-100 text-green-700', label: 'Đã thanh toán' },
  PARTIALLY_PAID: { cls: 'bg-yellow-100 text-yellow-700', label: 'Thanh toán 1 phần' },
  REFUNDED: { cls: 'bg-red-100 text-red-700', label: 'Đã hoàn tiền' },
};

/* ----------- helpers to read metadata safely ----------- */
function meta(order: any, ...keys: string[]) {
  let v = order?.metadata;
  for (const k of keys) {
    if (!v) return null;
    v = v[k];
  }
  return v ?? null;
}

function InfoRow({ label, value, className }: { label: string; value: any; className?: string }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-gray-800 ${className || ''}`}>{value}</p>
    </div>
  );
}

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

  const isPancake = order.source === 'PANCAKE';
  const m = order.metadata || {};
  const payment = m.payment || {};
  const financial = m.financial || {};
  const partner = m.partner || {};
  const shippingAddr = m.shippingAddress || {};
  const customer = m.customer || {};
  const source = m.source || {};

  const fullAddress = isPancake
    ? shippingAddr.fullAddress
    : [order.user?.addressStreet, order.user?.addressWard, order.user?.addressProvince].filter(Boolean).join(', ');

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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              Đơn hàng #{order.orderCode}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>Tạo lúc {fmtDate(order.createdAt)}</span>
              {isPancake && m.pancakeCreatedAt && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                  Pancake: {fmtDate(m.pancakeCreatedAt)}
                </span>
              )}
              {isPancake && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">
                  Pancake #{m.pancakeOrderId}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${st.cls}`}>
              {st.label}
            </span>
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${pst.cls}`}>
              {pst.label}
            </span>
            <DeleteOrderButton orderId={order.id} orderCode={order.orderCode} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Sản phẩm ({order.items?.length || m.items?.length || 0})
            </h2>
            <div className="space-y-4">
              {/* Real order items (linked products) */}
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
                        Quà tặng
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

              {/* Fallback: show items from metadata if no linked items */}
              {(!order.items || order.items.length === 0) && m.items?.length > 0 && (
                <>
                  {m.items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
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
                          {item.name || 'Sản phẩm'}
                        </h3>
                        {/* SKU / barcode */}
                        <div className="flex gap-2 flex-wrap mb-1">
                          {item.displayId && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                              SKU: {item.displayId}
                            </span>
                          )}
                          {item.barcode && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                              {item.barcode}
                            </span>
                          )}
                        </div>
                        {/* Variant fields (size, color etc.) */}
                        {item.fields && item.fields.length > 0 && (
                          <p className="text-sm text-gray-600 mb-1">
                            {item.fields.map((f: any) => `${f.name || f.keyValue}: ${f.value}`).join(' • ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          SL: {item.quantity} {item.weight ? `• ${item.weight}g` : ''}
                        </p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {item.isBonusProduct && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                              Quà tặng
                            </span>
                          )}
                          {item.discountEachProduct > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                              -{item.isDiscountPercent ? `${item.discountEachProduct}%` : fmt(item.discountEachProduct)}
                            </span>
                          )}
                          {item.returnedCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                              Hoàn: {item.returnedCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{fmt(item.price)}</p>
                        <p className="text-sm text-gray-600">
                          Tổng: {fmt(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Order Summary / Financials */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Tổng quan thanh toán
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>Tạm tính (sản phẩm):</span>
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
              {isPancake && financial.surcharge > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Phụ thu:</span>
                  <span className="font-semibold">{fmt(financial.surcharge)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between text-lg font-bold text-gray-900">
                <span>Tổng cộng:</span>
                <span className="text-blue-600">{fmt(order.totalAmount)}</span>
              </div>

              {/* Payment breakdown for Pancake orders */}
              {isPancake && payment.totalPaid > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-3">Chi tiết thanh toán</h3>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {payment.cod > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          Tiền thu hộ (COD):
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.cod)}</span>
                      </div>
                    )}
                    {payment.cash > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          Tiền mặt:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.cash)}</span>
                      </div>
                    )}
                    {payment.transferMoney > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          Chuyển khoản:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.transferMoney)}</span>
                      </div>
                    )}
                    {payment.chargedByMomo > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          MoMo:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByMomo)}</span>
                      </div>
                    )}
                    {payment.chargedByVnpay > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          VNPay:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByVnpay)}</span>
                      </div>
                    )}
                    {payment.chargedByCard > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          Quẹt thẻ:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByCard)}</span>
                      </div>
                    )}
                    {payment.chargedByQrpay > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          QR Pay:
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByQrpay)}</span>
                      </div>
                    )}
                    {payment.chargedByFundiin > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600">Fundiin:</span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByFundiin)}</span>
                      </div>
                    )}
                    {payment.chargedByKredivo > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600">Kredivo:</span>
                        <span className="font-semibold text-gray-800">{fmt(payment.chargedByKredivo)}</span>
                      </div>
                    )}
                    {payment.prepaidByPoint?.money > 0 && (
                      <div className="flex justify-between py-1.5 col-span-2">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          Điểm thưởng ({payment.prepaidByPoint.point} điểm):
                        </span>
                        <span className="font-semibold text-gray-800">{fmt(payment.prepaidByPoint.money)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t-2 border-gray-100 flex justify-between font-bold">
                    <span className="text-gray-800">Đã thanh toán:</span>
                    <span className="text-blue-600">{fmt(payment.totalPaid)}</span>
                  </div>
                  {payment.moneyToCollect > 0 && (
                    <div className="mt-1 flex justify-between font-bold">
                      <span className="text-gray-800">Còn cần thu:</span>
                      <span className="text-red-600">{fmt(payment.moneyToCollect)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {order.appliedVouchers?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
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
                  <span></span>
                  Ghi chú từ khách hàng:
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-gray-700 text-sm italic">&ldquo;{order.customerNote}&rdquo;</p>
                </div>
              </div>
            )}
          </div>

          {/* Shipping Partner / Tracking for Pancake */}
          {isPancake && partner && partner.trackingCode && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                🚚 Trạng thái đơn hàng
              </h2>
              <div className="space-y-4">
                {/* Tracking header */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Mã vận đơn</p>
                    <p className="font-mono font-bold text-blue-700 text-lg">{partner.trackingCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Phí ĐVVC</p>
                    <p className="font-semibold text-gray-800">{fmt(partner.totalFee)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Tên shipper" value={partner.deliveryName} />
                  <InfoRow label="SĐT shipper" value={partner.deliveryPhone} />
                  <InfoRow label="Thời điểm lấy hàng" value={partner.pickedUpAt ? fmtDate(partner.pickedUpAt) : null} />
                  <InfoRow label="COD (ĐVVC)" value={partner.cod > 0 ? fmt(partner.cod) : null} />
                  <InfoRow label="Mã phân loại" value={partner.sortCode} />
                  <InfoRow label="Thời điểm đối soát" value={partner.paidAt ? fmtDate(partner.paidAt) : null} />
                </div>

                {/* Timeline */}
                {partner.courierUpdates && partner.courierUpdates.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-4">Lịch sử vận chuyển</h3>
                    <div className="relative pl-6">
                      {/* Vertical line */}
                      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />
                      <div className="space-y-4">
                        {partner.courierUpdates.map((update: any, idx: number) => (
                          <div key={idx} className="relative">
                            {/* Dot */}
                            <div className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center z-10 ${
                              idx === 0 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'bg-white border-gray-300'
                            }`}>
                              {idx === 0 && (
                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                              )}
                            </div>
                            {/* Content */}
                            <div className="ml-2 pb-1">
                              <p className={`font-semibold text-sm ${idx === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                                {update.status || update.key || 'Cập nhật'}
                              </p>
                              {update.note && (
                                <p className="text-xs text-gray-500 mt-0.5">{update.note}</p>
                              )}
                              {update.address && (
                                <p className="text-xs text-gray-400 mt-0.5">{update.address}</p>
                              )}
                              {update.location && (
                                <p className="text-xs text-gray-400 mt-0.5">{update.location}</p>
                              )}
                              {update.update_at && (
                                <p className="text-xs text-gray-400 mt-1">{fmtDate(update.update_at)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Order QR Voucher */}
          <CreateOrderVoucherButton orderId={order.id} orderCode={order.orderCode} />
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
              Khách hàng
            </h2>
            <div className="space-y-3">
              <InfoRow label="Tên" value={isPancake ? (customer.name || order.user?.name) : order.user?.name} />
              <InfoRow label="Số điện thoại" value={isPancake ? (customer.phone || order.user?.phone) : order.user?.phone} />
              <InfoRow label="Email" value={isPancake ? (customer.email || order.user?.email) : order.user?.email} />
              {!isPancake && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Hạng</p>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {order.user?.rank || 'MEMBER'}
                  </span>
                </div>
              )}
              {isPancake && customer.fbId && (
                <InfoRow label="Facebook ID" value={customer.fbId} />
              )}
              {isPancake && customer.pancakeCustomerId && (
                <InfoRow label="Pancake Customer ID" value={customer.pancakeCustomerId} />
              )}
              {fullAddress && <InfoRow label="Địa chỉ" value={fullAddress} />}
            </div>

            {/* Reports by phone (Pancake) */}
            {isPancake && m.reportsByPhone && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Lịch sử đơn hàng</h3>
                {Object.entries(m.reportsByPhone).map(([phone, report]: [string, any]) => (
                  <div key={phone} className="flex gap-3 text-sm">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        ✓ {report.order_success || 0}
                      </span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        ✗ {report.order_fail || 0}
                      </span>
                      {report.warning > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                          {report.warning}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📍 Nhận hàng</h2>
            <div className="space-y-3">
              <InfoRow
                label="Người nhận"
                value={isPancake ? shippingAddr.fullName : order.shippingName}
              />
              <InfoRow
                label="SĐT"
                value={isPancake ? shippingAddr.phoneNumber : order.shippingPhone}
              />
              <InfoRow
                label="Địa chỉ"
                value={isPancake ? (shippingAddr.fullAddress || shippingAddr.address) : order.shippingStreet}
              />
              {!isPancake && (
                <>
                  <InfoRow label="Phường/Xã" value={order.shippingWard} />
                  <InfoRow label="Tỉnh/TP" value={order.shippingProvince} />
                </>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Thanh toán
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Phương thức</p>
                <p className="font-medium text-gray-800 text-sm">
                  {order.paymentMethod || (isPancake ? 'Thanh toán qua Pancake' : 'Chưa xác định')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Trạng thái</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${pst.cls}`}>
                  {pst.label}
                </span>
              </div>
              {order.paidAt && (
                <InfoRow label="Thanh toán lúc" value={fmtDate(order.paidAt)} />
              )}

              {/* Bank transfer images */}
              {isPancake && payment.bankTransferImages && payment.bankTransferImages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Hình ảnh chuyển khoản</p>
                  <div className="flex gap-2 flex-wrap">
                    {payment.bankTransferImages.map((img: string, idx: number) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt={`CK ${idx + 1}`} className="w-20 h-20 rounded-lg object-cover border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Source / Channel Info for Pancake */}
          {isPancake && (source.accountName || source.pageId || m.trackingLink) && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📡 Nguồn đơn</h2>
              <div className="space-y-3">
                <InfoRow label="Nguồn" value={source.accountName} />
                <InfoRow label="Page ID" value={source.pageId} />
                <InfoRow label="Post ID" value={source.postId} />
                {source.isFromEcommerce && (
                  <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                    Sàn TMĐT
                  </span>
                )}
                {source.isLivestream && (
                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                    Livestream
                  </span>
                )}
                {source.receivedAtShop && (
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                    Bán tại quầy
                  </span>
                )}
                {m.trackingLink && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Link xác nhận</p>
                    <a href={m.trackingLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                      {m.trackingLink}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warehouse Info */}
          {isPancake && m.warehouseInfo && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Kho hàng</h2>
              <div className="space-y-3">
                <InfoRow label="Tên kho" value={m.warehouseInfo.name} />
                <InfoRow label="SĐT kho" value={m.warehouseInfo.phone_number} />
                <InfoRow label="Địa chỉ" value={m.warehouseInfo.full_address || m.warehouseInfo.address} />
              </div>
            </div>
          )}

          {/* Tags */}
          {isPancake && m.tags && m.tags.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🏷️ Thẻ</h2>
              <div className="flex gap-2 flex-wrap">
                {m.tags.map((tag: any, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {tag.name || tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Staff Assignments */}
          {isPancake && (m.creator || m.marketer || m.assigningSeller || m.assigningCare) && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Nhân viên</h2>
              <div className="space-y-3">
                {m.creator && <InfoRow label="Người tạo đơn" value={m.creator.name} />}
                {m.marketer && <InfoRow label="Marketer" value={m.marketer.name} />}
                {m.assigningSeller && <InfoRow label="Nhân viên bán hàng" value={m.assigningSeller.name} />}
                {m.assigningCare && <InfoRow label="Nhân viên chăm sóc" value={m.assigningCare.name} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
