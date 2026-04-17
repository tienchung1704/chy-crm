import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const REFRESH_TOKEN_NAME = 'crm_refresh_token';
const ACCESS_TOKEN_NAME = 'crm_access_token';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_NAME)?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 401 });
    }

    // 1. Verify JWT signature/expiry
    let payload: { userId: string };
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
    }

    // 2. Find valid refresh tokens for this user in DB
    const storedTokens = await prisma.refreshToken.findMany({
      where: {
        userId: payload.userId,
        expiresAt: { gt: new Date() },
      },
    });

    // 3. Match against hashed tokens in DB (Refresh Token Rotation logic)
    let matchedTokenRecord = null;
    for (const record of storedTokens) {
      const isValid = await bcrypt.compare(refreshToken, record.token);
      if (isValid) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      // Possible token reuse or hijack - in a strict system we might clear ALL tokens for this user
      return NextResponse.json({ error: 'Refresh token not found or already used' }, { status: 401 });
    }

    // 4. Get User data for Access Token
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // 5. Generate new tokens (Rotation)
    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    // 6. Update DB: Delete old record and create new one
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: matchedTokenRecord.id } }),
      prisma.refreshToken.create({
        data: {
          token: await bcrypt.hash(newRefreshToken, 10),
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30 days
        },
      }),
    ]);

    // 7. Set cookies
    cookieStore.set(ACCESS_TOKEN_NAME, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 mins
      path: '/',
    });

    cookieStore.set(REFRESH_TOKEN_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
