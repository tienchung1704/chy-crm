import prisma from '@/lib/prisma';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import OrderSearchInput from '@/components/admin/OrderSearchInput';
import OrderStatusFilter from '@/components/admin/OrderStatusFilter';

async function getOrders(params: { page?: string; status?: string; paymentMethod?: string; search?: string }, storeId: string | null, role: string | null) {
  const page = parseInt(params.page || '1');
  const limit = 11;
  const where: any = {};
  const baseWhere: any = {}; // Used for status counts

  if (role === 'MODERATOR') {
    if (storeId) {
      where.storeId = storeId;
      baseWhere.storeId = storeId;
    } else {
      where.id = 'no-access';
      baseWhere.id = 'no-access';
    }
  }

  if (params.search) {
    const searchFilter = {
      OR: [
        { orderCode: { contains: params.search } },
        { user: { name: { contains: params.search } } },
      ],
    };
    where.OR = searchFilter.OR;
    baseWhere.OR = searchFilter.OR;
  }

  if (params.status) where.status = params.status;
  if (params.paymentMethod) where.paymentMethod = params.paymentMethod;

  const [orders, total, countsData] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, rank: true, phone: true } },
        appliedVouchers: { include: { userVoucher: { include: { voucher: { select: { code: true, type: true } } } } } },
        items: { include: { product: { select: { name: true, imageUrl: true } } } },
        _count: { select: { commissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    }),
  ]);

  const statusCounts = countsData.reduce((acc, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {} as Record<string, number>);

  return { 
    orders, 
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    statusCounts
  };
}

function fmt(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

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

export default async function OrdersPage(props: { searchParams: Promise<{ page?: string; status?: string; paymentMethod?: string; search?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getSession();

  let storeId = null;
  if (session?.role === 'MODERATOR') {
    const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
    storeId = store?.id || null;
  }

  const { orders, pagination, statusCounts } = await getOrders(searchParams, storeId, session?.role || null);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Đơn hàng</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Quản lý và theo dõi hiệu quả kinh doanh</p>
        </div>
        <div className="w-full md:w-80">
          <OrderSearchInput />
        </div>
      </div>

      <OrderStatusFilter counts={statusCounts} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
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
                  <td colSpan={7}>
                    <div className="text-center py-20 bg-white">
                      <div className="text-5xl mb-4 bg-gray-50 w-20 h-20 flex items-center justify-center rounded-3xl mx-auto shadow-inner">📦</div>
                      <div className="text-xl font-bold text-gray-900">Không tìm thấy đơn hàng</div>
                      <p className="text-gray-400 mt-1 max-w-[200px] mx-auto text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                  </td>
                </tr>
              ) : orders.map((order) => {
                const st = statusMap[order.status] || { cls: 'badge-gray', label: order.status };
                const isUnread = !order.isRead;
                
                let firstItemDisplay = 'Chưa có sản phẩm';
                const isPancake = order.source === 'PANCAKE';
                
                const metadata = order.metadata as any;
                if (isPancake && metadata?.items && Array.isArray(metadata.items) && metadata.items.length > 0) {
                  const item = metadata.items[0];
                  firstItemDisplay = `${item.name} x ${item.quantity || 1}`;
                } else if (order.items && order.items.length > 0) {
                  const item = order.items[0];
                  firstItemDisplay = `${item.product.name} x ${item.quantity}`;
                }

                return (
                  <tr 
                    key={order.id} 
                    className={`transition-all duration-200 hover:bg-black/[0.01] ${isUnread ? 'bg-gray-100/60' : 'bg-white'}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" title="Đơn hàng chưa đọc" />}
                        <span className={`font-mono text-sm font-bold ${isUnread ? 'text-blue-700' : 'text-gray-900'}`}>
                          #{order.orderCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-bold ${isUnread ? 'text-gray-900 font-bold' : 'text-gray-700 font-bold'}`}>{order.user.name}</div>
                      <div className="text-[11px] text-gray-400 font-medium">{order.user.phone || ''}</div>
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
                      <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm transition-all ${
                        st.cls === 'badge-warning' ? 'bg-orange-100 text-orange-700 shadow-orange-100' :
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 mb-4">
          {/* Previous Page */}
          {pagination.page > 1 && (
            <Link
              href={`/admin/orders?${(() => {
                const p = new URLSearchParams();
                p.set('page', String(pagination.page - 1));
                if (searchParams.status) p.set('status', searchParams.status);
                if (searchParams.search) p.set('search', searchParams.search);
                return p.toString();
              })()}`}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ←
            </Link>
          )}

          {/* Page Numbers */}
          {Array.from({ length: pagination.totalPages }, (_, i) => {
            const pageNum = i + 1;
            const shouldShow = pageNum === 1 || pageNum === pagination.totalPages || Math.abs(pageNum - pagination.page) <= 2;
            
            if (!shouldShow) {
              if (pageNum === 2 || pageNum === pagination.totalPages - 1) {
                return <span key={pageNum} className="px-2 text-gray-400">...</span>;
              }
              return null;
            }

            const params = new URLSearchParams();
            params.set('page', String(pageNum));
            if (searchParams.status) params.set('status', searchParams.status);
            if (searchParams.search) params.set('search', searchParams.search);

            return (
              <Link
                key={pageNum}
                href={`/admin/orders?${params.toString()}`}
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                  pagination.page === pageNum
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {pageNum}
              </Link>
            );
          })}

          {/* Next Page */}
          {pagination.page < pagination.totalPages && (
            <Link
              href={`/admin/orders?${(() => {
                const p = new URLSearchParams();
                p.set('page', String(pagination.page + 1));
                if (searchParams.status) p.set('status', searchParams.status);
                if (searchParams.search) p.set('search', searchParams.search);
                return p.toString();
              })()}`}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
