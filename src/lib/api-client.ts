/**
 * API Client with Auto-Refresh Token Interceptor
 * 
 * Automatically refreshes access token when receiving 401 errors
 * Prevents multiple simultaneous refresh requests
 */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token cookie
 */
async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Important: send cookies
      });

      if (response.ok) {
        return true;
      }

      // Refresh failed - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login?session_expired=1';
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (typeof window !== 'undefined') {
        window.location.href = '/login?error=refresh_failed';
      }
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Enhanced fetch with automatic token refresh on 401
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // Ensure credentials are included for cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // First attempt
  let response = await fetch(url, fetchOptions);

  // If 401, try to refresh token and retry once
  if (response.status === 401 && !url.includes('/api/auth/refresh')) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry the original request with new token
      response = await fetch(url, fetchOptions);
    } else {
      throw new Error('Session expired');
    }
  }

  // Handle non-OK responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(url: string, options?: RequestInit) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options?: RequestInit) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(url: string, data?: any, options?: RequestInit) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(url: string, options?: RequestInit) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
