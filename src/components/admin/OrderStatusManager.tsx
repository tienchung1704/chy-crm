'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface OrderStatusManagerProps {
  orderId: string;
  currentStatus: string;
  currentPaymentStatus: string;
}

const statusOptions = [
  { value: 'PENDING', label: 'Chờ duyệt', color: 'orange' },
  { value: 'CONFIRMED', label: 'Đang giao', color: 'cyan' },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'green' },
  { value: 'CANCELLED', label: 'Đã hủy', color: 'red' },
  { value: 'REFUNDED', label: 'Hoàn trả', color: 'red' },
];

const paymentStatusOptions = [
  { value: 'UNPAID', label: 'Chưa thanh toán', color: 'gray' },
  { value: 'PAID', label: 'Đã thanh toán', color: 'green' },
  { value: 'PARTIALLY_PAID', label: 'Thanh toán 1 phần', color: 'yellow' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền', color: 'red' },
];

export default function OrderStatusManager({
  orderId,
  currentStatus,
  currentPaymentStatus,
}: OrderStatusManagerProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleUpdate = async () => {
    if (status === currentStatus && paymentStatus === currentPaymentStatus) {
      setMessage({ text: 'Không có thay đổi nào', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentStatus }),
      });

      if (res.ok) {
        setMessage({ text: 'Cập nhật thành công!', type: 'success' });
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Có lỗi xảy ra', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Lỗi kết nối', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Quản lý trạng thái</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Trạng thái đơn hàng
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Trạng thái thanh toán
          </label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {paymentStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleUpdate}
          disabled={loading || (status === currentStatus && paymentStatus === currentPaymentStatus)}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Lưu ý:</strong> Khi chuyển đơn hàng sang "Hoàn thành", số lượng đã bán của sản phẩm sẽ được cập nhật tự động.
        </p>
      </div>
    </div>
  );
}
