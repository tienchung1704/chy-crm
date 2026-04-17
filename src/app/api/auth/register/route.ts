import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, setSession, generateReferralCode } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password, referralCode } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ thông tin (số điện thoại, mật khẩu)' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Check existing user
    const existingUser = await prisma.user.findFirst({
      where: { phone },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Số điện thoại đã được sử dụng' },
        { status: 400 }
      );
    }

    // Handle referral
    let referrerId: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Generate unique referral code
    let newReferralCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.user.findUnique({
        where: { referralCode: newReferralCode },
      });
      if (!exists) break;
      newReferralCode = generateReferralCode();
      attempts++;
    }

    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: phone, // Save phone as name initially
        email: null,
        phone: phone,
        password: hashedPassword,
        referralCode: newReferralCode,
        referrerId: referrerId || null,
        isActive: true, // Explicitly set active
      },
    });

    // Build closure table entries
    if (referrerId) {
      // Self entry
      await prisma.referralClosure.create({
        data: {
          ancestorId: user.id,
          descendantId: user.id,
          depth: 0,
        },
      });

      // Get all ancestors of the referrer (up to depth 3, so this user is depth 1-4)
      const referrerAncestors = await prisma.referralClosure.findMany({
        where: {
          descendantId: referrerId,
          depth: { lte: 3 }, // Max 4 levels total (F0-F4)
        },
      });

      // Create closure entries for all ancestors
      for (const ancestor of referrerAncestors) {
        await prisma.referralClosure.create({
          data: {
            ancestorId: ancestor.ancestorId,
            descendantId: user.id,
            depth: ancestor.depth + 1,
          },
        });
      }
    } else {
      // Self entry only
      await prisma.referralClosure.create({
        data: {
          ancestorId: user.id,
          descendantId: user.id,
          depth: 0,
        },
      });
    }

    // Set session
    await setSession(user.id, user.role);

    // Sync Pancake orders on registration if it's a customer
    if (user.role === 'CUSTOMER') {
      console.log(`[Register] Triggering Pancake sync for new user ${user.id} with phone ${phone}`);
      const { syncPancakeOrdersForUser } = await import('@/services/pancakeService');
      syncPancakeOrdersForUser(phone, user.id).catch(e => console.error('Pancake sync error on register:', e));
    }

    // New users go to onboarding, admins go to admin panel
    const redirect = user.role === 'ADMIN' ? '/admin' : '/onboarding';

    return NextResponse.json({
      success: true,
      redirect,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trong quá trình đăng ký' },
      { status: 500 }
    );
  }
}
