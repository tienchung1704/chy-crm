import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      gender: true,
      dob: true,
      address: true,
      addressStreet: true,
      addressWard: true,
      addressDistrict: true,
      addressProvince: true,
      avatarUrl: true,
      rank: true,
      totalSpent: true,
      commissionBalance: true,
      points: true,
      referralCode: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const refereeCount = await prisma.user.count({ where: { referrerId: session.id } });

  return (
    <>
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Hồ sơ cá nhân</h1>
          <p className="text-gray-600 text-sm">Quản lý thông tin tài khoản của bạn</p>
        </div>
      </div>

      {/* Profile overview cards */}
      <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3.5 py-1 rounded-full text-sm font-semibold ${user.rank === 'MEMBER' ? 'bg-gray-100 text-gray-700' :
                user.rank === 'SILVER' ? 'bg-gray-200 text-gray-800' :
                  user.rank === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                    user.rank === 'DIAMOND' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                }`}>
                {user.rank}
              </span>
              <span className="text-sm text-gray-600">
                Thành viên từ {new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Tổng chi tiêu</div>
          <div className="text-2xl font-bold text-gray-800">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(user.totalSpent)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Điểm tích lũy</div>
          <div className="text-2xl font-bold text-gray-800">
            {new Intl.NumberFormat('vi-VN').format(user.points)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Hoa hồng</div>
          <div className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(user.commissionBalance)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Bạn bè đã mời</div>
          <div className="text-2xl font-bold text-gray-800">
            {refereeCount}
          </div>
        </div>
      </div>

      {/* Referral code banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6 mt-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🎁</span>
          <div>
            <div className="font-bold text-base text-gray-800">Mã giới thiệu của bạn</div>
            <div className="text-xs text-gray-600">Chia sẻ mã này để nhận hoa hồng</div>
          </div>
        </div>
        <div className="px-6 py-3 bg-white rounded-lg font-mono font-bold text-lg text-indigo-600 shadow-sm">
          {user.referralCode}
        </div>
      </div>

      {/* Edit form */}
      <div className="mt-8">
        <ProfileForm user={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          gender: user.gender,
          dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
          addressStreet: user.addressStreet,
          addressWard: user.addressWard,
          addressDistrict: user.addressDistrict,
          addressProvince: user.addressProvince,
        }} />
      </div>
    </>
  );
}
