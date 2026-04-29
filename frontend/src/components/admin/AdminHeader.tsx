'use client';

import { Menu } from 'lucide-react';

interface AdminHeaderProps {
  user: {
    name: string;
    role: string;
  };
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function AdminHeader({ onToggleSidebar }: AdminHeaderProps) {
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
        {/* Placeholder for other header actions if needed */}
      </div>
    </header>
  );
}
