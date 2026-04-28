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

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

function getTypeBadge(type: string) {
  const map: Record<string, { class: string; label: string }> = {
    PERCENT: { class: 'badge-primary', label: 'Giảm %' },
    FIXED_AMOUNT: { class: 'badge-success', label: 'Giảm tiền' },
    FREESHIP: { class: 'badge-info', label: 'Free ship' },
    STACK: { class: 'badge-warning', label: '📊 Stack' },
  };
  return map[type] || { class: 'badge-member', label: type };
}

function getCampaignBadge(cat: string) {
  const map: Record<string, { class: string; label: string }> = {
    WELCOME: { class: 'badge-success', label: '🎉 Welcome' },
    VIP: { class: 'badge-gold', label: '👑 VIP' },
    BUNDLE: { class: 'badge-primary', label: '📦 Bundle' },
    FREESHIP: { class: 'badge-info', label: '🚚 Freeship' },
    GAMIFICATION: { class: 'badge-warning', label: '🎰 Vòng quay' },
    REFERRAL: { class: 'badge-diamond', label: '🔗 Referral' },
    BIRTHDAY: { class: 'badge-danger', label: '🎂 Sinh nhật' },
  };
  return map[cat] || { class: 'badge-member', label: cat };
}

export default function VoucherTableClient({ vouchers }: { vouchers: any[] }) {
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Chiến dịch</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loại</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Giá trị</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đơn tối thiểu</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã dùng</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hạn dùng</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="text-center py-12">
                    <div className="text-6xl mb-3">🎫</div>
                    <div className="text-xl font-semibold text-gray-800 mb-2">Chưa có voucher nào</div>
                    <div className="text-gray-600">Tạo voucher đầu tiên để bắt đầu chiến dịch</div>
                  </div>
                </td>
              </tr>
            ) : vouchers.map((voucher) => {
              const typeInfo = getTypeBadge(voucher.type);
              const campInfo = getCampaignBadge(voucher.campaignCategory);
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      campInfo.class === 'badge-success' ? 'bg-green-100 text-green-700' :
                      campInfo.class === 'badge-gold' ? 'bg-yellow-100 text-yellow-700' :
                      campInfo.class === 'badge-primary' ? 'bg-blue-100 text-blue-700' :
                      campInfo.class === 'badge-info' ? 'bg-cyan-100 text-cyan-700' :
                      campInfo.class === 'badge-warning' ? 'bg-orange-100 text-orange-700' :
                      campInfo.class === 'badge-diamond' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {campInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      typeInfo.class === 'badge-primary' ? 'bg-blue-100 text-blue-700' :
                      typeInfo.class === 'badge-success' ? 'bg-green-100 text-green-700' :
                      typeInfo.class === 'badge-warning' ? 'bg-orange-100 text-orange-700' :
                      'bg-cyan-100 text-cyan-700'
                    }`}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">
                    {voucher.type === 'STACK'
                      ? (() => {
                          const tiers = voucher.stackTiers as any[] | null;
                          if (tiers && tiers.length > 0) {
                            const maxTier = tiers.reduce((max: any, t: any) => t.discount > max.discount ? t : max, tiers[0]);
                            return `Đến ${maxTier.type === 'PERCENT' ? `${maxTier.discount}%` : formatCurrency(maxTier.discount)}`;
                          }
                          return '—';
                        })()
                      : voucher.type === 'PERCENT'
                        ? `${voucher.value}%`
                        : formatCurrency(voucher.value)}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{formatCurrency(voucher.minOrderValue)}</td>
                  <td className="px-6 py-4 text-gray-700">
                    {voucher.usedCount}
                    {voucher.totalUsageLimit ? `/${voucher.totalUsageLimit}` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(voucher.validTo)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      voucher.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
