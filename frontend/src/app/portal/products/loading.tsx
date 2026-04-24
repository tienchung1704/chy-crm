import { GridCardSkeleton } from '@/components/ui/CardSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function PortalProductsLoading() {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Filter Skeleton */}
      <div className="w-full md:w-64 shrink-0 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1">
        {/* Header/Sort Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>

        {/* Product Grid Skeleton */}
        <GridCardSkeleton count={9} />
      </div>
    </div>
  );
}
