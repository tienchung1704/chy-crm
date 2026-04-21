import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { setSession, generateReferralCode } from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '/portal';
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', req.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(new URL('/login?error=user_info_failed', req.url));
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // 1. Find user by OAuthAccount or Email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: googleUser.email },
          { oauthAccounts: { some: { provider: 'google', providerUserId: googleUser.id } } },
          { googleId: googleUser.id }, // Check old field for migration
        ],
      },
      include: {
        oauthAccounts: true,
      },
    });

    // Check if account is inactive
    if (user && !user.isActive) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', req.url));
    }

    if (!user) {
      // Check for pending referral code from cookie
      const cookies = req.cookies;
      const pendingReferralCode = cookies.get('pendingReferralCode')?.value;
      
      let referrerId: string | undefined;
      if (pendingReferralCode) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: pendingReferralCode },
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

      // Create new user with OAuthAccount
      user = await prisma.user.create({
        data: {
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
          referralCode: newReferralCode,
          referrerId: referrerId || null,
          role: 'CUSTOMER',
          isActive: true, // Explicitly set active
          oauthAccounts: {
            create: {
              provider: 'google',
              providerUserId: googleUser.id,
              profile: googleUser as any,
            },
          },
        },
        include: {
          oauthAccounts: true,
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
    } else {
      // 2. Migration & Update Logic
      const hasGoogleAccount = user.oauthAccounts.some(acc => acc.provider === 'google');
      
      const updateData: any = {};
      const oauthOps: any = {};

      // If they have the old googleId but no OAuthAccount, migrate them
      if (!hasGoogleAccount) {
        oauthOps.create = {
          provider: 'google',
          providerUserId: googleUser.id,
          profile: googleUser as any,
        };
      }

      // Update general info
      if (!user.avatarUrl && googleUser.picture) updateData.avatarUrl = googleUser.picture;
      if (!user.name || user.name === '') updateData.name = googleUser.name;

      if (Object.keys(updateData).length > 0 || Object.keys(oauthOps).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...updateData,
            oauthAccounts: Object.keys(oauthOps).length > 0 ? oauthOps : undefined,
          },
          include: {
            oauthAccounts: true,
          },
        });
      }
    }

    // Set session (this will emit both access and refresh tokens)
    await setSession(user.id, user.role);

    // Check if user needs onboarding
    const needsOnboarding = user.role === 'CUSTOMER' && !user.onboardingComplete;
    
    // Redirect based on role and onboarding status
    let redirect: string;
    if (user.role === 'ADMIN' || user.role === 'STAFF' || user.role === 'MODERATOR') {
      redirect = '/admin';
    } else if (needsOnboarding) {
      // Pass the original returnTo to onboarding page
      redirect = `/onboarding?returnTo=${encodeURIComponent(state)}`;
    } else {
      redirect = state;
    }
    
    const response = NextResponse.redirect(new URL(redirect, req.url));
    
    // Clear the pending referral code cookie
    response.cookies.set('pendingReferralCode', '', {
      path: '/',
      maxAge: 0,
    });
    
    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
  }
}
