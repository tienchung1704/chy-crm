'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { claimQrRewardAction } from '@/actions/qrClaimActions';

export default function QrClaimModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check if URL has campaign=qr_claim parameter
    const campaign = searchParams.get('campaign');
    if (campaign === 'qr_claim') {
      setIsOpen(true);
      
      // Auto-fill orderCode if provided in URL (from QR code scan)
      const urlOrderCode = searchParams.get('orderCode');
      if (urlOrderCode) {
        setOrderCode(urlOrderCode.toUpperCase());
      }
      
      // Clean URL without reload using Next.js router
      const params = new URLSearchParams(searchParams.toString());
      params.delete('campaign');
      params.delete('orderCode');
      const newUrl = pathname + (params.toString() ? `?${params.toString()}` : '');
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!orderCode.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã đơn hàng' });
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số điện thoại hợp lệ' });
      return;
    }

    startTransition(async () => {
      const result = await claimQrRewardAction(orderCode, phone);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setOrderCode('');
        setPhone('');
        
        // Auto close after 5 seconds
        setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
          router.refresh(); // Refresh to update voucher list
        }, 5000);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false);
      setOrderCode('');
      setPhone('');
      setMessage(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nhận quà từ mã vận đơn</h2>
            <p className="text-sm text-gray-500 mt-1">Nhập mã vận đơn và SĐT để nhận ưu đãi</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isPending}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Info Box */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Thông tin nhận quà:</h3>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Áp dụng cho đơn hàng mua từ các sàn TMĐT (Shopee, TikTok, Lazada...)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Voucher có giá trị giảm dần (50K → 10K) và giới hạn 5 lần/tài khoản.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Mỗi mã vận đơn chỉ được sử dụng 1 lần. Voucher kích hoạt sau 7 ngày.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <span className="text-amber-700 font-medium">Đơn hàng phải ở trạng thái đã nhận/hoàn thành mới được nhận quà.</span>
              </li>
            </ul>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg mb-6 text-sm flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span className="font-bold">{message.type === 'success' ? '✓' : '!'}</span>
              <p>{message.text}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="orderCode" className="block text-sm font-medium text-gray-700 mb-2">
                Mã vận đơn <span className="text-red-500">*</span>
              </label>
              <input
                id="orderCode"
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                placeholder="VD: SPX123456, TK789012..."
                disabled={isPending}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition-shadow"
                maxLength={50}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Số điện thoại đặt hàng <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="VD: 0912345678"
                disabled={isPending}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition-shadow"
                maxLength={15}
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !orderCode.trim() || !phone.trim()}
              className="w-full px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận'
              )}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
