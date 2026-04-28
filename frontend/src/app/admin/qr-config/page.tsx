'use client';

import { useState, useEffect } from 'react';
import { apiClientClient } from '@/lib/apiClientClient';

function fmtVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0);
}

export default function QRConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    values: [50000, 40000, 30000, 20000, 10000],
    minOrderValue: 0,
    displayText: 'Quét mã QR để nhận ngay voucher trị giá 50K',
    lockDurationDays: 7,
    expirationDays: 90,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await apiClientClient.get<any>('/admin/system-config/qr_voucher_default');
      if (res?.value) {
        // Migration: if old config has 'value' instead of 'values', convert it
        let configData = { ...res.value };
        if (configData.value !== undefined && !configData.values) {
          configData.values = [configData.value];
          delete configData.value;
        }
        setConfig({ ...config, ...configData });
      }
    } catch (e) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiClientClient.put('/admin/system-config/qr_voucher_default', { value: config });
      alert('Đã lưu cấu hình thành công!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Cấu hình Voucher QR</h1>
        <p className="text-gray-600 text-sm">
          Thiết lập voucher mặc định cho đơn hàng khi khách quét mã QR. Các voucher này không hiển thị trên giao diện khách hàng.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Cấu hình mặc định</h2>

            <div className="space-y-6">
              {/* Voucher Values Array */}
              <div className="p-4 border border-blue-100 bg-blue-50/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800">
                      Giá trị voucher theo từng lần quét (VNĐ)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Mỗi lần khách quét một mã QR đơn hàng mới, giá trị voucher sẽ giảm dần theo các mốc dưới đây.
                      Nếu quét vượt số mốc, sẽ lấy giá trị của mốc cuối cùng.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, values: [...config.values, 10000] })}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                  >
                    + Thêm mốc
                  </button>
                </div>
                
                <div className="space-y-2">
                  {config.values.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-gray-600">Lần {idx + 1}:</div>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const newValues = [...config.values];
                          newValues[idx] = Number(e.target.value);
                          setConfig({ ...config, values: newValues });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold"
                        placeholder="VD: 50000"
                      />
                      <button
                        onClick={() => {
                          const newValues = config.values.filter((_, i) => i !== idx);
                          setConfig({ ...config, values: newValues });
                        }}
                        disabled={config.values.length <= 1}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Xoá mốc này"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Min Order Value */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Giá trị đơn hàng tối thiểu (VNĐ)
                </label>
                <input
                  type="number"
                  value={config.minOrderValue}
                  onChange={(e) => setConfig({ ...config, minOrderValue: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Khách hàng cần đơn tối thiểu {fmtVND(config.minOrderValue)}đ để sử dụng voucher. Đặt 0 nếu không yêu cầu.
                </p>
              </div>

              {/* Display Text on DOCX */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nội dung hiển thị trên file QR (DOCX)
                </label>
                <input
                  type="text"
                  value={config.displayText}
                  onChange={(e) => setConfig({ ...config, displayText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Quét mã QR để nhận ngay voucher trị giá 500K"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dòng chữ này sẽ hiển thị ở cuối mỗi trang QR trong file DOCX xuất ra.
                </p>
              </div>

              {/* Lock Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Thời gian khóa (ngày)
                  </label>
                  <input
                    type="number"
                    value={config.lockDurationDays}
                    onChange={(e) => setConfig({ ...config, lockDurationDays: Number(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="7"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Voucher sẽ ở trạng thái PENDING trong {config.lockDurationDays} ngày sau khi nhận.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Thời hạn sử dụng (ngày)
                  </label>
                  <input
                    type="number"
                    value={config.expirationDays}
                    onChange={(e) => setConfig({ ...config, expirationDays: Number(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="90"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Voucher hết hạn sau {config.expirationDays} ngày kể từ khi nhận.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Xem trước</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 space-y-3">
              <div className="text-center">
                <p className="font-bold text-gray-800 text-sm">Mã đơn: #ORD12345</p>
                <p className="font-bold text-blue-600 text-sm">Tổng tiền: 1.200.000 đ</p>
              </div>
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                  [QR Code]
                </div>
              </div>
              <p className="text-center text-xs text-gray-400">
                https://example.com/portal?campaign=qr_claim&orderCode=ORD12345
              </p>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-center text-sm font-bold text-amber-600">
                  🎁 {config.displayText}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">ℹ️ Thông tin</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <p>Voucher mặc định được dùng khi admin <strong>không tạo voucher riêng</strong> cho đơn hàng.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <p>Các voucher QR này thuộc loại <strong>GAMIFICATION</strong> và <strong>không hiển thị</strong> trong danh sách voucher của khách hàng.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <p>Sau khi nhận, voucher sẽ bị khóa <strong>{config.lockDurationDays} ngày</strong> trước khi khách có thể sử dụng.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <p>Để tạo voucher riêng, vào <strong>Chi tiết đơn hàng</strong> → nhấn <strong>Tạo Voucher QR</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
