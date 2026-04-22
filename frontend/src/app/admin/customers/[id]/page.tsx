import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
}

function fmtDate(d: string | Date) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

function fmtShortDate(d: string | Date) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(d));
}

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'bg-orange-100 text-orange-700', label: 'Chờ duyệt' },
  CONFIRMED: { cls: 'bg-cyan-100 text-cyan-700', label: 'Xác nhận' },
  PACKAGING: { cls: 'bg-purple-100 text-purple-700', label: 'Đóng gói' },
  SHIPPED: { cls: 'bg-blue-100 text-blue-700', label: 'Đã gửi' },
  DELIVERED: { cls: 'bg-teal-100 text-teal-700', label: 'Đã nhận' },
  COMPLETED: { cls: 'bg-green-100 text-green-700', label: 'Hoàn thành' },
  CANCELLED: { cls: 'bg-red-100 text-red-700', label: 'Đã hủy' },
  REFUNDED: { cls: 'bg-red-100 text-red-700', label: 'Hoàn trả' },
};

const rankConfig: Record<string, { cls: string; bg: string }> = {
  MEMBER: { cls: 'text-gray-700', bg: 'bg-gray-100' },
  SILVER: { cls: 'text-gray-600', bg: 'bg-gray-200' },
  GOLD: { cls: 'text-yellow-700', bg: 'bg-yellow-100' },
  DIAMOND: { cls: 'text-blue-700', bg: 'bg-blue-100' },
  PLATINUM: { cls: 'text-purple-700', bg: 'bg-purple-100' },
};

export default async function CustomerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  let customer: any = null;
  try {
    customer = await apiClient.get<any>(`/admin/customers/${params.id}`);
  } catch (error) {
    console.error('Error fetching customer:', error);
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khách hàng</h1>
        <Link href="/admin/customers" className="text-blue-600 hover:text-blue-700 font-medium">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const rank = rankConfig[customer.rank] || rankConfig.MEMBER;
  const address = [customer.addressStreet, customer.addressWard, customer.addressProvince].filter(Boolean).join(', ');

  return (
    <>
      <div className="mb-6">
        <Link href="/admin/customers" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
          ← Quay lại danh sách
        </Link>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {(customer.name || customer.phone || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-800 truncate">
                {customer.name || customer.phone}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${rank.bg} ${rank.cls}`}>
                {customer.rank}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              {customer.phone && <span>📞 {customer.phone}</span>}
              {customer.email && <span>✉ {customer.email}</span>}
              {customer.gender && <span>{customer.gender === 'MALE' ? '♂ Nam' : customer.gender === 'FEMALE' ? '♀ Nữ' : ''}</span>}
              {customer.dob && <span>🎂 {fmtShortDate(customer.dob)}</span>}
              <span>Tham gia: {fmtShortDate(customer.createdAt)}</span>
            </div>
            {address && <p className="text-sm text-gray-500 mt-1">{address}</p>}
            {customer.referralCode && (
              <p className="text-sm text-gray-500 mt-1">
                Mã giới thiệu: <span className="font-mono font-semibold text-gray-700">{customer.referralCode}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Tổng chi tiêu</p>
          <p className="text-xl font-bold text-gray-800">{fmt(customer.totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Đơn hàng</p>
          <p className="text-xl font-bold text-gray-800">{customer._count?.orders || 0}</p>
          <p className="text-xs text-gray-500">{customer.stats?.completedOrders || 0} hoàn thành</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Hoa hồng</p>
          <p className="text-xl font-bold text-gray-800">{fmt(customer.commissionBalance)}</p>
          <p className="text-xs text-gray-500">Tổng: {fmt(customer.stats?.totalCommission)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Giới thiệu</p>
          <p className="text-xl font-bold text-gray-800">{customer._count?.referees || 0} người</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders + Commissions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Đơn hàng gần đây ({customer._count?.orders || 0})
            </h2>
            {customer.orders?.length > 0 ? (
              <div className="space-y-2">
                {customer.orders.map((order: any) => {
                  const st = statusMap[order.status] || { cls: 'bg-gray-100 text-gray-700', label: order.status };
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm group-hover:text-blue-600">
                            #{order.orderCode}
                          </p>
                          <p className="text-xs text-gray-500">{fmtDate(order.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.source === 'PANCAKE' && (
                          <span className="text-xs border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Pancake</span>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="font-semibold text-gray-800 text-sm w-28 text-right">{fmt(order.totalAmount)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-6">Chưa có đơn hàng</p>
            )}
          </div>

          {/* Commission Ledger */}
          {customer.commissionsEarned?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Lịch sử hoa hồng ({customer._count?.commissionsEarned || 0})
              </h2>
              <div className="space-y-2">
                {customer.commissionsEarned.map((comm: any) => (
                  <div key={comm.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Từ đơn #{comm.order?.orderCode || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Cấp {comm.level} • {comm.percentage}% • {fmtShortDate(comm.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 text-sm">{fmt(comm.amount)}</p>
                      <p className={`text-xs font-medium ${comm.status === 'COMPLETED' ? 'text-green-600' : comm.status === 'PENDING' ? 'text-orange-600' : 'text-gray-500'}`}>
                        {comm.status === 'COMPLETED' ? 'Đã duyệt' : comm.status === 'PENDING' ? 'Chờ duyệt' : comm.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Referrer */}
          {customer.referrer && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Người giới thiệu</h2>
              <Link
                href={`/admin/customers/${customer.referrer.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                  {(customer.referrer.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{customer.referrer.name}</p>
                  <p className="text-xs text-gray-500">{customer.referrer.phone} • {customer.referrer.referralCode}</p>
                </div>
              </Link>
            </div>
          )}

          {/* Referees */}
          {customer.referees?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Đã giới thiệu ({customer._count?.referees || 0})
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customer.referees.map((ref: any) => (
                  <Link
                    key={ref.id}
                    href={`/admin/customers/${ref.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs">
                        {(ref.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{ref.name || ref.phone}</p>
                        <p className="text-xs text-gray-500">{fmtShortDate(ref.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(rankConfig[ref.rank] || rankConfig.MEMBER).bg} ${(rankConfig[ref.rank] || rankConfig.MEMBER).cls}`}>
                        {ref.rank}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Vouchers */}
          {customer.userVouchers?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Voucher ({customer._count?.userVouchers || 0})
              </h2>
              <div className="space-y-2">
                {customer.userVouchers.map((uv: any) => (
                  <div key={uv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                    <div>
                      <p className="font-mono font-semibold text-sm text-gray-800">{uv.voucher?.code}</p>
                      <p className="text-xs text-gray-500">
                        {uv.voucher?.type === 'PERCENTAGE'
                          ? `Giảm ${uv.voucher.value}%`
                          : `Giảm ${fmt(uv.voucher?.value)}`}
                        {uv.voucher?.validTo && ` • HSD: ${fmtShortDate(uv.voucher.validTo)}`}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${uv.isUsed ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                      {uv.isUsed ? 'Đã dùng' : 'Chưa dùng'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
