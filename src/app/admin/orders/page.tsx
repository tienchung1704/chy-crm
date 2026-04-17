import prisma from '@/lib/prisma';
import Link from 'next/link';

async function getOrders(params: { page?: string; status?: string; paymentMethod?: string; search?: string }) {
  const page = parseInt(params.page || '1');
  const limit = 20;
  const where: Record<string, unknown> = {};

  if (params.status) where.status = params.status;
  if (params.paymentMethod) where.paymentMethod = params.paymentMethod;
  if (params.search) {
    where.OR = [
      { orderCode: { contains: params.search } },
      { user: { name: { contains: params.search } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, rank: true, phone: true } },
        appliedVouchers: { include: { userVoucher: { include: { voucher: { select: { code: true, type: true } } } } } },
        _count: { select: { items: true, commissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

const statusMap: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: 'badge-warning', label: 'Chờ duyệt' },
  PACKAGING: { cls: 'badge-purple', label: 'Đang đóng hàng' },
  CONFIRMED: { cls: 'badge-info', label: 'Đang giao' },
  COMPLETED: { cls: 'badge-success', label: 'Hoàn thành' },
  CANCELLED: { cls: 'badge-danger', label: 'Đã hủy' },
  REFUNDED: { cls: 'badge-danger', label: 'Hoàn trả' },
};

const paymentStatusMap: Record<string, { cls: string; label: string }> = {
  UNPAID: { cls: 'badge-gray', label: 'Chưa thanh toán' },
  PAID: { cls: 'badge-success', label: 'Đã thanh toán' },
  PARTIALLY_PAID: { cls: 'badge-warning', label: 'Thanh toán 1 phần' },
  REFUNDED: { cls: 'badge-danger', label: 'Đã hoàn tiền' },
};

export default async function OrdersPage(props: { searchParams: Promise<{ page?: string; status?: string; paymentMethod?: string; search?: string }> }) {
  const searchParams = await props.searchParams;
  const { orders, pagination } = await getOrders(searchParams);

  return (
    <>
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Đơn hàng</h1>
          <p className="text-gray-600 text-sm">{pagination.total} đơn hàng</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <form className="flex items-center gap-4" action="/admin/orders" method="GET">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              name="search" 
              placeholder="Tìm mã đơn, tên KH..." 
              defaultValue={searchParams.search} 
              id="order-search"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select 
            name="status" 
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            defaultValue={searchParams.status} 
            id="status-filter"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="PACKAGING">Đang đóng hàng</option>
            <option value="CONFIRMED">Đang giao</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REFUNDED">Hoàn trả</option>
          </select>
          <select 
            name="paymentMethod" 
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            defaultValue={searchParams.paymentMethod} 
            id="payment-method-filter"
          >
            <option value="">Tất cả thanh toán</option>
            <option value="COD">COD (Tiền mặt)</option>
            <option value="VIETQR">Chuyển khoản</option>
            <option value="STRIPE">Stripe</option>
          </select>
          <button type="submit" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            Lọc
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã đơn</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khách hàng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nguồn</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sản phẩm</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thành tiền</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phương thức</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thanh toán</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="text-center py-12">
                      <div className="text-6xl mb-3">📦</div>
                      <div className="text-xl font-semibold text-gray-800">Chưa có đơn hàng</div>
                    </div>
                  </td>
                </tr>
              ) : orders.map((order) => {
                const st = statusMap[order.status] || { cls: 'badge-member', label: order.status };
                const pst = paymentStatusMap[order.paymentStatus] || { cls: 'badge-gray', label: order.paymentStatus };
                
                const paymentMethodLabel = order.paymentMethod === 'COD' ? 'COD' : 
                                          order.paymentMethod === 'VIETQR' ? 'Chuyển khoản' :
                                          order.paymentMethod === 'STRIPE' ? 'Stripe' : 
                                          'Chưa xác định';
                const paymentMethodColor = order.paymentMethod === 'COD' ? 'bg-amber-100 text-amber-700' :
                                          order.paymentMethod === 'VIETQR' ? 'bg-blue-100 text-blue-700' :
                                          order.paymentMethod === 'STRIPE' ? 'bg-purple-100 text-purple-700' :
                                          'bg-gray-100 text-gray-700';
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-gray-800">{order.orderCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{order.user.name}</div>
                      <div className="text-xs text-gray-500">{order.user.phone || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">
                        {order.source || 'WEB'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{order._count.items} SP</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{fmt(order.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${paymentMethodColor}`}>
                        {paymentMethodLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        st.cls === 'badge-warning' ? 'bg-orange-100 text-orange-700' :
                        st.cls === 'badge-purple' ? 'bg-purple-100 text-purple-700' :
                        st.cls === 'badge-info' ? 'bg-cyan-100 text-cyan-700' :
                        st.cls === 'badge-success' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        pst.cls === 'badge-gray' ? 'bg-gray-100 text-gray-700' :
                        pst.cls === 'badge-success' ? 'bg-green-100 text-green-700' :
                        pst.cls === 'badge-warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {pst.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">{fmtDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Link 
                        href={`/admin/orders/${order.id}`} 
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => {
            const params = new URLSearchParams();
            params.set('page', String(i + 1));
            if (searchParams.status) params.set('status', searchParams.status);
            if (searchParams.paymentMethod) params.set('paymentMethod', searchParams.paymentMethod);
            if (searchParams.search) params.set('search', searchParams.search);
            
            return (
              <Link 
                key={i + 1} 
                href={`/admin/orders?${params.toString()}`}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  pagination.page === i + 1 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
