'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { claimQrRewardAction } from '@/actions/qrClaimActions';

export default function QrClaimModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check if URL has campaign=qr_claim parameter
    const campaign = searchParams.get('campaign');
    if (campaign === 'qr_claim') {
      setIsOpen(true);
      
      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('campaign');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!orderCode.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã đơn hàng' });
      return;
    }

    startTransition(async () => {
      const result = await claimQrRewardAction(orderCode);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setOrderCode('');
        
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
      setMessage(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 text-white relative">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
              🎁
            </div>
            <div>
              <h2 className="text-xl font-bold">Nhận quà từ QR Code</h2>
              <p className="text-sm text-blue-100 mt-0.5">Nhập mã đơn hàng để nhận voucher</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
            <div className="flex gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-blue-900 mb-1">Cách nhận quà:</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• Nhập mã đơn hàng từ sàn TMĐT (Shopee, TikTok...)</li>
                  <li>• Voucher sẽ được kích hoạt sau 7 ngày</li>
                  <li>• Tối đa 5 lần nhận quà/tài khoản</li>
                  <li>• Giá trị giảm dần: 50K → 40K → 30K → 20K → 10K</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`flex items-start gap-3 p-4 rounded-lg mb-4 animate-slideIn ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <span className="text-xl">{message.type === 'success' ? '✓' : '⚠'}</span>
              <p className="text-sm flex-1">{message.text}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="orderCode" className="block text-sm font-semibold text-gray-700 mb-2">
                Mã đơn hàng <span className="text-red-500">*</span>
              </label>
              <input
                id="orderCode"
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                placeholder="VD: SPX123456, TK789012..."
                disabled={isPending}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Nhập mã đơn hàng từ sàn TMĐT (Shopee, TikTok, Lazada...)
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending || !orderCode.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                '🎁 Nhận quà ngay'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            💡 <span className="font-semibold">Lưu ý:</span> Mỗi mã đơn hàng chỉ được sử dụng 1 lần
          </p>
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
