import prisma from '@/lib/prisma';
import Link from 'next/link';

async function getDashboardStats() {
  const [
    totalCustomers,
    newCustomersThisMonth,
    totalOrders,
    completedOrders,
    totalRevenue,
    activeVouchers,
    pendingCommissions,
    recentOrders,
    topCustomers,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({
      where: {
        role: 'CUSTOMER',
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.voucher.count({ where: { isActive: true } }),
    prisma.commissionLedger.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, rank: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      take: 5,
      orderBy: { totalSpent: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        rank: true,
        totalSpent: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  return {
    totalCustomers,
    newCustomersThisMonth,
    totalOrders,
    completedOrders,
    totalRevenue: totalRevenue._sum.totalAmount || 0,
    activeVouchers,
    pendingCommissions: pendingCommissions._sum.amount || 0,
    recentOrders,
    topCustomers,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRankBadgeClass(rank: string) {
  const map: Record<string, string> = {
    MEMBER: 'badge-member',
    SILVER: 'badge-silver',
    GOLD: 'badge-gold',
    DIAMOND: 'badge-diamond',
    PLATINUM: 'badge-platinum',
  };
  return map[rank] || 'badge-member';
}

function getStatusBadge(status: string) {
  const map: Record<string, { class: string; label: string }> = {
    PENDING: { class: 'badge-warning', label: 'Chờ xử lý' },
    CONFIRMED: { class: 'badge-info', label: 'Xác nhận' },
    COMPLETED: { class: 'badge-success', label: 'Hoàn thành' },
    CANCELLED: { class: 'badge-danger', label: 'Đã hủy' },
    REFUNDED: { class: 'badge-danger', label: 'Hoàn trả' },
  };
  return map[status] || { class: 'badge-member', label: status };
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Dashboard</h1>
          <p className="text-gray-600 text-sm">Tổng quan hệ thống chăm sóc khách hàng</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/customers" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
            👥 Khách hàng
          </Link>
          <Link href="/admin/vouchers" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            🎫 Tạo Voucher
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng khách hàng</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">{stats.totalCustomers.toLocaleString()}</div>
          <div className="text-xs text-green-600 font-medium">
            +{stats.newCustomersThisMonth} tháng này
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng doanh thu</div>
          <div className="text-2xl font-bold text-gray-800 mb-2">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <div className="text-xs text-green-600 font-medium">
            {stats.completedOrders} đơn hoàn thành
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Đơn hàng</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">{stats.totalOrders.toLocaleString()}</div>
          <div className="text-xs text-green-600 font-medium">
            {stats.completedOrders} hoàn thành
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Voucher hoạt động</div>
          <div className="text-3xl font-bold text-gray-800">{stats.activeVouchers}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Hoa hồng chờ duyệt</div>
          <div className="text-2xl font-bold text-gray-800">
            {formatCurrency(stats.pendingCommissions)}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <span className="text-lg font-bold text-gray-800">Đơn hàng gần đây</span>
            <Link href="/admin/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã đơn</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khách hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tổng tiền</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <div className="text-gray-500">Chưa có đơn hàng nào</div>
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => {
                    const statusInfo = getStatusBadge(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-gray-800">
                            {order.orderCode}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                              {order.user.name.charAt(0)}
                            </div>
                            <span className="text-sm">{order.user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            statusInfo.class === 'badge-success' ? 'bg-green-100 text-green-700' :
                            statusInfo.class === 'badge-warning' ? 'bg-yellow-100 text-yellow-700' :
                            statusInfo.class === 'badge-info' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <span className="text-lg font-bold text-gray-800">Khách hàng VIP</span>
            <Link href="/admin/customers" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khách hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hạng</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã chi</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Đơn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <div className="text-gray-500">Chưa có khách hàng nào</div>
                    </td>
                  </tr>
                ) : (
                  stats.topCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{customer.name}</div>
                            <div className="text-xs text-gray-600">{customer.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          customer.rank === 'PLATINUM' ? 'bg-purple-100 text-purple-700' :
                          customer.rank === 'DIAMOND' ? 'bg-blue-100 text-blue-700' :
                          customer.rank === 'GOLD' ? 'bg-yellow-100 text-yellow-700' :
                          customer.rank === 'SILVER' ? 'bg-gray-200 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {customer.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(customer.totalSpent)}</td>
                      <td className="px-6 py-4">{customer._count.orders}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
