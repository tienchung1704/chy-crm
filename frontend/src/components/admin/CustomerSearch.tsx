'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export default function CustomerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [rank, setRank] = useState(searchParams.get('rank') || '');
  
  const debouncedSearch = useDebounce(search, 500);
  const initialRender = useRef(true);
  
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    
    const params = new URLSearchParams(searchParams.toString());
    
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }
    
    if (rank) {
      params.set('rank', rank);
    } else {
      params.delete('rank');
    }
    
    params.delete('page'); // Reset page when searching
    
    router.push(`/admin/customers?${params.toString()}`);
  }, [debouncedSearch, rank, router, searchParams]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, SĐT..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Tất cả hạng</option>
          <option value="MEMBER">Member</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
          <option value="DIAMOND">Diamond</option>
          <option value="PLATINUM">Platinum</option>
        </select>
      </div>
    </div>
  );
}
