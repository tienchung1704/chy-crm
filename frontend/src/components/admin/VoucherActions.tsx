'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientClient } from '@/lib/apiClientClient';

export default function VoucherActions() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    campaignCategory: 'WELCOME',
    type: 'PERCENT',
    value: '',
    minOrderValue: '399000',
    maxDiscount: '',
    totalUsageLimit: '',
    perCustomerLimit: '1',
    validFrom: '',
    validTo: '',
    durationDays: '30',
    isStackable: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiClientClient.post('/vouchers', {
        ...form,
        value: parseFloat(form.value),
        minOrderValue: parseFloat(form.minOrderValue) || 0,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        totalUsageLimit: form.totalUsageLimit ? parseInt(form.totalUsageLimit) : null,
        perCustomerLimit: parseInt(form.perCustomerLimit) || 1,
        durationDays: form.durationDays ? parseInt(form.durationDays) : null,
      });

      setShowModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi tạo voucher');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors" 
        onClick={() => setShowModal(true)} 
        id="add-voucher-btn"
      >
        + Tạo Voucher
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Tạo Voucher mới</h2>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none" 
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <span>⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-code">
                      Mã voucher *
                    </label>
                    <input 
                      id="v-code" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono" 
                      required
                      value={form.code} 
                      onChange={e => update('code', e.target.value.toUpperCase())}
                      placeholder="VD: NEW10, VIP20" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-name">
                      Tên hiển thị *
                    </label>
                    <input 
                      id="v-name" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.name} 
                      onChange={e => update('name', e.target.value)}
                      placeholder="Giảm 10% đơn đầu" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-campaign">
                      Chiến dịch
                    </label>
                    <select 
                      id="v-campaign" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.campaignCategory} 
                      onChange={e => update('campaignCategory', e.target.value)}
                    >
                      <option value="WELCOME">🎉 Welcome – Khách mới</option>
                      <option value="VIP">👑 VIP – Khách thân thiết</option>
                      <option value="BUNDLE">📦 Bundle – Mua combo</option>
                      <option value="FREESHIP">🚚 Freeship</option>
                      <option value="GAMIFICATION">🎰 Vòng quay</option>
                      <option value="REFERRAL">🔗 Referral</option>
                      <option value="BIRTHDAY">🎂 Sinh nhật</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-type">
                      Loại giảm giá
                    </label>
                    <select 
                      id="v-type" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.type} 
                      onChange={e => update('type', e.target.value)}
                    >
                      <option value="PERCENT">Giảm %</option>
                      <option value="FIXED_AMOUNT">Giảm tiền mặt</option>
                      <option value="FREESHIP">Free ship</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-value">
                      Giá trị {form.type === 'PERCENT' ? '(%)' : '(VNĐ)'} *
                    </label>
                    <input 
                      id="v-value" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.value} 
                      onChange={e => update('value', e.target.value)}
                      placeholder={form.type === 'PERCENT' ? '10' : '50000'} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-min">
                      Đơn tối thiểu (VNĐ)
                    </label>
                    <input 
                      id="v-min" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.minOrderValue} 
                      onChange={e => update('minOrderValue', e.target.value)}
                      placeholder="399000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-max">
                      Giảm tối đa (VNĐ)
                    </label>
                    <input 
                      id="v-max" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.maxDiscount} 
                      onChange={e => update('maxDiscount', e.target.value)}
                      placeholder="Không giới hạn" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-total-limit">
                      Giới hạn tổng
                    </label>
                    <input 
                      id="v-total-limit" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.totalUsageLimit} 
                      onChange={e => update('totalUsageLimit', e.target.value)}
                      placeholder="Không giới hạn" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-per-cust">
                      Mỗi KH dùng
                    </label>
                    <input 
                      id="v-per-cust" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.perCustomerLimit} 
                      onChange={e => update('perCustomerLimit', e.target.value)}
                      placeholder="1" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-duration">
                      Hạn dùng (ngày)
                    </label>
                    <input 
                      id="v-duration" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.durationDays} 
                      onChange={e => update('durationDays', e.target.value)}
                      placeholder="30" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="v-desc">
                    Mô tả
                  </label>
                  <textarea 
                    id="v-desc" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    rows={2}
                    value={form.description} 
                    onChange={e => update('description', e.target.value)}
                    placeholder="Mô tả chi tiết voucher..." 
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={form.isStackable}
                    onChange={e => update('isStackable', e.target.checked)} 
                  />
                  <span className="text-gray-700">Cho phép cộng dồn với voucher khác</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button 
                  type="button" 
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors" 
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={loading} 
                  id="save-voucher-btn"
                >
                  {loading ? 'Đang tạo...' : 'Tạo Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
