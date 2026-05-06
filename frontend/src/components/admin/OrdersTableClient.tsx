'use client';

import { useState } from 'react';
import Link from 'next/link';
import ExportQRButton from './ExportQRButton';
import CreateOrderButton from './CreateOrderButton';
import OrderSearchInput from './OrderSearchInput';
import OrderStatusFilter from './OrderStatusFilter';

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'bg-orange-100 text-orange-700 border border-orange-200', label: 'Chờ xác nhận' },
  WAITING_FOR_GOODS: { cls: 'bg-purple-100 text-purple-700 border border-purple-200', label: 'Chờ hàng' },
  CONFIRMED: { cls: 'bg-cyan-100 text-cyan-700 border border-cyan-200', label: 'Đã xác nhận' },
  PACKAGING: { cls: 'bg-blue-100 text-blue-700 border border-blue-200', label: 'Đang đóng hàng' },
  WAITING_FOR_SHIPPING: { cls: 'bg-gray-100 text-gray-700 border border-gray-200', label: 'Chờ vận chuyển' },
  SHIPPED: { cls: 'bg-sky-100 text-sky-700 border border-sky-200', label: 'Đã gửi hàng' },
  DELIVERED: { cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', label: 'Đã nhận' },
  PAYMENT_COLLECTED: { cls: 'bg-green-100 text-green-700 border border-green-200', label: 'Đã thu tiền' },
  RETURNING: { cls: 'bg-red-100 text-red-700 border border-red-200', label: 'Đang hoàn' },
  EXCHANGING: { cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200', label: 'Đang đổi' },
  COMPLETED: { cls: 'bg-teal-100 text-teal-700 border border-teal-200', label: 'Hoàn thành' },
  CANCELLED: { cls: 'bg-rose-100 text-rose-700 border border-rose-200', label: 'Đã hủy' },
  REFUNDED: { cls: 'bg-slate-100 text-slate-700 border border-slate-200', label: 'Hoàn trả' },
};

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

interface OrdersTableClientProps {
  orders: any[];
  statusCounts: Record<string, number>;
}

export default function OrdersTableClient({ orders, statusCounts }: OrdersTableClientProps) {
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
    .map((o: any) => ({ id: o.id, orderCode: o.orderCode, totalAmount: o.totalAmount || 0 }));

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Đơn hàng</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Quản lý và theo dõi hiệu quả kinh doanh</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full md:w-80">
            <OrderSearchInput />
          </div>
          <ExportQRButton selectedOrders={selectedOrders} />
          <CreateOrderButton />
        </div>
      </div>
      
      <OrderStatusFilter counts={statusCounts} />

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-gray-50">
          {orders.length === 0 ? (
            <div className="text-center py-10 bg-white">
              <div className="text-lg font-bold text-gray-900">Không tìm thấy đơn hàng</div>
            </div>
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
              <div key={`mob-${order.id}`} className={`p-4 flex flex-col gap-3 transition-all duration-200 ${isUnread ? 'bg-gray-100/60' : 'bg-white'} ${isChecked ? '!bg-indigo-50/60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(order.id)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />}
                    <span className={`font-mono text-sm font-bold ${isUnread ? 'text-blue-700' : 'text-gray-900'}`}>
                      #{order.orderCode}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className={`text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-bold text-gray-700'}`}>
                    {order.shippingName || order.user?.name || order.user?.phone || 'Khách lạ'}
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    {order.shippingPhone || order.user?.phone || ''}
                  </div>
                </div>

                <div className="text-[13px] font-medium text-gray-600 bg-gray-50 p-2 rounded-lg truncate">
                  {firstItemDisplay}
                </div>

                <div className="flex justify-between items-center mt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-gray-400">
                      Tạo: {fmtDate(order.createdAt)}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">
                      Sửa: {fmtDate(order.updatedAt)}
                    </span>
                  </div>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="inline-flex items-center px-4 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-bold transition-all"
                  >
                    Chi tiết
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Mã đơn</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Nguồn</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Sản phẩm</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Ngày tạo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Cập nhật</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap"></th>
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
                    className={`transition-colors hover:bg-gray-50/50 ${isUnread ? 'bg-indigo-50/30' : ''} ${isChecked ? '!bg-indigo-50/60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(order.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" title="Đơn hàng chưa đọc" />}
                        <span className={`font-mono font-medium ${isUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>
                          {order.orderCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`font-medium ${isUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>
                        {order.shippingName || order.user?.name || order.user?.phone || 'Khách lạ'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.shippingPhone || order.user?.phone || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-700">
                        {order.source === 'PORTAL_DIRECT' || !order.source ? 'WEBSITE' : order.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className={`truncate text-gray-800 ${isUnread ? 'font-bold text-gray-900' : ''}`} title={firstItemDisplay}>
                          {firstItemDisplay}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm inline-block text-center ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(order.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(order.updatedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
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
