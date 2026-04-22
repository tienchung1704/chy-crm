'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  user: {
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
  isOpen?: boolean;
  unreadCount?: number;
  pendingStoresCount?: number;
}

const ALL_ROLES = ['ADMIN', 'STAFF', 'MODERATOR'];
const ADMIN_STAFF = ['ADMIN', 'STAFF'];
const ADMIN_ONLY = ['ADMIN'];

const navItems = [
  {
    label: 'Tổng quan',
    items: [
      { name: 'Dashboard', href: '/admin', roles: ALL_ROLES },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { name: 'Khách hàng', href: '/admin/customers', roles: ADMIN_STAFF },
      { name: 'Cửa hàng', href: '/admin/stores', roles: ADMIN_ONLY },
      { name: 'Đơn hàng', href: '/admin/orders', roles: ALL_ROLES },
      { name: 'Sản phẩm', href: '/admin/products', roles: ALL_ROLES },
      { name: 'Danh mục', href: '/admin/categories', roles: ALL_ROLES },
    ],
  },
  {
    label: 'Chiến dịch',
    items: [
      { name: 'Voucher', href: '/admin/vouchers', roles: ALL_ROLES },
      { name: 'Referral', href: '/admin/referrals', roles: ADMIN_STAFF },
      { name: 'Vòng quay', href: '/admin/spin', roles: ADMIN_STAFF },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { name: 'Kết nối', href: '/admin/integrations', roles: ALL_ROLES },
      { name: 'Hoa hồng', href: '/admin/commissions', roles: ADMIN_ONLY },
    ],
  },
  {
    label: 'Thông tin',
    items: [
      { name: 'Cửa hàng', href: '/admin/my-store', roles: ['MODERATOR'] },
    ],
  },
];

export default function AdminSidebar({ user, isOpen = true, unreadCount = 0, pendingStoresCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside className={`bg-white pt-6 text-black w-40 flex-shrink-0 overflow-y-auto transition-all border-r border-gray-200 ${isOpen ? '' : 'w-0'}`}>

      <nav className="px-3 pb-6">
        {navItems.map((group) => {
          // Filter items by role
          const visibleItems = group.items.filter(item => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-6">
              <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : ' hover:bg-gray-100'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.name}</span>
                  </div>
                  {item.name === 'Đơn hàng' && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {item.name === 'Cửa hàng' && pendingStoresCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingStoresCount > 99 ? '99+' : pendingStoresCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
