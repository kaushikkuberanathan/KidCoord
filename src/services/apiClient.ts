/**
 * API Client
 * HTTP service layer for KidCoord backend
 */

import { ApiResponse } from '@/types/api';
import { useAppStore } from '@/store/appStore';
import { generateIdempotencyKey } from '@/utils/idempotency';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.kidcoord.com/api';

const API_TIMEOUT = 10000; // 10 seconds

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = useAppStore.getState().token;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error?.code || 'UNKNOWN_ERROR',
            message: data.error?.message || 'An error occurred',
            details: data.error?.details,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: data.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Request timed out',
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network error occurred',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, idempotencyKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Idempotency-Key': idempotencyKey ?? generateIdempotencyKey(),
      },
    });
  }

  async put<T>(endpoint: string, body?: any, idempotencyKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Idempotency-Key': idempotencyKey ?? generateIdempotencyKey(),
      },
    });
  }

  async patch<T>(endpoint: string, body?: any, idempotencyKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Idempotency-Key': idempotencyKey ?? generateIdempotencyKey(),
      },
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL, API_TIMEOUT);

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

export function handleApiError(response: ApiResponse<any>): string {
  if (response.error) {
    switch (response.error.code) {
      case 'UNAUTHORIZED':
        return 'Please log in again';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action';
      case 'NOT_FOUND':
        return 'The requested resource was not found';
      case 'TIMEOUT':
        return 'Request timed out. Please try again';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection';
      default:
        return response.error.message || 'An error occurred';
    }
  }
  return 'An unknown error occurred';
}

export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success && response.data !== undefined;
}
