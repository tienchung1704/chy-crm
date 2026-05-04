'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiClientClient } from '@/lib/apiClientClient';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

function fmtVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' VND';
}

export default function OrderVouchersTableClient() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Search / filter state
  const [searchOrderCode, setSearchOrderCode] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  useEffect(() => {
    fetchVouchers();
  }, []);

  async function fetchVouchers() {
    try {
      setLoading(true);
      const data = await apiClientClient.get<any[]>('/vouchers/order-vouchers');
      setVouchers(data || []);
    } catch (error) {
      console.error('Error fetching order vouchers', error);
    } finally {
      setLoading(false);
    }
  }

  // Derived filtered list
  const filtered = useMemo(() => {
    let list = vouchers;

    if (searchOrderCode.trim()) {
      const q = searchOrderCode.trim().toLowerCase();
      list = list.filter(v => v.orderCode?.toLowerCase().includes(q));
    }
    if (searchPhone.trim()) {
      const q = searchPhone.trim();
      list = list.filter(v => v.phone?.includes(q));
    }
    if (searchStatus === 'active') {
      list = list.filter(v => v.isActive && v.usedCount < (v.totalUsageLimit || Infinity));
    } else if (searchStatus === 'used') {
      list = list.filter(v => v.totalUsageLimit && v.usedCount >= v.totalUsageLimit);
    }

    return list;
  }, [vouchers, searchOrderCode, searchPhone, searchStatus]);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Xoá voucher "${code}"?\nHành động không thể hoàn tác.`)) return;
    try {
      await apiClientClient.delete(`/vouchers/${id}`);
      setVouchers(prev => prev.filter(v => v.id !== id));
    } catch (err: any) {
      alert(err.message || 'Lỗi xoá voucher');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  function getStatus(v: any) {
    if (v.totalUsageLimit && v.usedCount >= v.totalUsageLimit) {
      return { label: 'Đã sử dụng', cls: 'text-gray-500' };
    }
    if (!v.isActive) {
      return { label: 'Tắt', cls: 'text-red-600' };
    }
    return { label: 'Còn hiệu lực', cls: 'text-green-600 font-semibold' };
  }

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Danh Sách Voucher theo đơn hàng</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Mã đơn hàng"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-44"
            value={searchOrderCode}
            onChange={e => setSearchOrderCode(e.target.value)}
          />
          <input
            type="text"
            placeholder="Số điện thoại"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-40"
            value={searchPhone}
            onChange={e => setSearchPhone(e.target.value)}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-40"
            value={searchStatus}
            onChange={e => setSearchStatus(e.target.value)}
          >
            <option value="">Trạng Thái</option>
            <option value="active">Còn hiệu lực</option>
            <option value="used">Đã sử dụng</option>
          </select>
          <button
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => {
              // Force re-filter (already reactive via useMemo, this is for UX clarity)
              setSearchOrderCode(prev => prev);
            }}
          >
            Tìm Kiếm
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Tên hiển thị</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Mã đơn hàng</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Số điện thoại</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Giá trị %</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Giá trị thanh toán</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Giá trị Voucher</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Hạn sử dụng</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Trạng Thái</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Áp dụng</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Đã sử dụng</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Còn Lại</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="text-center py-12">
                      <div className="text-xl font-bold text-gray-900">Không tìm thấy voucher đơn hàng nào</div>
                      <p className="text-gray-500 mt-2 text-sm">Bạn có thể tạo voucher riêng cho đơn hàng trong trang Chi tiết Đơn hàng.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((v) => {
                const status = getStatus(v);
                const durationLabel = v.durationDays ? `${v.durationDays} ngày` : '—';

                return (
                  <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap max-w-[180px] truncate" title={v.name}>
                      {v.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {v.orderId ? (
                        <Link href={`/admin/orders/${v.orderId}?from=order-vouchers`} className="text-indigo-600 hover:underline font-medium">
                          {v.orderCode}
                        </Link>
                      ) : (
                        <span className="text-gray-600">{v.orderCode}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{v.phone}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {v.type === 'PERCENT' ? `${v.value}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {fmtVND(v.orderTotalAmount)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {fmtVND(v.voucherMonetaryValue)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {durationLabel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={status.cls}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {v.usedCount}/{v.totalUsageLimit || '∞'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {fmtVND(v.totalDiscountUsed)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {fmtVND(v.remainingValue)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {v.orderId && (
                          <Link
                            href={`/admin/orders/${v.orderId}?from=order-vouchers`}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={15} />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(v.id, v.code)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Xoá"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
