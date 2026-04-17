import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TOKEN_NAME = 'crm_access_token';
const REFRESH_TOKEN_NAME = 'crm_refresh_token';

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

// Generate Access Token (short-lived)
export function generateAccessToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Generate Refresh Token (long-lived)
export function generateRefreshToken(payload: { userId: string }): string {
  // We only need userId in refresh token to minimize size and exposure
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      rank: true,
      totalSpent: true,
      commissionBalance: true,
      referralCode: true,
      avatarUrl: true,
      gender: true,
      dob: true,
    },
  });

  return user;
}

export async function setSession(userId: string, role: string) {
  const accessToken = generateAccessToken({ userId, role });
  const refreshToken = generateRefreshToken({ userId });
  
  // Store hashed refresh token in DB
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
  
  await prisma.refreshToken.create({
    data: {
      token: hashedRefreshToken,
      userId: userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    },
  });

  const cookieStore = await cookies();
  
  // Set Access Token Cookie
  cookieStore.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  });

  // Set Refresh Token Cookie
  cookieStore.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_NAME)?.value;

  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
      // Note: Since tokens are hashed, we'd normally have to find by userId 
      // or implement a strategy to match the specific token.
      // For simplicity in logout, we clear all refresh tokens for this user 
      // or we could try to match (but that requires iterating since it's hashed).
      // Standard practice for "logout from this device" is tricky with hashed tokens 
      // unless you store a token ID in the JWT.
      
      // We'll clear the current record if we can find it, but for most UX, 
      // clearing all for this user is safer if they suspect hijack.
      await prisma.refreshToken.deleteMany({
        where: { userId: payload.userId }
      });
    } catch (e) {
      // Token might be invalid/expired, just proceed to clear cookies
    }
  }

  cookieStore.delete(ACCESS_TOKEN_NAME);
  cookieStore.delete(REFRESH_TOKEN_NAME);
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
