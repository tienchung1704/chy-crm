import { getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
import { apiClient } from '@/lib/apiClient';

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function formatVnDate(date: string | Date | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date(date));
}

export default async function PortalVouchersPage() {
  const session = await getSession();
  if (!session) return null;

  let userVouchers: any[] = [];
  let systemVouchers: any[] = [];

  const now = new Date();

  try {
    const [userVouchersData, systemVouchersData] = await Promise.all([
      apiClient.get<any[]>('/vouchers/user/my-vouchers'),
      apiClient.get<any[]>('/vouchers'),
    ]);
    userVouchers = userVouchersData;
    systemVouchers = systemVouchersData;
  } catch (error) {
    console.error('Error fetching vouchers:', error);
  }

  const available = userVouchers.filter(v => {
    if (v.isUsed) return false;
    if (!v.expiresAt) return true;
    return new Date(v.expiresAt) > now;
  });

  const expiringSoon = available.filter(v => {
    if (!v.expiresAt) return false;
    const msDiff = new Date(v.expiresAt).getTime() - now.getTime();
    const daysDiff = msDiff / (1000 * 60 * 60 * 24);
    return daysDiff >= 0 && daysDiff <= 7;
  });

  const regularAvailable = available.filter(v => !expiringSoon.includes(v));

  const campaignIcons: Record<string, string> = {
    WELCOME: '🎉', VIP: '👑', BUNDLE: '📦', FREESHIP: '🚚',
    GAMIFICATION: '🎰', REFERRAL: '🔗', BIRTHDAY: '🎂',
  };

  const renderVoucherCard = (uv: any) => (
    <div key={uv.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{campaignIcons[uv.voucher.campaignCategory] || '🎫'}</span>
          <span className="font-bold text-gray-800">{uv.voucher.name}</span>
        </div>
        <div className="font-mono text-sm font-bold text-blue-600 tracking-wide mb-3 bg-blue-50 px-3 py-1.5 rounded inline-block">
          {uv.voucher.code}
        </div>
        <div className="text-sm text-gray-600 mb-2">
          Đơn tối thiểu: <span className="font-semibold">{fmt(uv.voucher.minOrderValue)}</span>
        </div>
        <div className="text-sm text-gray-600 mb-3">
          Giảm: <span className="font-semibold text-green-600">
            {uv.voucher.type === 'PERCENT' ? `${uv.voucher.value}%` :
              uv.voucher.type === 'FREESHIP' ? 'Phí ship' : fmt(uv.voucher.value)}
          </span>
        </div>
        {uv.expiresAt && (
          <div className="text-xs text-orange-600 mb-3">
            ⏰ Hết hạn: {formatVnDate(uv.expiresAt)}
          </div>
        )}
        <div className="flex justify-end">
          <a
            href="/portal/products"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
          >
            Sử dụng ngay
          </a>
        </div>
      </div>
    </div>
  );

  const renderSystemVoucherCard = (v: any) => (
    <div key={v.id} className="bg-white border-2 border-dashed border-gray-300 rounded-xl overflow-hidden transition-all hover:shadow-md opacity-90">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{campaignIcons[v.campaignCategory] || '🎫'}</span>
          <span className="font-bold text-gray-800">{v.name}</span>
        </div>
        <div className="font-mono text-sm font-bold text-blue-600 tracking-wide mb-3 bg-blue-50 px-3 py-1.5 rounded inline-block">
          {v.code}
        </div>
        <div className="text-sm text-gray-600 mb-2">
          Đơn tối thiểu: <span className="font-semibold">{fmt(v.minOrderValue)}</span>
        </div>
        <div className="text-sm text-gray-600 mb-3">
          Giảm: <span className="font-semibold text-green-600">
            {v.type === 'PERCENT' ? `${v.value}%` :
              v.type === 'FREESHIP' ? 'Phí ship' : fmt(v.value)}
          </span>
        </div>
        {v.validTo && (
          <div className="text-xs text-gray-500 mb-3">
            ⏰ Hạn dùng: {formatVnDate(v.validTo)}
          </div>
        )}
        <div className="flex justify-end">
          <a
            href="/portal/products"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
          >
            Sử dụng ngay
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Voucher của tôi</h1>
        <p className="text-gray-600 text-sm">{available.length} voucher khả dụng</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">🎫 Khả dụng</div>
          <div className="text-3xl font-bold text-green-600">{regularAvailable.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">⏰ Sắp hết hạn</div>
          <div className="text-3xl font-bold text-orange-600">{expiringSoon.length}</div>
        </div>
      </div>

      {available.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm text-center">
          <div className="text-6xl mb-3">🎫</div>
          <div className="font-semibold mb-2">Chưa có voucher nào</div>
          <div className="text-sm text-gray-600">Mua sắm hoặc quay vòng quay để nhận voucher!</div>
        </div>
      ) : (
        <>
          {expiringSoon.length > 0 && (
            <>
              <h3 className="text-lg font-bold mb-4 text-orange-600">
                Sắp hết hạn
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {expiringSoon.map(renderVoucherCard)}
              </div>
            </>
          )}

          {regularAvailable.length > 0 && (
            <>
              <h3 className="text-lg font-bold mb-4">
                Khả dụng
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {regularAvailable.map(renderVoucherCard)}
              </div>
            </>
          )}
        </>
      )}

      <hr className="my-8 border-gray-200" />
      
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-800 mb-1">Mã giảm giá từ hệ thống</h2>
        <p className="text-gray-600 text-sm">Khám phá và lưu ngay các ưu đãi đặc biệt</p>
      </div>

      {systemVouchers.length === 0 ? (
        <div className="text-sm text-gray-500">Hiện tại hệ thống chưa có voucher nào mới.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {systemVouchers.map(renderSystemVoucherCard)}
        </div>
      )}
    </>
  );
}
