import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete: set isActive to false
    await prisma.user.update({
      where: { id: session.id },
      data: { isActive: false },
    });

    // Clear session cookies
    const cookieStore = await cookies();
    cookieStore.delete('crm_access_token');
    cookieStore.delete('crm_refresh_token');

    return NextResponse.json({ 
      success: true,
      message: 'Tài khoản đã được vô hiệu hóa thành công' 
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi xóa tài khoản' },
      { status: 500 }
    );
  }
}
