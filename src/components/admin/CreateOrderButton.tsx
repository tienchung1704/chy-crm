'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateOrderModal from './CreateOrderModal';

export default function CreateOrderButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors shadow-sm whitespace-nowrap"
      >
        <Plus className="w-5 h-5" />
        Tạo đơn hàng
      </button>

      {showModal && (
        <CreateOrderModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
