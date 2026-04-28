'use client';

import { useState, useEffect } from 'react';
import { apiClientClient } from '@/lib/apiClientClient';

interface Props {
  orderId: string;
  orderCode: string;
}

function fmtVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
}

export default function CreateOrderVoucherButton({ orderId, orderCode }: Props) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingVoucher, setExistingVoucher] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customMinOrder, setCustomMinOrder] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    checkExisting();
  }, [orderCode]);

  async function checkExisting() {
    try {
      const res = await apiClientClient.get<any>(`/vouchers/order-voucher/${orderCode}`);
      if (res.exists) {
        setExistingVoucher(res.voucher);
      }
    } catch (e) {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const body: any = { orderId };
      if (useCustom && customValue) {
        body.value = Number(customValue);
        if (customMinOrder) body.minOrderValue = Number(customMinOrder);
      }
      const res = await apiClientClient.post<any>('/vouchers/create-order-voucher', body);
      alert(res.message || 'Tạo voucher thành công!');
      setExistingVoucher(res.voucher);
      setShowForm(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi tạo voucher');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Đang kiểm tra voucher...</span>
        </div>
      </div>
    );
  }

  if (existingVoucher) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🎟️ Voucher QR đơn hàng</h2>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-600 text-lg">✅</span>
            <span className="font-semibold text-green-800">Đã có voucher riêng</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Mã voucher:</span>
              <span className="font-mono font-bold text-gray-800">{existingVoucher.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Giá trị:</span>
              <span className="font-bold text-green-700">{fmtVND(existingVoucher.value)}</span>
            </div>
            {existingVoucher.minOrderValue > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Đơn tối thiểu:</span>
                <span className="text-gray-700">{fmtVND(existingVoucher.minOrderValue)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🎟️ Voucher QR đơn hàng</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tạo voucher riêng cho đơn hàng này. Khi khách quét QR sẽ nhận được voucher này thay vì voucher mặc định.
      </p>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          🎟️ Tạo Voucher QR cho đơn này
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useCustom"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="useCustom" className="text-sm font-medium text-gray-700">
              Tùy chỉnh giá trị (không chọn = lấy từ cấu hình mặc định)
            </label>
          </div>

          {useCustom && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Giá trị voucher (VNĐ)
                </label>
                <input
                  type="number"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="VD: 500000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Đơn tối thiểu (VNĐ)
                </label>
                <input
                  type="number"
                  value={customMinOrder}
                  onChange={(e) => setCustomMinOrder(e.target.value)}
                  placeholder="VD: 100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang tạo...' : 'Xác nhận tạo'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              disabled={loading}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
