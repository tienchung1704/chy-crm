'use client';

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

interface AdminShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
  unreadCount?: number;
  pendingStoresCount?: number;
}

export default function AdminShell({ children, user, unreadCount = 0, pendingStoresCount = 0 }: AdminShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar 
        user={user} 
        isOpen={isSidebarOpen} 
        unreadCount={unreadCount} 
        pendingStoresCount={pendingStoresCount}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="w-full px-4 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
