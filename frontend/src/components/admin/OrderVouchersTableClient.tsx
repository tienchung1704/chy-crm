'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClientClient } from '@/lib/apiClientClient';
import { Pencil, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

function fmtVND(amount: number) {
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

export default function OrderVouchersTableClient() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Voucher Đơn Hàng</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Quản lý danh sách các voucher được tạo riêng cho từng đơn hàng</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Tên Voucher</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Mã Đơn</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Số Điện Thoại</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Loại</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Mức Giảm</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Đơn Tối Thiểu</th>
                <th className="px-6 py-4 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Ngày Tạo</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="text-center py-10 bg-white">
                      <div className="text-xl font-bold text-gray-900">Không tìm thấy voucher đơn hàng nào</div>
                      <p className="text-gray-500 mt-2 text-sm">Bạn có thể tạo voucher riêng cho đơn hàng trong trang Chi tiết Đơn hàng.</p>
                    </div>
                  </td>
                </tr>
              ) : vouchers.map((v) => (
                <tr key={v.id} className="transition-all duration-200 hover:bg-black/[0.01]">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 text-sm max-w-[200px] truncate" title={v.name}>{v.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{v.code}</div>
                  </td>
                  <td className="px-6 py-4">
                    {v.orderId ? (
                      <Link href={`/admin/orders/${v.orderId}?from=order-vouchers`} className="text-indigo-600 hover:underline font-bold text-sm font-mono flex items-center gap-1">
                        <FileText size={14} />
                        #{v.orderCode}
                      </Link>
                    ) : (
                      <span className="text-gray-500 font-bold text-sm font-mono">#{v.orderCode}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-sm text-gray-700">{v.phone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      v.type === 'PERCENT' ? 'bg-purple-100 text-purple-700' : 
                      v.type === 'FREESHIP' ? 'bg-teal-100 text-teal-700' : 
                      v.type === 'STACK' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {v.type === 'PERCENT' ? 'PHẦN TRĂM' : v.type === 'FREESHIP' ? 'FREESHIP' : v.type === 'STACK' ? '📊 STACK' : 'SỐ TIỀN'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-green-700 text-sm">
                      {v.type === 'PERCENT' ? `${v.value}%` : 
                       v.type === 'FREESHIP' ? 'Miễn phí' : 
                       v.type === 'STACK' ? (() => {
                         const tiers = v.stackTiers as any[] | null;
                         if (tiers && tiers.length > 0) {
                           const maxTier = tiers.reduce((max: any, t: any) => t.discount > max.discount ? t : max, tiers[0]);
                           return `Đến ${maxTier.type === 'PERCENT' ? `${maxTier.discount}%` : fmtVND(maxTier.discount)}`;
                         }
                         return '—';
                       })() : 
                       fmtVND(v.value)}
                    </span>
                    {v.type === 'PERCENT' && v.maxDiscount > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">Tối đa: {fmtVND(v.maxDiscount)}</div>
                    )}
                    {v.type === 'STACK' && (
                      <div className="text-[10px] text-gray-400 mt-0.5">Nhiều mức giảm</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-700 text-sm">
                      {v.minOrderValue > 0 ? fmtVND(v.minOrderValue) : 'Không có'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-gray-500">
                    {fmtDate(v.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {v.orderId && (
                      <Link
                        href={`/admin/orders/${v.orderId}?from=order-vouchers`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold transition-all"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
