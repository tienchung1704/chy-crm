export const dynamic = 'force-dynamic';
import Link from 'next/link';
import CustomerActions from '@/components/admin/CustomerActions';
import { apiClient } from '@/lib/apiClient';

interface SearchParams {
  page?: string;
  search?: string;
  rank?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(amount);
}

function getRankBadgeClass(rank: string) {
  const map: Record<string, string> = {
    MEMBER: 'badge-member', SILVER: 'badge-silver',
    GOLD: 'badge-gold', DIAMOND: 'badge-diamond', PLATINUM: 'badge-platinum',
  };
  return map[rank] || 'badge-member';
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

export default async function CustomersPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;

  let customers: any[] = [];
  let pagination: any = { page: 1, limit: 20, total: 0, totalPages: 0 };

  try {
    const data = await apiClient.get<any>('/admin/customers', {
      params: {
        page: searchParams.page,
        search: searchParams.search,
        rank: searchParams.rank,
      }
    });
    customers = data.customers;
    pagination = data.pagination;
  } catch (error) {
    console.error('Error fetching customers:', error);
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Khách hàng</h1>
          <p className="text-gray-600 text-sm">
            {pagination.total} khách hàng trong hệ thống
          </p>
        </div>
        <CustomerActions />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
        <form className="flex items-center gap-4" action="/admin/customers" method="GET">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              name="search"
              placeholder="Tìm tên, email, SĐT..."
              defaultValue={searchParams.search}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            name="rank"
            className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            defaultValue={searchParams.rank}
          >
            <option value="">Tất cả hạng</option>
            <option value="MEMBER">Member</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="DIAMOND">Diamond</option>
            <option value="PLATINUM">Platinum</option>
          </select>
          <button type="submit" className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Lọc
          </button>
        </form>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khách hàng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hạng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tổng chi tiêu</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Số đơn</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Giới thiệu</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hoa hồng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ngày đăng ký</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="text-center py-12">
                      <div className="text-6xl mb-3">👥</div>
                      <div className="text-xl font-semibold text-gray-800 mb-2">Không tìm thấy khách hàng</div>
                      <div className="text-gray-600">
                        {searchParams.search
                          ? 'Thử tìm kiếm với từ khóa khác'
                          : 'Thêm khách hàng đầu tiên để bắt đầu'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {(customer.phone || customer.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {customer.phone || customer.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            {customer.name !== customer.phone ? customer.name : (customer.email || 'Chưa cập nhật')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">
                      {customer.email || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${customer.rank === 'PLATINUM' ? 'bg-purple-100 text-purple-700' :
                          customer.rank === 'DIAMOND' ? 'bg-blue-100 text-blue-700' :
                            customer.rank === 'GOLD' ? 'bg-yellow-100 text-yellow-700' :
                              customer.rank === 'SILVER' ? 'bg-gray-200 text-gray-700' :
                                'bg-gray-100 text-gray-600'
                        }`}>
                        {customer.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="px-6 py-4">{customer._count?.orders || 0}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {customer._count?.referees || 0} người
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{formatCurrency(customer.commissionBalance)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/customers/${customer.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (() => {
        const currentPage = Number(pagination.page);
        const totalPages = pagination.totalPages;
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 3) {
          pages.push(1, 2, 3, 4, '...', totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
          pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }

        const buildHref = (p: number) =>
          `/admin/customers?page=${p}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.rank ? `&rank=${searchParams.rank}` : ''}`;

        return (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {currentPage > 1 && (
              <Link
                href={buildHref(currentPage - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ← Trước
              </Link>
            )}

            {pages.map((page, index) =>
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="px-2 py-2 text-gray-400 text-sm">
                  ...
                </span>
              ) : (
                <Link
                  key={page}
                  href={buildHref(page as number)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </Link>
              )
            )}

            {currentPage < totalPages && (
              <Link
                href={buildHref(currentPage + 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Sau →
              </Link>
            )}
          </div>
        );
      })()}
    </>
  );
}
