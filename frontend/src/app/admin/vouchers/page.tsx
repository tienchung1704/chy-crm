import prisma from '@/lib/prisma';
import Link from 'next/link';
import VoucherActions from '@/components/admin/VoucherActions';

async function getVouchers() {
  return prisma.voucher.findMany({
    where: {
      campaignCategory: { not: 'GAMIFICATION' } // Exclude spin wheel vouchers
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { userVouchers: true } },
    },
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | null) {
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

export default async function VouchersPage() {
  const vouchers = await getVouchers();

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Voucher</h1>
          <p className="text-gray-600 text-sm">Quản lý mã giảm giá và chiến dịch khuyến mãi</p>
        </div>
        <VoucherActions />
      </div>

      {/* Campaign Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {['WELCOME', 'VIP', 'BUNDLE', 'FREESHIP'].map((cat) => {
          const count = vouchers.filter(v => v.campaignCategory === cat && v.isActive).length;
          const info = getCampaignBadge(cat);
          return (
            <div key={cat} className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-sm text-gray-600 mb-2">{info.label}</div>
              <div className="text-3xl font-bold text-gray-800 mb-2">{count}</div>
              <div className="text-xs text-gray-600">voucher hoạt động</div>
            </div>
          );
        })}
      </div>

      {/* Voucher Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-800">Tất cả Voucher</span>
        </div>
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
                <th className="px-6 py-3"></th>
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
                return (
                  <tr key={voucher.id} className="hover:bg-gray-50">
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
                        'bg-cyan-100 text-cyan-700'
                      }`}>
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
                      <Link href={`/admin/vouchers/${voucher.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Sửa
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
