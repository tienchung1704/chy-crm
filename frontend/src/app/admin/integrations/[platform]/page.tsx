'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layers, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { apiClientClient } from '@/lib/apiClientClient';

interface Integration {
  id: string;
  platform: string;
  apiKey: string | null;
  apiSecret: string | null;
  shopId: string | null;
  accessToken: string | null;
  isActive: boolean;
  storeId: string;
  metadata?: any;
}

const PLATFORMS = [
  { id: 'PANCAKE', name: 'Pancake Pos', icon: '🥞', color: 'bg-orange-500', desc: 'Đồng bộ đơn hàng, kho hàng đa kênh' },
  { id: 'SHOPEE', name: 'Shopee', icon: '🛍️', color: 'bg-orange-600', desc: 'Đồng bộ tự động đơn hàng Shopee' },
  { id: 'TIKTOK', name: 'TikTok Shop', icon: '🎵', color: 'bg-black', desc: 'Kết nối kho vận TikTok Shop' },
  { id: 'ZALO', name: 'Zalo OA', icon: '💬', color: 'bg-blue-500', desc: 'Gửi tin nhắn chăm sóc tự động' },
  { id: 'VIETTELPOST', name: 'ViettelPost', icon: '📦', color: 'bg-red-600', desc: 'Tính phí vận chuyển & đẩy đơn' },
];

export default function IntegrationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const platformId = (params.platform as string)?.toUpperCase();
  
  const platformInfo = PLATFORMS.find(p => p.id === platformId);

  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(''); 

  // Form states
  const [formApiKey, setFormApiKey] = useState('');
  const [formApiSecret, setFormApiSecret] = useState('');
  const [formShopId, setFormShopId] = useState('');
  const [formAccessToken, setFormAccessToken] = useState('');
  const [formIsActive, setFormIsActive] = useState(false);
  const [formMetadata, setFormMetadata] = useState<any>({});
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});

  const toggleField = (field: string) => {
    setShowFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  useEffect(() => {
    if (platformId) {
      fetchIntegration();
    }
  }, [platformId, selectedStoreId]);

  const fetchIntegration = async () => {
    try {
      const data = await apiClientClient.get<Integration[]>('/integrations', {
        params: { storeId: selectedStoreId }
      });
      
      const existing = (data || []).find(i => i.platform === platformId);
      if (existing) {
        setFormApiKey(existing.apiKey || '');
        setFormApiSecret(existing.apiSecret || '');
        setFormShopId(existing.shopId || '');
        setFormAccessToken(existing.accessToken || '');
        setFormIsActive(existing.isActive || false);
        setFormMetadata(existing.metadata || {});
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const payload = {
        platform: platformId,
        apiKey: formApiKey,
        apiSecret: formApiSecret,
        shopId: formShopId,
        accessToken: formAccessToken,
        isActive: formIsActive,
        metadata: formMetadata,
        ...(selectedStoreId && { storeId: selectedStoreId })
      };

      await apiClientClient.post<any>('/integrations', payload);
      alert('Lưu cấu hình thành công!');
      fetchIntegration();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  const syncPancakeProducts = async () => {
    if (!confirm('Đồng bộ tất cả sản phẩm từ Pancake? Quá trình này có thể mất vài phút.')) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Đang đồng bộ sản phẩm...');

    try {
      const data = await apiClientClient.post<any>('/integrations/pancake/sync-products', { 
        storeId: selectedStoreId 
      });
      
      setSyncMessage(data.message || 'Đồng bộ thành công!');
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (error: any) {
      console.error(error);
      setSyncMessage(error.response?.data?.message || 'Lỗi khi đồng bộ sản phẩm');
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncPancakeCategories = async () => {
    if (!confirm('Đồng bộ tất cả danh mục từ Pancake?')) {
      return;
    }

    setIsSyncingCategories(true);
    setSyncMessage('Đang đồng bộ danh mục...');

    try {
      const data = await apiClientClient.post<any>('/integrations/pancake/sync-categories', {});
      
      setSyncMessage(data.message || 'Đồng bộ danh mục thành công!');
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (error: any) {
      console.error(error);
      setSyncMessage(error.response?.data?.message || 'Lỗi khi đồng bộ danh mục');
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setIsSyncingCategories(false);
    }
  };

  if (!platformInfo) {
    return <div className="p-8 text-center text-gray-500">Nền tảng không hợp lệ</div>;
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải cấu hình kết nối...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.push('/admin/integrations')}
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${platformInfo.color} flex items-center justify-center text-xl text-white shadow-sm`}>
              {platformInfo.icon}
            </div>
            Chi tiết cấu hình {platformInfo.name}
          </h1>
          <p className="text-gray-600 mt-1">{platformInfo.desc}</p>
        </div>
      </div>

      {syncMessage && (
        <div className={`p-4 rounded-xl border ${syncMessage.includes('thành công') || syncMessage.includes('Đã đồng bộ') ? 'bg-green-50 border-green-200 text-green-800' : syncMessage.includes('Đang') ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <p className="font-semibold">{syncMessage}</p>
        </div>
      )}

      {platformId === 'PANCAKE' && formIsActive && (
        <div className="space-y-3 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors shadow-sm">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">Đồng bộ danh mục Pancake</h3>
              <p className="text-gray-500 text-sm mt-0.5">Cập nhật hệ thống bằng dữ liệu danh mục mới nhất từ Pancake.</p>
            </div>
            <button 
              onClick={syncPancakeCategories} 
              disabled={isSyncingCategories} 
              className="px-5 py-2.5 whitespace-nowrap bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncingCategories ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></span> Đang tải...</span>
              ) : 'Thực hiện đồng bộ'}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors shadow-sm">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">Đồng bộ sản phẩm Pancake</h3>
              <p className="text-gray-500 text-sm mt-0.5">Kéo toàn bộ sản phẩm từ Pancake và lưu vào cơ sở dữ liệu local.</p>
            </div>
            <button 
              onClick={syncPancakeProducts} 
              disabled={isSyncing} 
              className="px-5 py-2.5 whitespace-nowrap bg-gray-900 hover:bg-gray-800 text-white border border-gray-900 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSyncing ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span> Đang tải...</span>
              ) : 'Đồng bộ sản phẩm'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          ⚙️ Nhập khoá API (API Keys)
        </h2>
        <form onSubmit={saveConfig} className="space-y-5">
          {['PANCAKE'].includes(platformId) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop ID (Pancake)</label>
                <div className="relative">
                  <input type={showFields['shopId'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formShopId} onChange={e => setFormShopId(e.target.value)} required />
                  <button type="button" onClick={() => toggleField('shopId')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['shopId'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <div className="relative">
                  <input type={showFields['apiKey'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} required />
                  <button type="button" onClick={() => toggleField('apiKey')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['apiKey'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {['SHOPEE', 'TIKTOK', 'LAZADA'].includes(platformId) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop ID / Client ID</label>
                <div className="relative">
                  <input type={showFields['shopId'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formShopId} onChange={e => setFormShopId(e.target.value)} />
                  <button type="button" onClick={() => toggleField('shopId')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['shopId'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key / App Key</label>
                <div className="relative">
                  <input type={showFields['apiKey'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} />
                  <button type="button" onClick={() => toggleField('apiKey')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['apiKey'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Secret / API Secret</label>
                <div className="relative">
                  <input type={showFields['apiSecret'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" value={formApiSecret} onChange={e => setFormApiSecret(e.target.value)} />
                  <button type="button" onClick={() => toggleField('apiSecret')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['apiSecret'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {['VIETTELPOST'].includes(platformId) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token (ViettelPost)</label>
                <div className="relative">
                  <input type={showFields['accessToken'] ? 'text' : 'password'} className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" value={formAccessToken} onChange={e => setFormAccessToken(e.target.value)} required />
                  <button type="button" onClick={() => toggleField('accessToken')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showFields['accessToken'] ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <p className="font-semibold text-gray-800 mb-3">Cấu hình địa chỉ gửi mặc định (Tính phí ship)</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tỉnh/Thành phố</label>
                      <input type="text" placeholder="VD: Hà Nội" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formMetadata?.senderProvince || ''} onChange={e => setFormMetadata({...formMetadata, senderProvince: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phường/Xã</label>
                      <input type="text" placeholder="VD: Phường Dịch Vọng" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formMetadata?.senderWard || ''} onChange={e => setFormMetadata({...formMetadata, senderWard: e.target.value})} required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ chi tiết (Số nhà, Ngõ)</label>
                    <input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formMetadata?.senderAddress || ''} onChange={e => setFormMetadata({...formMetadata, senderAddress: e.target.value})} required />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="pt-4">
            <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="relative inline-flex items-center">
                <input type="checkbox" className="sr-only peer" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </div>
              <div>
                <span className="font-semibold text-gray-800 block text-lg">Bật đồng bộ (Active)</span>
                <span className="text-gray-500 text-sm">Cho phép hệ thống sử dụng khoá API này để gọi dữ liệu</span>
              </div>
            </label>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={isSaving} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-50 text-lg shadow-sm">
              {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
