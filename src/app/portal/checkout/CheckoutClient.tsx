'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, CreditCard, Ticket, CheckCircle2 } from 'lucide-react';

interface AddressOption {
  code: string;
  name: string;
}

interface Voucher {
  id: string;
  code: string;
  name: string;
  type: 'FIXED_AMOUNT' | 'PERCENT';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
}

interface CheckoutClientProps {
  user: any;
  item: {
    product: any;
    quantity: number;
    size: string | null;
    color: string | null;
    price: number;
  }
}

export default function CheckoutClient({ user, item }: CheckoutClientProps) {
  const router = useRouter();
  
  // Form State
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [street, setStreet] = useState(user.addressStreet || '');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [note, setNote] = useState('');
  
  // Address Dropdown states
  const [provinces, setProvinces] = useState<AddressOption[]>([]);
  const [wards, setWards] = useState<AddressOption[]>([]);
  
  const [province, setProvince] = useState(user.addressProvince || '');
  const [ward, setWard] = useState(user.addressWard || '');

  // Vouchers and Points
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('');
  const [useCommissionPoints, setUseCommissionPoints] = useState(false);

  const [loading, setLoading] = useState(false);
  
  const subtotal = item.price * item.quantity;
  
  // Load Address Configs
  useEffect(() => {
    fetch('/api/address?type=provinces')
      .then(res => res.json())
      .then(setProvinces).catch(console.error);
  }, []);

  const fetchWards = useCallback(async (provinceName: string) => {
    if (!provinceName) { setWards([]); return; }
    const p = provinces.find(x => x.name === provinceName);
    if (!p) return;
    try {
      const res = await fetch(`/api/address?type=wards&provinceCode=${p.code}`);
      setWards(await res.json());
    } catch {}
  }, [provinces]);

  // Initial load logic for saved address
  useEffect(() => {
    if (provinces.length && province && !wards.length) {
      fetchWards(province);
    }
  }, [provinces, province, fetchWards, wards.length]);

  const handleImportSavedAddress = () => {
    setName(user.name || '');
    setPhone(user.phone || '');
    setProvince(user.addressProvince || '');
    setWard(user.addressWard || '');
    setStreet(user.addressStreet || '');
  };

  // Load Vouchers
  useEffect(() => {
    fetch('/api/portal/user-vouchers').then(res => res.json()).then(data => {
      // Filter valid vouchers for this subtotal
      if (Array.isArray(data)) {
        const applicable = data.filter(v => subtotal >= v.minOrderValue);
        setVouchers(applicable);
      }
    }).catch(console.error);
  }, [subtotal]);

  // Calc Discounts
  let voucherDiscount = 0;
  if (selectedVoucherId) {
    const sel = vouchers.find(v => v.id === selectedVoucherId);
    if (sel) {
      voucherDiscount = sel.type === 'PERCENT' ? subtotal * (sel.value / 100) : sel.value;
      if (sel.maxDiscount && voucherDiscount > sel.maxDiscount) voucherDiscount = sel.maxDiscount;
    }
  }

  let finalAmount = subtotal - voucherDiscount;
  if (finalAmount < 0) finalAmount = 0;

  // Max points user can apply
  const maxPointsApplicable = Math.min(user.commissionBalance || 0, finalAmount);
  const pointDiscount = useCommissionPoints ? maxPointsApplicable : 0;
  finalAmount -= pointDiscount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !province || !ward || !street) {
      alert('Vui lòng điền đầy đủ thông tin giao hàng');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            productId: item.product.id,
            quantity: item.quantity,
            size: item.size,
            color: item.color
          }],
          paymentMethod,
          name, phone, note,
          addressStreet: street,
          addressWard: ward,
          addressProvince: province,
          voucherId: selectedVoucherId || undefined,
          useCommissionPoints: useCommissionPoints
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert('Đặt hàng thành công!');
        router.push('/portal/profile'); // Could redirect to orders page
      } else {
        alert(data.error || 'Lỗi đặt hàng');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  function formatPrice(val: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Address Card */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="text-indigo-600" /> Thông tin giao hàng
            </h2>
            <button 
              type="button" 
              onClick={handleImportSavedAddress}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
            >
              📥 Sử dụng địa chỉ mặc định
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg focus:ring-indigo-500 px-4 py-2.5" value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
              <input type="tel" className="w-full border border-gray-300 rounded-lg focus:ring-indigo-500 px-4 py-2.5" value={phone} onChange={e=>setPhone(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tỉnh/Thành phố *</label>
                <select className="w-full border border-gray-300 rounded-lg focus:ring-indigo-500 px-4 py-2.5" value={province} onChange={e => { setProvince(e.target.value); setWard(''); fetchWards(e.target.value); }} required>
                  <option value="">Chọn Tỉnh/Thành</option>
                  {provinces.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phường/Xã *</label>
                <select className="w-full border border-gray-300 rounded-lg focus:ring-indigo-500 disabled:bg-gray-100 px-4 py-2.5" value={ward} onChange={e => setWard(e.target.value)} disabled={!province} required>
                  <option value="">Chọn Phường/Xã</option>
                  {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số nhà, Tên đường *</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg focus:ring-indigo-500 px-4 py-2.5" placeholder="Số nhà, đường phố..." value={street} onChange={e=>setStreet(e.target.value)} required />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-4">Thông tin đơn hàng</h2>
          
          <div className="flex gap-4 mb-6">
            <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
              {item.product.imageUrl ? <img src={item.product.imageUrl} className="w-full h-full object-cover" /> : <span className="text-2xl mt-4 block text-center">📦</span>}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{item.product.name}</h3>
              <div className="text-xs text-gray-500 mt-1">
                {item.size && <span>Size: {item.size} </span>}
                {item.color && <span>&bull; Màu: {item.color}</span>}
              </div>
              <div className="text-sm font-bold text-gray-900 mt-2 flex justify-between">
                <span>{formatPrice(item.price)}</span>
                <span>x{item.quantity}</span>
              </div>
            </div>
          </div>

          <div className="py-4 space-y-6 border-b border-gray-100">
            {/* Payment Methods */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <CreditCard className="w-4 h-4 text-indigo-600" /> Phương thức thanh toán
              </label>
              <div className="space-y-3">
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'COD' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="payment" value="COD" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                  <span className="ml-3 text-sm font-medium text-gray-900">Thanh toán khi nhận hàng (COD)</span>
                </label>
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'VIETQR' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="payment" value="VIETQR" checked={paymentMethod === 'VIETQR'} onChange={() => setPaymentMethod('VIETQR')} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                  <span className="ml-3 text-sm font-medium text-gray-900">Chuyển khoản VietQR</span>
                </label>
              </div>
            </div>

            {/* Vouchers section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Ticket className="w-4 h-4 text-indigo-600" /> Mã giảm giá
                </label>
                {selectedVoucherId && (
                  <button onClick={() => setSelectedVoucherId('')} className="text-xs text-rose-500 font-medium hover:underline">Bỏ chọn</button>
                )}
              </div>
              
              {vouchers.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">Không có mã giảm giá phù hợp</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scroll">
                  <style jsx>{`
                    .hide-scroll::-webkit-scrollbar { display: none; }
                    .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                  `}</style>
                  {vouchers.map(v => {
                    const isSelected = selectedVoucherId === v.id;
                    return (
                      <div 
                        key={v.id} 
                        onClick={() => setSelectedVoucherId(v.id)}
                        className={`flex-none w-[200px] p-3 rounded-xl border cursor-pointer transition-all snap-start ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600 shadow-sm' 
                            : 'border-gray-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="font-bold text-sm bg-indigo-600 text-white inline-block px-2 py-0.5 rounded text-[10px] mb-1.5 uppercase letter-spacing-1">
                          {v.code}
                        </div>
                        <div className="text-sm font-bold text-gray-900 mb-0.5">
                          Giảm {v.type === 'PERCENT' ? `${v.value}%` : formatPrice(v.value)}
                        </div>
                        {v.maxDiscount && (
                          <div className="text-xs text-gray-500">
                            Tối đa: {formatPrice(v.maxDiscount)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Points usage section */}
            {user.commissionBalance > 0 && (
              <div className={`p-4 rounded-xl border transition-all ${useCommissionPoints ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">Dùng Hoa hồng</div>
                    <div className="text-xs text-gray-500">Tối đa {formatPrice(maxPointsApplicable)}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={useCommissionPoints}
                      onChange={(e) => setUseCommissionPoints(e.target.checked)}
                      disabled={maxPointsApplicable <= 0 && !useCommissionPoints}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 disabled:opacity-50"></div>
                  </label>
                </div>
                {useCommissionPoints && pointDiscount > 0 && (
                  <div className="text-xs font-semibold text-orange-600 mt-2">
                    ✅ Đã áp dụng giảm {formatPrice(pointDiscount)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 space-y-2 text-sm font-medium">
            <div className="flex justify-between text-gray-600"><span>Tạm tính</span><span>{formatPrice(subtotal)}</span></div>
            {voucherDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Giảm giá Voucher</span><span>-{formatPrice(voucherDiscount)}</span></div>}
            {pointDiscount > 0 && <div className="flex justify-between text-orange-600"><span>Dùng Hoa hồng</span><span>-{formatPrice(pointDiscount)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-gray-900 pt-3 mt-3 border-t border-gray-100">
              <span>Tổng cộng</span>
              <span className="text-indigo-600">{formatPrice(finalAmount)}</span>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {loading ? 'Đang xử lý...' : 'ĐẶT HÀNG NGAY'}
          </button>
        </div>
      </div>

    </div>
  );
}
