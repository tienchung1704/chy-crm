'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientClient } from '@/lib/apiClientClient';

export default function CustomerActions() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    dob: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiClientClient.post('/admin/customers', form);

      setShowModal(false);
      setForm({ name: '', email: '', phone: '', gender: '', dob: '', address: '' });
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors" 
        onClick={() => setShowModal(true)} 
        id="add-customer-btn"
      >
        + Thêm khách hàng
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Thêm khách hàng mới</h2>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none" 
                onClick={() => setShowModal(false)} 
                id="close-modal-btn"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-name">
                    Họ và tên *
                  </label>
                  <input 
                    id="new-name" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    required
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Nguyễn Văn A" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-email">
                      Email
                    </label>
                    <input 
                      id="new-email" 
                      type="email" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})}
                      placeholder="email@example.com" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-phone">
                      Số điện thoại
                    </label>
                    <input 
                      id="new-phone" 
                      type="tel" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})}
                      placeholder="0912345678" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-gender">
                      Giới tính
                    </label>
                    <select 
                      id="new-gender" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.gender} 
                      onChange={e => setForm({...form, gender: e.target.value})}
                    >
                      <option value="">Chọn</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-dob">
                      Ngày sinh
                    </label>
                    <input 
                      id="new-dob" 
                      type="date" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.dob} 
                      onChange={e => setForm({...form, dob: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-address">
                    Địa chỉ
                  </label>
                  <textarea 
                    id="new-address" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    rows={2}
                    value={form.address} 
                    onChange={e => setForm({...form, address: e.target.value})}
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" 
                  />
                </div>
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
                  id="save-customer-btn"
                >
                  {loading ? 'Đang lưu...' : 'Lưu khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
