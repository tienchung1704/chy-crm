export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import OrderSearchInput from '@/components/admin/OrderSearchInput';
import OrderStatusFilter from '@/components/admin/OrderStatusFilter';
import OrdersTableClient from '@/components/admin/OrdersTableClient';
import { apiClient } from '@/lib/apiClient';

export default async function OrdersPage(props: { searchParams: Promise<{ page?: string; status?: string; paymentMethod?: string; search?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session) return null;

  let orders: any[] = [];
  let pagination: any = { page: 1, limit: 11, total: 0, totalPages: 0 };
  let statusCounts: Record<string, number> = {};

  try {
    const data = await apiClient.get<any>('/orders/admin', {
      params: {
        page: searchParams.page,
        status: searchParams.status,
        paymentMethod: searchParams.paymentMethod,
        search: searchParams.search,
      }
    });
    orders = data.orders;
    pagination = data.pagination;
    statusCounts = data.statusCounts;
  } catch (error) {
    console.error('Error fetching admin orders:', error);
  }

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

      <OrdersTableClient orders={orders} />

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
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${pagination.page === pageNum
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

