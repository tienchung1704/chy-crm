'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import TrackingModal from './TrackingModal';

export default function TrackingButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold flex items-center gap-2 shadow-sm"
      >
        <Package className="w-5 h-5 text-yellow-400" />
        Tra cứu vận chuyển
      </button>

      <TrackingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
