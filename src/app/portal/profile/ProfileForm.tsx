'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X, MapPin, ChevronDown, Loader2 } from 'lucide-react';

interface AddressOption {
  code: string;
  name: string;
}

interface ProfileFormProps {
  user: {
    name: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    dob: string;
    addressStreet: string | null;
    addressWard: string | null;
    addressDistrict: string | null;
    addressProvince: string | null;
  };
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    gender: user.gender || '',
    dob: user.dob || '',
    addressStreet: user.addressStreet || '',
    addressWard: user.addressWard || '',
    addressDistrict: user.addressDistrict || '',
    addressProvince: user.addressProvince || '',
  });

  // Address dropdown state
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [districts, setDistricts] = useState<AddressOption[]>([]);
  const [wards, setWards] = useState<AddressOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Fetch provinces on mount
  useEffect(() => {
    setLoadingProvinces(true);
    fetch('/api/address?type=provinces')
      .then(res => res.json())
      .then(data => {
        setProvinces(data);
        setLoadingProvinces(false);
      })
      .catch(() => setLoadingProvinces(false));
  }, []);

  // Fetch districts when province changes
  const fetchDistricts = useCallback(async (provinceName: string) => {
    if (!provinceName) {
      setDistricts([]);
      setWards([]);
      return;
    }
    // Find province code by name
    const province = provinces.find(p => p.name === provinceName);
    if (!province) return;

    setLoadingDistricts(true);
    try {
      const res = await fetch(`/api/address?type=districts&provinceCode=${province.code}`);
      const data = await res.json();
      setDistricts(data);
    } catch {
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  }, [provinces]);

  // Fetch wards when district changes
  const fetchWards = useCallback(async (districtName: string) => {
    if (!districtName) {
      setWards([]);
      return;
    }
    const district = districts.find(d => d.name === districtName);
    if (!district) return;

    setLoadingWards(true);
    try {
      const res = await fetch(`/api/address?type=wards&districtCode=${district.code}`);
      const data = await res.json();
      setWards(data);
    } catch {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  }, [districts]);

  // Load districts for existing province on initial load
  useEffect(() => {
    if (form.addressProvince && provinces.length > 0) {
      fetchDistricts(form.addressProvince);
    }
  }, [provinces]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load wards for existing district on initial load
  useEffect(() => {
    if (form.addressDistrict && districts.length > 0) {
      fetchWards(form.addressDistrict);
    }
  }, [districts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      addressProvince: value,
      addressDistrict: '',
      addressWard: '',
    }));
    setWards([]);
    fetchDistricts(value);
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      addressDistrict: value,
      addressWard: '',
    }));
    fetchWards(value);
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, addressWard: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error || 'Có lỗi xảy ra' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Không thể kết nối tới máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/portal/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMsg({ type: 'error', text: data.error || 'Có lỗi xảy ra' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Không thể kết nối tới máy chủ' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);

    try {
      const res = await fetch('/api/portal/account', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        // Redirect to login page
        router.push('/login');
      } else {
        alert(data.error || 'Có lỗi xảy ra khi xóa tài khoản');
      }
    } catch {
      alert('Không thể kết nối tới máy chủ');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const selectClass = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer";
  const inputClass = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">📝 Thông tin cá nhân</h3>
            <p className="text-xs text-gray-600 mt-1">Cập nhật thông tin liên hệ của bạn</p>
          </div>

          {message && (
            <div className={`p-4 rounded-lg mb-4 ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-name">
                Họ và tên *
              </label>
              <input
                className={inputClass}
                type="text"
                id="profile-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-email">
                  Email
                </label>
                <input
                  className={`${inputClass} bg-gray-50`}
                  type="email"
                  id="profile-email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-phone">
                  Số điện thoại *
                </label>
                <input
                  className={inputClass}
                  type="tel"
                  id="profile-phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0901234567"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-gender">
                  Giới tính
                </label>
                <div className="relative">
                  <select
                    className={selectClass}
                    id="profile-gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="">— Chọn —</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-dob">
                  Ngày sinh
                </label>
                <input
                  className={inputClass}
                  type="date"
                  id="profile-dob"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-gray-800">Địa chỉ giao hàng</h4>
              </div>

              {/* Province & District */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-address-province">
                    Tỉnh/Thành phố
                  </label>
                  <div className="relative">
                    <select
                      className={selectClass}
                      id="profile-address-province"
                      value={form.addressProvince}
                      onChange={handleProvinceChange}
                      disabled={loadingProvinces}
                    >
                      <option value="">— Chọn tỉnh/thành phố —</option>
                      {provinces.map(p => (
                        <option key={p.code} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    {loadingProvinces ? (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-address-district">
                    Quận/Huyện
                  </label>
                  <div className="relative">
                    <select
                      className={selectClass}
                      id="profile-address-district"
                      value={form.addressDistrict}
                      onChange={handleDistrictChange}
                      disabled={!form.addressProvince || loadingDistricts}
                    >
                      <option value="">— Chọn quận/huyện —</option>
                      {districts.map(d => (
                        <option key={d.code} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    {loadingDistricts ? (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    )}
                  </div>
                </div>
              </div>

              {/* Ward */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-address-ward">
                  Phường/Xã
                </label>
                <div className="relative">
                  <select
                    className={selectClass}
                    id="profile-address-ward"
                    value={form.addressWard}
                    onChange={handleWardChange}
                    disabled={!form.addressDistrict || loadingWards}
                  >
                    <option value="">— Chọn phường/xã —</option>
                    {wards.map(w => (
                      <option key={w.code} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                  {loadingWards ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-address-street">
                  Số nhà, Tên đường
                </label>
                <input
                  className={inputClass}
                  type="text"
                  id="profile-address-street"
                  name="addressStreet"
                  value={form.addressStreet}
                  onChange={handleChange}
                  placeholder="Ví dụ: 123 Nguyễn Văn Linh"
                />
              </div>

              {/* Address Preview */}
              {(form.addressStreet || form.addressWard || form.addressDistrict || form.addressProvince) && (
                <div className="mt-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-indigo-700">
                      {[form.addressStreet, form.addressWard, form.addressDistrict, form.addressProvince]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              id="profile-save-btn"
            >
              {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">🔒 Đổi mật khẩu</h3>
            <p className="text-xs text-gray-600 mt-1">Cập nhật mật khẩu đăng nhập của bạn</p>
          </div>

          {passwordMsg && (
            <div className={`p-4 rounded-lg mb-4 ${
              passwordMsg.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-current-password">
                Mật khẩu hiện tại
              </label>
              <input
                className={inputClass}
                type="password"
                id="profile-current-password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-new-password">
                Mật khẩu mới
              </label>
              <input
                className={inputClass}
                type="password"
                id="profile-new-password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="profile-confirm-password">
                Xác nhận mật khẩu mới
              </label>
              <input
                className={inputClass}
                type="password"
                id="profile-confirm-password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={passwordLoading}
              id="profile-password-btn"
            >
              {passwordLoading ? 'Đang xử lý...' : '🔒 Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 mt-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Xóa tài khoản
            </h3>
            <p className="text-sm text-red-600 mt-2">
              Sau khi xóa, tài khoản của bạn sẽ bị vô hiệu hóa và không thể đăng nhập lại. 
              Tất cả dữ liệu sẽ được lưu trữ nhưng không thể truy cập.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            Xóa tài khoản
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Xác nhận xóa tài khoản</h2>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Bạn có chắc chắn muốn xóa tài khoản <span className="font-bold">{user.name}</span>?
              </p>
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                ⚠️ Hành động này sẽ vô hiệu hóa tài khoản của bạn. Bạn sẽ không thể đăng nhập lại và tất cả dữ liệu sẽ không thể truy cập.
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={deleteLoading}
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Xóa tài khoản
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
