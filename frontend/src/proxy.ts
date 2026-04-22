import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TOKEN_NAME = 'crm_access_token';
const REFRESH_TOKEN_NAME = 'crm_refresh_token';
// Use server-side env var for middleware (not NEXT_PUBLIC_*)
const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_NAME)?.value;

  // Skip proxy for public routes
  const publicPaths = ['/login', '/_next', '/favicon.ico'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // If no access token but has refresh token, try to refresh
  if (!accessToken && refreshToken) {
    try {
      // Call backend refresh endpoint
      const refreshResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Cookie: `${REFRESH_TOKEN_NAME}=${refreshToken}`,
        },
      });

      if (refreshResponse.ok) {
        // Get new tokens from response cookies
        const response = NextResponse.next();
        
        // Copy cookies from refresh response to current response
        const setCookieHeader = refreshResponse.headers.get('set-cookie');
        if (setCookieHeader) {
          response.headers.set('set-cookie', setCookieHeader);
        }
        
        return response;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }

  // If access token exists, verify it
  if (accessToken) {
    try {
      jwt.verify(accessToken, JWT_SECRET);
      return NextResponse.next();
    } catch (error) {
      // Access token expired, try to refresh
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              Cookie: `${REFRESH_TOKEN_NAME}=${refreshToken}`,
            },
          });

          if (refreshResponse.ok) {
            const response = NextResponse.next();
            const setCookieHeader = refreshResponse.headers.get('set-cookie');
            if (setCookieHeader) {
              response.headers.set('set-cookie', setCookieHeader);
            }
            return response;
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
    }
  }

  // If we reach here and trying to access protected routes, redirect to login
  if (request.nextUrl.pathname.startsWith('/portal') || request.nextUrl.pathname.startsWith('/admin')) {
    // Save the original URL (including query params) to return after login
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', returnTo);
    
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
