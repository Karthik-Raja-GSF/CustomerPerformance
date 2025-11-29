/**
 * API Client
 *
 * Centralized HTTP client with error handling, type safety, and authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8887';
// Use ID token for API calls - backend verifies Cognito ID tokens
const TOKEN_KEY = 'id_token';
const MAX_REFRESH_RETRIES = 1;

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  skipAuth?: boolean;
}

type RefreshTokenCallback = () => Promise<void>;

class ApiClient {
  private baseUrl: string;
  private refreshTokenCallback: RefreshTokenCallback | null = null;
  private isRefreshing = false;
  private refreshAttempts = 0;
  private failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set callback for token refresh
   */
  setRefreshTokenCallback(callback: RefreshTokenCallback) {
    this.refreshTokenCallback = callback;
  }

  /**
   * Process failed requests queue after token refresh
   */
  private processQueue(error: Error | null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve();
      }
    });

    this.failedQueue = [];
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, skipAuth, ...fetchConfig } = config;

    // Build URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    // Set default headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Add authorization header if token exists and not skipped
    if (!skipAuth) {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        headers,
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      // Handle 401 Unauthorized - attempt token refresh (with retry limit)
      if (response.status === 401 && !skipAuth && this.refreshTokenCallback) {
        // Check if we've exceeded max refresh attempts
        if (this.refreshAttempts >= MAX_REFRESH_RETRIES) {
          this.refreshAttempts = 0;
          throw new ApiError(401, 'Session expired. Please log in again.');
        }

        // If already refreshing, queue this request
        if (this.isRefreshing) {
          return new Promise((resolve, reject) => {
            this.failedQueue.push({ resolve, reject });
          }).then(() => {
            // Retry the request after token refresh
            return this.request<T>(endpoint, config);
          });
        }

        this.isRefreshing = true;
        this.refreshAttempts++;

        try {
          // Attempt to refresh token
          await this.refreshTokenCallback();

          // Process queued requests
          this.processQueue(null);

          // Retry the original request with new token
          return this.request<T>(endpoint, config);
        } catch (refreshError) {
          // Token refresh failed, reject all queued requests
          this.processQueue(refreshError as Error);
          this.refreshAttempts = 0;
          throw new ApiError(401, 'Session expired. Please log in again.');
        } finally {
          this.isRefreshing = false;
        }
      }

      // Reset refresh attempts on successful response
      if (response.ok) {
        this.refreshAttempts = 0;
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData: unknown = undefined;

        if (isJson) {
          try {
            errorData = await response.json();
            if (errorData && typeof errorData === 'object' && 'message' in errorData) {
              errorMessage = (errorData as { message: string }).message;
            }
          } catch {
            // If JSON parsing fails, use default error message
          }
        }

        throw new ApiError(response.status, errorMessage, errorData);
      }

      // Parse successful response
      if (isJson) {
        return await response.json();
      }

      // For non-JSON responses, return empty object
      return {} as T;
    } catch (error) {
      // Re-throw ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Network errors or other fetch errors
      if (error instanceof Error) {
        throw new ApiError(0, `Network error: ${error.message}`);
      }

      // Unknown errors
      throw new ApiError(0, 'An unknown error occurred');
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
