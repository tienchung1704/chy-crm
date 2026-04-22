'use client';

import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { apiClientClient } from '@/lib/apiClientClient';

interface AdminHeaderProps {
  user: {
    name: string;
    role: string;
  };
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function AdminHeader({ user, onToggleSidebar, isSidebarOpen }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiClientClient.post('/auth/logout', {});
    } catch { }
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
        >
          <Menu size={24} className="text-gray-600" />
        </button>

      </div>

      <div className="flex items-center gap-4">
        <button
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={handleLogout}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
