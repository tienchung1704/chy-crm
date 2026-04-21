import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('crm_access_token')?.value;

  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  let url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (options.params) {
    const queryParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { message: 'An unknown error occurred' };
    }
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T>(endpoint: string, body?: any, options?: ApiOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  
  patch: <T>(endpoint: string, body?: any, options?: ApiOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  
  delete: <T>(endpoint: string, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
