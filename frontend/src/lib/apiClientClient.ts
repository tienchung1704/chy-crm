'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export const apiClientClient = {
  async fetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    let url = `${API_URL}${endpoint}`;
    
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

    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include', // Important for cookies
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API Error');
    }

    return data as T;
  },

  get<T>(endpoint: string, options: ApiOptions = {}) {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body: any, options: ApiOptions = {}) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch<T>(endpoint: string, body: any, options: ApiOptions = {}) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  put<T>(endpoint: string, body: any, options: ApiOptions = {}) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string, options: ApiOptions = {}) {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
