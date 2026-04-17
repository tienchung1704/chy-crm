import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        dob: true,
        address: true,
        addressStreet: true,
        addressWard: true,
        addressDistrict: true,
        addressProvince: true,
        avatarUrl: true,
        interests: true,
        onboardingComplete: true,
        role: true,
        oauthAccounts: {
          select: { provider: true }
        }
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, gender, dob, addressStreet, addressWard, addressDistrict, addressProvince } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 });
    }

    // Check if email or phone is already used by another user
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email, id: { not: session.id } },
      });
      if (existingEmail) {
        return NextResponse.json({ error: 'Email này đã được sử dụng' }, { status: 400 });
      }
    }

    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone, id: { not: session.id } },
      });
      if (existingPhone) {
        return NextResponse.json({ error: 'Số điện thoại này đã được sử dụng' }, { status: 400 });
      }
    }

    const validGender = gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER' ? gender : null;

    await prisma.user.update({
      where: { id: session.id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        gender: validGender,
        dob: dob ? new Date(dob) : null,
        addressStreet: addressStreet || null,
        addressWard: addressWard || null,
        addressDistrict: addressDistrict || null,
        addressProvince: addressProvince || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
