'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface FloatingCartButtonProps {
  itemCount: number;
}

export default function FloatingCartButton({ itemCount }: FloatingCartButtonProps) {
  return (
    <Link
      href="/portal/cart"
      className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 flex items-center justify-center z-50 group"
    >
      <ShoppingCart className="w-7 h-7" />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
