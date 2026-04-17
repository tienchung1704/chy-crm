import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, setSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập số điện thoại và mật khẩu' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Số điện thoại hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Check if account is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Tài khoản đã bị vô hiệu hóa' },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Số điện thoại hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    await setSession(user.id, user.role);

    // Check if user completed onboarding
    const needsOnboarding = user.role === 'CUSTOMER' && !user.onboardingComplete;
    const redirect = user.role === 'ADMIN' || user.role === 'STAFF' 
      ? '/admin' 
      : needsOnboarding 
        ? '/onboarding' 
        : '/portal';

    return NextResponse.json({
      success: true,
      redirect,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trong quá trình đăng nhập' },
      { status: 500 }
    );
  }
}
