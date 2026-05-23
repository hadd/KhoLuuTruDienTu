import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios'
import axios from 'axios'
import { toast } from 'sonner'

import {
  authStore,
  getAccessToken,
  getRefreshToken,
} from '@/features/auth/store'
import type { LoginResponseT } from '@/features/auth/types'
import { isTokenExpired } from '@/features/auth/utils'
import { env } from '@/lib/utils/env'

// Custom error class for authentication failures
// This allows error components to detect auth errors and redirect to login
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

// Raw instance for auth calls and base config
const axiosInstance = axios.create({
  baseURL: env.API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// When body is FormData, remove Content-Type so axios sends multipart/form-data with boundary
axiosInstance.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.transformRequest = [
      (data, headers) => {
        delete headers['Content-Type']
        return data
      },
    ]
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

// Helper to detect network/CORS errors
const isNetworkError = (error: AxiosError): boolean => {
  // Network errors have no response
  if (!error.response) {
    return true
  }
  // CORS errors typically have status 0 or no status
  if (error.response.status === 0) {
    return true
  }
  return false
}

// Internal refresh logic using raw axios instance
const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    const refreshTokenValue = getRefreshToken()
    if (!refreshTokenValue) {
      authStore.reset()
      return null
    }

    refreshPromise = (async () => {
      try {
        // Direct call to avoid circular dependency with authClient or using the wrapper
        const response = await axiosInstance.post<LoginResponseT>(
          '/api/auth/refresh',
          {
            refreshToken: refreshTokenValue,
          },
        )
        const result = response.data

        authStore.setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        })

        return result.accessToken
      } catch (error: any) {
        const axiosError = error as AxiosError

        // Don't clear auth state on network/CORS errors
        // Only clear on actual authentication failures (401, 403, etc.)
        if (isNetworkError(axiosError)) {
          // Network error - don't reset auth, just return null
          return null
        }

        // Actual auth failure - reset auth state
        authStore.reset()
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }

  return refreshPromise
}

/** Request config; may include internal flags (e.g. opt-out of global error toast when caller shows its own). */
export type RequestConfig = AxiosRequestConfig & {
  _retry?: boolean
  _skipGlobalErrorToast?: boolean
}

// Wrapper function
const request = async <T>(config: RequestConfig): Promise<AxiosResponse<T>> => {
  let token = getAccessToken()

  // 1. Check expiry before request
  // BUT: Skip refresh if we're in a network error scenario
  // We'll handle token refresh only on actual 401 responses
  if (token && isTokenExpired(token)) {
    token = await refreshAccessToken()
    // If refresh failed due to network error, keep the old token
    // and let the request proceed - we'll handle 401 if it comes
  }

  // 2. Attach token
  if (token) {
    const headers = (config.headers ?? {}) as AxiosRequestHeaders &
      Record<string, string>
    headers.Authorization = `Bearer ${token}`
    config.headers = headers
  }

  try {
    return await axiosInstance(config)
  } catch (error: any) {
    const axiosError = error as AxiosError

    // Early exit for network/CORS errors - don't try to refresh
    if (isNetworkError(axiosError)) {
      if (!config._skipGlobalErrorToast) {
        toast.error('Kết nối mạng không ổn định')
      }
      throw new Error('Network error. Please check your connection.')
    }

    // 3. Handle 401 -> Refresh -> Retry
    if (axiosError.response?.status === 401 && !config._retry) {
      config._retry = true
      const newToken = await refreshAccessToken()

      if (newToken) {
        const headers = (config.headers ?? {}) as AxiosRequestHeaders &
          Record<string, string>
        headers.Authorization = `Bearer ${newToken}`
        config.headers = headers
        return axiosInstance(config)
      }

      // Refresh failed - clear auth state
      // We know we have a 401 response (checked above), so this is an actual auth failure
      authStore.reset()
      // Throw AuthenticationError to allow error components to detect and redirect
      throw new AuthenticationError(
        'Authentication failed. Please login again.',
      )
    }

    // 4. Handle different error types with toast notifications
    const status = axiosError.response?.status
    const responseData = axiosError.response?.data as
      | { message?: string }
      | undefined

    // Handle 403 - Access Denied
    if (status === 403) {
      if (!config._skipGlobalErrorToast) {
        toast.error(responseData?.message || 'Access Denied')
      }
      throw new Error(responseData?.message || 'Access Denied')
    }

    // Handle 5xx - Server Errors
    if (status && status >= 500) {
      if (!config._skipGlobalErrorToast) {
        toast.error('Hệ thống đang bảo trì, vui lòng thử lại')
      }
      throw new Error(
        responseData?.message || 'Server error. Please try again.',
      )
    }

    // 5. Standardize error message for other cases
    // const message =
    //   responseData?.message ||
    //   axiosError.message ||
    //   'Unexpected error. Please try again.'


    // throw new Error(message)
    throw axiosError
  }
}

// Export apiClient object mimicking axios methods
export const apiClient = {
  get: <T>(url: string, config?: RequestConfig) =>
    request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  /** POST with FormData; Content-Type is set to multipart/form-data by axios. */
  postForm: <T>(url: string, formData: FormData, config?: RequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data: formData }),
  put: <T>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  delete: <T>(url: string, config?: RequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),
  patch: <T>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
}
