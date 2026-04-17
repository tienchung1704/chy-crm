'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
interface Props {
  user: {
    name: string;
    rank: string;
    referralCode: string;
    totalSpent: number;
    commissionBalance: number;
    avatarUrl: string | null;
  };
}

const navItems = [
  { name: 'Tổng quan', href: '/portal', icon: '🏠' },
  { name: 'Sản phẩm', href: '/portal/products', icon: '🛍️' },
  { name: 'Voucher', href: '/portal/vouchers', icon: '🎫' },
  { name: 'Đơn hàng', href: '/portal/orders', icon: '📦' },
  { name: 'Giới thiệu', href: '/portal/referral', icon: '🔗' },
  { name: 'Vòng quay', href: '/portal/spin', icon: '🎰' },
];

const rankColors: Record<string, string> = {
  MEMBER: '#6b7280',
  SILVER: '#9ca3af',
  GOLD: '#f59e0b',
  DIAMOND: '#3b82f6',
  PLATINUM: '#8b5cf6',
};

export default function PortalNavbar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/portal') return pathname === '/portal';
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="w-[80%] mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <Link href="/portal">
            <Image
              src="/logo.png"
              alt="Logo"
              width={100}
              height={100}
              style={{ height: 'auto' }}
            />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(item.href)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Stats pills (desktop only) */}
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-600">Hoa hồng</span>
              <span className="text-sm font-semibold text-green-600">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(user.commissionBalance)}
              </span>
            </div>

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
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
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold text-gray-800">{user.name}</div>
                  <div className="text-xs font-medium" style={{ color: rankColors[user.rank] }}>
                    {user.rank}
                  </div>
                </div>
                <span className={`hidden md:block text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
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
                      <div className="font-bold text-gray-800">{user.name}</div>
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1"
                        style={{
                          color: rankColors[user.rank],
                          backgroundColor: `${rankColors[user.rank]}20`,
                          border: `1px solid ${rankColors[user.rank]}40`,
                        }}
                      >
                        {user.rank}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 px-4 py-3 bg-gray-50">
                    <div>
                      <div className="text-xs text-gray-600">Đã chi tiêu</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(user.totalSpent)}đ
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Hoa hồng</div>
                      <div className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(user.commissionBalance)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 my-1" />

                  <Link href="/portal/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    👤 Hồ sơ cá nhân
                  </Link>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    onClick={handleLogout}
                  >
                    🚪 Đăng xuất
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col gap-1.5 p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className={`w-6 h-0.5 bg-gray-600 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`w-6 h-0.5 bg-gray-600 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`w-6 h-0.5 bg-gray-600 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-2">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isActive(item.href)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
            <div className="border-t border-gray-200 my-2" />
            <Link href="/portal/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              👤 Hồ sơ cá nhân
            </Link>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              🚪 Đăng xuất
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
