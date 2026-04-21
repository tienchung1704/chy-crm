'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const INTEREST_OPTIONS = [
  { id: 'fashion', label: 'Thời trang' },
  { id: 'beauty', label: 'Làm đẹp' },
  { id: 'health', label: 'Sức khỏe'},
  { id: 'home', label: 'Nội thất' },
  { id: 'books', label: 'Sách'},
  { id: 'music', label: 'Âm nhạc'},
];

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ'},
  { value: 'OTHER', label: 'Khác'},
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [genderOpen, setGenderOpen] = useState(false);
  const [hasGoogleAccount, setHasGoogleAccount] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const genderRef = useRef<HTMLDivElement>(null);
  
  // Get returnTo URL from query params
  const returnTo = searchParams.get('returnTo') || '/portal';
  
  const [formData, setFormData] = useState({
    gender: '',
    dob: '',
    phone: '',
    interests: [] as string[],
  });

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (genderRef.current && !genderRef.current.contains(e.target as Node)) {
        setGenderOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const res = await fetch('/api/portal/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.onboardingComplete) {
          router.push(returnTo);
        } else {
          if (data.oauthAccounts?.length > 0 && !data.phone) {
            setHasGoogleAccount(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to check onboarding status:', err);
    }
  };

  const toggleInterest = (interestId: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter(id => id !== interestId)
        : [...prev.interests, interestId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: formData.gender || null,
          dob: formData.dob || null,
          phone: showPhoneInput ? formData.phone : null,
          interests: formData.interests,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      router.push(returnTo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Mark onboarding as complete even when skipping
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: null,
          dob: null,
          interests: [],
        }),
      });
      router.push(returnTo);
    } catch (err) {
      console.error('Skip onboarding error:', err);
      router.push(returnTo);
    } finally {
      setLoading(false);
    }
  };

  const selectedGender = GENDER_OPTIONS.find(g => g.value === formData.gender);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Chào mừng bạn! 🎉
          </h1>
          <p className="text-gray-600">
            Hãy cho chúng tôi biết thêm về bạn để có trải nghiệm tốt nhất
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gender and Date of Birth - Same Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Custom Gender Dropdown */}
            <div ref={genderRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Giới tính
              </label>
              <button
                type="button"
                onClick={() => setGenderOpen(!genderOpen)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <span className={formData.gender ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedGender ? (
                    <span className="flex items-center gap-2">
                      <span>{selectedGender.label}</span>
                    </span>
                  ) : (
                    'Chọn giới tính'
                  )}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${genderOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {genderOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {GENDER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, gender: option.value }));
                        setGenderOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-blue-50 transition ${
                        formData.gender === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      {formData.gender === option.value && (
                        <svg className="w-5 h-5 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-2">
                Ngày sinh
              </label>
              <input
                type="date"
                id="dob"
                value={formData.dob}
                onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-base font-medium text-gray-600 mb-4">
              Sở thích của bạn (tùy chọn)
            </label>
            <div className="grid grid-cols-3 gap-4">
              {INTEREST_OPTIONS.map(interest => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`px-6 py-4 rounded-xl border transition-all text-center font-medium ${
                    formData.interests.includes(interest.id)
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {interest.label}
                </button>
              ))}
            </div>
          </div>

          {hasGoogleAccount && (
            <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 mt-6">
              {!showPhoneInput ? (
                <div className="text-center">
                  <p className="text-gray-700 mb-4">Bạn đã từng mua hàng tại hệ thống trước đây chưa?</p>
                  <button
                    type="button"
                    onClick={() => setShowPhoneInput(true)}
                    className="px-6 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 transition-colors font-medium"
                  >
                    Đồng bộ tài khoản mua hàng cũ
                  </button>
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <label htmlFor="phoneSync" className="block text-sm font-medium text-gray-700 mb-2">
                    Nhập số điện thoại mua hàng của bạn
                  </label>
                  <input
                    type="tel"
                    id="phoneSync"
                    value={formData.phone}
                    onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="0912 345 678"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    * Phục vụ mục đích đồng bộ thông tin khách hàng với các nền tảng khác.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || (showPhoneInput && formData.phone.length < 9)}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? 'Đang lưu...' : 'Hoàn thành'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-8 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              disabled={loading}
            >
              Bỏ qua
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
