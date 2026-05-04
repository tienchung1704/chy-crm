'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientClient } from '@/lib/apiClientClient';
import EditVoucherModal from './EditVoucherModal';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(amount);
}

function getTypeBadge(type: string) {
  const map: Record<string, { bg: string; label: string }> = {
    PERCENT: { bg: 'bg-blue-100 text-blue-700', label: 'Giảm %' },
    FIXED_AMOUNT: { bg: 'bg-green-100 text-green-700', label: 'Giảm tiền' },
    FREESHIP: { bg: 'bg-cyan-100 text-cyan-700', label: 'Free ship' },
    STACK: { bg: 'bg-orange-100 text-orange-700', label: 'Stack' },
  };
  return map[type] || { bg: 'bg-gray-100 text-gray-600', label: type };
}

export default function ReferralVoucherTable({ vouchers }: { vouchers: any[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editVoucher, setEditVoucher] = useState<any>(null);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Bạn chắc chắn muốn xoá voucher "${code}"?\nHành động này không thể hoàn tác.`)) return;

    setDeletingId(id);
    try {
      await apiClientClient.delete(`/vouchers/${id}`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi xoá voucher');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-800">Danh sách Voucher Referral</span>
          <span className="text-sm text-gray-500">{vouchers.length} voucher</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loại</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Giá trị</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đơn tối thiểu</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã dùng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="text-center py-12">
                      <div className="text-xl font-semibold text-gray-800 mb-2">Chưa có voucher referral</div>
                      <div className="text-gray-600">Tạo voucher đầu tiên để gán vào phần thưởng mời bạn</div>
                    </div>
                  </td>
                </tr>
              ) : vouchers.map((voucher) => {
                const typeInfo = getTypeBadge(voucher.type);
                const isDeleting = deletingId === voucher.id;

                return (
                  <tr key={voucher.id} className={`hover:bg-gray-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-sm bg-gray-100 px-2 py-1 rounded">
                        {voucher.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{voucher.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeInfo.bg}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {voucher.type === 'PERCENT'
                        ? `${voucher.value}%`
                        : formatCurrency(voucher.value)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{formatCurrency(voucher.minOrderValue)}</td>
                    <td className="px-6 py-4 text-gray-700">
                      {voucher._count?.userVouchers || voucher.usedCount || 0}
                      {voucher.totalUsageLimit ? `/${voucher.totalUsageLimit}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${voucher.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {voucher.isActive ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditVoucher(voucher)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(voucher.id, voucher.code)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? '...' : '🗑️ Xoá'}
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

      {/* Edit Modal */}
      {editVoucher && (
        <EditVoucherModal
          voucher={editVoucher}
          onSaved={() => {
            setEditVoucher(null);
            router.refresh();
          }}
          onClose={() => setEditVoucher(null)}
        />
      )}
    </>
  );
}
