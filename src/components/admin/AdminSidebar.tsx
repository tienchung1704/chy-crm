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
}

const navItems = [
  {
    label: 'Tổng quan',
    items: [
      { name: 'Dashboard', href: '/admin', icon: '📊' },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { name: 'Khách hàng', href: '/admin/customers', icon: '👥' },
      { name: 'Đơn hàng', href: '/admin/orders', icon: '📦' },
      { name: 'Sản phẩm', href: '/admin/products', icon: '🏷️' },
      { name: 'Danh mục', href: '/admin/categories', icon: '📂' },
    ],
  },
  {
    label: 'Chiến dịch',
    items: [
      { name: 'Voucher', href: '/admin/vouchers', icon: '🎫' },
      { name: 'Referral', href: '/admin/referrals', icon: '🔗' },
      { name: 'Vòng quay', href: '/admin/spin', icon: '🎰' },
    ],
  },
  {
    label: 'Liên lạc',
    items: [
      { name: 'Thông báo', href: '/admin/notifications', icon: '🔔' },
      { name: 'Templates', href: '/admin/templates', icon: '📝' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { name: 'Cấu hình', href: '/admin/settings', icon: '⚙️' },
      { name: 'Hoa hồng', href: '/admin/commissions', icon: '💰' },
      { name: 'Phân hạng', href: '/admin/ranks', icon: '🏆' },
    ],
  },
];

export default function AdminSidebar({ user, isOpen = true }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside className={`bg-white pt-6 text-black w-64 flex-shrink-0 overflow-y-auto transition-all border-r border-gray-200 ${isOpen ? '' : 'w-0'}`}>

      <nav className="px-3 pb-6">
        {navItems.map((group) => (
          <div key={group.label} className="mb-6">
            <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : ' hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
