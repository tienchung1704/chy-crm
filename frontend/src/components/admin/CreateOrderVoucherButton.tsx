'use client';

import { useState, useEffect } from 'react';
import { apiClientClient } from '@/lib/apiClientClient';
import { Pencil, Trash2 } from 'lucide-react';

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  // Form states
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('FIXED_AMOUNT');
  const [customValue, setCustomValue] = useState('');
  const [customMinOrder, setCustomMinOrder] = useState('');
  const [customMaxDiscount, setCustomMaxDiscount] = useState('');
  const [customDurationDays, setCustomDurationDays] = useState('');

  useEffect(() => {
    checkExisting();
  }, [orderCode]);

  async function checkExisting() {
    try {
      const res = await apiClientClient.get<any>(`/vouchers/order-voucher/${orderCode}`);
      if (res.exists) {
        setExistingVoucher(res.voucher);
      } else {
        setExistingVoucher(null);
      }
    } catch (e) {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  async function handleCreateOrUpdate() {
    setLoading(true);
    try {
      if (isEditMode && existingVoucher) {
        // PATCH existing
        const body: any = {};
        if (customName) body.name = customName;
        body.type = customType;
        if (customValue) body.value = Number(customValue);
        body.minOrderValue = customMinOrder ? Number(customMinOrder) : 0;
        body.maxDiscount = customMaxDiscount ? Number(customMaxDiscount) : null;
        body.durationDays = customDurationDays ? Number(customDurationDays) : null;

        const res = await apiClientClient.patch<any>(`/vouchers/${existingVoucher.id}`, body);
        alert('Cập nhật voucher thành công!');
        setExistingVoucher(res);
      } else {
        // POST new
        const body: any = { orderId };
        if (useCustom) {
          if (customName) body.name = customName;
          body.type = customType;
          if (customValue) body.value = Number(customValue);
          if (customMinOrder) body.minOrderValue = Number(customMinOrder);
          if (customMaxDiscount) body.maxDiscount = Number(customMaxDiscount);
          if (customDurationDays) body.durationDays = Number(customDurationDays);
        }
        const res = await apiClientClient.post<any>('/vouchers/create-order-voucher', body);
        alert(res.message || 'Tạo voucher thành công!');
        setExistingVoucher(res.voucher);
      }
      setShowForm(false);
      setIsEditMode(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi xử lý voucher');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Bạn chắc chắn muốn xoá voucher này? Khách hàng sẽ không thể nhận được nữa.')) return;
    setLoading(true);
    try {
      await apiClientClient.delete(`/vouchers/${existingVoucher.id}`);
      alert('Đã xoá voucher thành công.');
      setExistingVoucher(null);
      setShowForm(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi xoá voucher');
    } finally {
      setLoading(false);
    }
  }

  function handleEditClick() {
    setIsEditMode(true);
    setUseCustom(true);
    setCustomName(existingVoucher.name || '');
    setCustomType(existingVoucher.type || 'FIXED_AMOUNT');
    setCustomValue(existingVoucher.value?.toString() || '');
    setCustomMinOrder(existingVoucher.minOrderValue?.toString() || '');
    setCustomMaxDiscount(existingVoucher.maxDiscount?.toString() || '');
    setCustomDurationDays(existingVoucher.durationDays?.toString() || '');
    setShowForm(true);
  }

  function handleCancelForm() {
    setShowForm(false);
    setIsEditMode(false);
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

  if (existingVoucher && !showForm) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 relative">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🎟️ Voucher QR đơn hàng</h2>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">✅</span>
              <span className="font-semibold text-green-800">Đã có voucher riêng</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleEditClick} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Sửa">
                <Pencil size={16} />
              </button>
              <button onClick={handleDelete} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xoá">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Tên Voucher:</span>
              <span className="font-semibold text-gray-800">{existingVoucher.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mã voucher:</span>
              <span className="font-mono font-bold text-gray-800">{existingVoucher.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Giá trị:</span>
              <span className="font-bold text-green-700">
                {existingVoucher.type === 'PERCENT' ? `${existingVoucher.value}%` : fmtVND(existingVoucher.value)}
              </span>
            </div>
            {existingVoucher.type === 'PERCENT' && existingVoucher.maxDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Giảm tối đa:</span>
                <span className="text-gray-700">{fmtVND(existingVoucher.maxDiscount)}</span>
              </div>
            )}
            {existingVoucher.minOrderValue > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Đơn tối thiểu:</span>
                <span className="text-gray-700">{fmtVND(existingVoucher.minOrderValue)}</span>
              </div>
            )}
            {existingVoucher.durationDays > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Hạn dùng:</span>
                <span className="text-gray-700">{existingVoucher.durationDays} ngày</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{isEditMode ? 'Sửa Voucher Đơn Hàng' : 'Voucher QR đơn hàng'}</h2>
      {!isEditMode && (
        <p className="text-sm text-gray-500 mb-4">
          Tạo voucher riêng cho đơn hàng này. Khi khách quét QR sẽ nhận được voucher này thay vì voucher mặc định.
        </p>
      )}

      {!showForm ? (
        <button
          onClick={() => {
            setIsEditMode(false);
            setUseCustom(false);
            setCustomName('');
            setCustomType('FIXED_AMOUNT');
            setCustomValue('');
            setCustomMinOrder('');
            setCustomMaxDiscount('');
            setCustomDurationDays('');
            setShowForm(true);
          }}
          className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Tạo Voucher QR cho đơn này
        </button>
      ) : (
        <div className="space-y-4">
          {!isEditMode && (
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
              <input
                type="checkbox"
                id="useCustom"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="useCustom" className="text-sm font-medium text-gray-700">
                Tùy chỉnh giá trị chi tiết (nếu không chọn sẽ lấy từ cấu hình mặc định)
              </label>
            </div>
          )}

          {(useCustom || isEditMode) && (
            <div className="space-y-4 border border-gray-100 rounded-lg p-4 bg-gray-50/50">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên Voucher</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`Voucher QR đơn #${orderCode}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Loại giảm giá</label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="FIXED_AMOUNT">Giảm tiền (VNĐ)</option>
                    <option value="PERCENT">Giảm phần trăm (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mức giảm</label>
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={customType === 'PERCENT' ? 'VD: 10' : 'VD: 50000'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {customType === 'PERCENT' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Giảm tối đa (VNĐ)</label>
                    <input
                      type="number"
                      value={customMaxDiscount}
                      onChange={(e) => setCustomMaxDiscount(e.target.value)}
                      placeholder="Không giới hạn"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}
                <div className={customType !== 'PERCENT' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đơn tối thiểu (VNĐ)</label>
                  <input
                    type="number"
                    value={customMinOrder}
                    onChange={(e) => setCustomMinOrder(e.target.value)}
                    placeholder="VD: 100000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số ngày hiệu lực</label>
                <input
                  type="number"
                  value={customDurationDays}
                  onChange={(e) => setCustomDurationDays(e.target.value)}
                  placeholder="Để trống = Không giới hạn"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreateOrUpdate}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : 'Xác nhận tạo')}
            </button>
            <button
              onClick={handleCancelForm}
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
