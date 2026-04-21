import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { password: true },
    });

    if (!user || !user.password) {
      // If user logs in via Social, they might not have a password
      return NextResponse.json({ error: 'Không thể đổi mật khẩu cho tài khoản này' }, { status: 400 });
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password update error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
