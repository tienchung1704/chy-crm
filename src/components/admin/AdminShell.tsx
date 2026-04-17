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
}

export default function AdminShell({ children, user }: AdminShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar user={user} isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="w-[80%] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
