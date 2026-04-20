import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncAllPancakeCategories } from '@/services/pancakeService';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] Starting Pancake category sync...');
    const result = await syncAllPancakeCategories();

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ ${result.synced} danh mục từ Pancake${result.errors > 0 ? ` (${result.errors} lỗi)` : ''}`,
      synced: result.synced,
      errors: result.errors
    });
  } catch (error) {
    console.error('[API] Category sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
