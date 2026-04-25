'use client';

import { useState } from 'react';
import Link from 'next/link';
import ExportQRButton from './ExportQRButton';
import CreateOrderButton from './CreateOrderButton';

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'badge-warning', label: 'Chờ xác nhận' },
  WAITING_FOR_GOODS: { cls: 'badge-purple', label: 'Chờ hàng' },
  CONFIRMED: { cls: 'badge-info', label: 'Đã xác nhận' },
  PACKAGING: { cls: 'badge-blue', label: 'Đang đóng hàng' },
  WAITING_FOR_SHIPPING: { cls: 'badge-gray', label: 'Chờ vận chuyển' },
  SHIPPED: { cls: 'badge-info', label: 'Đã gửi hàng' },
  DELIVERED: { cls: 'badge-success', label: 'Đã nhận' },
  PAYMENT_COLLECTED: { cls: 'badge-success', label: 'Đã thu tiền' },
  RETURNING: { cls: 'badge-danger', label: 'Đang hoàn' },
  EXCHANGING: { cls: 'badge-warning', label: 'Đang đổi' },
  COMPLETED: { cls: 'badge-success', label: 'Hoàn thành' },
  CANCELLED: { cls: 'badge-danger', label: 'Đã hủy' },
  REFUNDED: { cls: 'badge-gray', label: 'Hoàn trả' },
};

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

interface OrdersTableClientProps {
  orders: any[];
}

export default function OrdersTableClient({ orders }: OrdersTableClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = orders.length > 0 && selectedIds.size === orders.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o: any) => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedOrders = orders
    .filter((o: any) => selectedIds.has(o.id))
    .map((o: any) => ({ id: o.id, orderCode: o.orderCode }));

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        <ExportQRButton selectedOrders={selectedOrders} />
        <CreateOrderButton />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Mã đơn</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Khách hàng</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Nguồn</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Sản phẩm</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="text-center py-10 bg-white">
                      <div className="text-xl font-bold text-gray-900">Không tìm thấy đơn hàng</div>
                    </div>
                  </td>
                </tr>
              ) : orders.map((order: any) => {
                const st = statusMap[order.status] || { cls: 'badge-gray', label: order.status };
                const isUnread = !order.isRead;
                const isChecked = selectedIds.has(order.id);

                let firstItemDisplay = 'Chưa có sản phẩm';
                const isPancake = order.source === 'PANCAKE';

                const metadata = order.metadata as any;
                if (isPancake && metadata?.items && Array.isArray(metadata.items) && metadata.items.length > 0) {
                  const item = metadata.items[0];
                  firstItemDisplay = `${item.name} x ${item.quantity || 1}`;
                } else if (order.items && order.items.length > 0) {
                  const item = order.items[0];
                  firstItemDisplay = `${item.product?.name || 'Sản phẩm'} x ${item.quantity}`;
                }

                return (
                  <tr
                    key={order.id}
                    className={`transition-all duration-200 hover:bg-black/[0.01] ${isUnread ? 'bg-gray-100/60' : 'bg-white'} ${isChecked ? '!bg-indigo-50/60' : ''}`}
                  >
                    <td className="px-4 py-5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(order.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" title="Đơn hàng chưa đọc" />}
                        <span className={`font-mono text-sm font-bold ${isUnread ? 'text-blue-700' : 'text-gray-900'}`}>
                          #{order.orderCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-bold ${isUnread ? 'text-gray-900 font-bold' : 'text-gray-700 font-bold'}`}>
                        {order.shippingName || order.user?.name || order.user?.phone || 'Khách lạ'}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        {order.shippingPhone || order.user?.phone || ''}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-400 uppercase tracking-wider">
                        {order.source === 'PORTAL_DIRECT' || !order.source ? 'WEBSITE' : order.source}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900 font-bold' : 'text-gray-600 font-medium'}`} title={firstItemDisplay}>
                          {firstItemDisplay}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm transition-all ${st.cls === 'badge-warning' ? 'bg-orange-100 text-orange-700 shadow-orange-100' :
                        st.cls === 'badge-purple' ? 'bg-purple-100 text-purple-700 shadow-purple-100' :
                          st.cls === 'badge-info' ? 'bg-cyan-100 text-cyan-700 shadow-cyan-100' :
                            st.cls === 'badge-success' ? 'bg-green-100 text-green-700 shadow-green-100' :
                              st.cls === 'badge-blue' ? 'bg-blue-100 text-blue-700 shadow-blue-100' :
                                'bg-gray-100 text-gray-700'
                        }`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-[13px] font-medium text-gray-400">{fmtDate(order.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-white rounded-xl font-bold transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-100"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
