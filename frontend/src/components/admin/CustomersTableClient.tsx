'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MessageSquareShare } from 'lucide-react';
import ZaloZnsModal from './ZaloZnsModal';

interface CustomersTableClientProps {
  customers: any[];
  searchParams: any;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date) => string;
  isZaloEnabled?: boolean;
}

export default function CustomersTableClient({ customers, searchParams, formatCurrency, formatDate, isZaloEnabled = false }: CustomersTableClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZnsModalOpen, setIsZnsModalOpen] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSet = new Set(selectedIds);
      customers.forEach(c => newSet.add(c.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      customers.forEach(c => newSet.delete(c.id));
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const isAllSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id));
  const isIndeterminate = customers.some(c => selectedIds.has(c.id)) && !isAllSelected;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 w-12 text-left">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={isAllSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khách hàng</th>
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
                        {searchParams?.search
                          ? 'Thử tìm kiếm với từ khóa khác'
                          : 'Thêm khách hàng đầu tiên để bắt đầu'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className={`hover:bg-gray-50 ${selectedIds.has(customer.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.has(customer.id)}
                        onChange={(e) => handleSelectOne(customer.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-800">
                          {customer.phone || customer.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {customer.name !== customer.phone ? customer.name : (customer.email || 'Chưa cập nhật')}
                        </div>
                      </div>
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

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white shadow-2xl rounded-2xl border border-blue-100 py-3 px-6 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <span className="flex items-center justify-center bg-blue-100 text-blue-700 w-6 h-6 rounded-full font-bold text-xs">
              {selectedIds.size}
            </span>
            khách hàng đã chọn
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex items-center gap-3">
            {isZaloEnabled && (
              <button
                onClick={() => setIsZnsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors text-sm"
              >
                <MessageSquareShare size={16} />
                Gửi Zalo ZNS
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg font-medium text-sm transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Zalo Modal */}
      <ZaloZnsModal
        isOpen={isZnsModalOpen}
        onClose={() => setIsZnsModalOpen(false)}
        selectedUserIds={Array.from(selectedIds)}
        totalCustomersCount={selectedIds.size}
        onSuccess={() => {
          setSelectedIds(new Set()); // clear selection after success
        }}
      />
    </>
  );
}
