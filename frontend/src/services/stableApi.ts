import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
}

interface RequestConfig extends AxiosRequestConfig {
  retry?: RetryConfig;
  skipErrorToast?: boolean;
  timeout?: number;
}

/**
 * Stable API service with retry logic, timeout handling, and circuit breaker
 */
class StableApiService {
  private client: AxiosInstance;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private failureCount: Map<string, number> = new Map();
  private circuitBreakerOpen: Map<string, boolean> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 15000, // 15 second default timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        // Add timestamp
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log response time in development
        if (import.meta.env.MODE === 'development' && response.config.metadata) {
          const duration = Date.now() - response.config.metadata.startTime;
          console.log(`API call to ${response.config.url} took ${duration}ms`);
        }

        // Reset failure count on success
        const endpoint = this.getEndpointKey(response.config.url || '');
        this.failureCount.set(endpoint, 0);
        
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Handle network errors
        if (!error.response) {
          this.handleNetworkError(error);
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Try to refresh token
          try {
            await this.refreshToken();
            return this.client(originalRequest);
          } catch (refreshError) {
            // Redirect to login
            this.handleAuthError();
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors with retry logic
        if (this.shouldRetry(error, originalRequest)) {
          return this.retryRequest(originalRequest, error);
        }

        // Show error toast unless disabled
        if (!originalRequest.skipErrorToast) {
          this.showErrorToast(error);
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: AxiosError, config: RequestConfig): boolean {
    // Check custom retry condition
    if (config.retry?.retryCondition) {
      return config.retry.retryCondition(error);
    }

    // Default retry conditions
    const status = error.response?.status;
    return (
      (status === 408 || // Request Timeout
      status === 429 || // Too Many Requests
      status === 500 || // Internal Server Error
      status === 502 || // Bad Gateway
      status === 503 || // Service Unavailable
      status === 504) && // Gateway Timeout
      (!config._retryCount || config._retryCount < (config.retry?.retries || 3))
    );
  }

  private async retryRequest(config: RequestConfig, error: AxiosError): Promise<any> {
    config._retryCount = (config._retryCount || 0) + 1;
    
    const retryDelay = config.retry?.retryDelay || this.calculateBackoff(config._retryCount);
    
    console.log(`Retrying request (attempt ${config._retryCount}) after ${retryDelay}ms`);
    
    await this.delay(retryDelay);
    
    return this.client(config);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEndpointKey(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  private handleNetworkError(error: AxiosError) {
    console.error('Network error:', error.message);
    
    // Check if offline
    if (!navigator.onLine) {
      toast.error('You appear to be offline. Please check your connection.');
    } else {
      toast.error('Network error. Please check your connection and try again.');
    }
  }

  private handleAuthError() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  private showErrorToast(error: AxiosError) {
    const message = error.response?.data?.message || 
                   error.response?.data?.error || 
                   'An error occurred. Please try again.';
    toast.error(message);
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.client.post('/api/auth/refresh', {
      refreshToken
    });

    const { token } = response.data;
    localStorage.setItem('token', token);
  }

  // Circuit breaker implementation
  private isCircuitOpen(endpoint: string): boolean {
    return this.circuitBreakerOpen.get(endpoint) || false;
  }

  private openCircuit(endpoint: string) {
    console.warn(`Circuit breaker opened for ${endpoint}`);
    this.circuitBreakerOpen.set(endpoint, true);
    
    // Auto-close after timeout
    setTimeout(() => {
      console.log(`Circuit breaker closed for ${endpoint}`);
      this.circuitBreakerOpen.set(endpoint, false);
      this.failureCount.set(endpoint, 0);
    }, this.CIRCUIT_BREAKER_TIMEOUT);
  }

  private trackFailure(endpoint: string) {
    const count = (this.failureCount.get(endpoint) || 0) + 1;
    this.failureCount.set(endpoint, count);
    
    if (count >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuit(endpoint);
    }
  }

  // Request deduplication
  private async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in progress
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key) as Promise<T>;
    }

    // Start new request
    const promise = requestFn().finally(() => {
      this.requestQueue.delete(key);
    });

    this.requestQueue.set(key, promise);
    return promise;
  }

  // Public API methods with stability features
  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    const endpoint = this.getEndpointKey(url);
    
    // Check circuit breaker
    if (this.isCircuitOpen(endpoint)) {
      throw new Error(`Service temporarily unavailable: ${endpoint}`);
    }

    try {
      const response = await this.deduplicateRequest(
        `GET:${url}`,
        () => this.client.get<T>(url, config)
      );
      return response.data;
    } catch (error) {
      this.trackFailure(endpoint);
      throw error;
    }
  }

  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const endpoint = this.getEndpointKey(url);
    
    if (this.isCircuitOpen(endpoint)) {
      throw new Error(`Service temporarily unavailable: ${endpoint}`);
    }

    try {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.trackFailure(endpoint);
      throw error;
    }
  }

  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const endpoint = this.getEndpointKey(url);
    
    if (this.isCircuitOpen(endpoint)) {
      throw new Error(`Service temporarily unavailable: ${endpoint}`);
    }

    try {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.trackFailure(endpoint);
      throw error;
    }
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    const endpoint = this.getEndpointKey(url);
    
    if (this.isCircuitOpen(endpoint)) {
      throw new Error(`Service temporarily unavailable: ${endpoint}`);
    }

    try {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error) {
      this.trackFailure(endpoint);
      throw error;
    }
  }

  // Batch requests
  async batch<T = any>(requests: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(requests.map(req => req().catch(err => err)));
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', { 
        timeout: 5000,
        skipErrorToast: true 
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const stableApi = new StableApiService();
export default stableApi;