import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('crm_access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { gender, dob, interests, phone } = body;

    // Validate interests (can be empty now)
    if (!Array.isArray(interests)) {
      return NextResponse.json({ error: 'Interests must be an array' }, { status: 400 });
    }

    // Process phone sync
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone, id: { not: payload.userId } }
      });
      if (existingPhone) {
        return NextResponse.json({ error: 'Số điện thoại này đã được sử dụng ở tài khoản khác' }, { status: 400 });
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        gender: gender || null,
        dob: dob ? new Date(dob) : null,
        interests: interests.length > 0 ? interests : undefined,
        phone: phone || undefined,
        onboardingComplete: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        gender: true,
        dob: true,
        interests: true,
        phone: true,
        onboardingComplete: true,
      },
    });

    // Trigger Pancake sync asynchronously in the background if they provided a phone
    if (phone) {
      console.log(`[Onboarding] Triggering Pancake sync for user ${payload.userId} with phone ${phone}`);
      const { syncPancakeOrdersForUser } = await import('@/services/pancakeService');
      syncPancakeOrdersForUser(phone, payload.userId).catch(e => console.error('Pancake sync error:', e));
    }

    return NextResponse.json({
      message: 'Onboarding completed successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
